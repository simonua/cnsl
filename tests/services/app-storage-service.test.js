const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createLocalStorageMock } = require('../helpers/test-helpers.js');
const AppStorageService = require('../../src/js/services/app-storage-service.js');

describe('AppStorageService', () => {
  describe('clearAppData', () => {
    it('should clear only app-owned local, session, and cache storage entries', async () => {
      const localStorage = createLocalStorageMock();
      const sessionStorage = createLocalStorageMock();
      const deletedCaches = [];
      const cacheStorage = {
        keys: async () => ['cnsl-static-current', 'unrelated-cache'],
        delete: async name => { deletedCaches.push(name); return true; }
      };

      ['cnsl_preferences', 'cnsl_current_version', 'cnsl_settings_notice_dismissed', 'unrelated'].forEach(key => localStorage.setItem(key, 'saved'));
      ['cnsl_weather_alert_status', 'cnsl_weather_alert_expanded', 'unrelated'].forEach(key => sessionStorage.setItem(key, 'saved'));

      await AppStorageService.clearAppData({ localStorage, sessionStorage, cacheStorage });

      assert.equal(localStorage.getItem('cnsl_preferences'), null);
      assert.equal(localStorage.getItem('cnsl_current_version'), null);
      assert.equal(localStorage.getItem('cnsl_settings_notice_dismissed'), null);
      assert.equal(localStorage.getItem('unrelated'), 'saved');
      assert.equal(sessionStorage.getItem('cnsl_weather_alert_status'), null);
      assert.equal(sessionStorage.getItem('cnsl_weather_alert_expanded'), null);
      assert.equal(sessionStorage.getItem('unrelated'), 'saved');
      assert.deepEqual(deletedCaches, ['cnsl-static-current']);
    });

    it('should fail safely when browser storage is unavailable', async () => {
      const unavailableStorage = { removeItem: () => { throw new Error('storage denied'); } };
      const unavailableCaches = { keys: async () => { throw new Error('cache denied'); } };

      await assert.doesNotReject(() => AppStorageService.clearAppData({
        localStorage: unavailableStorage,
        sessionStorage: unavailableStorage,
        cacheStorage: unavailableCaches
      }));
    });

    it('discovers available browser storage by default and leaves unrelated caches intact', async () => {
      const originalLocalStorage = globalThis.localStorage;
      const originalSessionStorage = globalThis.sessionStorage;
      const originalCaches = globalThis.caches;
      const localStorage = createLocalStorageMock();
      const sessionStorage = createLocalStorageMock();
      const deleted = [];
      globalThis.localStorage = localStorage;
      globalThis.sessionStorage = sessionStorage;
      globalThis.caches = { keys: async () => ['other-cache'], delete: async name => { deleted.push(name); } };
      localStorage.setItem('cnsl_preferences', 'saved');
      sessionStorage.setItem('cnsl_weather_alert_status', 'saved');
      try {
        await AppStorageService.clearAppData();
        assert.equal(localStorage.getItem('cnsl_preferences'), null);
        assert.equal(sessionStorage.getItem('cnsl_weather_alert_status'), null);
        assert.deepEqual(deleted, []);
        assert.equal(AppStorageService.getBrowserStorage('localStorage'), localStorage);
        assert.equal(AppStorageService.getCacheStorage(), globalThis.caches);
      } finally {
        if (originalLocalStorage === undefined) delete globalThis.localStorage;
        else globalThis.localStorage = originalLocalStorage;
        if (originalSessionStorage === undefined) delete globalThis.sessionStorage;
        else globalThis.sessionStorage = originalSessionStorage;
        if (originalCaches === undefined) delete globalThis.caches;
        else globalThis.caches = originalCaches;
      }
    });
  });

  describe('safe platform access and cleanup helpers', () => {
    it('ignores unavailable keys, storage failures, and unavailable cache storage', async () => {
      const removed = [];
      AppStorageService.removeKeys(null, ['a']);
      AppStorageService.removeKeys({ removeItem: () => {} }, null);
      AppStorageService.removeKeys({ removeItem: key => { if (key === 'bad') throw new Error('blocked'); removed.push(key); } }, ['ok', 'bad', 'next']);
      await AppStorageService.deleteCaches(null, 'cnsl-');
      await AppStorageService.deleteCaches({ keys: async () => ['one'] }, null);
      assert.deepEqual(removed, ['ok', 'next']);
    });

    it('returns null when browser storage getters throw or are absent', () => {
      const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
      const originalCachesDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'caches');
      Object.defineProperty(globalThis, 'localStorage', { configurable: true, get: () => { throw new Error('blocked'); } });
      Object.defineProperty(globalThis, 'caches', { configurable: true, get: () => { throw new Error('blocked'); } });
      try {
        assert.equal(AppStorageService.getBrowserStorage('localStorage'), null);
        assert.equal(AppStorageService.getBrowserStorage('missingStorage'), null);
        assert.equal(AppStorageService.getCacheStorage(), null);
      } finally {
        if (originalDescriptor) Object.defineProperty(globalThis, 'localStorage', originalDescriptor);
        else delete globalThis.localStorage;
        if (originalCachesDescriptor) Object.defineProperty(globalThis, 'caches', originalCachesDescriptor);
        else delete globalThis.caches;
      }
    });

    it('installs the service as a browser script global', () => {
      const sourcePath = path.join(__dirname, '..', '..', 'src', 'js', 'services', 'app-storage-service.js');
      const source = fs.readFileSync(sourcePath, 'utf8');
      const context = { window: {}, globalThis: { APP_LOCAL_STORAGE_KEYS: [], APP_SESSION_STORAGE_KEYS: [], PWA_CACHE_PREFIX: 'cnsl-' } };
      vm.runInNewContext(source, context, { filename: sourcePath });
      assert.equal(typeof context.window.AppStorageService, 'function');
    });
  });
});
