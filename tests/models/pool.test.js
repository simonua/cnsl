const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { createSamplePoolData, suppressConsole } = require('../helpers/test-helpers.js');
const { PoolStatus } = require('../../src/js/types/pool-enums.js');
const TimeUtils = require('../../src/js/services/time-utils.js');
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

      assert.equal(pool.getHoursForDay('Monday'), '9:00AM - 5:00PM');
      assert.equal(pool.getStatusAtTime('Monday', new Date(2026, 5, 1, 12, 0)), PoolStatus.OPEN);
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
              { weekDays: ['Tue'], startTime: '1:00PM', endTime: '2:00PM', types: ['Rec Swim'] },
              { weekDays: ['Tue'], startTime: '2:00PM', endTime: '3:00PM', types: ['Closed to Public'] },
              { weekDays: ['Tue'], startTime: '3:00PM', endTime: '5:00PM', types: ['Rec Swim'] }
            ]
          }]
        }));

        assert.equal(pool.isOpenForNextMinutes(), true);
        assert.equal(pool.isOpenForNextMinutes(60), true);
        assert.equal(pool.isOpenForNextMinutes(120), false);
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
            hours: [{ weekDays: ['Tue'], startTime: '1:00PM', endTime: '5:00PM', types: ['Rec Swim'] }]
          }],
          scheduleOverrides: [{
            startDate: '2026-05-26',
            endDate: '2026-05-26',
            reason: 'Private event',
            hours: [{ weekDays: ['Tue'], startTime: '2:00PM', endTime: '3:00PM', types: ['Closed to Public'] }]
          }]
        }));

        assert.equal(pool.getCurrentStatus(), PoolStatus.CLOSED_TO_PUBLIC);
        assert.equal(pool.isOpenForNextMinutes(), false);
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
      const pool = new Pool(createSamplePoolData());
      const json = pool.toJSON();
      assert.equal(typeof json, 'object');
      assert.equal(json.id, 'bwp');
      assert.equal(json.name, 'Bryant Woods');
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
  });
});
