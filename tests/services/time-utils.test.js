const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const TimeUtils = require('../../src/js/services/time-utils.js');
const { suppressConsole } = require('../helpers/test-helpers.js');

describe('TimeUtils', () => {
  describe('validation and diagnostics', () => {
    it('supports nullable input and rejects incorrect primitive types', () => {
      assert.doesNotThrow(() => TimeUtils._validateInput(null, 'optional', 'string', true));
      assert.throws(() => TimeUtils._validateInput(1, 'value', 'string'), /must be a string/);
      assert.throws(() => TimeUtils._validateTimeString('not-a-time'), /Invalid time format/);
    });

    it('emits diagnostic calls with and without supporting data', () => {
      const originalInfo = console.info;
      const messages = [];
      console.info = (...args) => messages.push(args);
      try {
        TimeUtils._log('plain');
        TimeUtils._log('data', 'info', { value: true });
        assert.equal(messages.length, 2);
      } finally {
        console.info = originalInfo;
      }
    });
  });

  describe('timezone cache and fallbacks', () => {
    it('calculates seasonal offsets and clears stale cached values', () => {
      const originalCleanup = TimeUtils._lastCacheCleanup;
      const originalInfo = console.info;
      console.info = () => {};
      try {
        TimeUtils._timezoneOffsetCache.set('old', 1);
        TimeUtils._lastCacheCleanup = 0;
        TimeUtils._cleanupCache();
        assert.equal(TimeUtils._timezoneOffsetCache.has('old'), false);
        assert.equal(TimeUtils._getEasternOffsetMs(new Date(2026, 6, 1)), -4 * 3600000);
        assert.equal(TimeUtils._getEasternOffsetMs(new Date(2026, 0, 1)), -5 * 3600000);
      } finally {
        TimeUtils._lastCacheCleanup = originalCleanup;
        console.info = originalInfo;
      }
    });

    it('caches timezone offset computations and falls back after calculation errors', () => {
      const originalLog = TimeUtils._log;
      TimeUtils._log = () => {};
      try {
        TimeUtils._timezoneOffsetCache.clear();
        const date = new Date(2026, 5, 1);
        const first = TimeUtils._getTimezoneOffset(date);
        assert.equal(TimeUtils._getTimezoneOffset(date), first);
        const invalidDate = { toDateString: () => 'bad', getTime: () => { throw new Error('bad'); } };
        assert.equal(TimeUtils._getTimezoneOffset(invalidDate), 0);
      } finally {
        TimeUtils._log = originalLog;
      }
    });

    it('falls back to manual Eastern conversion when Intl conversion fails', () => {
      const originalFormatter = Intl.DateTimeFormat;
      const originalLog = TimeUtils._log;
      Intl.DateTimeFormat = function BrokenFormatter() { throw new Error('blocked'); };
      TimeUtils._log = () => {};
      try {
        assert.equal(TimeUtils.getEasternTime() instanceof Date, true);
      } finally {
        Intl.DateTimeFormat = originalFormatter;
        TimeUtils._log = originalLog;
      }
    });

      it('returns a last-resort local date when both timezone conversion methods fail', () => {
        const originalFormatter = Intl.DateTimeFormat;
        const originalOffset = TimeUtils._getTimezoneOffset;
        const originalLog = TimeUtils._log;
        Intl.DateTimeFormat = function InvalidFormatter() { return { formatToParts: () => [{ type: 'year', value: 'bad' }] }; };
        TimeUtils._getTimezoneOffset = () => Number.NaN;
        TimeUtils._log = () => {};
        try {
          assert.equal(TimeUtils.getEasternTime() instanceof Date, true);
        } finally {
          Intl.DateTimeFormat = originalFormatter;
          TimeUtils._getTimezoneOffset = originalOffset;
          TimeUtils._log = originalLog;
        }
      });
  });

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
        assert.throws(() => TimeUtils.timeStringToMinutes('25:00PM'), /Invalid hour value/);
        assert.throws(() => TimeUtils.timeStringToMinutes('12:99PM'), /Invalid minute value/);
      });
    });

    it('rejects a match failure after syntax validation succeeds', () => {
        const originalRegex = TimeUtils.TIME_REGEX;
        TimeUtils.TIME_REGEX = { test: () => true, [Symbol.match]: () => null };
        try {
          assert.throws(() => suppressConsole(() => TimeUtils.timeStringToMinutes('anything')), /Invalid time format/);
        } finally {
          TimeUtils.TIME_REGEX = originalRegex;
        }
      });

    it('rejects a calculated result outside the configured day boundary', () => {
      const originalMinutesPerDay = TimeUtils.MINUTES_PER_DAY;
      TimeUtils.MINUTES_PER_DAY = 1;
      try {
        assert.throws(() => suppressConsole(() => TimeUtils.timeStringToMinutes('1:00AM')), /outside valid range/);
      } finally {
        TimeUtils.MINUTES_PER_DAY = originalMinutesPerDay;
      }
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
      assert.equal(suppressConsole(() => TimeUtils.formatActivityTypes(7)), '7');
    });

      it('returns empty text when converting an activity value fails', () => {
        const value = { toString: () => { throw new Error('bad'); } };
        assert.equal(suppressConsole(() => TimeUtils.formatActivityTypes(value)), '');
      });
  });

  describe('getEasternTime', () => {
    it('returns a valid Date object', () => {
      const result = TimeUtils.getEasternTime();
      assert.ok(result instanceof Date);
    });

      it('retains ET when a timezone abbreviation cannot be read', () => {
        const originalGetEasternTime = TimeUtils.getEasternTime;
        const date = new Date(2026, 5, 1, 10, 0);
        const originalLocale = date.toLocaleDateString;
        let calls = 0;
        date.toLocaleDateString = (...args) => {
          calls += 1;
          if (calls === 1) throw new Error('timezone unavailable');
          return originalLocale.call(date, ...args);
        };
        TimeUtils.getEasternTime = () => date;
        try {
          assert.equal(suppressConsole(() => TimeUtils.getCurrentEasternTimeInfo()).timezone, 'ET');
        } finally {
          TimeUtils.getEasternTime = originalGetEasternTime;
        }
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
      assert.throws(() => TimeUtils.parseDateOnly('June 13'), /Invalid date format/);
    });
  });

  describe('display formatting helpers', () => {
    it('formats day, date, text time, comparable minutes, and parsed hours', () => {
      const date = new Date(2026, 5, 13, 14, 35);
      assert.equal(TimeUtils.getDayName(date), 'Saturday');
      assert.equal(TimeUtils.formatDate(date), '2026-06-13');
      assert.equal(TimeUtils.formatTime(' 9:00AM '), '9:00AM');
      assert.equal(TimeUtils.formatTimeForComparison(date), (14 * 60) + 35);
      assert.equal(TimeUtils.parseTimeString('2:30PM'), 14);
    });

    it('returns safe formatting fallbacks for invalid values', () => {
      suppressConsole(() => {
        assert.equal(TimeUtils.getDayName('bad'), 'Unknown');
        assert.equal(TimeUtils.getDayName(new Date('bad')), 'Unknown');
        assert.match(TimeUtils.formatDate('bad'), /^\d{4}-\d{2}-\d{2}$/);
        assert.match(TimeUtils.formatDate(new Date('bad')), /^\d{4}-\d{2}-\d{2}$/);
        assert.equal(TimeUtils.formatTime(null), '12:00am');
        assert.equal(TimeUtils.formatTimeForComparison('bad'), 0);
        assert.equal(TimeUtils.formatTimeForComparison(new Date('bad')), 0);
        assert.throws(() => TimeUtils.parseTimeString('bad'));
      });
    });

    it('rejects out-of-range derived minutes and parsed hours', () => {
      const date = new Date(2026, 5, 1);
      date.getHours = () => 24;
      date.getMinutes = () => 0;
      assert.equal(suppressConsole(() => TimeUtils.formatTimeForComparison(date)), 0);
      const originalConversion = TimeUtils.timeStringToMinutes;
      TimeUtils.timeStringToMinutes = () => 1440;
      try {
        assert.throws(() => suppressConsole(() => TimeUtils.parseTimeString('12:00AM')), /outside valid range/);
      } finally {
        TimeUtils.timeStringToMinutes = originalConversion;
      }
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

    it('keeps an Eastern evening on the current calendar day until midnight', () => {
      const originalGetEasternTime = TimeUtils.getEasternTime;
      const easternEvening = new Date(2026, 4, 29, 20, 25);
      easternEvening.toISOString = () => '2026-05-30T00:25:00.000Z';
      TimeUtils.getEasternTime = () => easternEvening;
      try {
        const info = TimeUtils.getCurrentEasternTimeInfo();
        assert.equal(info.date, '2026-05-29');
        assert.equal(info.minutes, (20 * 60) + 25);
      } finally {
        TimeUtils.getEasternTime = originalGetEasternTime;
      }
    });

    it('returns a local fallback when Eastern conversion cannot be formatted', () => {
      const originalGetEasternTime = TimeUtils.getEasternTime;
      TimeUtils.getEasternTime = () => new Date('invalid');
      try {
        const info = suppressConsole(() => TimeUtils.getCurrentEasternTimeInfo());
        assert.equal(info.isValid, false);
        assert.equal(info.timezone, 'Local');
      } finally {
        TimeUtils.getEasternTime = originalGetEasternTime;
      }
    });

    it('returns a local fallback for out-of-range Eastern clock values', () => {
      const originalGetEasternTime = TimeUtils.getEasternTime;
      const invalidClock = new Date(2026, 5, 1, 10, 0);
      invalidClock.getHours = () => 24;
      TimeUtils.getEasternTime = () => invalidClock;
      try {
        assert.equal(suppressConsole(() => TimeUtils.getCurrentEasternTimeInfo()).isValid, false);
      } finally {
        TimeUtils.getEasternTime = originalGetEasternTime;
      }
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

    it('uses fetched current time and fails safely when it is unavailable', () => {
      const originalGetInfo = TimeUtils.getCurrentEasternTimeInfo;
      try {
        TimeUtils.getCurrentEasternTimeInfo = () => ({ isValid: true, minutes: 600 });
        assert.equal(suppressConsole(() => TimeUtils.isCurrentTimeSlot('9:00AM', '5:00PM', null, true)), true);
        TimeUtils.getCurrentEasternTimeInfo = () => ({ isValid: false, minutes: 0 });
        assert.equal(suppressConsole(() => TimeUtils.isCurrentTimeSlot('9:00AM', '5:00PM', null, true)), false);
        assert.equal(suppressConsole(() => TimeUtils.isCurrentTimeSlot('11:00PM', '6:00AM', null, true)), false);
      } finally {
        TimeUtils.getCurrentEasternTimeInfo = originalGetInfo;
      }
    });

    it('matches an overnight slot using an automatically resolved valid time', () => {
      const originalGetInfo = TimeUtils.getCurrentEasternTimeInfo;
      TimeUtils.getCurrentEasternTimeInfo = () => ({ isValid: true, minutes: 30 });
      try {
        assert.equal(suppressConsole(() => TimeUtils.isCurrentTimeSlot('11:00PM', '6:00AM', null, true)), true);
      } finally {
        TimeUtils.getCurrentEasternTimeInfo = originalGetInfo;
      }
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

    it('rejects malformed collections and an invalid current-time lookup', () => {
      const originalGetInfo = TimeUtils.getCurrentEasternTimeInfo;
      suppressConsole(() => assert.equal(TimeUtils.hasCurrentTimeSlot(null, true), false));
      TimeUtils.getCurrentEasternTimeInfo = () => ({ isValid: false });
      try {
        assert.equal(suppressConsole(() => TimeUtils.hasCurrentTimeSlot([{ startTime: '9:00AM', endTime: '10:00AM' }], true)), false);
      } finally {
        TimeUtils.getCurrentEasternTimeInfo = originalGetInfo;
      }
    });

      it('fails safely when time lookup or an individual slot check throws', () => {
        const originalGetInfo = TimeUtils.getCurrentEasternTimeInfo;
        const originalSlotCheck = TimeUtils.isCurrentTimeSlot;
        try {
          TimeUtils.getCurrentEasternTimeInfo = () => { throw new Error('clock failed'); };
          assert.equal(suppressConsole(() => TimeUtils.hasCurrentTimeSlot([{ startTime: '9:00AM', endTime: '10:00AM' }], true)), false);
          TimeUtils.getCurrentEasternTimeInfo = () => ({ isValid: true, minutes: 600 });
          TimeUtils.isCurrentTimeSlot = () => { throw new Error('slot failed'); };
          assert.equal(suppressConsole(() => TimeUtils.hasCurrentTimeSlot([{ startTime: '9:00AM', endTime: '10:00AM' }], true)), false);
          assert.equal(suppressConsole(() => TimeUtils.hasCurrentTimeSlot([{ startTime: '9:00AM', endTime: '10:00AM' }], 'invalid')), false);
        } finally {
          TimeUtils.getCurrentEasternTimeInfo = originalGetInfo;
          TimeUtils.isCurrentTimeSlot = originalSlotCheck;
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

    it('covers forced colors, empty input, invalid status, and escaped fallback values', () => {
      const yellow = suppressConsole(() => TimeUtils.formatTimeRangeWithHighlight('9:00AM-5:00PM', false, 0, { color: 'yellow' }, true));
      const red = suppressConsole(() => TimeUtils.formatTimeRangeWithHighlight('9:00AM-5:00PM', false, 0, { color: 'red' }, true));
      const ignored = suppressConsole(() => TimeUtils.formatTimeRangeWithHighlight('9:00AM-5:00PM', false, 0, { color: 'blue' }, true));
      assert.match(yellow, /highlighted-time-slot-yellow/);
      assert.match(red, /highlighted-time-slot-red/);
      assert.doesNotMatch(ignored, /highlighted-time-slot/);
      assert.equal(suppressConsole(() => TimeUtils.formatTimeRangeWithHighlight(' ')), '');
      assert.match(suppressConsole(() => TimeUtils.formatTimeRangeWithHighlight(null)), /Invalid Time Range/);
      assert.equal(TimeUtils._getHighlightStyles('unknown'), null);
      assert.equal(TimeUtils._escapeHtml('<a>"\'&'), '&lt;a&gt;&quot;&#39;&amp;');
      assert.equal(TimeUtils._escapeHtml(4), '4');
    });

    it('fails safely for invalid minute inputs and unavailable highlight time lookups', () => {
      assert.match(suppressConsole(() => TimeUtils.formatTimeRangeWithHighlight('9:00AM-5:00PM', true, -1)), /time-range-container error/);
      assert.match(suppressConsole(() => TimeUtils.formatTimeRangeWithHighlight('bad-5:00PM', true, 600)), /time-range-container invalid/);
      assert.doesNotMatch(suppressConsole(() => TimeUtils.formatTimeRangeWithHighlight('9:00AM-5:00PM', true, 600, 'green')), /highlighted-time-slot/);
      assert.doesNotMatch(suppressConsole(() => TimeUtils.formatTimeRangeWithHighlight('9:00AM-5:00PM', true, 600)), /highlighted-time-slot/);
      const originalGetInfo = TimeUtils.getCurrentEasternTimeInfo;
      const originalSlotCheck = TimeUtils.isCurrentTimeSlot;
      const originalHighlightStyles = TimeUtils._getHighlightStyles;
      try {
        TimeUtils.getCurrentEasternTimeInfo = () => ({ isValid: false });
        assert.doesNotMatch(suppressConsole(() => TimeUtils.formatTimeRangeWithHighlight('9:00AM-5:00PM', true, null, { color: 'green' })), /highlighted-time-slot/);
        TimeUtils.getCurrentEasternTimeInfo = () => { throw new Error('clock failed'); };
        assert.doesNotMatch(suppressConsole(() => TimeUtils.formatTimeRangeWithHighlight('9:00AM-5:00PM', true, null, { color: 'green' })), /highlighted-time-slot/);
        TimeUtils.getCurrentEasternTimeInfo = () => ({ isValid: true, minutes: 600 });
        TimeUtils.isCurrentTimeSlot = () => { throw new Error('slot failed'); };
        assert.doesNotMatch(suppressConsole(() => TimeUtils.formatTimeRangeWithHighlight('9:00AM-5:00PM', true, null, { color: 'green' })), /highlighted-time-slot/);
        TimeUtils.isCurrentTimeSlot = originalSlotCheck;
        TimeUtils._getHighlightStyles = () => null;
        assert.doesNotMatch(suppressConsole(() => TimeUtils.formatTimeRangeWithHighlight('9:00AM-5:00PM', false, 600, { color: 'green' }, true)), /highlighted-time-slot/);
      } finally {
        TimeUtils.getCurrentEasternTimeInfo = originalGetInfo;
        TimeUtils.isCurrentTimeSlot = originalSlotCheck;
        TimeUtils._getHighlightStyles = originalHighlightStyles;
      }
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

    it('captures a self-validation conversion failure', () => {
      const originalConversion = TimeUtils.timeStringToMinutes;
      TimeUtils.timeStringToMinutes = () => { throw new Error('failure'); };
      try {
        const results = suppressConsole(() => TimeUtils.validateSelf());
        assert.equal(results.success, false);
        assert.ok(results.errors.length > 0);
      } finally {
        TimeUtils.timeStringToMinutes = originalConversion;
      }
    });

      it('captures a self-validation setup failure', () => {
        const originalEasternTime = TimeUtils.getEasternTime;
        TimeUtils.getEasternTime = () => { throw new Error('failure'); };
        try {
          const results = suppressConsole(() => TimeUtils.validateSelf());
          assert.equal(results.success, false);
          assert.match(results.errors[0], /Self-validation failed/);
        } finally {
          TimeUtils.getEasternTime = originalEasternTime;
        }
      });
  });

  describe('browser registration', () => {
    it('installs TimeUtils as a browser script global', () => {
      const sourcePath = path.join(__dirname, '..', '..', 'src', 'js', 'services', 'time-utils.js');
      const source = fs.readFileSync(sourcePath, 'utf8');
      const context = { window: {}, globalThis: { APP_TIMEZONE: 'America/New_York' } };
      vm.runInNewContext(source, context, { filename: sourcePath });
      assert.equal(typeof context.window.TimeUtils, 'function');
    });
  });
});
