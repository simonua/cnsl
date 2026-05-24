const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { createSampleMeetsData, createSamplePoolsManagerData, createSampleTeamsData } = require('../helpers/test-helpers.js');

global.PoolsManager = require('../../src/js/pools-manager.js');
global.TeamsManager = require('../../src/js/teams-manager.js');
global.MeetsManager = require('../../src/js/meets-manager.js');

const { DataManager } = require('../../src/js/services/data-manager.js');

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
        '/data/meets.json': createSampleMeetsData()
      };

      global.FileHelper = {
        getEnvironment: () => 'test',
        getPoolsDataPath: () => '/data/pools.json',
        getTeamsDataPath: () => '/data/teams.json',
        getMeetsDataPath: () => '/data/meets.json'
      };
      global.fetch = async (filePath) => {
        requestPaths.push(filePath);
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
        assert.deepStrictEqual(manager.getSeasonInfo(), {
          seasonStartDate: '2026-05-23',
          seasonEndDate: '2026-09-07',
          caPoolDirectoryUrl: 'https://example.com/pools',
          caPoolGuideUrl: 'https://example.com/guide'
        });
      } finally {
        global.fetch = originalFetch;
        global.FileHelper = originalFileHelper;
        console.log = originalConsoleLog;
      }
    });
  });
});
