const { afterEach, beforeEach, describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { HOME_PAGE_HOSTNAME, HOME_PAGE_URL, YEAR } = require('../../src/js/config/app-config.js');
const FileHelper = require('../../src/js/services/file-helper.js');

describe('FileHelper', () => {
  beforeEach(() => {
    global.window = {
      location: {
        hostname: 'cnsl.example.test',
        pathname: '/pools.html'
      }
    };
    global.document = {
      querySelector: () => null,
      querySelectorAll: () => []
    };
  });

  afterEach(() => {
    delete global.window;
    delete global.document;
  });

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
  });

  describe('seasonal data paths', () => {
    it('should return year and domain scoped JSON paths in production', () => {
      assert.equal(FileHelper.getPoolsDataPath(), 'assets/data/2026/pools/pools.json');
      assert.equal(FileHelper.getTeamsDataPath(), 'assets/data/2026/teams/teams.json');
      assert.equal(FileHelper.getMeetsDataPath(), 'assets/data/2026/meets/meets.json');
    });

    it('should retain year and domain segments in direct source development mode', () => {
      global.document.querySelectorAll = selector => selector.includes('script[src*="src/js/"]') ? [{}] : [];

      assert.equal(FileHelper.getPoolsDataPath(), 'src/assets/data/2026/pools/pools.json');
    });
  });
});
