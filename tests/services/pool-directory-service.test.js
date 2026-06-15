const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { PoolDirectoryService } = require('../helpers/browser-module-loader.js').loadBrowserModule('pool-directory-service');

describe('PoolDirectoryService', () => {
  it('accepts only supported availability filters', () => {
    assert.equal(PoolDirectoryService.isAvailabilityFilter('open-now'), true);
    assert.equal(PoolDirectoryService.isAvailabilityFilter('opens-soon'), true);
    assert.equal(PoolDirectoryService.isAvailabilityFilter('open-today'), true);
    assert.equal(PoolDirectoryService.isAvailabilityFilter('open-tomorrow'), true);
    assert.equal(PoolDirectoryService.isAvailabilityFilter('open-day-2'), true);
    assert.equal(PoolDirectoryService.isAvailabilityFilter('open-day-6'), true);
    assert.equal(PoolDirectoryService.isAvailabilityFilter('unknown'), false);
  });

  it('builds five rolling weekday choices after today and tomorrow', () => {
    const mondayOptions = PoolDirectoryService.getUpcomingDayAvailabilityOptions('2026-06-15');
    assert.deepEqual(mondayOptions.map(option => [option.value, option.dayOffset, option.label]), [
      ['open-day-2', 2, 'Wednesday'],
      ['open-day-3', 3, 'Thursday'],
      ['open-day-4', 4, 'Friday'],
      ['open-day-5', 5, 'Saturday'],
      ['open-day-6', 6, 'Sunday']
    ]);
    assert.deepEqual(
      PoolDirectoryService.getUpcomingDayAvailabilityOptions('2026-06-16').map(option => option.label),
      ['Thursday', 'Friday', 'Saturday', 'Sunday', 'Monday']
    );
    assert.deepEqual(PoolDirectoryService.getUpcomingDayAvailabilityOptions('not-a-date'), []);
    assert.deepEqual(PoolDirectoryService.getUpcomingDayAvailabilityOptions('2026-02-31'), []);
  });

  it('describes fixed and rolling availability choices', () => {
    assert.equal(PoolDirectoryService.getAvailabilityFilterDescription('opens-soon', '2026-06-15'), 'pools opening within the hour');
    assert.equal(PoolDirectoryService.getAvailabilityFilterDescription('open-today', '2026-06-15'), 'pools with general-use hours today');
    assert.equal(PoolDirectoryService.getAvailabilityFilterDescription('open-day-2', '2026-06-15'), 'pools with general-use hours Wednesday');
    assert.equal(PoolDirectoryService.getAvailabilityFilterDescription('unknown', '2026-06-15'), 'all pools');
  });

  it('resolves only future day filters to positive offsets', () => {
    assert.equal(PoolDirectoryService.getFutureAvailabilityDayOffset('open-today'), null);
    assert.equal(PoolDirectoryService.getFutureAvailabilityDayOffset('open-tomorrow'), 1);
    assert.equal(PoolDirectoryService.getFutureAvailabilityDayOffset('open-day-6'), 6);
    assert.equal(PoolDirectoryService.getFutureAvailabilityDayOffset('open-now'), null);
  });

  it('formats and merges compact future-day general-use hours', () => {
    const timeUtils = {
      timeStringToMinutes: value => ({
        '1:00PM': 13 * 60,
        '4:30PM': (16 * 60) + 30,
        '4:30pm': (16 * 60) + 30,
        '7:00PM': 19 * 60,
        '8:00PM': 20 * 60
      })[value]
    };
    const summary = PoolDirectoryService.formatGeneralUseScheduleSummary({
      shortDay: 'Tue',
      dayName: 'Tuesday',
      timeSlots: [
        { startTime: '4:30pm', endTime: '7:00PM' },
        { startTime: '1:00PM', endTime: '4:30PM' },
        { startTime: '7:00PM', endTime: '8:00PM' }
      ]
    }, timeUtils);

    assert.deepEqual(summary, {
      text: 'Tue 1pm - 8pm',
      label: 'Tuesday general-use hours: 1:00 PM to 8:00 PM'
    });
    assert.deepEqual(PoolDirectoryService.formatGeneralUseScheduleSummary(null, timeUtils), { text: '', label: '' });
    assert.deepEqual(PoolDirectoryService.formatGeneralUseScheduleSummary({}, timeUtils), { text: '', label: '' });
    assert.deepEqual(PoolDirectoryService.formatGeneralUseScheduleSummary({ timeSlots: [] }, timeUtils), { text: '', label: '' });
    assert.deepEqual(PoolDirectoryService.formatGeneralUseScheduleSummary({ timeSlots: [{}] }, null), { text: '', label: '' });
  });

  it('formats disjoint ranges with midnight and partial-hour times', () => {
    const times = new Map([
      ['12:00AM', 0],
      ['12:30AM', 30],
      ['1:15PM', (13 * 60) + 15],
      ['2:45PM', (14 * 60) + 45]
    ]);
    const summary = PoolDirectoryService.formatGeneralUseScheduleSummary({
      shortDay: 'Sat',
      dayName: 'Saturday',
      timeSlots: [
        { startTime: '12:00AM', endTime: '12:30AM' },
        { startTime: '1:15PM', endTime: '2:45PM' }
      ]
    }, { timeStringToMinutes: value => times.get(value) });

    assert.deepEqual(summary, {
      text: 'Sat 12am - 12:30am; 1:15pm - 2:45pm',
      label: 'Saturday general-use hours: 12:00 AM to 12:30 AM; 1:15 PM to 2:45 PM'
    });
  });

  it('omits malformed and reversed future-day time ranges', () => {
    const timeUtils = {
      timeStringToMinutes: value => {
        if (value === 'bad') throw new Error('Invalid time');
        return value === '7:00PM' ? 19 * 60 : 20 * 60;
      }
    };
    const summary = PoolDirectoryService.formatGeneralUseScheduleSummary({
      shortDay: 'Tue',
      dayName: 'Tuesday',
      timeSlots: [
        { startTime: 'bad', endTime: '8:00PM' },
        { startTime: '8:00PM', endTime: '7:00PM' }
      ]
    }, timeUtils);

    assert.deepEqual(summary, { text: '', label: '' });
  });

  it('matches semantic pool availability rules without inspecting presentation state', () => {
    const model = {
      hasPublicUseToday: () => true,
      hasPublicUseTomorrow: () => false,
      hasPublicUseOnDayOffset: dayOffset => dayOffset === 2,
      opensWithinNextMinutes: minutes => minutes === PoolDirectoryService.OPENING_SOON_MINUTES,
      isOpenForNextMinutes: minutes => minutes === undefined
    };

    assert.equal(PoolDirectoryService.matchesAvailabilityFilter(model, 'all'), true);
    assert.equal(PoolDirectoryService.matchesAvailabilityFilter(model, 'open-now'), true);
    assert.equal(PoolDirectoryService.matchesAvailabilityFilter(model, 'opens-soon'), true);
    assert.equal(PoolDirectoryService.matchesAvailabilityFilter(model, 'open-today'), true);
    assert.equal(PoolDirectoryService.matchesAvailabilityFilter(model, 'open-tomorrow'), false);
    assert.equal(PoolDirectoryService.matchesAvailabilityFilter(model, 'open-day-2'), true);
    assert.equal(PoolDirectoryService.matchesAvailabilityFilter(model, 'open-next-two-hours'), false);
    assert.equal(PoolDirectoryService.matchesAvailabilityFilter(model, 'unknown'), false);
    assert.equal(PoolDirectoryService.matchesAvailabilityFilter(null, 'open-now'), false);
  });

  it('filters records and builds live signatures through a model lookup callback', () => {
    const pools = [{ id: 'open', name: 'Open' }, { id: 'soon', name: 'Soon' }, { id: 'missing', name: 'Missing' }];
    const models = new Map([
      ['Open', {
        getCurrentStatus: () => ({ kind: 'open' }),
        hasPublicUseToday: () => true,
        hasPublicUseTomorrow: () => false,
        hasPublicUseOnDayOffset: () => false,
        isOpenForNextMinutes: minutes => minutes === undefined,
        opensWithinNextMinutes: () => false
      }],
      ['Soon', {
        getCurrentStatus: () => ({ kind: 'closed' }),
        hasPublicUseToday: () => true,
        hasPublicUseTomorrow: () => true,
        hasPublicUseOnDayOffset: dayOffset => dayOffset === 2,
        isOpenForNextMinutes: () => false,
        opensWithinNextMinutes: minutes => minutes === PoolDirectoryService.OPENING_SOON_MINUTES
      }]
    ]);
    const getPoolModel = pool => models.get(pool.name);

    assert.equal(PoolDirectoryService.filterByAvailability(pools, 'all', getPoolModel), pools);
    assert.deepEqual(
      PoolDirectoryService.filterByAvailability(pools, 'opens-soon', getPoolModel),
      [pools[1]]
    );
    assert.equal(
      PoolDirectoryService.getLiveStatusSignature(pools, 'opens-soon', getPoolModel),
      'open:open:false|soon:closed:true|missing:unavailable'
    );
    assert.equal(PoolDirectoryService.getLiveStatusSignature(pools, 'all', null), '');
    assert.equal(PoolDirectoryService.getLiveStatusSignature(
      [{ name: 'Named Pool' }],
      'all',
      () => ({ getCurrentStatus: () => ({ kind: 'closed' }) })
    ), 'Named Pool:closed:');
    assert.equal(PoolDirectoryService.getLiveStatusSignature([{ name: 'Unavailable Name' }], 'all', () => null), 'Unavailable Name:unavailable');
  });

  it('formats and orders feature labels through supplied groups', () => {
    const groups = () => [{ features: ['wifi', 'shallow', 'ada compliant'] }];
    assert.deepEqual(PoolDirectoryService.sortFeaturesForDisplay([], groups), ['ada compliant', 'shallow', 'wifi']);
    assert.equal(PoolDirectoryService.formatFeatureLabel('wifi'), 'Wi-Fi');
    assert.equal(PoolDirectoryService.formatFeatureLabel('lap lanes'), 'Lap lanes');
  });

  it('adds distances without mutating records and leaves missing locations untouched', () => {
    const pools = [{ name: 'Nearby', location: { lat: 39.2, lng: -76.8 } }, { name: 'Unknown' }];
    const withDistances = PoolDirectoryService.addDistances(pools, { lat: 39.2, lng: -76.8 });

    assert.equal(withDistances[0].distance, 0);
    assert.equal(withDistances[0].name, pools[0].name);
    assert.equal(Object.hasOwn(pools[0], 'distance'), false);
    assert.equal(withDistances[1], pools[1]);
  });

  it('returns original records without coordinates and supports flat coordinate records', () => {
    const pools = [{ name: 'Flat', lat: 39.2, lng: -76.8 }, null];
    assert.equal(PoolDirectoryService.addDistances(pools, null), pools);
    const withDistances = PoolDirectoryService.addDistances(pools, { lat: 39.2, lng: -76.8 });
    assert.equal(withDistances[0].distance, 0);
    assert.equal(withDistances[1], null);
  });

  it('installs the service as a browser script global', () => {
    const sourcePath = path.join(__dirname, '..', '..', 'src', 'js', 'services', 'pool-directory-service.js');
    const source = fs.readFileSync(sourcePath, 'utf8');
    const context = { window: {} };
    Object.assign(context, context.globalThis || {}, context.window || {});
    context.globalThis = context; context.self = context; context.window = context;
    vm.runInNewContext(source, context, { filename: sourcePath });

    assert.equal(typeof context.window.PoolDirectoryService, 'function');
  });
});
