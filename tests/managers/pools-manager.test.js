const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { createSamplePoolsManagerData, suppressConsole } = require('../helpers/test-helpers.js');
const PoolsManager = require('../../src/js/pools-manager.js');

describe('PoolsManager', () => {
  let manager;
  const sampleData = createSamplePoolsManagerData();

  beforeEach(() => {
    manager = new PoolsManager();
  });

  describe('constructor', () => {
    it('initializes with empty pools', () => {
      assert.equal(manager.isDataLoaded(), false);
    });
  });

  describe('loadData', () => {
    it('loads pool data from object with pools array', () => {
      suppressConsole(() => manager.loadData(sampleData));
      assert.equal(manager.isDataLoaded(), true);
    });
  });

  describe('getAllPools', () => {
    it('returns empty array before loading', () => {
      assert.ok(Array.isArray(manager.getAllPools()));
      assert.equal(manager.getAllPools().length, 0);
    });

    it('returns all loaded pools', () => {
      suppressConsole(() => manager.loadData(sampleData));
      assert.equal(manager.getAllPools().length, 2);
    });
  });

  describe('getPool', () => {
    it('finds pool by name', () => {
      suppressConsole(() => manager.loadData(sampleData));
      const pool = manager.getPool('Bryant Woods');
      assert.ok(pool);
      assert.equal(pool.name, 'Bryant Woods');
    });

    it('returns null for unknown pool', () => {
      suppressConsole(() => manager.loadData(sampleData));
      assert.equal(manager.getPool('Nonexistent'), null);
    });
  });

  describe('searchPools', () => {
    it('finds pools by partial name', () => {
      suppressConsole(() => manager.loadData(sampleData));
      const results = manager.searchPools('Bryant');
      assert.ok(results.length > 0);
    });

    it('returns empty for no match', () => {
      suppressConsole(() => manager.loadData(sampleData));
      const results = manager.searchPools('zzz_nonexistent');
      assert.equal(results.length, 0);
    });
  });

  describe('getStatistics', () => {
    it('returns statistics', () => {
      suppressConsole(() => {
        manager.loadData(sampleData);
        const stats = manager.getStatistics();
        assert.equal(typeof stats, 'object');
        assert.equal(stats.totalPools, 2);
      });
    });
  });

  describe('clearData', () => {
    it('clears all pool data', () => {
      suppressConsole(() => manager.loadData(sampleData));
      assert.equal(manager.isDataLoaded(), true);
      manager.clearData();
      assert.equal(manager.isDataLoaded(), false);
    });
  });
});
