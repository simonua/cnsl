const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { createLocalStorageMock } = require('../helpers/test-helpers.js');
const cacheModule = require('../helpers/browser-module-loader.js').loadBrowserModule('weather-alert-cache-service');
const {
  WeatherAlertCacheService,
  WeatherAlertSource,
  context: cacheContext
} = cacheModule;

const now = new Date('2026-06-17T14:00:00.000Z');
const validStatus = Object.freeze({
  isInclement: true,
  message: 'Active National Weather Service alert: Severe Thunderstorm Warning.',
  source: WeatherAlertSource.ALERT,
  updatedAt: now.toISOString()
});

describe('WeatherAlertCacheService', () => {
  describe('read and write', () => {
    it('round trips a validated fresh weather status', () => {
      const storage = createLocalStorageMock();

      assert.equal(WeatherAlertCacheService.write(validStatus, 5, storage, now), true);
      assert.deepEqual(WeatherAlertCacheService.read(5, storage, now), {
        expiresAt: now.getTime() + 5 * 60 * 1000,
        refreshMinutes: 5,
        status: validStatus
      });
    });

    it('rejects unavailable, malformed, expired, and mismatched cache entries', () => {
      const storage = createLocalStorageMock();
      assert.equal(WeatherAlertCacheService.read(5, null, now), null);

      storage.setItem(WeatherAlertCacheService.STORAGE_KEY, '{');
      assert.equal(WeatherAlertCacheService.read(5, storage, now), null);

      storage.setItem(WeatherAlertCacheService.STORAGE_KEY, JSON.stringify({
        expiresAt: now.getTime() + 60 * 1000,
        refreshMinutes: 10,
        status: validStatus
      }));
      assert.equal(WeatherAlertCacheService.read(5, storage, now), null);

      storage.setItem(WeatherAlertCacheService.STORAGE_KEY, JSON.stringify({
        expiresAt: 'later',
        refreshMinutes: 5,
        status: validStatus
      }));
      assert.equal(WeatherAlertCacheService.read(5, storage, now), null);

      storage.setItem(WeatherAlertCacheService.STORAGE_KEY, JSON.stringify({
        expiresAt: now.getTime(),
        refreshMinutes: 5,
        status: validStatus
      }));
      assert.equal(WeatherAlertCacheService.read(5, storage, now), null);
    });

    it('rejects statuses outside the weather display contract', () => {
      assert.equal(WeatherAlertCacheService.isValidStatus(null), false);
      assert.equal(WeatherAlertCacheService.isValidStatus({ isInclement: 'yes' }), false);
      assert.equal(WeatherAlertCacheService.isValidStatus({ isInclement: false, updatedAt: 'invalid' }), false);
      assert.equal(WeatherAlertCacheService.isValidStatus({ isInclement: false, updatedAt: now.toISOString() }), true);
      assert.equal(WeatherAlertCacheService.isValidStatus({
        ...validStatus,
        source: 'unsupported'
      }), false);
      assert.equal(WeatherAlertCacheService.isValidStatus({
        ...validStatus,
        message: 42
      }), false);
      assert.equal(WeatherAlertCacheService.isValidStatus({
        ...validStatus,
        message: '  '
      }), false);
    });

    it('fails safely when writes are invalid or unavailable', () => {
      const blockedStorage = { setItem: () => { throw new Error('blocked'); } };
      assert.equal(WeatherAlertCacheService.write(validStatus, 5, null, now), false);
      assert.equal(WeatherAlertCacheService.write(validStatus, 0, createLocalStorageMock(), now), false);
      assert.equal(WeatherAlertCacheService.write({ isInclement: false }, 5, createLocalStorageMock(), now), false);
      assert.equal(WeatherAlertCacheService.write(validStatus, 5, blockedStorage, now), false);
    });
  });

  describe('browser storage access', () => {
    it('discovers available session storage and handles a throwing getter', () => {
      const originalDescriptor = Object.getOwnPropertyDescriptor(cacheContext, 'sessionStorage');
      const storage = createLocalStorageMock();
      cacheContext.sessionStorage = storage;
      try {
        assert.equal(WeatherAlertCacheService.getStorage(), storage);
        Object.defineProperty(cacheContext, 'sessionStorage', {
          configurable: true,
          get: () => { throw new Error('blocked'); }
        });
        assert.equal(WeatherAlertCacheService.getStorage(), null);
      } finally {
        if (originalDescriptor) Object.defineProperty(cacheContext, 'sessionStorage', originalDescriptor);
        else delete cacheContext.sessionStorage;
      }
    });
  });
});
