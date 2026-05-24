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
  weekStart: new Date(2026, 4, 18),
  today: new Date(2026, 4, 20),
  timeUtils,
  poolStatus: { color: 'green' }
};

describe('PoolScheduleDisplay', () => {
  describe('render', () => {
    it('keeps list rendering as the uncolored default presentation', () => {
      const html = PoolScheduleDisplay.render(weekSchedule, options);

      assert.match(html, /pool-schedule-list/);
      assert.match(html, /day-schedule is-today/);
      assert.match(html, /day-schedule is-today[^]*?<\/div><div class="time-slot"/);
      assert.doesNotMatch(html, /schedule-activity--public/);
    });

    it('renders a calendar with the current day and activity color categories', () => {
      const html = PoolScheduleDisplay.render(weekSchedule, { ...options, layout: 'calendar' });

      assert.match(html, /schedule-calendar/);
      assert.match(html, /schedule-calendar__day is-today/);
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
});
