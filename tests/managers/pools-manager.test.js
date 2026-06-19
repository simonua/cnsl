const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createSamplePoolsManagerData, suppressConsole } = require('../helpers/test-helpers.js');
const { PoolStatus, PoolsManager } = require('../helpers/browser-module-loader.js').loadBrowserModule('pools-manager');

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

    it('filters status by semantic kind when visible copy changes', () => {
      suppressConsole(() => manager.loadData(sampleData));
      const [openPool] = manager.getAllPools();
      openPool.getCurrentStatus = () => ({ ...PoolStatus.OPEN, status: 'Visitor-facing copy changed' });

      assert.deepEqual(manager.getPoolsByStatus({ ...PoolStatus.OPEN, status: 'Different visible copy' }), [openPool]);
    });

    it('filters and reports published features', () => {
      manager.loadData(createSamplePoolsManagerData([
        { name: 'A', features: ['Lap lanes', 'Slides'] },
        { name: 'B', features: ['Lap lanes'] }
      ]));

      assert.equal(manager.filterByFeatures([]).length, 2);
      assert.deepEqual(manager.filterByFeatures(['Lap lanes', 'Slides']).map(pool => pool.name), ['A']);
      assert.deepEqual(manager.getAllFeatures(), ['Lap lanes', 'Slides']);
      assert.deepEqual(manager.getStatistics(), {
        totalPools: 2,
        openPools: 0,
        closedPools: 2,
        openPercentage: 0,
        uniqueFeatures: 2,
        lastUpdated: manager.lastUpdated
      });
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

  describe('export', () => {
    it('exports canonical loaded pools', () => {
      manager.loadData(createSamplePoolsManagerData([{ name: 'A' }, { name: 'B' }]));
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

  });

  describe('browser registration', () => {
    it('installs the manager as a browser script global', () => {
      const sourcePath = path.join(__dirname, '..', '..', 'src', 'js', 'managers', 'pools-manager.js');
      const source = fs.readFileSync(sourcePath, 'utf8');
      const context = { window: {}, Pool: class {} };
      Object.assign(context, context.globalThis || {}, context.window || {});
      context.globalThis = context; context.self = context; context.window = context;
      vm.runInNewContext(source, context, { filename: sourcePath });
      assert.equal(typeof context.window.PoolsManager, 'function');
    });
  });
});
