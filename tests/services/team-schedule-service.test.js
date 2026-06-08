const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const TimeUtils = require('../../src/js/services/time-utils');

globalThis.YEAR = 2026;
globalThis.TimeUtils = TimeUtils;
const { TeamScheduleService } = require('../../src/js/services/team-schedule-service');

describe('TeamScheduleService', () => {
  describe('parseWeekdays', () => {
    it('should expand published weekday ranges and lists', () => {
      assert.deepEqual(TeamScheduleService.parseWeekdays('Tuesday - Friday'), ['Tuesday', 'Wednesday', 'Thursday', 'Friday']);
      assert.deepEqual(TeamScheduleService.parseWeekdays('Monday & Wednesday'), ['Monday', 'Wednesday']);
    });

    it('returns no weekdays for non-text or unrecognized descriptions', () => {
      assert.deepEqual(TeamScheduleService.parseWeekdays(null), []);
      assert.deepEqual(TeamScheduleService.parseWeekdays('Pool closed'), []);
      assert.deepEqual(TeamScheduleService.parseWeekdays('Monday through Friday'), ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']);
    });
  });

  describe('parseSeasonRange', () => {
    it('accepts valid ranges and rejects absent, malformed, invalid, or reversed ranges', () => {
      assert.equal(TeamScheduleService.parseSeasonRange(null), null);
      assert.equal(TeamScheduleService.parseSeasonRange('May 1 - May 2', null), null);
      assert.equal(TeamScheduleService.parseSeasonRange('May 1'), null);
      assert.equal(TeamScheduleService.parseSeasonRange('May 1 - May 2', 'not-a-year'), null);
      assert.equal(TeamScheduleService.parseSeasonRange('May 2 - May 1'), null);
      const range = TeamScheduleService.parseSeasonRange('May 1 - May 2');
      assert.equal(range.startDate.getDate(), 1);
      assert.equal(range.endDate.getDate(), 2);
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

    it('returns no validation errors for absent or complete practice data', () => {
      assert.deepEqual(TeamScheduleService.getValidationErrors(null), []);
      assert.deepEqual(TeamScheduleService.getValidationErrors({
        preseason: [{ period: 'May 26 - May 29', days: 'Tuesday - Friday' }],
        regular: { season: 'June 19 - July 24', morning: [{ days: 'Monday' }], evening: [{ day: 'Friday' }] }
      }), []);
    });
  });

  describe('getPracticePatterns', () => {
    it('skips invalid ranges and supplies empty session collections where omitted', () => {
      assert.deepEqual(TeamScheduleService.getPracticePatterns(null), []);
      assert.deepEqual(TeamScheduleService.getPracticePatterns({ preseason: [{ period: 'bad', days: 'Monday' }] }), []);
      assert.deepEqual(TeamScheduleService.getPracticePatterns({ regular: { season: 'bad', morning: [{ days: 'Monday' }] } }), []);
      const patterns = TeamScheduleService.getPracticePatterns({
        preseason: [{ period: 'May 26 - May 29', days: 'Tuesday', location: 'A' }],
        regular: { season: 'June 19 - July 24', morning: [{ days: 'Monday', location: 'B' }], evening: [{ day: 'Friday', location: 'C' }] }
      });
      assert.equal(patterns.length, 3);
      assert.deepEqual(patterns.map(pattern => pattern.sessions), [[], [], []]);
      assert.deepEqual(patterns.map(pattern => pattern.practicePeriod), ['other', 'morning', 'evening']);
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
      assert.equal(firstWeek[0].practicePeriod, 'evening');

      const regularWeek = TeamScheduleService.getUpcomingPractices(practice, new Date('2026-06-22T12:00:00'), 5);
      assert.equal(regularWeek.length, 5);
      assert.equal(regularWeek[0].location, "Clary's Forest Pool");
      assert.equal(regularWeek[0].practicePeriod, 'evening');
      assert.equal(regularWeek[1].label, 'Morning Practice');
      assert.equal(regularWeek[1].practicePeriod, 'morning');
    });
  });

  describe('getPracticePeriod', () => {
    it('classifies valid session ranges before agenda rendering and returns other for mixed or malformed sessions', () => {
      assert.equal(TeamScheduleService.getPracticePeriod([{ time: '8:00 - 9:00am' }], TimeUtils), 'morning');
      assert.equal(TeamScheduleService.getPracticePeriod([{ time: '5:00 - 6:00pm' }], TimeUtils), 'evening');
      assert.equal(TeamScheduleService.getPracticePeriod([{ time: '11:30am - 12:30pm' }], TimeUtils), 'other');
      assert.equal(TeamScheduleService.getPracticePeriod([{ time: 'Noon' }], TimeUtils), 'other');
      assert.equal(TeamScheduleService.getPracticePeriod([], TimeUtils), 'other');
    });
  });

  describe('getDetailedPracticeTeamNames', () => {
    const teams = [{
      name: 'Morning Team',
      shortName: 'Morning',
      practice: { regular: { season: 'June 19 - July 24', morning: [{ days: 'Tuesday', location: 'Shared Pool', sessions: [{ time: '8:00 - 10:00am' }] }] } }
    }, {
      name: 'Evening Team',
      shortName: 'Evening',
      practice: { regular: { season: 'June 19 - July 24', evening: [{ day: 'Tuesday', location: 'Shared Pool', sessions: [{ time: '5:00 - 6:30pm' }] }] } }
    }, {
      name: 'Second Evening Team',
      practice: { regular: { season: 'June 19 - July 24', evening: [{ day: 'Tuesday', location: 'Shared Pool', sessions: [{ time: '6:00 - 7:00pm' }] }] } }
    }];

    it('returns short team names for matching detailed practices with a full-name fallback', () => {
      const slot = { startTime: '5:00pm', endTime: '8:00pm' };
      assert.deepEqual(
        TeamScheduleService.getDetailedPracticeTeamNames(teams, 'Shared', new Date('2026-06-23T12:00:00'), slot, TimeUtils),
        ['Evening', 'Second Evening Team']
      );
      assert.deepEqual(
        TeamScheduleService.getDetailedPracticeTeamNames(teams, 'Shared', new Date('2026-06-24T12:00:00'), slot, TimeUtils),
        []
      );
    });

    it('parses inherited meridiem session ranges and rejects invalid or reversed ranges', () => {
      assert.deepEqual(TeamScheduleService.getTimeRange('5:00 - 6:30pm', TimeUtils), { start: 1020, end: 1110 });
      assert.equal(TeamScheduleService.getTimeRange('bad', TimeUtils), null);
      assert.equal(TeamScheduleService.getTimeRange('8:00pm - 7:00pm', TimeUtils), null);
      assert.equal(TeamScheduleService.getTimeRange('5:00pm - 6:30pm', { timeStringToMinutes: () => { throw new Error('Invalid time'); } }), null);
    });
  });

  describe('getCurrentPracticePhase', () => {
    const practice = {
      preseason: [
        { period: 'May 26 - May 29' },
        { period: 'June 15 - June 18' }
      ],
      regular: { season: 'June 19 - July 24' }
    };

    it('should highlight pre-season only while inside a published pre-season period', () => {
      assert.equal(TeamScheduleService.getCurrentPracticePhase(practice, new Date('2026-05-20T12:00:00')), null);
      assert.equal(TeamScheduleService.getCurrentPracticePhase(practice, new Date('2026-06-01T12:00:00')), null);
      assert.equal(TeamScheduleService.getCurrentPracticePhase(practice, new Date('2026-06-18T12:00:00')), 'preseason');
    });

    it('should highlight in-season practices after pre-season until the season ends', () => {
      assert.equal(TeamScheduleService.getCurrentPracticePhase(practice, new Date('2026-06-19T12:00:00')), 'regular');
      assert.equal(TeamScheduleService.getCurrentPracticePhase(practice, new Date('2026-07-24T12:00:00')), 'regular');
    });

    it('should not highlight either practice phase after in-season practices end', () => {
      assert.equal(TeamScheduleService.getCurrentPracticePhase(practice, new Date('2026-07-25T12:00:00')), null);
      assert.equal(TeamScheduleService.getCurrentPracticePhase(null, new Date('2026-07-25T12:00:00')), null);
      assert.equal(TeamScheduleService.getCurrentPracticePhase({}, new Date('2026-07-25T12:00:00')), null);
    });
  });

  describe('isCurrentPracticeRange', () => {
    it('should identify only the date range containing the reference date', () => {
      assert.equal(TeamScheduleService.isCurrentPracticeRange('May 26 - May 29', new Date('2026-05-28T12:00:00')), true);
      assert.equal(TeamScheduleService.isCurrentPracticeRange('June 1 - June 18', new Date('2026-05-28T12:00:00')), false);
      assert.equal(TeamScheduleService.isCurrentPracticeRange('Invalid', new Date('2026-05-28T12:00:00')), false);
    });
  });

  describe('getPracticeRangeStatus', () => {
    it('should distinguish past, current, and upcoming ranges', () => {
      const range = 'June 15 - June 18';

      assert.equal(TeamScheduleService.getPracticeRangeStatus(range, new Date('2026-06-08T12:00:00')), 'upcoming');
      assert.equal(TeamScheduleService.getPracticeRangeStatus(range, new Date('2026-06-15T12:00:00')), 'current');
      assert.equal(TeamScheduleService.getPracticeRangeStatus(range, new Date('2026-06-19T12:00:00')), 'past');
      assert.equal(TeamScheduleService.getPracticeRangeStatus('Invalid', new Date('2026-06-08T12:00:00')), null);
    });
  });

  describe('browser registration', () => {
    it('should install the service as a browser script global', () => {
      const sourcePath = path.join(__dirname, '..', '..', 'src', 'js', 'services', 'team-schedule-service.js');
      const source = fs.readFileSync(sourcePath, 'utf8');
      const context = { window: {} };
      vm.runInNewContext(source, context, { filename: sourcePath });

      assert.equal(typeof context.window.TeamScheduleService, 'function');
    });
  });
});
