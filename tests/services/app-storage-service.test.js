const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
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
  });
});
