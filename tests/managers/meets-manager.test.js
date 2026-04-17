const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { createSampleMeetsData, suppressConsole } = require('../helpers/test-helpers.js');
const MeetsManager = require('../../src/js/meets-manager.js');

describe('MeetsManager', () => {
  let manager;
  const sampleData = createSampleMeetsData();

  beforeEach(() => {
    manager = new MeetsManager();
  });

  describe('constructor', () => {
    it('initializes with empty meets', () => {
      assert.equal(manager.isDataLoaded(), false);
    });
  });

  describe('loadData', () => {
    it('loads meets from array', () => {
      suppressConsole(() => manager.loadData(sampleData));
      assert.equal(manager.isDataLoaded(), true);
    });
  });

  describe('getAllMeets', () => {
    it('returns empty array before loading', () => {
      assert.ok(Array.isArray(manager.getAllMeets()));
      assert.equal(manager.getAllMeets().length, 0);
    });

    it('returns all loaded meets', () => {
      suppressConsole(() => manager.loadData(sampleData));
      assert.equal(manager.getAllMeets().length, 3);
    });
  });

  describe('searchMeets', () => {
    it('finds meets by team name', () => {
      suppressConsole(() => manager.loadData(sampleData));
      const results = manager.searchMeets('Bryant Woods');
      assert.ok(results.length > 0);
    });

    it('returns empty for no match', () => {
      suppressConsole(() => manager.loadData(sampleData));
      const results = manager.searchMeets('zzz_nonexistent');
      assert.equal(results.length, 0);
    });
  });

  describe('getUpcomingMeets', () => {
    it('returns future meets', () => {
      suppressConsole(() => manager.loadData(sampleData));
      const upcoming = manager.getUpcomingMeets(30);
      // Should include the two future meets, not the past one
      assert.ok(upcoming.length >= 1);
      for (const meet of upcoming) {
        assert.ok(new Date(meet.date) >= new Date(new Date().toISOString().split('T')[0]));
      }
    });
  });

  describe('getStatistics', () => {
    it('returns statistics', () => {
      suppressConsole(() => {
        manager.loadData(sampleData);
        const stats = manager.getStatistics();
        assert.equal(typeof stats, 'object');
      });
    });
  });

  describe('clearData', () => {
    it('clears all data', () => {
      suppressConsole(() => manager.loadData(sampleData));
      assert.equal(manager.isDataLoaded(), true);
      manager.clearData();
      assert.equal(manager.isDataLoaded(), false);
    });
  });
});
