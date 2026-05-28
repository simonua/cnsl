const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createSamplePoolsManagerData, suppressConsole } = require('../helpers/test-helpers.js');
const { PoolStatus } = require('../../src/js/types/pool-enums.js');
global.PoolStatus = PoolStatus;
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

    it('remains empty for documents without a pool collection', () => {
      manager.loadData(null);
      assert.equal(manager.isDataLoaded(), false);
      assert.equal(manager.getPoolCount(), 0);
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

    it('reports loaded pool names and counts', () => {
      suppressConsole(() => manager.loadData(sampleData));
      assert.deepEqual(manager.getPoolNames(), ['Bryant Woods', 'Kendall Ridge']);
      assert.equal(manager.getPoolCount(), 2);
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

    it('returns all pools for an empty term', () => {
      suppressConsole(() => manager.loadData(sampleData));
      assert.equal(manager.searchPools(' ').length, 2);
    });
  });

  describe('status and attribute filters', () => {
    it('filters open, closed, and matching status pools', () => {
      suppressConsole(() => manager.loadData(sampleData));
      const [openPool, closedPool] = manager.getAllPools();
      openPool.isOpenNow = () => true;
      openPool.getCurrentStatus = () => PoolStatus.OPEN;
      closedPool.isOpenNow = () => false;
      closedPool.getCurrentStatus = () => PoolStatus.CLOSED;

      assert.deepEqual(manager.getOpenPools(), [openPool]);
      assert.deepEqual(manager.getClosedPools(), [closedPool]);
      assert.deepEqual(manager.getPoolsByStatus(PoolStatus.OPEN), [openPool]);
    });

    it('filters features, amenities, and special pool facilities', () => {
      manager.loadData(createSamplePoolsManagerData([
        { name: 'A', features: ['Lap lanes', 'Slides'], amenities: ['Parking'], divingBoard: true, babyPool: false },
        { name: 'B', features: ['Lap lanes'], amenities: ['Parking', 'Wi-Fi'], divingBoard: false, babyPool: true }
      ]));

      assert.equal(manager.filterByFeatures([]).length, 2);
      assert.deepEqual(manager.filterByFeatures(['Lap lanes', 'Slides']).map(pool => pool.name), ['A']);
      assert.equal(manager.filterByAmenities(null).length, 2);
      assert.deepEqual(manager.filterByAmenities(['Wi-Fi']).map(pool => pool.name), ['B']);
      assert.deepEqual(manager.getPoolsWithDivingBoards().map(pool => pool.name), ['A']);
      assert.deepEqual(manager.getPoolsWithBabyPools().map(pool => pool.name), ['B']);
      assert.deepEqual(manager.getAllFeatures(), ['Lap lanes', 'Slides']);
      assert.deepEqual(manager.getAllAmenities(), ['Parking', 'Wi-Fi']);
      assert.deepEqual(manager.getStatistics(), {
        totalPools: 2,
        openPools: 0,
        closedPools: 2,
        openPercentage: 0,
        uniqueFeatures: 2,
        uniqueAmenities: 2,
        poolsWithDivingBoards: 1,
        poolsWithBabyPools: 1,
        lastUpdated: manager.lastUpdated
      });
    });

    it('sorts pool names alphabetically for distance placeholder behavior', () => {
      manager.loadData(createSamplePoolsManagerData([{ name: 'Zeta' }, { name: 'Alpha' }]));
      assert.deepEqual(manager.getPoolsByDistance({ lat: 0, lng: 0 }).map(pool => pool.name), ['Alpha', 'Zeta']);
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

    it('reports zero percentages when no pools are loaded', () => {
      assert.equal(manager.getStatistics().openPercentage, 0);
    });
  });

  describe('summaries, events, and export', () => {
    it('delegates summaries and today-event filtering to loaded pools', () => {
      manager.loadData(createSamplePoolsManagerData([{ name: 'A' }, { name: 'B' }]));
      const [first, second] = manager.getAllPools();
      first.getSummary = () => ({ name: 'A' });
      second.getSummary = () => ({ name: 'B' });
      first.getTodaysEvents = () => [{}];
      second.getTodaysEvents = () => [];

      assert.deepEqual(manager.getPoolsSummary(), [{ name: 'A' }, { name: 'B' }]);
      assert.deepEqual(manager.getPoolsWithTodaysEvents(), [first]);
      assert.equal(manager.exportData().pools.length, 2);
    });
  });

  describe('clearData', () => {
    it('clears all pool data', () => {
      suppressConsole(() => manager.loadData(sampleData));
      assert.equal(manager.isDataLoaded(), true);
      manager.clearData();
      assert.equal(manager.isDataLoaded(), false);
    });

    it('refreshes its update timestamp', async () => {
      await manager.refreshData();
      assert.match(manager.lastUpdated, /^\d{4}-\d{2}-\d{2}T/);
    });
  });

  describe('browser registration', () => {
    it('installs the manager as a browser script global', () => {
      const sourcePath = path.join(__dirname, '..', '..', 'src', 'js', 'pools-manager.js');
      const source = fs.readFileSync(sourcePath, 'utf8');
      const context = { window: {}, Pool: class {} };
      vm.runInNewContext(source, context, { filename: sourcePath });
      assert.equal(typeof context.window.PoolsManager, 'function');
    });
  });
});
