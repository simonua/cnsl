const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { createLocalStorageMock } = require('../helpers/test-helpers.js');
const weatherFreshnessModule = require('../helpers/browser-module-loader.js').loadBrowserModule('weather-freshness-service');
const { WeatherFreshnessService, context: weatherFreshnessContext } = weatherFreshnessModule;

describe('WeatherFreshnessService', () => {
  describe('read', () => {
    it('returns a validated durable timestamp', () => {
      const storage = createLocalStorageMock();
      storage.setItem(WeatherFreshnessService.STORAGE_KEY, JSON.stringify({ updatedAt: '2026-06-02T14:15:00-04:00' }));

      assert.deepEqual(WeatherFreshnessService.read(storage), { updatedAt: '2026-06-02T14:15:00-04:00' });
    });

    it('rejects missing, malformed, and invalid durable state', () => {
      assert.equal(WeatherFreshnessService.read(null), null);
      const storage = createLocalStorageMock();
      assert.equal(WeatherFreshnessService.read(storage), null);
      storage.setItem(WeatherFreshnessService.STORAGE_KEY, '{bad json');
      assert.equal(WeatherFreshnessService.read(storage), null);
      storage.setItem(WeatherFreshnessService.STORAGE_KEY, JSON.stringify({ updatedAt: 'invalid' }));
      assert.equal(WeatherFreshnessService.read(storage), null);
      assert.equal(WeatherFreshnessService.read({ getItem: () => { throw new Error('blocked'); } }), null);
    });
  });

  describe('remember', () => {
    it('stores only a newer valid successful check', () => {
      const storage = createLocalStorageMock();
      const firstStatus = { isInclement: false, updatedAt: '2026-06-02T14:15:00-04:00' };
      WeatherFreshnessService.remember(firstStatus, storage);
      WeatherFreshnessService.remember({ isInclement: true, updatedAt: '2026-06-02T14:10:00-04:00' }, storage);

      assert.deepEqual(WeatherFreshnessService.read(storage), { updatedAt: firstStatus.updatedAt });

      WeatherFreshnessService.remember({ isInclement: true, updatedAt: '2026-06-02T14:20:00-04:00' }, storage);
      assert.deepEqual(WeatherFreshnessService.read(storage), { updatedAt: '2026-06-02T14:20:00-04:00' });
    });

    it('ignores unavailable storage and invalid statuses', () => {
      const storage = createLocalStorageMock();
      assert.doesNotThrow(() => WeatherFreshnessService.remember(null, storage));
      assert.doesNotThrow(() => WeatherFreshnessService.remember({ isInclement: 'no', updatedAt: '2026-06-02T14:15:00-04:00' }, storage));
      assert.doesNotThrow(() => WeatherFreshnessService.remember({ isInclement: false, updatedAt: 'invalid' }, storage));
      assert.doesNotThrow(() => WeatherFreshnessService.remember({ isInclement: false, updatedAt: '2026-06-02T14:15:00-04:00' }, null));
      assert.equal(WeatherFreshnessService.read(storage), null);
    });

    it('does not propagate blocked writes', () => {
      const storage = {
        getItem: () => null,
        setItem: () => { throw new Error('blocked'); }
      };
      assert.doesNotThrow(() => WeatherFreshnessService.remember({
        isInclement: false,
        updatedAt: '2026-06-02T14:15:00-04:00'
      }, storage));
    });
  });

  describe('getStorage', () => {
    it('returns accessible local storage and handles its absence', () => {
      const originalStorage = weatherFreshnessContext.localStorage;
      const storage = createLocalStorageMock();
      weatherFreshnessContext.localStorage = storage;
      try {
        assert.equal(WeatherFreshnessService.getStorage(), storage);
        assert.equal(WeatherFreshnessService.read(), null);
      } finally {
        if (originalStorage === undefined) delete weatherFreshnessContext.localStorage;
        else weatherFreshnessContext.localStorage = originalStorage;
      }

      assert.equal(WeatherFreshnessService.getStorage(), null);
    });
  });
});
