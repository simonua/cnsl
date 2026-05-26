const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const TimeUtils = require('../../src/js/services/time-utils.js');
const { suppressConsole } = require('../helpers/test-helpers.js');

describe('TimeUtils', () => {
  describe('timeStringToMinutes', () => {
    it('converts AM times correctly', () => {
      assert.equal(TimeUtils.timeStringToMinutes('9:00AM'), 540);
      assert.equal(TimeUtils.timeStringToMinutes('9:30AM'), 570);
      assert.equal(TimeUtils.timeStringToMinutes('11:45AM'), 705);
    });

    it('converts PM times correctly', () => {
      assert.equal(TimeUtils.timeStringToMinutes('1:00PM'), 780);
      assert.equal(TimeUtils.timeStringToMinutes('2:30PM'), 870);
      assert.equal(TimeUtils.timeStringToMinutes('5:00PM'), 1020);
      assert.equal(TimeUtils.timeStringToMinutes('11:59PM'), 1439);
    });

    it('handles noon (12:00PM) correctly', () => {
      assert.equal(TimeUtils.timeStringToMinutes('12:00PM'), 720);
      assert.equal(TimeUtils.timeStringToMinutes('12:30PM'), 750);
    });

    it('handles midnight (12:00AM) correctly', () => {
      assert.equal(TimeUtils.timeStringToMinutes('12:00AM'), 0);
      assert.equal(TimeUtils.timeStringToMinutes('12:30AM'), 30);
    });

    it('handles lowercase am/pm', () => {
      assert.equal(TimeUtils.timeStringToMinutes('9:00am'), 540);
      assert.equal(TimeUtils.timeStringToMinutes('2:30pm'), 870);
    });

    it('throws for invalid input', () => {
      suppressConsole(() => {
        assert.throws(() => TimeUtils.timeStringToMinutes(null));
        assert.throws(() => TimeUtils.timeStringToMinutes(''));
        assert.throws(() => TimeUtils.timeStringToMinutes('invalid'));
      });
    });
  });

  describe('minutesToTimeString', () => {
    it('converts minutes to time strings', () => {
      assert.equal(TimeUtils.minutesToTimeString(540), '9:00am');
      assert.equal(TimeUtils.minutesToTimeString(870), '2:30pm');
      assert.equal(TimeUtils.minutesToTimeString(720), '12:00pm');
      assert.equal(TimeUtils.minutesToTimeString(0), '12:00am');
    });

    it('rounds trip with timeStringToMinutes', () => {
      const testCases = [
        { input: '9:00AM', expectedMinutes: 540 },
        { input: '12:00PM', expectedMinutes: 720 },
        { input: '12:00AM', expectedMinutes: 0 },
        { input: '5:30PM', expectedMinutes: 1050 },
        { input: '11:45AM', expectedMinutes: 705 }
      ];
      for (const { input, expectedMinutes } of testCases) {
        const minutes = TimeUtils.timeStringToMinutes(input);
        assert.equal(minutes, expectedMinutes);
        const result = TimeUtils.minutesToTimeString(minutes);
        assert.equal(result, input.toLowerCase());
      }
    });

    it('normalizes out-of-range values and safely handles invalid values', () => {
      suppressConsole(() => {
        assert.equal(TimeUtils.minutesToTimeString(-30), '11:30pm');
        assert.equal(TimeUtils.minutesToTimeString(1500), '1:00am');
        assert.equal(TimeUtils.minutesToTimeString('invalid'), '12:00am');
      });
    });
  });

  describe('formatActivityTypes', () => {
    it('normalizes strings and filters invalid array entries', () => {
      assert.equal(TimeUtils.formatActivityTypes('  Rec Swim  '), 'Rec Swim');
      assert.equal(TimeUtils.formatActivityTypes([' Laps ', '', null, 'Rec Swim']), 'Laps, Rec Swim');
      assert.equal(TimeUtils.formatActivityTypes(null), '');
    });
  });

  describe('getEasternTime', () => {
    it('returns a valid Date object', () => {
      const result = TimeUtils.getEasternTime();
      assert.ok(result instanceof Date);
    });
  });

  describe('parseDateOnly', () => {
    it('preserves the published weekday for ISO calendar dates', () => {
      const meetDate = TimeUtils.parseDateOnly('2026-06-13');

      assert.equal(meetDate.getDay(), 6);
      assert.equal(meetDate.toLocaleDateString('en-US', { weekday: 'long' }), 'Saturday');
    });

    it('rejects impossible calendar dates', () => {
      assert.throws(() => TimeUtils.parseDateOnly('2026-02-30'), /Invalid calendar date/);
    });
  });

  describe('getCurrentEasternTimeInfo', () => {
    it('returns expected structure', () => {
      const info = TimeUtils.getCurrentEasternTimeInfo();
      assert.ok(info.date);
      assert.ok(info.day);
      assert.equal(typeof info.minutes, 'number');
      assert.ok(info.timezone);
      assert.equal(typeof info.isValid, 'boolean');
      assert.ok(info.isValid);
    });

    it('minutes are within valid range', () => {
      const info = TimeUtils.getCurrentEasternTimeInfo();
      assert.ok(info.minutes >= 0);
      assert.ok(info.minutes < 1440);
    });
  });

  describe('isCurrentTimeSlot', () => {
    it('detects time within a normal range', () => {
      // 10:00AM is between 9:00AM and 5:00PM
      const result = suppressConsole(() => TimeUtils.isCurrentTimeSlot('9:00AM', '5:00PM', 600, true));
      assert.equal(result, true);
    });

    it('detects time outside a normal range', () => {
      // 3:00AM (180 min) is NOT between 9:00AM and 5:00PM
      const result = suppressConsole(() => TimeUtils.isCurrentTimeSlot('9:00AM', '5:00PM', 180, true));
      assert.equal(result, false);
    });

    it('handles overnight time slots', () => {
      // 1:00AM (60 min) IS between 11:00PM and 6:00AM
      const result = suppressConsole(() => TimeUtils.isCurrentTimeSlot('11:00PM', '6:00AM', 60, true));
      assert.equal(result, true);
    });

    it('does not highlight slots outside the current day or with invalid values', () => {
      suppressConsole(() => {
        assert.equal(TimeUtils.isCurrentTimeSlot('9:00AM', '5:00PM', 600, false), false);
        assert.equal(TimeUtils.isCurrentTimeSlot('bad', '5:00PM', 600, true), false);
        assert.equal(TimeUtils.isCurrentTimeSlot('9:00AM', '5:00PM', 2000, true), false);
      });
    });
  });

  describe('hasCurrentTimeSlot', () => {
    it('skips malformed slots and identifies an active published slot', () => {
      const originalGetCurrentEasternTimeInfo = TimeUtils.getCurrentEasternTimeInfo;
      TimeUtils.getCurrentEasternTimeInfo = () => ({ isValid: true, minutes: 600 });

      try {
        const result = suppressConsole(() => TimeUtils.hasCurrentTimeSlot([
          null,
          { startTime: '9:00AM' },
          { startTime: '9:00AM', endTime: '11:00AM' }
        ], true));
        assert.equal(result, true);
        assert.equal(TimeUtils.hasCurrentTimeSlot([], true), false);
      } finally {
        TimeUtils.getCurrentEasternTimeInfo = originalGetCurrentEasternTimeInfo;
      }
    });
  });

  describe('formatTimeRangeWithHighlight', () => {
    it('returns formatted string for basic range', () => {
      const result = TimeUtils.formatTimeRangeWithHighlight('9:00AM-5:00PM', false);
      assert.ok(typeof result === 'string');
      assert.ok(result.length > 0);
    });

    it('highlights valid active ranges and safely returns invalid markup', () => {
      const highlighted = suppressConsole(() => TimeUtils.formatTimeRangeWithHighlight(
        '9:00AM-5:00PM', true, 600, { color: 'green' }
      ));
      const invalid = suppressConsole(() => TimeUtils.formatTimeRangeWithHighlight('<bad>', true));

      assert.match(highlighted, /highlighted-time-slot-green/);
      assert.match(invalid, /invalid/);
      assert.match(invalid, /&lt;bad&gt;/);
      assert.doesNotMatch(invalid, /<bad>/);
    });
  });

  describe('constants', () => {
    it('has expected timezone', () => {
      assert.equal(TimeUtils.TIMEZONE, 'America/New_York');
    });

    it('has correct MINUTES_PER_DAY', () => {
      assert.equal(TimeUtils.MINUTES_PER_DAY, 1440);
    });

    it('has correct MINUTES_PER_HOUR', () => {
      assert.equal(TimeUtils.MINUTES_PER_HOUR, 60);
    });
  });

  describe('validateSelf', () => {
    it('passes self-validation', () => {
      const results = suppressConsole(() => TimeUtils.validateSelf());
      assert.ok(results.success, `Self-validation failed: ${JSON.stringify(results.errors)}`);
    });
  });
});
