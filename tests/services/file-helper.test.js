const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { AUTHOR_EMAIL, EXTERNAL_LINKS, HOME_PAGE_HOSTNAME, HOME_PAGE_URL, YEAR } = require('../../src/js/config/app-config.js');
const FileHelper = require('../../src/js/services/file-helper.js');

describe('FileHelper', () => {
  describe('active season configuration', () => {
    it('exposes the immutable 2026 YEAR constant globally', () => {
      const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'YEAR');

      assert.equal(YEAR, 2026);
      assert.equal(globalThis.YEAR, YEAR);
      assert.equal(descriptor.writable, false);
      assert.equal(FileHelper.getSeasonYear(), YEAR);
    });

    it('exposes the immutable HTTPS home-page configuration globally', () => {
      const hostnameDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'HOME_PAGE_HOSTNAME');
      const urlDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'HOME_PAGE_URL');

      assert.equal(HOME_PAGE_HOSTNAME, 'pools.longreachmarlins.org');
      assert.equal(HOME_PAGE_URL, 'https://pools.longreachmarlins.org');
      assert.equal(globalThis.HOME_PAGE_HOSTNAME, HOME_PAGE_HOSTNAME);
      assert.equal(globalThis.HOME_PAGE_URL, HOME_PAGE_URL);
      assert.equal(hostnameDescriptor.writable, false);
      assert.equal(urlDescriptor.writable, false);
    });

    it('centralizes authored share and contact destinations', () => {
      assert.equal(AUTHOR_EMAIL, 'simonkurtz+pool-app@gmail.com');
      assert.equal(EXTERNAL_LINKS.SMS_SHARE, 'sms:?&body=Find%20Columbia%20pools%20and%20CNSL%20schedules%3A%20https%3A%2F%2Fpools.longreachmarlins.org');
      assert.equal(EXTERNAL_LINKS.EMAIL_SHARE, 'mailto:?subject=Columbia%20Pools%20and%20CNSL%20Schedules&body=Find%20Columbia%20pools%20and%20CNSL%20schedules%3A%20https%3A%2F%2Fpools.longreachmarlins.org');
      assert.equal(EXTERNAL_LINKS.X_SHARE, 'https://x.com/intent/post?text=Find%20Columbia%20pools%20and%20CNSL%20schedules%3A%20https%3A%2F%2Fpools.longreachmarlins.org');
      assert.equal(EXTERNAL_LINKS.AUTHOR_FEEDBACK_EMAIL_URL, 'mailto:simonkurtz+pool-app@gmail.com?subject=CA%20Pool%20%26%20CNSL%20Assistant%20-%20Feedback');
      assert.equal(EXTERNAL_LINKS.AUTHOR_BUG_FEATURE_EMAIL_URL, 'mailto:simonkurtz+pool-app@gmail.com?subject=CA%20Pool%20%26%20CNSL%20Assistant%20-%20Bug%20%2F%20Feature%20-%20Version%202.11.0');
      assert.equal(EXTERNAL_LINKS.AUTHOR_DATA_EMAIL_URL, 'mailto:simonkurtz+pool-app@gmail.com?subject=CA%20Pool%20%26%20CNSL%20Assistant%20-%20Data');
      assert.equal(EXTERNAL_LINKS.GITHUB_DATA_DIRECTORY, 'https://github.com/simonua/cnsl/tree/main/src/assets/data');
      assert.equal(EXTERNAL_LINKS.GITHUB_LICENSE, 'https://github.com/simonua/cnsl/blob/main/LICENSE');
      assert.equal(EXTERNAL_LINKS.GITHUB_REPOSITORY, 'https://github.com/simonua/cnsl');
      assert.equal(EXTERNAL_LINKS.NATIONAL_WEATHER_SERVICE_ACTIVE_ALERTS, 'https://api.weather.gov/alerts/active?point=39.2014%2C-76.8610');
      assert.equal(EXTERNAL_LINKS.NATIONAL_WEATHER_SERVICE_POINT, 'https://api.weather.gov/points/39.2014,-76.8610');
      assert.equal(EXTERNAL_LINKS.USA_SWIMMING_RULES_POLICIES, 'https://www.usaswimming.org/resources/rules-regulations');
    });
  });

  describe('seasonal data paths', () => {
    it('returns year and domain scoped JSON paths in the delivered layout', () => {
      assert.equal(FileHelper.getPoolsDataPath(), 'assets/data/2026/pools/pools.json');
      assert.equal(FileHelper.getTeamsDataPath(), 'assets/data/2026/teams/teams.json');
      assert.equal(FileHelper.getMeetsDataPath(), 'assets/data/2026/meets/meets.json');
      assert.equal(FileHelper.getLessonsDataPath(), 'assets/data/lessons.json');
    });

    it('does not need DOM globals to resolve paths', () => {
      assert.equal(FileHelper.getAssetsBasePath(), 'assets/');
      assert.equal(FileHelper.getJsBasePath(), 'js/');
      assert.equal(FileHelper.getCssBasePath(), 'css/');
    });

    it('returns all delivered asset and file helper paths', () => {
      assert.equal(FileHelper.getSeasonDataBasePath('teams'), 'assets/data/2026/teams/');
      assert.equal(FileHelper.getDataFilePath('reference.json'), 'assets/data/reference.json');
      assert.equal(FileHelper.getImagesBasePath(), 'assets/images/');
      assert.equal(FileHelper.getFaviconsBasePath(), 'assets/favicons/');
      assert.equal(FileHelper.getImagePath('logo.png'), 'assets/images/logo.png');
      assert.equal(FileHelper.getTeamLogosBasePath(), 'assets/images/logos/');
      assert.equal(FileHelper.getTeamLogoPath('team.png'), 'assets/images/logos/team.png');
      assert.equal(FileHelper.getJsPath('navigation.js'), 'js/navigation.js');
      assert.equal(FileHelper.getCssPath('styles.css'), 'css/styles.css');
      assert.deepEqual(FileHelper.getAllPaths(), {
        layout: 'delivered',
        basePaths: { data: 'assets/data/', assets: 'assets/', images: 'assets/images/', js: 'js/', css: 'css/' },
        dataFiles: { lessons: 'assets/data/lessons.json', pools: 'assets/data/2026/pools/pools.json', teams: 'assets/data/2026/teams/teams.json', meets: 'assets/data/2026/meets/meets.json' },
        assetPaths: { favicons: 'assets/favicons/', teamLogos: 'assets/images/logos/' }
      });
    });
  });

  describe('loadJsonFile', () => {
    it('returns parsed JSON from the requested delivered path', async () => {
      const originalFetch = global.fetch;
      let requestOptions;
      global.fetch = async (filePath, options) => {
        requestOptions = options;
        return { ok: true, json: async () => ({ filePath }) };
      };
      try {
        assert.deepEqual(await FileHelper.loadJsonFile('assets/data/example.json'), { filePath: 'assets/data/example.json' });
        assert.deepEqual(requestOptions, { cache: 'no-cache' });
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('reports and rethrows failed requests', async () => {
      const originalFetch = global.fetch;
      const originalConsoleError = console.error;
      global.fetch = async () => ({ ok: false, status: 404, statusText: 'Missing' });
      console.error = () => {};
      try {
        await assert.rejects(FileHelper.loadJsonFile('assets/data/missing.json'), /404 Missing/);
      } finally {
        global.fetch = originalFetch;
        console.error = originalConsoleError;
      }
    });
  });

  describe('browser registration and missing configuration', () => {
    it('registers globally and rejects season paths when YEAR is not configured', () => {
      const sourcePath = path.join(__dirname, '..', '..', 'src', 'js', 'services', 'file-helper.js');
      const source = fs.readFileSync(sourcePath, 'utf8');
      const context = { window: {}, globalThis: {} };
      vm.runInNewContext(source, context, { filename: sourcePath });

      assert.equal(typeof context.window.FileHelper, 'function');
      assert.throws(() => context.window.FileHelper.getSeasonYear(), /YEAR configuration is not loaded/);
    });

    it('loads application configuration when required directly without YEAR', () => {
      const sourcePath = path.join(__dirname, '..', '..', 'src', 'js', 'services', 'file-helper.js');
      const source = fs.readFileSync(sourcePath, 'utf8');
      const context = { module: { exports: {} }, globalThis: {}, require: () => { context.globalThis.YEAR = 2026; } };
      vm.runInNewContext(source, context, { filename: sourcePath });

      assert.equal(context.module.exports.getSeasonYear(), 2026);
    });
  });
});
