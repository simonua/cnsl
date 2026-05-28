const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const PoolSchedule = require('../../src/js/pool-schedule.js');
const { PoolStatus } = require('../../src/js/types/pool-enums.js');

describe('PoolSchedule', () => {
  describe('constructor', () => {
    it('initializes with schedule data', () => {
      const data = { Monday: { open: true, timeSlots: ['9:00AM-12:00PM'] } };
      const schedule = new PoolSchedule(data);
      assert.deepEqual(schedule.scheduleData, data);
    });

    it('initializes with empty data', () => {
      const schedule = new PoolSchedule();
      assert.deepEqual(schedule.scheduleData, {});
    });

    it('initializes with null', () => {
      const schedule = new PoolSchedule(null);
      assert.deepEqual(schedule.scheduleData, {});
    });
  });

  describe('hasScheduleData', () => {
    it('returns false for empty schedule', () => {
      const schedule = new PoolSchedule({});
      assert.equal(schedule.hasScheduleData(), false);
    });

    it('returns false for schedule with no open days', () => {
      const schedule = new PoolSchedule({ Monday: {} });
      assert.equal(schedule.hasScheduleData(), false);
    });

    it('returns true for schedule with open day', () => {
      const schedule = new PoolSchedule({
        Monday: { open: true, timeSlots: ['9:00AM-12:00PM'] }
      });
      assert.equal(schedule.hasScheduleData(), true);
    });

    it('returns true for schedule with time slots', () => {
      const schedule = new PoolSchedule({
        Tuesday: { timeSlots: [{ start: '9:00AM', end: '12:00PM' }] }
      });
      assert.equal(schedule.hasScheduleData(), true);
    });
  });

  describe('hours and status', () => {
    it('formats open, closed, and unavailable daily hours', () => {
      const schedule = new PoolSchedule({
        Monday: { open: '9:00AM', close: '5:00PM' },
        Tuesday: { closed: true },
        Wednesday: { open: '9:00AM' }
      });

      assert.equal(schedule.getFormattedHours('Monday'), '9:00AM - 5:00PM');
      assert.equal(schedule.getFormattedHours('Tuesday'), 'Closed');
      assert.equal(schedule.getFormattedHours('Wednesday'), 'Hours unavailable');
      assert.equal(schedule.getFormattedHours('Thursday'), 'No hours available');
      assert.deepEqual(schedule.getDayHours('Monday'), { open: '9:00AM', close: '5:00PM' });
      assert.equal(schedule.getDayHours('Thursday'), null);
    });

    it('returns open and closed statuses using minute-accurate comparisons', () => {
      const schedule = new PoolSchedule({
        Monday: { open: '9:30AM', close: '5:00PM' }
      });

      assert.equal(schedule.getStatusAtTime('Monday', new Date(2026, 5, 1, 10, 15)), PoolStatus.OPEN);
      assert.equal(schedule.getStatusAtTime('Monday', new Date(2026, 5, 1, 9, 15)), PoolStatus.CLOSED);
      assert.equal(schedule.getStatusAtTime('Tuesday', new Date(2026, 5, 2, 10, 15)), PoolStatus.CLOSED);
    });

    it('returns the active restriction status during otherwise open hours', () => {
      const schedule = new PoolSchedule({
        Monday: {
          open: '9:00AM',
          close: '5:00PM',
          restrictions: [
            { type: 'practice', start: '10:30AM', end: '11:30AM' },
            { type: 'meet', start: '1:00PM', end: '2:00PM' },
            { type: 'closed', start: '3:00PM', end: '4:00PM' }
          ]
        }
      });

      assert.equal(schedule.getStatusAtTime('Monday', new Date(2026, 5, 1, 10, 45)), PoolStatus.PRACTICE_ONLY);
      assert.equal(schedule.getStatusAtTime('Monday', new Date(2026, 5, 1, 13, 15)), PoolStatus.SWIM_MEET);
      assert.equal(schedule.getStatusAtTime('Monday', new Date(2026, 5, 1, 15, 15)), PoolStatus.CLOSED_TO_PUBLIC);
      assert.equal(schedule.getStatusAtTime('Monday', new Date(2026, 5, 1, 12, 0)), PoolStatus.OPEN);
    });

    it('maps other active restriction types and ignores incomplete ranges', () => {
      const schedule = new PoolSchedule({ Monday: { open: '9:00AM', close: '5:00PM' } });
      const time = new Date(2026, 5, 1, 12, 0);

      assert.equal(schedule._getRestrictionStatus([{ type: 'unexpected', start: '11:00AM', end: '1:00PM' }], time), PoolStatus.RESTRICTED);
      assert.equal(schedule._getRestrictionStatus([{ type: 'practice', start: '1:00PM' }], time), PoolStatus.OPEN);
      assert.equal(schedule._isTimeInRestriction({}, time), false);
    });
  });

  describe('schedule display helpers', () => {
    it('builds hourly slots for an open day and none for a closed day', () => {
      const schedule = new PoolSchedule({
        Monday: { open: '9:00AM', close: '11:00AM' },
        Tuesday: { closed: true }
      });

      const slots = schedule.getTimeSlots('Monday');
      assert.equal(slots.length, 2);
      assert.deepEqual(slots.map(slot => slot.status), ['Open Now', 'Open Now']);
      assert.deepEqual(schedule.getTimeSlots('Tuesday'), []);
    });

    it('uses the status open flag for the current open-state check', () => {
      const schedule = new PoolSchedule({});
      schedule.getStatusAtTime = () => PoolStatus.OPEN;

      assert.equal(schedule.isPoolOpen(), true);
    });

    it('returns a status entry for every day and exposes the current status helper', () => {
      const originalTimeUtils = globalThis.TimeUtils;
      globalThis.TimeUtils = {
        TIMEZONE: 'America/New_York',
        getDayName: () => 'Monday',
        formatTime: value => value,
        formatTimeForComparison: () => 12 * 60,
        timeStringToMinutes: value => value === '9:00AM' ? 9 * 60 : 17 * 60,
        parseTimeString: () => 9
      };
      try {
        const schedule = new PoolSchedule({ Monday: { open: '9:00AM', close: '5:00PM' } });
        assert.equal(schedule.getAllDaysStatus().length, 7);
        assert.equal(schedule.getCurrentStatus(), PoolStatus.OPEN);
      } finally {
        globalThis.TimeUtils = originalTimeUtils;
      }
    });
  });

  describe('browser registration', () => {
    it('installs PoolSchedule as a browser script global', () => {
      const sourcePath = path.join(__dirname, '..', '..', 'src', 'js', 'pool-schedule.js');
      const source = fs.readFileSync(sourcePath, 'utf8');
      const context = { window: {}, globalThis: { PoolStatus, TimeUtils: {} } };
      context.globalThis.window = context.window;
      vm.runInNewContext(source, context, { filename: sourcePath });

      assert.equal(typeof context.window.PoolSchedule, 'function');
    });

    it('returns safe fallback values when browser dependencies are unavailable', () => {
      const sourcePath = path.join(__dirname, '..', '..', 'src', 'js', 'pool-schedule.js');
      const source = fs.readFileSync(sourcePath, 'utf8');
      const context = { window: {}, console: { error: () => {} } };
      vm.runInNewContext(source, context, { filename: sourcePath });
      const schedule = new context.window.PoolSchedule({ Monday: { open: '9:00AM', close: '5:00PM' } });

      assert.equal(schedule.getFormattedHours('Monday'), 'Error loading times');
      assert.equal(schedule.getStatusAtTime('Monday').status, 'Error');
      assert.equal(schedule.getCurrentStatus().status, 'Error');
      assert.equal(schedule.isPoolOpen(), false);
      assert.equal(schedule.getTimeSlots('Monday').length, 0);
      assert.equal(schedule._getRestrictionStatus([], new Date()).status, 'Error');
      assert.equal(schedule._isTimeInRestriction({ start: '1:00PM', end: '2:00PM' }, new Date()), false);
    });

    it('closes incomplete browser schedules when status exists without time utilities', () => {
      const sourcePath = path.join(__dirname, '..', '..', 'src', 'js', 'pool-schedule.js');
      const source = fs.readFileSync(sourcePath, 'utf8');
      const context = { window: {}, PoolStatus, console: { error: () => {} } };
      vm.runInNewContext(source, context, { filename: sourcePath });
      const schedule = new context.window.PoolSchedule({ Monday: { closed: true }, Tuesday: { open: '9:00AM' }, Wednesday: { open: '9:00AM', close: '5:00PM' } });
      assert.equal(schedule.getStatusAtTime('Missing').status, PoolStatus.CLOSED.status);
      assert.equal(schedule.getStatusAtTime('Monday').status, PoolStatus.CLOSED.status);
      assert.equal(schedule.getStatusAtTime('Tuesday').status, PoolStatus.CLOSED.status);
      assert.equal(schedule.getStatusAtTime('Wednesday').status, PoolStatus.CLOSED.status);
    });
  });
});
