const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { PoolScheduleDisplay, TimeUtils } = require('../helpers/browser-module-loader.js').loadBrowserModule('pool-schedule-display');

const timeUtils = {
  formatActivityTypes: activities => activities.join(', '),
  getCurrentEasternTimeInfo: () => ({ isValid: true, minutes: 0 }),
  isCurrentTimeSlot: () => false,
  timeStringToMinutes: TimeUtils.timeStringToMinutes.bind(TimeUtils),
  MINUTES_PER_DAY: TimeUtils.MINUTES_PER_DAY
};

const weekSchedule = [{
  day: 'Wed',
  timeSlots: [{ startTime: '12:00pm', endTime: '7:00pm', activities: ['Laps', 'Rec Swim'], accessStatus: 'public', notes: '' }],
  hasOverrides: false
}, {
  day: 'Thu',
  timeSlots: [{ startTime: '4:00pm', endTime: '7:00pm', activities: ['Closed to Public'], accessStatus: 'closed-to-public', notes: '' }],
  hasOverrides: false
}];

const options = {
  weekStart: new Date(2026, 5, 15),
  today: new Date(2026, 5, 17),
  timeUtils,
  poolStatus: { color: 'green' }
};

describe('PoolScheduleDisplay', () => {
  describe('render', () => {
    it('keeps list rendering as the uncolored default presentation', () => {
      const html = PoolScheduleDisplay.render(weekSchedule, options);

      assert.match(html, /pool-schedule-list/);
      assert.match(html, /day-schedule is-today/);
      assert.match(html, /Wed \(June 17\)/);
      assert.match(html, /class="time-slot"/);
      assert.doesNotMatch(html, /schedule-activity--public/);
    });

    it('renders closed and override-notice days safely', () => {
      const html = PoolScheduleDisplay.render([{
        day: 'Wed',
        timeSlots: [{ startTime: '1:00pm', endTime: '2:00pm', activities: [], notes: '' }],
        hasOverrides: true,
        overrideReason: '<Meet>'
      }], options);
      assert.match(html, /override-notice">&lt;Meet&gt;/);
      assert.doesNotMatch(html, /<Meet>/);
      assert.doesNotMatch(html, /Special Schedule:/);
    });

    it('renders an untimed all-day closure without an invalid time range', () => {
      const html = PoolScheduleDisplay.render([{
        day: 'Wed',
        timeSlots: [{ activities: ['Closed to Public'], accessStatus: 'closed-to-public', notes: '', isOverride: true }],
        hasOverrides: true,
        overrideReason: 'Hosted meet closure'
      }], options);

      assert.match(html, /Closed to Public/);
      assert.doesNotMatch(html, /Invalid Time Range|undefined/);
    });

    it('creates a complete dated week with one matching current day', () => {
      const days = PoolScheduleDisplay.createDays(weekSchedule, options.weekStart, options.today);
      assert.equal(days.length, 7);
      assert.equal(days.filter(day => day.isCurrentDay).length, 1);
      assert.equal(days[2].schedule.day, 'Wed');
      assert.equal(PoolScheduleDisplay.isSameDate(options.today, new Date(2026, 5, 17, 23)), true);
    });

    it('renders a calendar with the current day and activity color categories', () => {
      const html = PoolScheduleDisplay.render(weekSchedule, { ...options, layout: 'calendar' });

      assert.match(html, /schedule-calendar/);
      assert.match(html, /schedule-calendar__day is-today/);
      assert.match(html, /aria-label="Wed June 17"/);
      assert.match(html, />Today</);
      assert.match(html, /schedule-activity--public/);
      assert.match(html, /schedule-activity--restricted/);
    });

    it('renders colored closed and overridden calendar days', () => {
      const html = PoolScheduleDisplay.render([{ day: 'Wed', timeSlots: [], hasOverrides: true }], { ...options, layout: 'calendar' });
      assert.match(html, /has-override/);
      assert.match(html, /schedule-activity--restricted/);
      assert.equal(PoolScheduleDisplay.isSameDate(options.today, new Date(2026, 5, 18)), false);
    });

    it('highlights calendar meet days from semantic access state rather than visible labels', () => {
      const html = PoolScheduleDisplay.render([{
        day: 'Wed',
        timeSlots: [{ startTime: '7:00am', endTime: '12:00pm', activities: ['Practice'], accessStatus: 'swim-meet' }]
      }, {
        day: 'Thu',
        timeSlots: [{ startTime: '7:00am', endTime: '12:00pm', activities: ['Swim Meet'], accessStatus: 'public' }]
      }], { ...options, layout: 'calendar' });

      assert.match(html, /schedule-calendar__day is-today has-swim-meet[^]*?schedule-calendar__meet/);
      assert.equal((html.match(/schedule-calendar__meet/g) || []).length, 1);
    });
  });

  describe('getActivityCategory', () => {
    it('categorizes operating slots from semantic access status rather than labels', () => {
      assert.equal(PoolScheduleDisplay.getActivityCategory({ accessStatus: 'public' }), 'public');
      assert.equal(PoolScheduleDisplay.getActivityCategory({ accessStatus: 'public', isSpecialEvent: true }), 'event');
      assert.equal(PoolScheduleDisplay.getActivityCategory({ accessStatus: 'swim-meet' }), 'event');
      assert.equal(PoolScheduleDisplay.getActivityCategory({ accessStatus: 'special-event' }), 'event');
      assert.equal(PoolScheduleDisplay.getActivityCategory({ accessStatus: 'practice-only' }), 'event');
      assert.equal(PoolScheduleDisplay.getActivityCategory({ accessStatus: 'closed-to-public' }), 'restricted');
      assert.equal(PoolScheduleDisplay.getActivityCategory({ accessStatus: 'public', activities: ['CNSL Practice Only'] }), 'public');
      assert.equal(PoolScheduleDisplay.getActivityCategory({ accessStatus: 'public', isOverride: true }), 'public');
    });
  });

  describe('slot rendering and browser registration', () => {
    it('formats highlighted ranges from semantic status without inline styles', () => {
      const highlighted = PoolScheduleDisplay.formatTimeRange('9:00AM-5:00PM', { timeUtils, currentMinutes: 600, forceHighlight: true, statusKind: 'open' });
      const invalid = PoolScheduleDisplay.formatTimeRange('<bad>', { timeUtils });
      assert.match(highlighted, /highlighted-time-slot-green/);
      assert.doesNotMatch(highlighted, /style=/);
      assert.match(invalid, /time-range-container invalid/);
      assert.match(invalid, /&lt;bad&gt;/);
      assert.equal(PoolScheduleDisplay.getTimeRangeHighlightClass('practice-only'), ' highlighted-time-slot-yellow');
      assert.equal(PoolScheduleDisplay.getTimeRangeHighlightClass('closed'), ' highlighted-time-slot-red');
      assert.equal(PoolScheduleDisplay.getTimeRangeHighlightClass('missing'), '');
      assert.match(PoolScheduleDisplay.formatTimeRange('9:00AM-5:00PM', { timeUtils: { timeStringToMinutes: () => { throw new Error('bad clock'); } } }), /time-range-container error/);
      assert.match(PoolScheduleDisplay.formatTimeRange(null), /time-range-container error/);
      assert.equal(PoolScheduleDisplay.formatTimeRange('   '), '');
      assert.match(PoolScheduleDisplay.formatTimeRange('9:00AM-5:00PM'), /time-range-container error/);
      assert.match(PoolScheduleDisplay.formatTimeRange('9:00AM-5:00PM', { timeUtils, currentMinutes: -1 }), /time-range-container error/);
      assert.match(PoolScheduleDisplay.formatTimeRange('9:00AM-5:00PM', {
        isCurrentDay: true,
        timeUtils: { ...timeUtils, getCurrentEasternTimeInfo: () => ({ isValid: false }) }
      }), /time-range-container/);
      assert.match(PoolScheduleDisplay.formatTimeRange('9:00AM-5:00PM', {
        currentMinutes: null,
        isCurrentDay: true,
        timeUtils
      }), /time-range-container/);
      assert.equal(PoolScheduleDisplay.formatPracticeTeamText('practice-only', null), '');
      assert.equal(PoolScheduleDisplay.getMeetHref({ meetDate: '2026-06-20' }), '');
    });

    it('renders notes and override activity styling only when requested', () => {
      const day = { isCurrentDay: false };
      const slot = { startTime: '1:00PM', endTime: '2:00PM', activities: ['Swim Meet'], accessStatus: 'swim-meet', notes: '<note>', isOverride: true };
      const colored = PoolScheduleDisplay.renderSlot(slot, day, options, true);
      const plain = PoolScheduleDisplay.renderSlot(slot, day, options, false);
      assert.match(colored, /schedule-activity--event override-slot/);
      assert.match(colored, /&lt;note&gt;/);
      assert.doesNotMatch(plain, /schedule-activity--event/);
    });

    it('renders distinct valid source updates below the week with affected weekdays', () => {
      const sourceUpdate = {
        sourceName: 'Official <Publisher>',
        updatedOn: '2026-06-24',
        note: 'Fixture <hours> for June 19-August 9.'
      };
      const html = PoolScheduleDisplay.render([{
        day: 'Wed',
        timeSlots: [{
          startTime: '1:00PM', endTime: '2:00PM', activities: ['Rec Swim'], accessStatus: 'public', sourceUpdate
        }, {
          startTime: '2:00PM', endTime: '3:00PM', activities: ['Laps'], accessStatus: 'public', sourceUpdate
        }]
      }, {
        day: 'Fri',
        timeSlots: [{
          startTime: '1:00PM', endTime: '2:00PM', activities: ['Rec Swim'], accessStatus: 'public', sourceUpdate
        }]
      }], { ...options, layout: 'calendar' });

      assert.equal((html.match(/class="schedule-activity__source-update"/g) || []).length, 1);
      assert.equal((html.match(/schedule-activity__footnote-marker/g) || []).length, 3);
      assert.match(html, /<sup class="schedule-activity__footnote-marker"><span aria-hidden="true">1<\/span><span class="visually-hidden"> \(schedule note 1\)<\/span><\/sup>/);
      assert.match(html, /<ol class="schedule-activity__footnotes" aria-label="Schedule notes"><li class="schedule-activity__source-update"><strong>Wednesday and Friday:<\/strong>/);
      assert.match(html, /Fixture &lt;hours&gt; for June 19-August 9\. Official &lt;Publisher&gt; data updated Jun 24, 2026\./);
      assert.ok(html.indexOf('schedule-activity__footnotes') > html.lastIndexOf('</section>'));
      assert.doesNotMatch(html, /<Publisher>|<hours>/);
      assert.equal(PoolScheduleDisplay.formatSourceUpdateHtml({
        ...sourceUpdate,
        sourceName: 'Columbia Association'
      }), 'Fixture &lt;hours&gt; for June 19-August 9. CA data updated Jun 24, 2026.');
      assert.equal(PoolScheduleDisplay.formatSourceUpdateHtml({
        ...sourceUpdate,
        sourceName: 'Columbia Neighborhood Swim League'
      }), 'Fixture &lt;hours&gt; for June 19-August 9. CNSL data updated Jun 24, 2026.');
      assert.equal(PoolScheduleDisplay.formatSourceUpdateHtml({ ...sourceUpdate, updatedOn: '2026-02-30' }), '');
      assert.equal(PoolScheduleDisplay.formatSourceUpdateHtml({ ...sourceUpdate, sourceName: '' }), '');
      assert.deepEqual(PoolScheduleDisplay.getSourceUpdateFootnotes(null), []);
      assert.equal(PoolScheduleDisplay.renderSourceUpdates(null), '');
    });

    it('keeps public follow-on slots ordinary within a swim meet override', () => {
      const day = { isCurrentDay: false };
      const meetSlot = { startTime: '7:00AM', endTime: '12:00PM', activities: ['Swim Meet'], accessStatus: 'swim-meet', notes: '', isOverride: true };
      const publicSlot = { startTime: '12:00PM', endTime: '7:00PM', activities: ['Laps', 'Rec Swim'], accessStatus: 'public', notes: '', isOverride: true };

      assert.match(PoolScheduleDisplay.renderSlot(meetSlot, day, options, false), /class="time-slot override-slot"/);
      assert.doesNotMatch(PoolScheduleDisplay.renderSlot(publicSlot, day, options, false), /override-slot/);
    });

    it('renders validated dual-meet links and highlighted public events without trusting malformed routes', () => {
      const day = { isCurrentDay: false };
      const linkedMeet = { startTime: '7:00AM', endTime: '12:00PM', activities: ['Swim Meet'], accessStatus: 'swim-meet', meetDate: '2026-06-20', meetPoolId: 'krp' };
      const poolParty = { startTime: '6:00PM', endTime: '8:30PM', activities: ['Pool Party'], accessStatus: 'public', isOverride: true, isSpecialEvent: true };

      assert.match(PoolScheduleDisplay.renderSlot(linkedMeet, day, options, true), /href="meets\.html\?date=2026-06-20&amp;pool=krp"/);
      assert.match(PoolScheduleDisplay.renderSlot(poolParty, day, options, true), /schedule-activity--event override-slot/);
      assert.equal(PoolScheduleDisplay.getMeetHref({ meetDate: 'bad', meetPoolId: 'krp' }), '');
      assert.equal(PoolScheduleDisplay.getMeetHref({ meetDate: '2026-06-20', meetPoolId: '<bad>' }), '');
    });

    it('renders safe official activity links and rejects unsafe destinations', () => {
      const day = { isCurrentDay: false };
      const slot = { startTime: '10:00AM', endTime: '10:55AM', activities: ['Aqua <Fitness>'], accessStatus: 'restricted', notes: '' };
      const linked = PoolScheduleDisplay.renderSlot({
        ...slot,
        sourceUrl: 'https://example.com/classes?type=aqua&view=details'
      }, day, options, true);
      const hostile = PoolScheduleDisplay.renderSlot({
        ...slot,
        sourceUrl: 'JaVaScRiPt:alert(1)'
      }, day, options, true);
      const malformed = PoolScheduleDisplay.renderSlot({ ...slot, sourceUrl: 'not a URL' }, day, options, true);

      assert.match(linked, /class="schedule-activity__link schedule-activity__source-link"/);
      assert.match(linked, /href="https:\/\/example\.com\/classes\?type=aqua&amp;view=details"/);
      assert.match(linked, /target="_blank" rel="noopener"/);
      assert.match(linked, /aria-label="Aqua &lt;Fitness&gt; official details \(opens in new tab\)"/);
      assert.match(linked, />Aqua &lt;Fitness&gt;<\/a>/);
      assert.doesNotMatch(hostile, /<a\b/i);
      assert.doesNotMatch(hostile, /javascript:/i);
      assert.doesNotMatch(malformed, /<a\b/i);
    });

    it('renders resolved practice teams only for semantic practice slots', () => {
      const day = { isCurrentDay: false };
      const slot = { startTime: '5:00PM', endTime: '6:30PM', activities: ['Published Team Session'], accessStatus: 'practice-only', notes: '' };
      const named = PoolScheduleDisplay.renderSlot({
        ...slot,
        practiceTeamNames: ['Long Reach <Marlins>', 'Second Team'],
        favoritePracticeTeamNames: ['Long Reach <Marlins>']
      }, day, options, false);
      const misleadingLabel = PoolScheduleDisplay.renderSlot({ ...slot, activities: ['CNSL Practice Only'], accessStatus: 'public', practiceTeamNames: ['Hidden Team'] }, day, options, false);

      assert.ok(named.indexOf('Long Reach &lt;Marlins&gt;') < named.indexOf('Second Team'));
      assert.match(named, /favorite-marker[^>]*role="img"[^>]*aria-label="[^"]+"/);
      assert.equal((named.match(/favorite-marker/g) || []).length, 1);
      assert.doesNotMatch(named, /<Marlins>/);
      assert.match(misleadingLabel, />CNSL Practice Only</);
      assert.doesNotMatch(misleadingLabel, /schedule-activity__team-names/);
    });

    it('normalizes absent and invalid practice-team collections', () => {
      assert.equal(PoolScheduleDisplay.formatPracticeTeamText('public', ['Hidden Team']), '');
      assert.equal(PoolScheduleDisplay.formatPracticeTeamText('practice-only', ['First Team', '', null]), 'First Team');
      assert.equal(PoolScheduleDisplay.formatPracticeTeamHtml('practice-only', null), '');
      assert.equal(PoolScheduleDisplay.formatPracticeTeamHtml('practice-only', ['', null]), '');
      assert.match(PoolScheduleDisplay.formatPracticeTeamHtml('practice-only', ['First Team'], null), /First Team/);
    });

    it('installs the display service as a browser script global', () => {
      const sourcePath = path.join(__dirname, '..', '..', 'src', 'js', 'services', 'pool-schedule-display.js');
      const source = fs.readFileSync(sourcePath, 'utf8');
      const context = { window: {} };
      Object.assign(context, context.globalThis || {}, context.window || {});
      context.globalThis = context; context.self = context; context.window = context;
      vm.runInNewContext(source, context, { filename: sourcePath });
      assert.equal(typeof context.window.PoolScheduleDisplay, 'function');
    });
  });
});
