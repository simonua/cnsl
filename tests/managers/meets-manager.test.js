const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createSampleMeetsData, suppressConsole } = require('../helpers/test-helpers.js');
const meetsManagerModule = require('../helpers/browser-module-loader.js').loadBrowserModule('meets-manager');
const { Meet, MeetsManager, context: meetsManagerContext } = meetsManagerModule;

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
      assert.deepEqual(manager.getMeetTimes(), sampleData.meetTimes);
      assert.equal(manager.getAllMeets()[0].getTimeWindowKey(), 'dualMeets');
      assert.equal(manager.getAllMeets()[0].getDisplayTime(), '7:00 AM - 12:00 PM');
    });

    it('does not mark an empty annual document as loaded', () => {
      manager.loadData({ regular_meets: [], special_meets: [] });
      assert.equal(manager.isDataLoaded(), false);
      assert.equal(manager.getMeetCount(), 0);
    });

    it('loads special meets without participating teams', () => {
      manager.loadData({ special_meets: [{ date: '2026-07-25', name: 'All City', location: 'Columbia' }] });
      assert.equal(manager.getMeetCount(), 1);
      assert.equal(manager.getAllMeets()[0].isSpecialMeet(), true);
      manager.loadData({ special_meets: [{ date: '2026-07-26' }] });
      assert.equal(manager.getMeetCount(), 1);
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
      assert.equal(manager.getAllMeets()[0] instanceof Meet, true);
      assert.equal(manager.getAllMeets()[0].home_team, 'Bryant Woods Barracudas');
    });
  });

  describe('published schema queries', () => {
    it('finds meets by participating team and hosting pool location', () => {
      suppressConsole(() => manager.loadData(sampleData));

      assert.equal(manager.getMeetsByTeam('Bryant Woods Barracudas').length, 3);
      assert.equal(manager.getMeetsByPool('Bryant Woods').length, 2);
      assert.equal(manager.getHomeMeetsByPool('Bryant Woods Pool').length, 2);
    });

    it('uses the published location for conflict and pool statistics', () => {
      suppressConsole(() => manager.loadData(sampleData));
      const firstMeet = manager.getAllMeets()[0];

      assert.equal(manager.poolHasMeetOnDate('Bryant Woods', firstMeet.date), true);
      assert.equal(manager.getPoolConflicts('Bryant Woods', firstMeet.date).length, 1);
      suppressConsole(() => assert.equal(manager.getStatistics().poolUsage['Bryant Woods Pool'], 2));
    });

    it('finds published dates and reports absent conflicts', () => {
      manager.loadData(sampleData);
      const firstMeet = manager.getAllMeets()[0];
      assert.deepEqual(manager.getMeetsByDate(firstMeet.date), [firstMeet]);
      assert.equal(manager.poolHasMeetOnDate('Other Pool', firstMeet.date), false);
      assert.deepEqual(manager.getPoolConflicts('Other Pool', firstMeet.date), []);
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

    it('returns all meets for an empty query', () => {
      manager.loadData(sampleData);
      assert.equal(manager.searchMeets('  ').length, 3);
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

    it('returns recent past meets and computes the current week collection', () => {
      const now = new Date();
      const withinThisWeek = new Date(now.getTime() + 1000).toISOString();
      const yesterday = new Date(now.getTime() - (24 * 60 * 60 * 1000)).toISOString();
      const twoDaysAgo = new Date(now.getTime() - (2 * 24 * 60 * 60 * 1000)).toISOString();
      manager.loadData({ regular_meets: [
        { date: withinThisWeek, home_team: 'A', visiting_team: 'B' },
        { date: withinThisWeek, home_team: 'C', visiting_team: 'D' },
        { date: yesterday, home_team: 'E', visiting_team: 'F' },
        { date: twoDaysAgo, home_team: 'G', visiting_team: 'H' }
      ] });

      assert.equal(manager.getPastMeets(30).length, 2);
      assert.ok(manager.getThisWeeksMeets().length >= 2);
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

  describe('time-aware views and export', () => {
    it('returns no today or summary data when TimeUtils is unavailable', () => {
      manager.loadData(sampleData);
      suppressConsole(() => {
        assert.deepEqual(manager.getTodaysMeets(), []);
        assert.deepEqual(manager.getMeetsSummary(), []);
      });
    });

    it('uses TimeUtils for today and display summaries', () => {
      const originalTimeUtils = meetsManagerContext.TimeUtils;
      const today = new Date().toISOString().split('T')[0];
      meetsManagerContext.TimeUtils = {
        formatDate: () => today,
        formatDateForDisplay: date => `display:${date.toISOString().split('T')[0]}`
      };
      manager.loadData({ regular_meets: [{ date: today, home_team: 'Home', visiting_team: 'Away', location: 'Pool' }, { date: '2026-01-01', name: 'Special' }] });
      try {
        assert.equal(manager.getTodaysMeets().length, 1);
        const summaries = manager.getMeetsSummary();
        assert.equal(summaries[0].formattedDate, `display:${today}`);
        assert.equal(summaries[1].time, 'TBD');
        assert.equal(summaries[1].home_team, 'TBD');
        assert.equal(summaries[1].location, 'TBD');
        assert.equal(manager.exportData().meets.length, 2);
        assert.deepEqual(manager.exportData().meetTimes, {});
        manager.loadData({
          meetTimes: { dualMeets: { start: '07:00', end: '12:00' } },
          regular_meets: [{ date: today, home_team: 'Home', visiting_team: 'Away' }]
        });
        assert.equal(manager.getMeetsSummary()[0].time, '7:00 AM - 12:00 PM');
      } finally {
        meetsManagerContext.TimeUtils = originalTimeUtils;
      }
    });
  });

  describe('clearData', () => {
    it('clears all data', () => {
      suppressConsole(() => manager.loadData(sampleData));
      assert.equal(manager.isDataLoaded(), true);
      manager.clearData();
      assert.equal(manager.isDataLoaded(), false);
      assert.deepEqual(manager.getMeetTimes(), {});
    });
  });

  describe('browser registration', () => {
    it('installs the manager and resolves browser TimeUtils as script globals', () => {
      const sourcePath = path.join(__dirname, '..', '..', 'src', 'js', 'managers', 'meets-manager.js');
      const source = fs.readFileSync(sourcePath, 'utf8');
      const context = { window: { TimeUtils: { formatDate: () => '2026-06-20' } }, Meet };
      Object.assign(context, context.globalThis || {}, context.window || {});
      context.globalThis = context; context.self = context; context.window = context;
      vm.runInNewContext(source, context, { filename: sourcePath });

      assert.equal(typeof context.window.MeetsManager, 'function');
      const browserManager = new context.window.MeetsManager();
      browserManager.loadData({ regular_meets: [{ date: '2026-06-20', home_team: 'Home', visiting_team: 'Away' }] });
      assert.equal(browserManager.getTodaysMeets().length, 1);
    });

    it('resolves lexical TimeUtils when it is absent from globalThis', () => {
      const sourcePath = path.join(__dirname, '..', '..', 'src', 'js', 'managers', 'meets-manager.js');
      const source = fs.readFileSync(sourcePath, 'utf8');
      const lexicalTimeUtils = { formatDate: () => '2026-06-20' };
      const exportedGlobals = {};
      const context = { globalThis: exportedGlobals, Meet, TimeUtils: lexicalTimeUtils };
      vm.runInNewContext(source, context, { filename: sourcePath });

      const browserManager = new exportedGlobals.MeetsManager();
      assert.equal(browserManager._getTimeUtils(), lexicalTimeUtils);
    });
  });
});
