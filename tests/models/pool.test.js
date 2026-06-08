const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createSamplePoolData, suppressConsole } = require('../helpers/test-helpers.js');
const { PoolStatus } = require('../../src/js/types/pool-enums.js');
const TimeUtils = require('../../src/js/services/time-utils.js');
const PoolPeriodScheduleService = require('../../src/js/services/pool-period-schedule-service.js');
global.PoolStatus = PoolStatus;
const Pool = require('../../src/js/models/pool.js');

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

    it('retains supported legacy flat location fields', () => {
      const pool = new Pool({ name: 'Legacy', address: 'Address', lat: 1, lng: 2, mapsQuery: 'Legacy Pool' });
      assert.equal(pool.address, 'Address');
      assert.equal(pool.toJSON().lat, 1);
      assert.equal(pool.toJSON().mapsQuery, 'Legacy Pool');
    });
  });

  describe('getName', () => {
    it('returns pool name', () => {
      const pool = new Pool(createSamplePoolData());
      assert.equal(pool.getName(), 'Bryant Woods');
    });
  });

  describe('published details', () => {
    it('returns feature, amenity, and contact values without exposing mutable arrays', () => {
      const pool = new Pool(createSamplePoolData({
        features: ['Lap lanes'],
        amenities: ['Bathhouse'],
        website: 'https://example.com/pool'
      }));
      const features = pool.getFeatures();
      const amenities = pool.getAmenities();
      features.push('Changed');
      amenities.push('Changed');

      assert.deepEqual(pool.getFeatures(), ['Lap lanes']);
      assert.deepEqual(pool.getAmenities(), ['Bathhouse']);
      assert.equal(pool.hasFeature('Lap lanes'), true);
      assert.equal(pool.hasAmenity('Bathhouse'), true);
      assert.deepEqual(pool.getContactInfo(), {
        address: 'Columbia, MD 21044',
        phone: '410-555-1234',
        website: 'https://example.com/pool'
      });
    });

    it('searches name, address, feature, and amenity content case insensitively', () => {
      const pool = new Pool(createSamplePoolData({
        features: ['Beach entry'],
        amenities: ['Changing room']
      }));

      assert.equal(pool.search('bRyAnT').matches.name, true);
      assert.equal(pool.search('columbia').matches.address, true);
      assert.equal(pool.search('beach').matches.features, true);
      assert.equal(pool.search('changing').matches.amenities, true);
      assert.equal(pool.search('not present').hasMatch, false);
    });
  });

  describe('schedule output', () => {
    it('delegates new-format hours and status checks to the schedule model', () => {
      const pool = new Pool(createSamplePoolData({
        hours: { Monday: { open: '9:00AM', close: '5:00PM' } }
      }));
      pool.schedule.getCurrentStatus = () => PoolStatus.CLOSED;

      assert.equal(pool.getHoursForDay('Monday'), '9:00AM - 5:00PM');
      assert.equal(pool.getStatusAtTime('Monday', new Date(2026, 5, 1, 12, 0)), PoolStatus.OPEN);
      assert.equal(pool.getWeekSchedule().length, 7);
      assert.equal(pool.getWeekScheduleForDate(new Date(2026, 5, 1)).length, 7);
      assert.equal(pool.getTimeSlots('Monday').length, 8);
      assert.equal(pool.getCurrentStatus(), PoolStatus.CLOSED);
    });

    it('reports schedule missing when new-format data is empty', () => {
      assert.equal(new Pool({ name: 'No hours' }).getCurrentStatus(), PoolStatus.SCHEDULE_NOT_FOUND);
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
        assert.equal(pool.getPublicStatusTransitionToday(), null);
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
            hours: [{ weekDays: ['Wed'], startTime: '12:00PM', endTime: '7:00PM', types: ['Rec Swim'] }]
          }]
        }));

        assert.equal(pool.getPublicStatusTransitionToday(), null);
        assert.equal(pool.isClosedToPublicAllDayToday(), true);
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

    it('finds new-format same-day public transitions and continuous availability', () => {
      const original = {
        getEasternTime: TimeUtils.getEasternTime,
        getDayName: TimeUtils.getDayName,
        formatTimeForComparison: TimeUtils.formatTimeForComparison
      };
      TimeUtils.getEasternTime = () => new Date(2026, 5, 1, 8, 0);
      TimeUtils.getDayName = () => 'Monday';
      TimeUtils.formatTimeForComparison = () => 8 * 60;
      try {
        const pool = new Pool(createSamplePoolData({ hours: { Monday: { open: '9:00AM', close: '5:00PM' } } }));
        assert.deepEqual(pool.getPublicStatusTransitionToday(), { action: 'opens', minutes: 60 });
        TimeUtils.getEasternTime = () => new Date(2026, 5, 1, 10, 0);
        TimeUtils.formatTimeForComparison = () => 10 * 60;
        assert.deepEqual(pool.getPublicStatusTransitionToday(), { action: 'closes', minutes: 420 });
        assert.equal(pool.isOpenForNextMinutes(2), true);
        assert.equal(pool.isOpenForNextMinutes(-1), false);
        const restricted = new Pool(createSamplePoolData({ hours: { Monday: { open: '9:00AM', close: '5:00PM', restrictions: [{ start: '2:00PM' }] } } }));
        restricted.getCurrentStatus = () => PoolStatus.OPEN;
        assert.deepEqual(restricted.getPublicStatusTransitionToday(), { action: 'closes', minutes: 240 });
        const closed = new Pool(createSamplePoolData({ hours: { Tuesday: { open: '9:00AM', close: '5:00PM' } } }));
        closed.getCurrentStatus = () => PoolStatus.CLOSED;
        assert.equal(closed.getPublicStatusTransitionToday(), null);
        assert.equal(closed.isClosedToPublicAllDayToday(), false);
        const explicitlyClosed = new Pool(createSamplePoolData({ hours: { Monday: { closed: true } } }));
        assert.equal(explicitlyClosed.isClosedToPublicAllDayToday(), true);
      } finally {
        Object.assign(TimeUtils, original);
      }
    });

    it('maps declared schedule access statuses without interpreting activity labels', () => {
      const pool = new Pool(createSamplePoolData({ schedules: [] }));
      assert.equal(pool._getPeriodSlotStatus({ accessStatus: 'closed-to-public', types: ['Open-looking label'] }), PoolStatus.CLOSED_TO_PUBLIC);
      assert.equal(pool._getPeriodSlotStatus({ accessStatus: 'practice-only', types: ['Clippers Practice Only'] }), PoolStatus.PRACTICE_ONLY);
      assert.equal(pool._getPeriodSlotStatus({ accessStatus: 'swim-meet', types: ['Event'] }), PoolStatus.SWIM_MEET);
      assert.equal(pool._getPeriodSlotStatus({ accessStatus: 'public', types: ['CNSL Practice Only'] }), PoolStatus.OPEN);
      assert.equal(pool._getPeriodSlotStatus({ types: ['Rec Swim'] }), PoolStatus.RESTRICTED);
      suppressConsole(() => assert.equal(pool._getPeriodStatusAtMinutes([{}], 60), PoolStatus.CLOSED));
      pool.scheduleOverrides = null;
      assert.equal(pool._getScheduleOverrideForDate('2026-05-26', 'Tue'), null);
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

    it('renders the current period week through the date-aware schedule path', () => {
      const pool = new Pool(createSamplePoolData({ schedules: [{ startDate: '2026-01-01', endDate: '2026-12-31', hours: [] }] }));
      let requestedWeekStart;
      pool._getPeriodWeekScheduleForDate = weekStartDate => {
        requestedWeekStart = weekStartDate;
        return ['week'];
      };

      assert.deepEqual(pool.getWeekSchedule(), ['week']);
      assert.equal(requestedWeekStart.getDay(), 1);
    });

    it('returns safe fallbacks when period schedule dependencies or matching records are absent', () => {
      const pool = new Pool(createSamplePoolData({
        schedules: [{ startDate: '2026-06-01', endDate: '2026-06-07', hours: [{ weekDays: ['Mon'], startTime: '1:00PM', endTime: '2:00PM', types: ['Rec Swim'] }] }],
        scheduleOverrides: [{ startDate: '2026-06-08', endDate: '2026-06-08', hours: [{ weekDays: ['Mon'] }] }]
      }));
      const originalGetPoolStatus = pool._getPoolStatus;
      const originalGetTimeUtils = pool._getTimeUtils;
      pool._getPoolStatus = () => null;
      assert.equal(pool._getPeriodStatus().status, 'Error');
      pool._getPoolStatus = () => PoolStatus;
      pool._getTimeUtils = () => null;
      assert.equal(pool._getPeriodStatus(), PoolStatus.SCHEDULE_NOT_FOUND);
      assert.deepEqual(pool._getPeriodTimeSlotsForDate('2026-06-01', 'Mon'), []);
      assert.equal(pool._getPeriodSlotStatus({ types: ['Rec Swim'] }), PoolStatus.RESTRICTED);
      assert.equal(pool._getPeriodStatusAtMinutes([], 0).isOpen, false);
      assert.equal(pool.getPublicStatusTransitionToday(), null);
      assert.equal(pool.getCurrentRestrictions().length, 0);
      assert.equal(pool.getTodaysEvents().length, 0);
      pool._getPoolStatus = originalGetPoolStatus;
      pool._getTimeUtils = originalGetTimeUtils;
      assert.equal(pool._getScheduleOverrideForDate('2026-06-01', 'Mon'), undefined);
    });

    it('tolerates invalid merge times', () => {
      const pool = new Pool(createSamplePoolData());
      const merged = suppressConsole(() => pool._mergeScheduleWithOverride(
        { hours: [{ weekDays: ['Mon'], startTime: 1, endTime: '2:00PM', types: ['Rec Swim'] }] },
        'Mon',
        { reason: '', hours: [{ weekDays: ['Mon'], startTime: '1:00PM', endTime: '2:00PM', types: ['Closed'] }] }
      ));
      assert.ok(Array.isArray(merged));
    });

    it('sorts period days safely without TimeUtils and reports absent optional projections', () => {
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
        assert.equal(pool.getCurrentSchedulePeriod(), null);
      } finally {
        pool._getTimeUtils = originalGetTimeUtils;
      }
      assert.equal(pool._getPeriodWeekScheduleForDate(new Date(2026, 5, 1))[0].timeSlots.length, 2);
      const noOptions = new Pool(createSamplePoolData({ hours: { Monday: { open: '9:00AM', close: '5:00PM' } }, specialEvents: [] }));
      assert.deepEqual(noOptions.getCurrentRestrictions(), []);
      assert.deepEqual(noOptions.getTodaysEvents(), []);
      const originalGetCurrentEasternTimeInfo = TimeUtils.getCurrentEasternTimeInfo;
      TimeUtils.getCurrentEasternTimeInfo = () => ({ date: '2026-08-01' });
      try {
        assert.equal(pool.getCurrentSchedulePeriod(), null);
      } finally {
        TimeUtils.getCurrentEasternTimeInfo = originalGetCurrentEasternTimeInfo;
      }
    });
  });

  describe('googleMapsUrl', () => {
    it('stores google maps URL from location', () => {
      const pool = new Pool(createSamplePoolData());
      assert.ok(pool.googleMapsUrl.includes('google'));
    });
  });

  describe('toJSON', () => {
    it('returns a plain object', () => {
      const pool = new Pool(createSamplePoolData({ laneCount: 6, laneLengthUnits: 'yards', laneLength: 25 }));
      const json = pool.toJSON();
      assert.equal(typeof json, 'object');
      assert.equal(json.id, 'bwp');
      assert.equal(json.name, 'Bryant Woods');
      assert.equal(json.laneCount, 6);
      assert.equal(json.laneLengthUnits, 'yards');
      assert.equal(json.laneLength, 25);
    });

    it('retains published schedule periods needed by weather operating windows', () => {
      const schedules = [{ startDate: '2026-05-23', endDate: '2026-09-07', hours: [] }];
      const pool = new Pool(createSamplePoolData({ schedules }));

      assert.deepEqual(pool.toJSON().schedules, schedules);
    });
  });

  describe('getSummary', () => {
    it('returns a summary object', () => {
      suppressConsole(() => {
        const pool = new Pool(createSamplePoolData());
        const summary = pool.getSummary();
        assert.equal(typeof summary, 'object');
        assert.ok('name' in summary);
      });
    });

    it('reports current restrictions, events, upcoming events, and detailed projections', () => {
      const originalGetDayName = TimeUtils.getDayName;
      const originalFormatDate = TimeUtils.formatDate;
      TimeUtils.getDayName = () => 'Monday';
      TimeUtils.formatDate = () => '2026-05-28';
      try {
        const tomorrow = new Date(Date.now() + (24 * 60 * 60 * 1000)).toISOString();
        const pool = new Pool(createSamplePoolData({
          hours: { Monday: { open: '12:00AM', close: '11:59PM', restrictions: [{ type: 'practice', start: '12:00AM', end: '11:59PM' }] } },
          specialEvents: [{ date: '2026-05-28', name: 'Today' }, { date: tomorrow, name: 'Upcoming' }],
          divingBoard: true,
          babyPool: true
        }));
        assert.equal(pool.getCurrentStatus(), PoolStatus.PRACTICE_ONLY);
        assert.equal(pool.isOpenNow(), true);
        assert.equal(pool.getCurrentRestrictions().length, 1);
        assert.equal(pool.getTodaysEvents().length, 1);
        assert.equal(pool.getUpcomingEvents().length, 1);
        assert.equal(pool.getSummary().hasEvents, true);
        const detail = pool.getDetailedInfo();
        assert.equal(detail.divingBoard, true);
        assert.equal(detail.restrictions.length, 1);
      } finally {
        TimeUtils.getDayName = originalGetDayName;
        TimeUtils.formatDate = originalFormatDate;
      }
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

    it('returns current period details and null for unscoped hours', () => {
      const originalGetCurrentEasternTimeInfo = TimeUtils.getCurrentEasternTimeInfo;
      TimeUtils.getCurrentEasternTimeInfo = () => ({ date: '2026-06-01' });
      try {
        const pool = new Pool(createSamplePoolData({ schedules: [{ name: 'Summer', startDate: '2026-06-01', endDate: '2026-06-14', hours: [] }] }));
        assert.deepEqual(pool.getCurrentSchedulePeriod(), { name: 'Summer', startDate: '2026-06-01', endDate: '2026-06-14' });
        assert.equal(new Pool(createSamplePoolData({ hours: {} })).getCurrentSchedulePeriod(), null);
        assert.equal(new Pool(createSamplePoolData({ hours: {} })).getValidDateRange(), null);
      } finally {
        TimeUtils.getCurrentEasternTimeInfo = originalGetCurrentEasternTimeInfo;
      }
    });
  });

  describe('browser registration', () => {
    it('installs the model as a browser script global', () => {
      const sourcePath = path.join(__dirname, '..', '..', 'src', 'js', 'models', 'pool.js');
      const source = fs.readFileSync(sourcePath, 'utf8');
      const context = { window: {}, PoolSchedule: class {}, PoolPeriodScheduleService, TimeUtils, PoolStatus };
      vm.runInNewContext(source, context, { filename: sourcePath });
      assert.equal(typeof context.window.Pool, 'function');
    });

    it('uses browser dependencies and degrades safely when they are absent', () => {
      const sourcePath = path.join(__dirname, '..', '..', 'src', 'js', 'models', 'pool.js');
      const source = fs.readFileSync(sourcePath, 'utf8');
      class ScheduleStub {
        constructor(data) { this.data = data; }
        hasScheduleData() { return false; }
      }
      const context = { window: { TimeUtils, PoolStatus }, PoolSchedule: ScheduleStub, PoolPeriodScheduleService, console: { error: () => {} } };
      vm.runInNewContext(source, context, { filename: sourcePath });
      const pool = new context.window.Pool({ hours: {} });
      assert.equal(pool._getTimeUtils(), context.window.TimeUtils);
      assert.equal(pool._getPoolStatus(), context.window.PoolStatus);
      delete context.window.TimeUtils;
      delete context.window.PoolStatus;
      assert.equal(pool._getTimeUtils(), null);
      assert.equal(pool._getPoolStatus(), null);
      assert.equal(pool.getCurrentStatus().status, 'Error');
      assert.equal(Object.keys(new context.window.Pool({ schedules: [] }).schedule.data).length, 0);
      context.window.PoolStatus = PoolStatus;
      assert.equal(new context.window.Pool({ schedules: [] }).getCurrentStatus(), PoolStatus.SCHEDULE_NOT_FOUND);
      assert.equal(new context.window.Pool({ schedules: [{ startDate: '2026-01-01', endDate: '2026-12-31', hours: [] }] }).getCurrentSchedulePeriod(), null);
    });
  });
});
