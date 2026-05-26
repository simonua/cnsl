const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

globalThis.YEAR = 2026;
const { TeamScheduleService } = require('../../src/js/services/team-schedule-service');

describe('TeamScheduleService', () => {
  describe('parseWeekdays', () => {
    it('should expand published weekday ranges and lists', () => {
      assert.deepEqual(TeamScheduleService.parseWeekdays('Tuesday - Friday'), ['Tuesday', 'Wednesday', 'Thursday', 'Friday']);
      assert.deepEqual(TeamScheduleService.parseWeekdays('Monday & Wednesday'), ['Monday', 'Wednesday']);
    });
  });

  describe('getValidationErrors', () => {
    it('should reject practice recurrence values that cannot render schedule entries', () => {
      const errors = TeamScheduleService.getValidationErrors({
        preseason: [{ period: 'May 29 - May 26', days: 'Pool closed' }],
        regular: {
          season: 'Not a season',
          morning: [{ days: 'Weekdays' }],
          evening: [{ day: 'Later' }]
        }
      }, 2026);

      assert.deepEqual(errors, [
        'preseason entry 1 date range cannot be rendered: May 29 - May 26.',
        'preseason entry 1 weekdays cannot be rendered: Pool closed.',
        'regular season date range cannot be rendered: Not a season.',
        'regular morning entry 1 weekdays cannot be rendered: Weekdays.',
        'regular evening entry 1 weekdays cannot be rendered: Later.'
      ]);
    });
  });

  describe('getUpcomingPractices', () => {
    it('should combine pre-season and regular recurring practices in a seven-day window', () => {
      const practice = {
        preseason: [{
          period: 'May 26 - May 29',
          days: 'Tuesday - Friday',
          location: 'Hawthorn Pool',
          sessions: [{ time: '5:00 - 5:30pm', group: 'New Swimmers' }]
        }],
        regular: {
          season: 'June 19 - July 24',
          morning: [{
            days: 'Tuesday - Friday',
            location: 'Swansfield Pool',
            sessions: [{ time: '8:00 - 8:30am', group: '8 & Under' }]
          }],
          evening: [{
            day: 'Monday',
            location: "Clary's Forest Pool",
            sessions: [{ time: '5:00 - 5:45pm', group: '10 & Under' }]
          }]
        }
      };

      const firstWeek = TeamScheduleService.getUpcomingPractices(practice, new Date('2026-05-26T12:00:00'), 4);
      assert.equal(firstWeek.length, 4);
      assert.equal(firstWeek[0].label, 'Pre-season Practice');

      const regularWeek = TeamScheduleService.getUpcomingPractices(practice, new Date('2026-06-22T12:00:00'), 5);
      assert.equal(regularWeek.length, 5);
      assert.equal(regularWeek[0].location, "Clary's Forest Pool");
      assert.equal(regularWeek[1].label, 'Morning Practice');
    });
  });
});