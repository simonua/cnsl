const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const PoolScheduleDisplay = require('../../src/js/services/pool-schedule-display.js');

const timeUtils = {
  formatActivityTypes: activities => activities.join(', '),
  formatTimeRangeWithHighlight: timeRange => `<span class="time-range-container">${timeRange}</span>`
};

const weekSchedule = [{
  day: 'Wed',
  timeSlots: [{ startTime: '12:00pm', endTime: '7:00pm', activities: ['Laps', 'Rec Swim'], notes: '' }],
  hasOverrides: false
}, {
  day: 'Thu',
  timeSlots: [{ startTime: '4:00pm', endTime: '7:00pm', activities: ['Closed to Public'], notes: '' }],
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
  });

  describe('getActivityCategory', () => {
    it('categorizes operating activities for calendar tinting', () => {
      assert.equal(PoolScheduleDisplay.getActivityCategory('Aqua Fitness'), 'program');
      assert.equal(PoolScheduleDisplay.getActivityCategory('CNSL Practice Only'), 'team');
      assert.equal(PoolScheduleDisplay.getActivityCategory('Swim Meet'), 'event');
      assert.equal(PoolScheduleDisplay.getActivityCategory('Closed to Public'), 'restricted');
      assert.equal(PoolScheduleDisplay.getActivityCategory('Rec Swim'), 'public');
      assert.equal(PoolScheduleDisplay.getActivityCategory('Rec Swim', { isOverride: true }), 'event');
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
    it('renders notes and override activity styling only when requested', () => {
      const day = { isCurrentDay: false };
      const slot = { startTime: '1:00PM', endTime: '2:00PM', activities: ['Swim Meet'], notes: '<note>', isOverride: true };
      const colored = PoolScheduleDisplay.renderSlot(slot, day, options, true);
      const plain = PoolScheduleDisplay.renderSlot(slot, day, options, false);
      assert.match(colored, /schedule-activity--event override-slot/);
      assert.match(colored, /&lt;note&gt;/);
      assert.doesNotMatch(plain, /schedule-activity--event/);
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
