const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { PoolCalendarService } = require('../helpers/browser-module-loader.js').loadBrowserModule('pool-calendar-service');

describe('PoolCalendarService', () => {
  describe('getMondayOfWeek', () => {
    it('returns the Monday for weekdays and Sundays', () => {
      assert.equal(PoolCalendarService.getMondayOfWeek(new Date(2026, 5, 17)).getDate(), 15);
      assert.equal(PoolCalendarService.getMondayOfWeek(new Date(2026, 5, 21)).getDate(), 15);
    });
  });

  describe('addDays and getWeekEnd', () => {
    it('returns new dates without mutating the original date', () => {
      const weekStart = new Date(2026, 5, 15);
      const weekEnd = PoolCalendarService.getWeekEnd(weekStart);
      const previousWeek = PoolCalendarService.addDays(weekStart, -7);

      assert.equal(weekStart.getDate(), 15);
      assert.equal(weekEnd.getDate(), 21);
      assert.equal(previousWeek.getDate(), 8);
    });
  });

  describe('isTodayInSeason', () => {
    it('includes range boundaries and rejects absent ranges', () => {
      const dateRange = { startDate: new Date(2026, 5, 1), endDate: new Date(2026, 5, 30) };
      assert.equal(PoolCalendarService.isTodayInSeason(dateRange, new Date(2026, 5, 1, 8)), true);
      assert.equal(PoolCalendarService.isTodayInSeason(dateRange, new Date(2026, 5, 30, 23)), true);
      assert.equal(PoolCalendarService.isTodayInSeason(dateRange, new Date(2026, 6, 1)), false);
      assert.equal(PoolCalendarService.isTodayInSeason(null, new Date(2026, 5, 15)), false);
    });
  });

  describe('date input helpers', () => {
    it('parses date-only values as local calendar days and formats them without UTC conversion', () => {
      const parsedDate = PoolCalendarService.parseDateInput('2026-06-15');
      assert.equal(parsedDate.getFullYear(), 2026);
      assert.equal(parsedDate.getMonth(), 5);
      assert.equal(parsedDate.getDate(), 15);
      assert.equal(PoolCalendarService.formatDateInputValue(parsedDate), '2026-06-15');
      assert.equal(PoolCalendarService.parseDateInput('not-a-date'), null);
      assert.equal(PoolCalendarService.parseDateInput('2026-02-30'), null);
      assert.equal(PoolCalendarService.formatDateInputValue(new Date('invalid')), '');
    });
  });

  it('installs the service as a browser script global', () => {
    const sourcePath = path.join(__dirname, '..', '..', 'src', 'js', 'services', 'pool-calendar-service.js');
    const source = fs.readFileSync(sourcePath, 'utf8');
    const context = { window: {} };
    Object.assign(context, context.globalThis || {}, context.window || {});
    context.globalThis = context; context.self = context; context.window = context;
    vm.runInNewContext(source, context, { filename: sourcePath });

    assert.equal(typeof context.window.PoolCalendarService, 'function');
  });
});
