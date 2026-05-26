const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
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
  });
});
