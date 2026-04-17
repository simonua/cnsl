const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const PoolSchedule = require('../../src/js/pool-schedule.js');

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
});
