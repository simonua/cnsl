const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createSampleMeetsData, createSamplePoolsManagerData, createSampleTeamsData } = require('../helpers/test-helpers.js');

const dataManagerModule = require('../helpers/browser-module-loader.js').loadBrowserModule('data-manager');
const { DataManager, getDataManager } = dataManagerModule;

describe('DataManager', () => {
  describe('initialize', () => {
    it('should load each configured annual document once for concurrent initialization', async () => {
      const originalFetch = global.fetch;
      const originalFileHelper = global.FileHelper;
      const originalConsoleLog = console.log;
      const requestPaths = [];
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
        getMeetsDataPath: () => '/data/meets.json',
        loadJsonFile: async filePath => {
          requestPaths.push(filePath);
          return datasets[filePath];
        }
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
        getMeetsDataPath: () => '/data/meets.json',
        loadJsonFile: async filePath => {
          requestPaths.push(filePath);
          return datasets[filePath];
        }
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

    it('should validate and load preloaded domain data without fetching it again', async () => {
      const originalFetch = global.fetch;
      let fetchCount = 0;
      global.fetch = async () => {
        fetchCount += 1;
        throw new Error('Unexpected fetch');
      };

      try {
        const manager = new DataManager();
        await manager.initialize(['teams', 'meets'], {
          meets: Promise.resolve({ ...createSampleMeetsData(), special_meets: [] }),
          teams: createSampleTeamsData()
        });

        assert.equal(fetchCount, 0);
        assert.equal(manager.isInitialized(['teams', 'meets']), true);
        assert.ok(manager.getTeams().getAllTeams().length > 0);
        assert.ok(manager.getMeets().getAllMeets().length > 0);
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('should reject malformed published domain responses', async () => {
      const originalFetch = global.fetch;
      const originalFileHelper = global.FileHelper;
      global.FileHelper = { getPoolsDataPath: () => '/data/pools.json', loadJsonFile: async () => ({}) };

      try {
        const manager = new DataManager();
        await assert.rejects(manager.initialize(['pools']));
      } finally {
        global.fetch = originalFetch;
        global.FileHelper = originalFileHelper;
      }
    });

    it('should reject unknown domains before fetching data', async () => {
      const manager = new DataManager();
      await assert.rejects(manager.initialize(['unknown']));
    });

    it('should report failed fetches and release failed loading promises', async () => {
      const originalFetch = global.fetch;
      const originalFileHelper = global.FileHelper;
      const originalConsoleError = console.error;
      global.FileHelper = {
        getPoolsDataPath: () => '/missing.json',
        loadJsonFile: async () => { throw new Error('Missing'); }
      };
      console.error = () => {};
      try {
        const manager = new DataManager();
        await assert.rejects(manager.initialize(['pools']));
        assert.equal(manager.loadingPromises.size, 0);
      } finally {
        global.fetch = originalFetch;
        global.FileHelper = originalFileHelper;
        console.error = originalConsoleError;
      }
    });
  });

  describe('accessors and refresh lifecycle', () => {
    it('creates domain managers and returns no season metadata before data loads', () => {
      const manager = new DataManager();
      assert.ok(manager.getPools());
      assert.ok(manager.getTeams());
      assert.ok(manager.getMeets());
      assert.equal(manager.getSeasonInfo(), null);
    });

    it('rejects the legacy meets collection shape without reporting an empty successful collection', async () => {
      const originalFetch = global.fetch;
      const originalFileHelper = global.FileHelper;
      global.FileHelper = { getMeetsDataPath: () => '/data/meets.json', loadJsonFile: async () => ({ meets: [] }) };
      try {
        const manager = new DataManager();
        await assert.rejects(manager.initialize(['meets']), /Invalid meets annual data response/);
        assert.equal(manager.isInitialized(['meets']), false);
        assert.equal(manager.getMeets().getAllMeets().length, 0);
      } finally {
        global.fetch = originalFetch;
        global.FileHelper = originalFileHelper;
      }
    });
  });

  describe('global and browser registration', () => {
    it('reuses the global data manager helper', () => {
      assert.equal(getDataManager(), getDataManager());
    });

    it('installs DataManager in the browser global scope', () => {
      const sourcePath = path.join(__dirname, '..', '..', 'src', 'js', 'services', 'data-manager.js');
      const source = fs.readFileSync(sourcePath, 'utf8');
      const context = { window: {} };
      Object.assign(context, context.globalThis || {}, context.window || {});
      context.globalThis = context; context.self = context; context.window = context;
      vm.runInNewContext(source, context, { filename: sourcePath });
      assert.equal(typeof context.window.DataManager, 'function');
    });
  });
});
