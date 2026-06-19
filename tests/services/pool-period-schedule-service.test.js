const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { suppressConsole } = require('../helpers/test-helpers.js');
const { PoolStatus, TimeUtils, PoolPeriodScheduleService } = require('../helpers/browser-module-loader.js').loadBrowserModule('pool-period-schedule-service');

const schedules = [{
  name: 'Summer',
  startDate: '2026-06-01',
  endDate: '2026-06-07',
  hours: [
    { weekDays: ['Mon'], startTime: '1:00PM', endTime: '5:00PM', types: ['Rec Swim'], accessStatus: 'public', sourceUrl: 'https://example.com/activity' },
    { weekDays: ['Tue'], startTime: '2:00PM', endTime: '4:00PM', types: ['Practice'], accessStatus: 'practice-only' }
  ]
}];

const scheduleOverrides = [{
  startDate: '2026-06-01',
  endDate: '2026-06-01',
  reason: 'Published event',
  hours: [{ weekDays: ['Mon'], startTime: '2:00PM', endTime: '3:00PM', types: ['Event'], accessStatus: 'swim-meet' }]
}];

function createService(options = {}) {
  return new PoolPeriodScheduleService({
    schedulePeriods: schedules,
    scheduleOverrides,
    poolName: 'Test Pool',
    getTimeUtils: () => TimeUtils,
    getPoolStatus: () => PoolStatus,
    ...options
  });
}

function createTimeUtils(overrides = {}) {
  return Object.assign(Object.create(TimeUtils), overrides);
}

