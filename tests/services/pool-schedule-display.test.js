const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
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

    it('renders a calendar with the current day and activity color categories', () => {
      const html = PoolScheduleDisplay.render(weekSchedule, { ...options, layout: 'calendar' });

      assert.match(html, /schedule-calendar/);
      assert.match(html, /schedule-calendar__day is-today/);
      assert.match(html, /aria-label="Wed June 17"/);
      assert.match(html, />Today</);
      assert.match(html, /schedule-activity--public/);
      assert.match(html, /schedule-activity--restricted/);
    });
  });

  describe('getActivityCategory', () => {
    it('categorizes operating activities for calendar tinting', () => {
      assert.equal(PoolScheduleDisplay.getActivityCategory('Aqua Fitness'), 'program');
      assert.equal(PoolScheduleDisplay.getActivityCategory('CNSL Practice Only'), 'team');
      assert.equal(PoolScheduleDisplay.getActivityCategory('Swim Meet'), 'event');
      assert.equal(PoolScheduleDisplay.getActivityCategory('Closed to Public'), 'restricted');
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
    });
  });
});
