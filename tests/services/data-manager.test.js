const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createSampleMeetsData, createSamplePoolsManagerData, createSampleTeamsData } = require('../helpers/test-helpers.js');

global.PoolsManager = require('../../src/js/pools-manager.js');
global.TeamsManager = require('../../src/js/teams-manager.js');
global.MeetsManager = require('../../src/js/meets-manager.js');

const { DataManager, getDataManager, initializeDataManager } = require('../../src/js/services/data-manager.js');

describe('DataManager', () => {
  describe('initialize', () => {
    it('should load each configured annual document once for concurrent initialization', async () => {
      const originalFetch = global.fetch;
      const originalFileHelper = global.FileHelper;
      const originalConsoleLog = console.log;
      const requestPaths = [];
      const requestCacheModes = [];
      const datasets = {
        '/data/pools.json': {
          ...createSamplePoolsManagerData(),
          seasonStartDate: '2026-05-23',
          seasonEndDate: '2026-09-07',
          caPoolDirectoryUrl: 'https://example.com/pools',
          caPoolGuideUrl: 'https://example.com/guide'
        },
        '/data/teams.json': createSampleTeamsData(),
        '/data/meets.json': { ...createSampleMeetsData(), special_meets: [] }
      };

      global.FileHelper = {
        getEnvironment: () => 'test',
        getPoolsDataPath: () => '/data/pools.json',
        getTeamsDataPath: () => '/data/teams.json',
        getMeetsDataPath: () => '/data/meets.json'
      };
      global.fetch = async (filePath, options) => {
        requestPaths.push(filePath);
        requestCacheModes.push(options.cache);
        return { ok: true, json: async () => datasets[filePath] };
      };
      console.log = () => {};

      try {
        const manager = new DataManager();
        await Promise.all([manager.initialize(), manager.initialize()]);

        assert.deepStrictEqual(requestPaths.sort(), [
          '/data/meets.json',
          '/data/pools.json',
          '/data/teams.json'
        ]);
        assert.deepStrictEqual(requestCacheModes, ['no-cache', 'no-cache', 'no-cache']);
        assert.deepStrictEqual(manager.getSeasonInfo(), {
          seasonStartDate: '2026-05-23',
          seasonEndDate: '2026-09-07',
          caPoolDirectoryUrl: 'https://example.com/pools',
          caPoolGuideUrl: 'https://example.com/guide'
        });
        await manager.refresh([]);
        assert.equal(requestPaths.length, 6);
      } finally {
        global.fetch = originalFetch;
        global.FileHelper = originalFileHelper;
        console.log = originalConsoleLog;
      }
    });

    it('should load and refresh only explicitly required domains', async () => {
      const originalFetch = global.fetch;
      const originalFileHelper = global.FileHelper;
      const requestPaths = [];
      const datasets = {
        '/data/pools.json': { ...createSamplePoolsManagerData(), seasonStartDate: '2026-05-23', seasonEndDate: '2026-09-07' },
        '/data/teams.json': createSampleTeamsData(),
        '/data/meets.json': { ...createSampleMeetsData(), special_meets: [] }
      };

      global.FileHelper = {
        getPoolsDataPath: () => '/data/pools.json',
        getTeamsDataPath: () => '/data/teams.json',
        getMeetsDataPath: () => '/data/meets.json'
      };
      global.fetch = async (filePath) => {
        requestPaths.push(filePath);
        return { ok: true, json: async () => datasets[filePath] };
      };

      try {
        const manager = new DataManager();
        await Promise.all([manager.initialize(['pools']), manager.initialize(['pools'])]);
        await manager.initialize(['pools', 'teams']);

        assert.deepStrictEqual(requestPaths, ['/data/pools.json', '/data/teams.json']);
        assert.strictEqual(manager.isInitialized(['pools', 'teams']), true);
        assert.strictEqual(manager.isInitialized(), false);

        await manager.refresh(['pools']);
        assert.deepStrictEqual(requestPaths, ['/data/pools.json', '/data/teams.json', '/data/pools.json']);
      } finally {
        global.fetch = originalFetch;
        global.FileHelper = originalFileHelper;
      }
    });

    it('should reject malformed published domain responses', async () => {
      const originalFetch = global.fetch;
      const originalFileHelper = global.FileHelper;
      global.FileHelper = { getPoolsDataPath: () => '/data/pools.json' };
      global.fetch = async () => ({ ok: true, json: async () => ({}) });

      try {
        const manager = new DataManager();
        await assert.rejects(manager.initialize(['pools']), /Invalid pools annual data response/);
      } finally {
        global.fetch = originalFetch;
        global.FileHelper = originalFileHelper;
      }
    });

    it('should reject unknown domains before fetching data', async () => {
      const manager = new DataManager();
      await assert.rejects(manager.initialize(['unknown']), /Unknown annual data domain/);
    });

    it('should report failed fetches and release failed loading promises', async () => {
      const originalFetch = global.fetch;
      const originalFileHelper = global.FileHelper;
      const originalConsoleError = console.error;
      global.FileHelper = { getPoolsDataPath: () => '/missing.json' };
      global.fetch = async () => ({ ok: false, status: 404 });
      console.error = () => {};
      try {
        const manager = new DataManager();
        await assert.rejects(manager.initialize(['pools']), /Failed to load \/missing.json: 404/);
        assert.equal(manager.loadingPromises.size, 0);
      } finally {
        global.fetch = originalFetch;
        global.FileHelper = originalFileHelper;
        console.error = originalConsoleError;
      }
    });
  });

  describe('accessors and refresh lifecycle', () => {
    it('creates domain managers, exposes aliases, and returns empty lookups before data', () => {
      const manager = new DataManager();
      assert.equal(manager.pools, manager.getPools());
      assert.equal(manager.teams, manager.getTeams());
      assert.equal(manager.meets, manager.getMeets());
      assert.equal(manager.getPool('Missing'), null);
      assert.equal(manager.getTeam('Missing'), null);
      assert.equal(manager.getSeasonInfo(), null);
    });

    it('accepts the legacy meets collection shape and refreshes loaded domains by default', async () => {
      const originalFetch = global.fetch;
      const originalFileHelper = global.FileHelper;
      let loads = 0;
      global.FileHelper = { getMeetsDataPath: () => '/data/meets.json' };
      global.fetch = async () => { loads += 1; return { ok: true, json: async () => ({ meets: [] }) }; };
      try {
        const manager = new DataManager();
        await manager.initialize(['meets']);
        await manager.refresh();
        assert.equal(loads, 2);
      } finally {
        global.fetch = originalFetch;
        global.FileHelper = originalFileHelper;
      }
    });
  });

  describe('global and browser registration', () => {
    it('reuses and initializes the global data manager helper', async () => {
      const originalFetch = global.fetch;
      const originalFileHelper = global.FileHelper;
      global.FileHelper = { getTeamsDataPath: () => '/data/teams.json' };
      global.fetch = async () => ({ ok: true, json: async () => ({ teams: [] }) });
      try {
        assert.equal(getDataManager(), getDataManager());
        await initializeDataManager(['teams']);
        assert.equal(getDataManager().isInitialized(['teams']), true);
      } finally {
        global.fetch = originalFetch;
        global.FileHelper = originalFileHelper;
      }
    });

    it('installs DataManager in the browser global scope', () => {
      const sourcePath = path.join(__dirname, '..', '..', 'src', 'js', 'services', 'data-manager.js');
      const source = fs.readFileSync(sourcePath, 'utf8');
      const context = { window: {} };
      vm.runInNewContext(source, context, { filename: sourcePath });
      assert.equal(typeof context.window.DataManager, 'function');
    });
  });
});
