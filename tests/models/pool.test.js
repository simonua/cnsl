const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createSamplePoolData } = require('../helpers/test-helpers.js');
const poolModule = require('../helpers/browser-module-loader.js').loadBrowserModule('pool');
const { Pool, PoolStatus, PoolPeriodScheduleService, TimeUtils, context: poolContext } = poolModule;

describe('Pool', () => {
  describe('constructor', () => {
    it('initializes from pool data', () => {
      const data = createSamplePoolData();
      const pool = new Pool(data);
      assert.equal(pool.id, 'bwp');
      assert.equal(pool.name, 'Bryant Woods');
    });

    it('uses empty strings for missing data', () => {
      const pool = new Pool({});
      assert.equal(pool.id, '');
      assert.equal(pool.name, '');
    });

    it('handles location object format', () => {
      const data = createSamplePoolData();
      const pool = new Pool(data);
      assert.ok(pool.location);
      assert.equal(pool.location.city, 'Columbia');
      assert.equal(pool.location.state, 'MD');
      assert.equal(pool.googleMapsUrl, 'https://maps.google.com/?q=Bryant+Woods+Pool');
    });

    it('formats partial structured locations', () => {
      assert.equal(new Pool({ location: { street: '123 Main Street' } }).address, '123 Main Street');
      assert.equal(new Pool({ location: { state: 'MD' } }).address, 'MD');
      assert.equal(new Pool({ location: { zip: '21044' } }).address, '21044');
    });

    it('provides model dependencies to period schedules', () => {
      const pool = new Pool(createSamplePoolData({ schedules: [] }));

      assert.equal(pool.periodSchedule.getTimeUtils(), TimeUtils);
      assert.equal(pool.periodSchedule.getPoolStatus(), PoolStatus);
    });

  });

  describe('schedule output', () => {
    it('reports schedule missing when published period data is empty', () => {
      assert.equal(new Pool({ name: 'No schedules' }).getCurrentStatus(), PoolStatus.SCHEDULE_NOT_FOUND);
    });

    it('splits regular hours around a dated swim meet override', () => {
      const pool = new Pool(createSamplePoolData({
        schedules: [{
          startDate: '2026-05-25',
          endDate: '2026-05-31',
          hours: [{ weekDays: ['Mon'], startTime: '1:00PM', endTime: '5:00PM', types: ['Rec Swim'] }]
        }],
        scheduleOverrides: [{
          startDate: '2026-05-25',
          endDate: '2026-05-31',
          reason: 'Swim Meet',
          hours: [{ weekDays: ['Mon'], startTime: '2:00PM', endTime: '4:00PM', types: ['Swim Meet'] }]
        }]
      }));

      const monday = pool.getWeekScheduleForDate(new Date(2026, 4, 25))[0];
      assert.equal(monday.hasOverrides, true);
      assert.deepEqual(monday.timeSlots.map(slot => ({
        endTime: slot.endTime,
        isOverride: slot.isOverride,
        startTime: slot.startTime
      })), [
        { startTime: '1:00PM', endTime: '2:00pm', isOverride: false },
        { startTime: '2:00PM', endTime: '4:00PM', isOverride: true },
        { startTime: '4:00pm', endTime: '5:00PM', isOverride: false }
      ]);
    });

    it('requires continuous public-use hours for near-term availability', () => {
      const originalGetCurrentEasternTimeInfo = TimeUtils.getCurrentEasternTimeInfo;
      TimeUtils.getCurrentEasternTimeInfo = () => ({
        date: '2026-05-26', day: 'Tue', minutes: 13 * 60, isValid: true
      });

      try {
        const pool = new Pool(createSamplePoolData({
          schedules: [{
            startDate: '2026-05-23',
            endDate: '2026-09-07',
            hours: [
              { weekDays: ['Tue'], startTime: '1:00PM', endTime: '2:00PM', types: ['Rec Swim'], accessStatus: 'public' },
              { weekDays: ['Tue'], startTime: '2:00PM', endTime: '3:00PM', types: ['Closed to Public'], accessStatus: 'closed-to-public' },
              { weekDays: ['Tue'], startTime: '3:00PM', endTime: '5:00PM', types: ['Rec Swim'], accessStatus: 'public' }
            ]
          }]
        }));

        assert.equal(pool.isOpenForNextMinutes(), true);
        assert.equal(pool.isOpenForNextMinutes(60), true);
        assert.equal(pool.isOpenForNextMinutes(120), false);
        assert.equal(pool.opensWithinNextMinutes(), false);
        assert.deepEqual(pool.getPublicStatusTransitionToday(), { action: 'closes', minutes: 60 });
      } finally {
        TimeUtils.getCurrentEasternTimeInfo = originalGetCurrentEasternTimeInfo;
      }
    });

    it('applies dated overrides to live public availability', () => {
      const originalGetCurrentEasternTimeInfo = TimeUtils.getCurrentEasternTimeInfo;
      TimeUtils.getCurrentEasternTimeInfo = () => ({
        date: '2026-05-26', day: 'Tue', minutes: 14 * 60, isValid: true
      });

      try {
        const pool = new Pool(createSamplePoolData({
          schedules: [{
            startDate: '2026-05-23',
            endDate: '2026-09-07',
            hours: [{ weekDays: ['Tue'], startTime: '1:00PM', endTime: '5:00PM', types: ['Rec Swim'], accessStatus: 'public' }]
          }],
          scheduleOverrides: [{
            startDate: '2026-05-26',
            endDate: '2026-05-26',
            reason: 'Private event',
            hours: [{ weekDays: ['Tue'], startTime: '2:00PM', endTime: '3:00PM', types: ['Closed to Public'], accessStatus: 'closed-to-public' }]
          }]
        }));

        assert.equal(pool.getCurrentStatus(), PoolStatus.CLOSED_TO_PUBLIC);
        assert.equal(pool.isOpenForNextMinutes(), false);
        assert.deepEqual(pool.getPublicStatusTransitionToday(), { action: 'opens', minutes: 60 });
      } finally {
        TimeUtils.getCurrentEasternTimeInfo = originalGetCurrentEasternTimeInfo;
      }
    });

    it('finds the public opening after a morning swim meet', () => {
      const originalGetCurrentEasternTimeInfo = TimeUtils.getCurrentEasternTimeInfo;
      TimeUtils.getCurrentEasternTimeInfo = () => ({
        date: '2026-06-20', day: 'Sat', minutes: (11 * 60) + 15, isValid: true
      });

      try {
        const pool = new Pool(createSamplePoolData({
          schedules: [{
            startDate: '2026-06-19',
            endDate: '2026-08-09',
            hours: [
              { weekDays: ['Sat'], startTime: '7:00AM', endTime: '12:00PM', types: ['Swim Meet'], accessStatus: 'swim-meet' },
              { weekDays: ['Sat'], startTime: '12:00PM', endTime: '8:30PM', types: ['Rec Swim'], accessStatus: 'public' }
            ]
          }]
        }));

        assert.equal(pool.getCurrentStatus(), PoolStatus.SWIM_MEET);
        assert.deepEqual(pool.getPublicStatusTransitionToday(), { action: 'opens', minutes: 45 });
        assert.equal(pool.opensWithinNextMinutes(), true);
      } finally {
        TimeUtils.getCurrentEasternTimeInfo = originalGetCurrentEasternTimeInfo;
      }
    });

    it('finds the next public opening later today while closed', () => {
      const originalGetCurrentEasternTimeInfo = TimeUtils.getCurrentEasternTimeInfo;
      TimeUtils.getCurrentEasternTimeInfo = () => ({
        date: '2026-05-26', day: 'Tue', minutes: (13 * 60) + 31, isValid: true
      });

      try {
        const pool = new Pool(createSamplePoolData({
          schedules: [{
            startDate: '2026-05-23',
            endDate: '2026-09-07',
            hours: [
              { weekDays: ['Tue'], startTime: '2:00PM', endTime: '3:00PM', types: ['Closed to Public'], accessStatus: 'closed-to-public' },
              { weekDays: ['Tue'], startTime: '3:00PM', endTime: '5:00PM', types: ['Rec Swim'], accessStatus: 'public' }
            ]
          }]
        }));

        assert.deepEqual(pool.getPublicStatusTransitionToday(), { action: 'opens', minutes: 89 });
  assert.equal(pool.opensWithinNextMinutes(), false);
      } finally {
        TimeUtils.getCurrentEasternTimeInfo = originalGetCurrentEasternTimeInfo;
      }
    });

    it('does not find an opening when public hours resume on another day', () => {
      const originalGetCurrentEasternTimeInfo = TimeUtils.getCurrentEasternTimeInfo;
      TimeUtils.getCurrentEasternTimeInfo = () => ({
        date: '2026-05-26', day: 'Tue', minutes: 19 * 60, isValid: true
      });

      try {
        const pool = new Pool(createSamplePoolData({
          schedules: [{
            startDate: '2026-05-23',
            endDate: '2026-09-07',
            hours: [{ weekDays: ['Wed'], startTime: '12:00PM', endTime: '7:00PM', types: ['Rec Swim'], accessStatus: 'public' }]
          }]
        }));

        assert.equal(pool.getPublicStatusTransitionToday(), null);
        assert.equal(pool.isClosedToPublicAllDayToday(), true);
        assert.equal(pool.hasPublicUseToday(), false);
        assert.equal(pool.hasPublicUseTomorrow(), true);
        assert.equal(pool.isClosedToPublicForDay(), false);
      } finally {
        TimeUtils.getCurrentEasternTimeInfo = originalGetCurrentEasternTimeInfo;
      }
    });

    it('reports when the final public-use period today has ended', () => {
      const originalGetCurrentEasternTimeInfo = TimeUtils.getCurrentEasternTimeInfo;
      TimeUtils.getCurrentEasternTimeInfo = () => ({
        date: '2026-05-26', day: 'Tue', minutes: 18 * 60, isValid: true
      });

      try {
        const pool = new Pool(createSamplePoolData({
          schedules: [{
            startDate: '2026-05-23',
            endDate: '2026-09-07',
            hours: [{ weekDays: ['Tue'], startTime: '1:00PM', endTime: '5:00PM', types: ['Rec Swim'], accessStatus: 'public' }]
          }]
        }));

        assert.equal(pool.isClosedToPublicForDay(), true);
        assert.equal(pool.hasPublicUseToday(), true);
      } finally {
        TimeUtils.getCurrentEasternTimeInfo = originalGetCurrentEasternTimeInfo;
      }
    });

    it('returns the next opening rather than a closing transition while currently closed', () => {
      const originalGetCurrentEasternTimeInfo = TimeUtils.getCurrentEasternTimeInfo;
      TimeUtils.getCurrentEasternTimeInfo = () => ({
        date: '2026-05-26', day: 'Tue', minutes: 12 * 60, isValid: true
      });

      try {
        const pool = new Pool(createSamplePoolData({
          schedules: [{
            startDate: '2026-05-23',
            endDate: '2026-09-07',
            hours: [{ weekDays: ['Tue'], startTime: '1:00PM', endTime: '5:00PM', types: ['Rec Swim'], accessStatus: 'public' }]
          }]
        }));

        assert.deepEqual(pool.getPublicStatusTransitionToday(), { action: 'opens', minutes: 60 });
  assert.equal(pool.opensWithinNextMinutes(), true);
  assert.equal(pool.opensWithinNextMinutes(59), false);
  assert.equal(pool.opensWithinNextMinutes(-1), false);
      } finally {
        TimeUtils.getCurrentEasternTimeInfo = originalGetCurrentEasternTimeInfo;
      }
    });

    it('uses overrides without active periods', () => {
      const originalGetInfo = TimeUtils.getCurrentEasternTimeInfo;
      TimeUtils.getCurrentEasternTimeInfo = () => ({ date: '2026-06-08', day: 'Mon', minutes: 600, isValid: true });
      try {
        const pool = new Pool(createSamplePoolData({
          schedules: [{ startDate: '2026-06-01', endDate: '2026-06-07', hours: [] }],
          scheduleOverrides: [{
            startDate: '2026-06-08',
            endDate: '2026-06-08',
            hours: [{ weekDays: ['Mon'], startTime: '1:00PM', endTime: '2:00PM', accessStatus: 'closed-to-public' }]
          }]
        }));

        assert.equal(pool.isClosedToPublicAllDayToday(), true);
      } finally {
        TimeUtils.getCurrentEasternTimeInfo = originalGetInfo;
      }
    });

    it('maps declared schedule access statuses without interpreting activity labels', () => {
      const pool = new Pool(createSamplePoolData({ schedules: [] }));
      assert.equal(pool._getPeriodSlotStatus({ accessStatus: 'closed-to-public', types: ['Open-looking label'] }), PoolStatus.CLOSED_TO_PUBLIC);
      assert.equal(pool._getPeriodSlotStatus({ accessStatus: 'practice-only', types: ['Clippers Practice Only'] }), PoolStatus.PRACTICE_ONLY);
      assert.equal(pool._getPeriodSlotStatus({ accessStatus: 'swim-meet', types: ['Event'] }), PoolStatus.SWIM_MEET);
      assert.equal(pool._getPeriodSlotStatus({ accessStatus: 'public', types: ['CNSL Practice Only'] }), PoolStatus.OPEN);
      assert.equal(pool._getPeriodSlotStatus({ types: ['Rec Swim'] }), PoolStatus.RESTRICTED);
    });

    it('excludes declared team-only practice periods from public availability', () => {
      const originalGetInfo = TimeUtils.getCurrentEasternTimeInfo;
      TimeUtils.getCurrentEasternTimeInfo = () => ({ date: '2026-05-26', day: 'Tue', minutes: (15 * 60) + 30, isValid: true });
      try {
        const pool = new Pool(createSamplePoolData({ schedules: [{
          startDate: '2026-05-23',
          endDate: '2026-09-07',
          hours: [{ weekDays: ['Tue'], startTime: '3:00PM', endTime: '7:00PM', types: ['Clippers Practice Only'], accessStatus: 'practice-only' }]
        }] }));
        assert.equal(pool.getCurrentStatus(), PoolStatus.PRACTICE_ONLY);
        assert.equal(pool.getCurrentStatus().color, 'yellow');
        assert.equal(pool.isOpenForNextMinutes(), false);
        assert.equal(pool.isClosedToPublicAllDayToday(), true);
      } finally {
        TimeUtils.getCurrentEasternTimeInfo = originalGetInfo;
      }
    });

    it('handles period schedules without active hours and renders regular non-override weeks', () => {
      const originalGetInfo = TimeUtils.getCurrentEasternTimeInfo;
      TimeUtils.getCurrentEasternTimeInfo = () => ({ date: '2026-06-01', day: 'Mon', minutes: 600, isValid: true });
      try {
        assert.equal(new Pool(createSamplePoolData({ schedules: [] })).getCurrentStatus(), PoolStatus.SCHEDULE_NOT_FOUND);
        const pool = new Pool(createSamplePoolData({ schedules: [{ startDate: '2026-06-01', endDate: '2026-06-07', hours: [{ weekDays: ['Mon'], startTime: '2:00PM', endTime: '3:00PM', types: ['Rec Swim'] }, { weekDays: ['Mon'], startTime: '1:00PM', endTime: '2:00PM', types: ['Laps'] }] }] }));
        const monday = pool.getWeekScheduleForDate(new Date(2026, 5, 1))[0];
        assert.deepEqual(monday.timeSlots.map(slot => slot.startTime), ['1:00PM', '2:00PM']);
      } finally {
        TimeUtils.getCurrentEasternTimeInfo = originalGetInfo;
      }
    });

    it('returns safe fallbacks when period schedule dependencies or matching records are absent', () => {
      const pool = new Pool(createSamplePoolData({
        schedules: [{ startDate: '2026-06-01', endDate: '2026-06-07', hours: [{ weekDays: ['Mon'], startTime: '1:00PM', endTime: '2:00PM', types: ['Rec Swim'] }] }],
        scheduleOverrides: [{ startDate: '2026-06-08', endDate: '2026-06-08', hours: [{ weekDays: ['Mon'] }] }]
      }));
      const originalGetPoolStatus = pool._getPoolStatus;
      const originalGetTimeUtils = pool._getTimeUtils;
      pool._getPoolStatus = () => null;
      assert.equal(pool._getPeriodStatus().isOpen, false);
      pool._getPoolStatus = () => PoolStatus;
      pool._getTimeUtils = () => null;
      assert.equal(pool._getPeriodStatus(), PoolStatus.SCHEDULE_NOT_FOUND);
      assert.deepEqual(pool._getPeriodTimeSlotsForDate('2026-06-01', 'Mon'), []);
      assert.equal(pool._getPeriodSlotStatus({ types: ['Rec Swim'] }), PoolStatus.RESTRICTED);
      assert.equal(pool.getPublicStatusTransitionToday(), null);
      pool._getPoolStatus = originalGetPoolStatus;
      pool._getTimeUtils = originalGetTimeUtils;
    });

    it('returns safe fallbacks for invalid availability input and absent period collaborators', () => {
      const pool = new Pool(createSamplePoolData({ schedules: [] }));
      assert.equal(pool.isOpenForNextMinutes(Number.POSITIVE_INFINITY), false);

      const originalGetTimeUtils = pool._getTimeUtils;
      pool._getTimeUtils = () => null;
      assert.equal(pool.isOpenForNextMinutes(), false);
      assert.equal(pool.getPublicStatusTransitionToday(), null);
      assert.equal(pool.isClosedToPublicAllDayToday(), false);
      assert.equal(pool.hasPublicUseToday(), false);
      pool._getTimeUtils = originalGetTimeUtils;

      pool.periodSchedule = null;
      assert.equal(pool._getPeriodStatus(), PoolStatus.SCHEDULE_NOT_FOUND);
      assert.deepEqual(pool._getPeriodTimeSlotsForDate('2026-06-01', 'Mon'), []);
      assert.equal(pool._getPeriodSlotStatus({}).isOpen, false);
      assert.deepEqual(pool._getPeriodWeekScheduleForDate(new Date(2026, 5, 1)), []);
    });

    it('resolves lexical model dependencies when they are absent from globalThis', () => {
      const originalGlobalThis = poolContext.globalThis;
      poolContext.globalThis = {};
      try {
        const pool = new Pool(createSamplePoolData());
        assert.equal(pool._getTimeUtils(), TimeUtils);
        assert.equal(pool._getPoolStatus(), PoolStatus);
      } finally {
        poolContext.globalThis = originalGlobalThis;
      }
    });

    it('rejects an invalid Eastern calendar date when checking tomorrow', () => {
      const pool = new Pool(createSamplePoolData({ schedules: [] }));
      const originalGetInfo = TimeUtils.getCurrentEasternTimeInfo;
      try {
        TimeUtils.getCurrentEasternTimeInfo = () => ({ date: 'not-a-date', day: 'Mon', isValid: true });
        assert.equal(pool.hasPublicUseTomorrow(), false);
        TimeUtils.getCurrentEasternTimeInfo = () => ({ date: '2026-02-31', day: 'Tue', isValid: true });
        assert.equal(pool.hasPublicUseTomorrow(), false);
      } finally {
        TimeUtils.getCurrentEasternTimeInfo = originalGetInfo;
      }
    });

    it('checks future offsets against dated schedules and public access state', () => {
      const originalGetInfo = TimeUtils.getCurrentEasternTimeInfo;
      TimeUtils.getCurrentEasternTimeInfo = () => ({ date: '2026-06-15', day: 'Mon', isValid: true });
      try {
        const pool = new Pool(createSamplePoolData({ schedules: [{
          startDate: '2026-06-15',
          endDate: '2026-06-21',
          hours: [
            { weekDays: ['Wed'], startTime: '1:00PM', endTime: '3:00PM', accessStatus: 'public' },
            { weekDays: ['Wed'], startTime: '3:00PM', endTime: '5:00PM', accessStatus: 'public', isSpecialEvent: true },
            { weekDays: ['Thu'], startTime: '1:00PM', endTime: '5:00PM', accessStatus: 'practice-only' },
            { weekDays: ['Fri'], startTime: '6:00PM', endTime: '9:00PM', accessStatus: 'public', isSpecialEvent: true },
            { weekDays: ['Sun'], startTime: '1:00PM', endTime: '5:00PM', accessStatus: 'public' }
          ]
        }] }));

        assert.equal(pool.hasPublicUseOnDayOffset(2), true);
        assert.deepEqual(pool.getGeneralUseScheduleOnDayOffset(2), {
          date: '2026-06-17',
          dayName: 'Wednesday',
          shortDay: 'Wed',
          timeSlots: [{ startTime: '1:00PM', endTime: '3:00PM' }]
        });
        assert.equal(pool.hasPublicUseOnDayOffset(3), false);
        assert.equal(pool.hasPublicUseOnDayOffset(4), false);
        assert.equal(pool.hasPublicUseOnDayOffset(6), true);
        assert.equal(pool.hasPublicUseOnDayOffset(-1), false);
        assert.equal(pool.hasPublicUseOnDayOffset(1.5), false);
      } finally {
        TimeUtils.getCurrentEasternTimeInfo = originalGetInfo;
      }
    });

    it('requires both model dependencies when checking tomorrow', () => {
      const pool = new Pool(createSamplePoolData());
      const originalGetTimeUtils = pool._getTimeUtils;
      const originalGetPoolStatus = pool._getPoolStatus;
      try {
        pool._getTimeUtils = () => null;
        assert.equal(pool.hasPublicUseTomorrow(), false);
        pool._getTimeUtils = originalGetTimeUtils;
        pool._getPoolStatus = () => null;
        assert.equal(pool.hasPublicUseTomorrow(), false);
      } finally {
        pool._getTimeUtils = originalGetTimeUtils;
        pool._getPoolStatus = originalGetPoolStatus;
      }
    });

    it('rejects invalid Eastern time information when checking tomorrow', () => {
      const pool = new Pool(createSamplePoolData());
      const originalGetInfo = TimeUtils.getCurrentEasternTimeInfo;
      TimeUtils.getCurrentEasternTimeInfo = () => ({ isValid: false });
      try {
        assert.equal(pool.hasPublicUseTomorrow(), false);
      } finally {
        TimeUtils.getCurrentEasternTimeInfo = originalGetInfo;
      }
    });

    it('rejects invalid and next-day period availability windows', () => {
      const pool = new Pool(createSamplePoolData({ schedules: [{ startDate: '2026-06-01', endDate: '2026-06-07', hours: [] }] }));
      const originalGetInfo = TimeUtils.getCurrentEasternTimeInfo;
      try {
        TimeUtils.getCurrentEasternTimeInfo = () => ({ isValid: false });
        assert.equal(pool.isOpenForNextMinutes(), false);
        pool.getCurrentStatus = () => PoolStatus.CLOSED;
        assert.equal(pool.getPublicStatusTransitionToday(), null);
        assert.equal(pool.isClosedToPublicAllDayToday(), false);
        assert.equal(pool.hasPublicUseToday(), false);
        assert.equal(pool.isClosedToPublicForDay(), false);

        TimeUtils.getCurrentEasternTimeInfo = () => ({ date: '2026-06-01', day: 'Mon', minutes: 1430, isValid: true });
        assert.equal(pool.isOpenForNextMinutes(11), false);
      } finally {
        TimeUtils.getCurrentEasternTimeInfo = originalGetInfo;
      }
    });

    it('handles non-public and malformed period transition slots', () => {
      const pool = new Pool(createSamplePoolData({ schedules: [] }));
      const originalGetInfo = TimeUtils.getCurrentEasternTimeInfo;
      TimeUtils.getCurrentEasternTimeInfo = () => ({ date: '2026-06-01', day: 'Mon', minutes: 600, isValid: true });
      try {
        pool.getCurrentStatus = () => PoolStatus.RESTRICTED;
        assert.equal(pool.getPublicStatusTransitionToday(), null);

        pool.getCurrentStatus = () => PoolStatus.CLOSED;
        pool._getPeriodTimeSlotsForDate = () => [
          { accessStatus: 'closed-to-public', startTime: '9:00AM', endTime: '10:00AM' },
          { accessStatus: 'public' },
          { accessStatus: 'public', startTime: '11:00AM', endTime: '12:00PM' }
        ];
        assert.deepEqual(pool.getPublicStatusTransitionToday(), { action: 'opens', minutes: 60 });

        pool.getCurrentStatus = () => PoolStatus.OPEN;
        pool._getPeriodTimeSlotsForDate = () => [{ accessStatus: 'public', startTime: '9:00AM' }];
        assert.equal(pool.getPublicStatusTransitionToday(), null);
      } finally {
        TimeUtils.getCurrentEasternTimeInfo = originalGetInfo;
      }
    });

    it('rejects inactive period dates', () => {
      const originalGetCurrentEasternTimeInfo = TimeUtils.getCurrentEasternTimeInfo;
      try {
        TimeUtils.getCurrentEasternTimeInfo = () => ({ date: '2027-01-01', day: 'Fri', minutes: 600, isValid: true });
        const periodPool = new Pool(createSamplePoolData({ schedules: [{ startDate: '2026-06-01', endDate: '2026-06-07', hours: [] }] }));
        assert.equal(periodPool.isClosedToPublicAllDayToday(), false);
      } finally {
        TimeUtils.getCurrentEasternTimeInfo = originalGetCurrentEasternTimeInfo;
      }
    });

    it('sorts period days safely without TimeUtils', () => {
      const pool = new Pool(createSamplePoolData({
        schedules: [{ startDate: '2026-06-01', endDate: '2026-06-07', hours: [
          { weekDays: ['Mon'], startTime: '2:00PM', endTime: '3:00PM', types: ['Rec Swim'] },
          { weekDays: ['Mon'], startTime: 1, endTime: '2:00PM', types: ['Rec Swim'] }
        ] }]
      }));
      const originalGetTimeUtils = pool._getTimeUtils;
      pool._getTimeUtils = () => null;
      try {
        assert.equal(pool._getPeriodWeekScheduleForDate(new Date(2026, 5, 1))[0].timeSlots.length, 2);
      } finally {
        pool._getTimeUtils = originalGetTimeUtils;
      }
      assert.equal(pool._getPeriodWeekScheduleForDate(new Date(2026, 5, 1))[0].timeSlots.length, 2);
    });
  });

  describe('googleMapsUrl', () => {
    it('stores google maps URL from location', () => {
      const pool = new Pool(createSamplePoolData());
      assert.ok(pool.googleMapsUrl.includes('google'));
    });
  });

  describe('date ranges', () => {
    it('reports the first and last published schedule dates', () => {
      const pool = new Pool(createSamplePoolData({ schedules: [
        { startDate: '2026-06-01', endDate: '2026-06-14', hours: [] },
        { startDate: '2026-05-23', endDate: '2026-05-31', hours: [] }
      ] }));
      const range = pool.getValidDateRange();

      assert.equal(range.startDate.toISOString().slice(0, 10), '2026-05-23');
      assert.equal(range.endDate.toISOString().slice(0, 10), '2026-06-14');
    });

    it('returns null without published schedules', () => {
      assert.equal(new Pool(createSamplePoolData({ schedules: [] })).getValidDateRange(), null);
    });
  });

  describe('browser registration', () => {
    it('installs the model as a browser script global', () => {
      const sourcePath = path.join(__dirname, '..', '..', 'src', 'js', 'models', 'pool.js');
      const source = fs.readFileSync(sourcePath, 'utf8');
      const context = { window: {}, PoolPeriodScheduleService, TimeUtils, PoolStatus };
      Object.assign(context, context.globalThis || {}, context.window || {});
      context.globalThis = context; context.self = context; context.window = context;
      vm.runInNewContext(source, context, { filename: sourcePath });
      assert.equal(typeof context.window.Pool, 'function');
    });

    it('uses browser dependencies and degrades safely when they are absent', () => {
      const sourcePath = path.join(__dirname, '..', '..', 'src', 'js', 'models', 'pool.js');
      const source = fs.readFileSync(sourcePath, 'utf8');
      const context = { window: { TimeUtils, PoolStatus }, PoolPeriodScheduleService, console: { error: () => {} } };
      Object.assign(context, context.globalThis || {}, context.window || {});
      context.globalThis = context; context.self = context; context.window = context;
      vm.runInNewContext(source, context, { filename: sourcePath });
      const pool = new context.window.Pool({ schedules: [] });
      assert.equal(pool._getTimeUtils(), context.window.TimeUtils);
      assert.equal(pool._getPoolStatus(), context.window.PoolStatus);
      delete context.window.TimeUtils;
      delete context.window.PoolStatus;
      assert.equal(pool._getTimeUtils(), null);
      assert.equal(pool._getPoolStatus(), null);
      assert.equal(pool.getCurrentStatus().status, 'Error');
      context.window.PoolStatus = PoolStatus;
      assert.equal(new context.window.Pool({ schedules: [] }).getCurrentStatus(), PoolStatus.SCHEDULE_NOT_FOUND);
    });
  });
});
