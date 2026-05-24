const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { createSamplePoolData, suppressConsole } = require('../helpers/test-helpers.js');
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
});