describe('PoolPeriodScheduleService', () => {
  describe('schedule projection', () => {
    it('normalizes the active schedule and returns closed defaults', () => {
      const service = createService({ getTimeUtils: () => createTimeUtils({ getCurrentEasternTimeInfo: () => ({ date: '2026-06-01' }) }) });
      const normalized = service.normalizeActiveSchedule();
      assert.deepEqual(normalized.Monday.activities, ['Rec Swim']);
      assert.equal(normalized.Monday.accessStatus, 'public');
      assert.equal(normalized.Wednesday.closed, true);
      assert.deepEqual(createService({ getTimeUtils: () => null }).normalizeActiveSchedule(), {});
      const malformed = createService({
        schedulePeriods: [{
          startDate: '2026-06-01',
          endDate: '2026-06-01',
          hours: [{}, { weekDays: ['Mon'], startTime: '1:00PM', endTime: '2:00PM' }, {
            weekDays: ['Mon', 'Bad'], startTime: '2:00PM', endTime: '3:00PM'
          }]
        }],
        getTimeUtils: () => createTimeUtils({ getCurrentEasternTimeInfo: () => ({ date: '2026-06-01' }) })
      }).normalizeActiveSchedule();
      assert.deepEqual(malformed.Monday.activities, []);
      assert.deepEqual(createService({
        schedulePeriods: [{ startDate: '2026-06-01', endDate: '2026-06-01' }],
        getTimeUtils: () => createTimeUtils({ getCurrentEasternTimeInfo: () => ({ date: '2026-06-01' }) })
      }).normalizeActiveSchedule(), {});
    });

    it('maps public access statuses without interpreting labels', () => {
      const service = createService();
      assert.equal(service.getSlotStatus({ accessStatus: 'public', types: ['Closed-looking label'] }), PoolStatus.OPEN);
      assert.equal(service.getSlotStatus({ accessStatus: 'restricted' }), PoolStatus.RESTRICTED);
      assert.equal(service.getSlotStatus({ accessStatus: 'closed-to-public' }), PoolStatus.CLOSED_TO_PUBLIC);
      assert.equal(service.getSlotStatus({ accessStatus: 'practice-only' }), PoolStatus.PRACTICE_ONLY);
      assert.equal(service.getSlotStatus({ accessStatus: 'special-event' }), PoolStatus.SPECIAL_EVENT);
      assert.equal(service.getSlotStatus({ accessStatus: 'swim-meet' }), PoolStatus.SWIM_MEET);
      assert.equal(service.getSlotStatus({}), PoolStatus.RESTRICTED);
      assert.equal(createService({ getPoolStatus: () => null }).getSlotStatus({}).isOpen, false);
    });

    it('splits regular hours around explicit dated overrides', () => {
      const monday = createService().getWeekScheduleForDate(new Date(2026, 5, 1))[0];
      assert.equal(monday.hasOverrides, true);
      assert.equal(monday.overrideReason, 'Published event');
      assert.deepEqual(monday.timeSlots.map(slot => ({ startTime: slot.startTime, endTime: slot.endTime, isOverride: slot.isOverride })), [
        { startTime: '1:00PM', endTime: '2:00pm', isOverride: false },
        { startTime: '2:00PM', endTime: '3:00PM', isOverride: true },
        { startTime: '3:00pm', endTime: '5:00PM', isOverride: false }
      ]);
    });

    it('replaces the complete recurring day when the dated source defines replacement hours', () => {
      const service = createService({
        scheduleOverrides: [{
          startDate: '2026-06-01',
          endDate: '2026-06-01',
          overrideMode: 'replace-day',
          reason: 'Holiday hours',
          hours: [{
            weekDays: ['Mon'], startTime: '1:00PM', endTime: '3:00PM',
            types: ['Rec Swim'], accessStatus: 'public'
          }]
        }]
      });

      const monday = service.getWeekScheduleForDate(new Date(2026, 5, 1))[0];
      assert.deepEqual(monday.timeSlots.map(slot => ({
        startTime: slot.startTime,
        endTime: slot.endTime,
        isOverride: slot.isOverride
      })), [{ startTime: '1:00PM', endTime: '3:00PM', isOverride: true }]);
    });

    it('preserves an all-day replacement closure beneath a timed authoritative event', () => {
      const service = createService({
        scheduleOverrides: [{
          startDate: '2026-06-01',
          endDate: '2026-06-01',
          overrideMode: 'replace-day',
          reason: 'Closed for hosted meet',
          hours: [{
            weekDays: ['Mon'], types: ['Closed to Public'], accessStatus: 'closed-to-public'
          }, {
            weekDays: ['Mon'], startTime: '7:00AM', endTime: '12:00PM',
            types: ['Swim Meet'], accessStatus: 'swim-meet'
          }]
        }]
      });

      const slots = service.getTimeSlotsForDate('2026-06-01', 'Mon');
      assert.equal(slots.length, 2);
      assert.equal(slots[0].accessStatus, 'closed-to-public');
      assert.equal(slots[0].startTime, undefined);
      assert.equal(service.getStatusAtMinutes(slots, 8 * 60), PoolStatus.SWIM_MEET);
      assert.equal(service.getStatusAtMinutes(slots, 13 * 60), PoolStatus.CLOSED_TO_PUBLIC);
    });

    it('uses declarative access status instead of activity labels for special events', () => {
      const service = createService();
      const specialEvent = service.mergeScheduleWithOverride(schedules[0], 'Mon', {
        reason: 'Masters only',
        hours: [{ weekDays: ['Mon'], startTime: '3:00PM', endTime: '5:00PM', types: ['Unrecognized label'], accessStatus: 'special-event', isSpecialEvent: true }]
      });

      assert.equal(specialEvent.find(slot => slot.isOverride).accessStatus, 'special-event');
      assert.equal(specialEvent.find(slot => slot.isOverride).isSpecialEvent, true);
    });

    it('preserves official activity source URLs in regular and override schedules', () => {
      const regular = createService({ scheduleOverrides: [] }).getWeekScheduleForDate(new Date(2026, 5, 1));
      assert.equal(regular[0].timeSlots[0].sourceUrl, 'https://example.com/activity');

      const overrideService = createService({
        scheduleOverrides: [{
          startDate: '2026-06-01',
          endDate: '2026-06-01',
          reason: 'Class',
          hours: [{
            weekDays: ['Mon'],
            startTime: '2:00PM',
            endTime: '3:00PM',
            types: ['Aqua Fitness'],
            accessStatus: 'restricted',
            sourceUrl: 'https://example.com/override'
          }]
        }]
      });
      const override = overrideService.getWeekScheduleForDate(new Date(2026, 5, 1))[0].timeSlots;
      assert.equal(override.find(slot => slot.accessStatus === 'restricted').sourceUrl, 'https://example.com/override');
      assert.equal(override.filter(slot => slot.accessStatus === 'public').every(slot => slot.sourceUrl === 'https://example.com/activity'), true);
    });

    it('projects regular weekly slots into the display shape', () => {
      const service = createService({ scheduleOverrides: [] });
      const monday = service.getWeekScheduleForDate(new Date(2026, 5, 1))[0];
      assert.deepEqual(monday.timeSlots[0].activities, ['Rec Swim']);
      assert.equal(monday.timeSlots[0].isOverride, false);
      assert.equal(service.getWeekScheduleForDate(new Date(2026, 5, 8))[0].isOpen, false);
    });

    it('orders multiple regular slots chronologically', () => {
      const service = createService({
        scheduleOverrides: [],
        schedulePeriods: [{
          startDate: '2026-06-01',
          endDate: '2026-06-07',
          hours: [{
            weekDays: ['Mon'], startTime: '3:00PM', endTime: '5:00PM',
            types: ['Rec Swim'], accessStatus: 'public'
          }, {
            weekDays: ['Mon'], startTime: '1:00PM', endTime: '2:00PM',
            types: ['Laps'], accessStatus: 'public'
          }, {
            weekDays: ['Mon'], types: ['Closed'], accessStatus: 'closed-to-public'
          }, {
            weekDays: ['Mon'], startTime: 1, endTime: '2:00PM',
            types: ['Malformed'], accessStatus: 'restricted'
          }]
        }]
      });

      assert.deepEqual(
        service.getWeekScheduleForDate(new Date(2026, 5, 1))[0].timeSlots.map(slot => slot.startTime),
        ['1:00PM', '3:00PM', 1]
      );
      assert.deepEqual(
        service.getTimeSlotsForDate('2026-06-01', 'Mon').map(slot => slot.startTime),
        ['1:00PM', '3:00PM', undefined, 1]
      );
      assert.deepEqual(
        service.sortSlots([{ notes: 'Untimed' }, { startTime: '1:00PM', notes: 'Timed' }]).map(slot => slot.notes),
        ['Timed', 'Untimed']
      );
    });

    it('formats schedule lookup dates from local calendar fields', () => {
      const localEveningDate = {
        getFullYear: () => 2026,
        getMonth: () => 5,
        getDate: () => 6,
        toISOString: () => '2026-06-07T00:30:00.000Z'
      };
      assert.equal(PoolPeriodScheduleService.getLocalDateString(localEveningDate), '2026-06-06');
    });

    it('handles null overrides and unavailable time utilities safely', () => {
      const service = createService({ scheduleOverrides: null });
      service.scheduleOverrides = null;
      assert.equal(service.getOverrideForDate('2026-06-01', 'Mon'), null);
      assert.deepEqual(createService({ getTimeUtils: () => null }).getTimeSlotsForDate('2026-06-01', 'Mon'), []);
      assert.equal(createService({ getTimeUtils: () => null }).getWeekScheduleForDate(new Date(2026, 5, 1))[0].timeSlots.length, 1);
      assert.deepEqual(createService().getTimeSlotsForDate('2027-01-01', 'Fri'), []);
    });

    it('uses safe dependency fallbacks when no collaborators are supplied', () => {
      const service = new PoolPeriodScheduleService();

      assert.deepEqual(service.normalizeActiveSchedule(), {});
      assert.deepEqual(service.getCurrentStatus(), { kind: 'unavailable', isOpen: false, status: 'Error', color: 'gray' });
    });
  });

  describe('status and date boundaries', () => {
    it('resolves active status at the current Eastern time', () => {
      const service = createService({
        scheduleOverrides: [],
        getTimeUtils: () => createTimeUtils({ getCurrentEasternTimeInfo: () => ({ date: '2026-06-01', day: 'Mon', minutes: 14 * 60 }) })
      });
      assert.equal(service.getCurrentStatus(), PoolStatus.OPEN);
      assert.equal(service.getStatusAtMinutes([], 14 * 60), PoolStatus.CLOSED);
    });

    it('returns safe status fallbacks and skips malformed slots', () => {
      assert.equal(createService({ schedulePeriods: [] }).getCurrentStatus(), PoolStatus.SCHEDULE_NOT_FOUND);
      assert.equal(createService({ getPoolStatus: () => null }).getCurrentStatus().kind, 'unavailable');
      assert.equal(createService({ getTimeUtils: () => null }).getCurrentStatus(), PoolStatus.SCHEDULE_NOT_FOUND);
      suppressConsole(() => assert.equal(createService().getStatusAtMinutes([{}], 60), PoolStatus.CLOSED));
      suppressConsole(() => assert.equal(createService().getStatusAtMinutes([{
        accessStatus: 'closed-to-public', startTime: '1:00PM'
      }], 14 * 60), PoolStatus.CLOSED));
      assert.equal(createService().getStatusAtMinutes([{
        accessStatus: 'closed-to-public', startTime: '1:00PM', endTime: '2:00PM'
      }], 13 * 60 + 30), PoolStatus.CLOSED_TO_PUBLIC);
      assert.equal(createService({ getTimeUtils: () => null }).getStatusAtMinutes([], 0).isOpen, false);
    });

    it('reports active-period and complete date boundaries', () => {
      const service = createService({ getTimeUtils: () => createTimeUtils({ getCurrentEasternTimeInfo: () => ({ date: '2026-06-01' }) }) });
      assert.deepEqual(service.getCurrentSchedulePeriod(), { name: 'Summer', startDate: '2026-06-01', endDate: '2026-06-07' });
      assert.equal(service.getValidDateRange().startDate.toISOString().slice(0, 10), '2026-06-01');
      assert.equal(createService({ schedulePeriods: [] }).getValidDateRange(), null);
      assert.equal(createService({ getTimeUtils: () => null }).getCurrentSchedulePeriod(), null);
      assert.equal(createService({
        schedulePeriods: [{ startDate: '2026-06-01', endDate: '2026-06-07', hours: [] }],
        getTimeUtils: () => createTimeUtils({ getCurrentEasternTimeInfo: () => ({ date: '2026-06-01' }) })
      }).getCurrentSchedulePeriod().name, 'Current Schedule');
      assert.equal(createService({
        getTimeUtils: () => createTimeUtils({ getCurrentEasternTimeInfo: () => ({ date: '2026-07-01' }) })
      }).getCurrentSchedulePeriod(), null);
    });
  });

  describe('override boundaries', () => {
    it('handles complete, separate, and malformed overrides', () => {
      const service = createService();
      const active = { hours: [{ weekDays: ['Mon'], startTime: '1:00PM', endTime: '2:00PM', types: ['Rec Swim'] }] };
      const covered = service.mergeScheduleWithOverride(active, 'Mon', { reason: 'Meet', hours: [{ weekDays: ['Mon'], startTime: '12:00PM', endTime: '3:00PM', types: ['Meet'] }] });
      const separate = service.mergeScheduleWithOverride(active, 'Mon', { reason: 'Meet', hours: [{ weekDays: ['Mon'], startTime: '3:00PM', endTime: '4:00PM', types: ['Meet'] }] });
      assert.equal(covered.length, 1);
      assert.equal(separate.length, 2);
      assert.deepEqual(service.getSlotsForDay(null, 'Mon'), []);
      assert.deepEqual(service.getSlotsForDay([{
        weekDays: ['Mon'], types: ['Closed to Public'], accessStatus: 'closed-to-public'
      }], 'Mon'), []);
      assert.deepEqual(service.getSlotsForDay([{
        weekDays: ['Mon'], startTime: '1:00PM', types: ['Closed to Public'], accessStatus: 'closed-to-public'
      }], 'Mon', true), []);
      assert.deepEqual(service.getSlotsForDay([{
        weekDays: ['Mon'], endTime: '2:00PM', types: ['Closed to Public'], accessStatus: 'closed-to-public'
      }], 'Mon', true), []);
      assert.deepEqual(service.getSlotsForDay([{
        weekDays: ['Mon'], types: ['Event'], accessStatus: 'special-event'
      }], 'Mon', true), []);
      assert.equal(service.getOverrideForDate('2026-06-02', 'Tue'), undefined);
      assert.deepEqual(service.getRegularSlots(null, 'Mon'), []);
      assert.deepEqual(service.getRegularSlots({ hours: [{ weekDays: ['Mon'], startTime: '1:00PM', endTime: '2:00PM' }] }, 'Mon')[0].activities, []);
      assert.deepEqual(service.mergeScheduleWithOverride(null, 'Mon', {
        hours: [{ weekDays: ['Mon'], startTime: '1:00PM', endTime: '2:00PM', accessStatus: 'public' }]
      })[0].activities, []);
    });

    it('degrades invalid merge times without throwing', () => {
      const service = createService();
      const merged = suppressConsole(() => service.mergeScheduleWithOverride(
        { hours: [{ weekDays: ['Mon'], startTime: 'bad', endTime: '2:00PM', types: ['Rec Swim'] }] },
        'Mon',
        { reason: '', hours: [{ weekDays: ['Mon'], startTime: '1:00PM', endTime: '2:00PM', types: ['Closed'] }] }
      ));
      assert.ok(Array.isArray(merged));
      assert.deepEqual(createService({ getTimeUtils: () => null }).subtractOverride({ startMinutes: 60, endMinutes: 180 }, { startMinutes: 120, endMinutes: 240 }), []);
    });
  });

  it('installs the service as a browser script global', () => {
    const sourcePath = path.join(__dirname, '..', '..', 'src', 'js', 'services', 'pool-period-schedule-service.js');
    const source = fs.readFileSync(sourcePath, 'utf8');
    const context = { window: {} };
    Object.assign(context, context.globalThis || {}, context.window || {});
    context.globalThis = context; context.self = context; context.window = context;
    vm.runInNewContext(source, context, { filename: sourcePath });
    assert.equal(typeof context.window.PoolPeriodScheduleService, 'function');
  });
});
