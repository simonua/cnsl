const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const PoolScheduleDisplay = require('../../src/js/services/pool-schedule-display.js');
const TimeUtils = require('../../src/js/services/time-utils.js');

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
      assert.match(html, /day-schedule is-today[^]*?<\/div><div class="time-slot"/);
      assert.doesNotMatch(html, /schedule-activity--public/);
    });

    it('renders closed and override-notice days safely', () => {
      const html = PoolScheduleDisplay.render([{
        day: 'Wed',
        timeSlots: [{ startTime: '1:00pm', endTime: '2:00pm', activities: [], notes: '' }],
        hasOverrides: true,
        overrideReason: '<Meet>'
      }], options);
      assert.match(html, /Closed/);
      assert.match(html, /Special schedule/);
      assert.match(html, /Special Schedule: &lt;Meet&gt;/);
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

      assert.match(html, /schedule-calendar__day is-today has-swim-meet[^]*?schedule-calendar__meet">Meet day/);
      assert.equal((html.match(/schedule-calendar__meet/g) || []).length, 1);
    });
  });

  describe('getActivityCategory', () => {
    it('categorizes operating slots from semantic access status rather than labels', () => {
      assert.equal(PoolScheduleDisplay.getActivityCategory({ accessStatus: 'public' }), 'public');
      assert.equal(PoolScheduleDisplay.getActivityCategory({ accessStatus: 'practice-only' }), 'team');
      assert.equal(PoolScheduleDisplay.getActivityCategory({ accessStatus: 'swim-meet' }), 'event');
      assert.equal(PoolScheduleDisplay.getActivityCategory({ accessStatus: 'closed-to-public' }), 'restricted');
      assert.equal(PoolScheduleDisplay.getActivityCategory({ accessStatus: 'public', activities: ['CNSL Practice Only'] }), 'public');
      assert.equal(PoolScheduleDisplay.getActivityCategory({ accessStatus: 'public', isOverride: true }), 'public');
    });
  });

  describe('getStatusTooltip', () => {
    it('maps semantic current status to explanatory copy independent of color', () => {
      assert.equal(PoolScheduleDisplay.getStatusTooltip('open'), 'Open for public use');
      assert.equal(PoolScheduleDisplay.getStatusTooltip('practice-only'), 'Special schedule or restrictions');
      assert.equal(PoolScheduleDisplay.getStatusTooltip('closed-to-public'), 'Currently closed');
      assert.equal(PoolScheduleDisplay.getStatusTooltip('schedule-not-found'), 'Schedule not available');
      assert.equal(PoolScheduleDisplay.getStatusTooltip('missing'), 'Status unknown');
    });
  });

  describe('formatPublicStatusTransition', () => {
    it('uses compact minute units for openings within an hour', () => {
      assert.equal(PoolScheduleDisplay.formatPublicStatusTransition({ action: 'opens', minutes: 1 }), 'Opens in 1 min');
      assert.equal(PoolScheduleDisplay.formatPublicStatusTransition({ action: 'opens', minutes: 59 }), 'Opens in 59 min');
    });

    it('uses compact hour and minute units for later openings today', () => {
      assert.equal(PoolScheduleDisplay.formatPublicStatusTransition({ action: 'opens', minutes: 60 }), 'Opens in 1 hr 0 min');
      assert.equal(PoolScheduleDisplay.formatPublicStatusTransition({ action: 'opens', minutes: 61 }), 'Opens in 1 hr 1 min');
      assert.equal(PoolScheduleDisplay.formatPublicStatusTransition({ action: 'opens', minutes: 122 }), 'Opens in 2 hr 2 min');
    });

    it('omits a countdown without a later same-day opening', () => {
      assert.equal(PoolScheduleDisplay.formatPublicStatusTransition(null), '');
      assert.equal(PoolScheduleDisplay.formatPublicStatusTransition({ action: 'opens', minutes: 0 }), '');
    });

    it('uses compact units for current-day closures', () => {
      assert.equal(PoolScheduleDisplay.formatPublicStatusTransition({ action: 'closes', minutes: 1 }), 'Closes in 1 min');
      assert.equal(PoolScheduleDisplay.formatPublicStatusTransition({ action: 'closes', minutes: 60 }), 'Closes in 1 hr 0 min');
      assert.equal(PoolScheduleDisplay.formatPublicStatusTransition({ action: 'closes', minutes: 122 }), 'Closes in 2 hr 2 min');
    });

    it('provides expanded units for an accessible label', () => {
      assert.equal(PoolScheduleDisplay.formatPublicStatusTransition({ action: 'closes', minutes: 121 }, { useLongUnits: true }), 'Closes in 2 hours 1 minute');
      assert.equal(PoolScheduleDisplay.formatPublicStatusTransition({ action: 'opens', minutes: 1 }, { useLongUnits: true }), 'Opens in 1 minute');
      assert.equal(PoolScheduleDisplay.formatPublicStatusTransition({ action: 'opens', minutes: 61 }, { useLongUnits: true }), 'Opens in 1 hour 1 minute');
    });

    it('omits a countdown without a current-day public closure', () => {
      assert.equal(PoolScheduleDisplay.formatPublicStatusTransition({ action: 'closed', minutes: 15 }), '');
    });
  });

  describe('getPublicStatusTransitionClass', () => {
    it('adds caution styling only for a closing transition within the next hour', () => {
      assert.equal(PoolScheduleDisplay.getPublicStatusTransitionClass({ action: 'closes', minutes: 59 }), 'pool-status-countdown pool-status-countdown--caution');
      assert.equal(PoolScheduleDisplay.getPublicStatusTransitionClass({ action: 'closes', minutes: 60 }), 'pool-status-countdown');
      assert.equal(PoolScheduleDisplay.getPublicStatusTransitionClass({ action: 'opens', minutes: 15 }), 'pool-status-countdown');
      assert.equal(PoolScheduleDisplay.getPublicStatusTransitionClass(null), 'pool-status-countdown');
      assert.equal(PoolScheduleDisplay.getPublicStatusTransitionClass({ action: 'closes', minutes: 0 }), 'pool-status-countdown');
    });
  });

  describe('slot rendering and browser registration', () => {
    it('formats highlighted ranges from semantic status without inline styles', () => {
      const highlighted = PoolScheduleDisplay.formatTimeRange('9:00AM-5:00PM', { timeUtils, currentMinutes: 600, forceHighlight: true, statusKind: 'open' });
      const invalid = PoolScheduleDisplay.formatTimeRange('<bad>', { timeUtils });
      assert.match(highlighted, /highlighted-time-slot-green/);
      assert.doesNotMatch(highlighted, /style=/);
      assert.match(invalid, /invalid/);
      assert.match(invalid, /&lt;bad&gt;/);
      assert.equal(PoolScheduleDisplay.getTimeRangeHighlightClass('practice-only'), ' highlighted-time-slot-yellow');
      assert.equal(PoolScheduleDisplay.getTimeRangeHighlightClass('closed'), ' highlighted-time-slot-red');
      assert.equal(PoolScheduleDisplay.getTimeRangeHighlightClass('missing'), '');
      assert.match(PoolScheduleDisplay.formatTimeRange('9:00AM-5:00PM', { timeUtils: { timeStringToMinutes: () => { throw new Error('bad clock'); } } }), /time-range-container error/);
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

    it('keeps public follow-on slots ordinary within a swim meet override', () => {
      const day = { isCurrentDay: false };
      const meetSlot = { startTime: '7:00AM', endTime: '12:00PM', activities: ['Swim Meet'], accessStatus: 'swim-meet', notes: '', isOverride: true };
      const publicSlot = { startTime: '12:00PM', endTime: '7:00PM', activities: ['Laps', 'Rec Swim'], accessStatus: 'public', notes: '', isOverride: true };

      assert.match(PoolScheduleDisplay.renderSlot(meetSlot, day, options, false), /class="time-slot override-slot"/);
      assert.doesNotMatch(PoolScheduleDisplay.renderSlot(publicSlot, day, options, false), /override-slot/);
    });

    it('renders resolved practice teams only for semantic practice slots', () => {
      const day = { isCurrentDay: false };
      const slot = { startTime: '5:00PM', endTime: '6:30PM', activities: ['Published Team Session'], accessStatus: 'practice-only', notes: '' };
      const named = PoolScheduleDisplay.renderSlot({ ...slot, practiceTeamNames: ['Long Reach <Marlins>', 'Second Team'] }, day, options, false);
      const misleadingLabel = PoolScheduleDisplay.renderSlot({ ...slot, activities: ['CNSL Practice Only'], accessStatus: 'public', practiceTeamNames: ['Hidden Team'] }, day, options, false);

      assert.match(named, /<span class="schedule-activity__label">Published Team Session<\/span><span class="schedule-activity__team-names">Long Reach &lt;Marlins&gt;, Second Team<\/span>/);
      assert.doesNotMatch(named, /<Marlins>/);
      assert.match(misleadingLabel, />CNSL Practice Only</);
      assert.doesNotMatch(misleadingLabel, /schedule-activity__team-names/);
    });

    it('installs the display service as a browser script global', () => {
      const sourcePath = path.join(__dirname, '..', '..', 'src', 'js', 'services', 'pool-schedule-display.js');
      const source = fs.readFileSync(sourcePath, 'utf8');
      const context = { window: {} };
      vm.runInNewContext(source, context, { filename: sourcePath });
      assert.equal(typeof context.window.PoolScheduleDisplay, 'function');
    });
  });
});
