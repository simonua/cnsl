const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { createLocalStorageMock } = require('../helpers/test-helpers.js');

// CacheService uses localStorage, so we need to mock it
globalThis.localStorage = createLocalStorageMock();

const CacheService = require('../../src/js/services/cache-service.js');

describe('CacheService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('set and get', () => {
    it('stores and retrieves a value', () => {
      CacheService.set('test-key', { data: 'hello' });
      const result = CacheService.get('test-key');
      assert.deepEqual(result, { data: 'hello' });
    });

    it('stores and retrieves primitive values', () => {
      CacheService.set('num', 42);
      assert.equal(CacheService.get('num'), 42);

      CacheService.set('str', 'hello');
      assert.equal(CacheService.get('str'), 'hello');

      CacheService.set('bool', true);
      assert.equal(CacheService.get('bool'), true);
    });

    it('returns null for missing key', () => {
      assert.equal(CacheService.get('nonexistent'), null);
    });
  });

  describe('expiration', () => {
    it('returns null for expired entry', () => {
      // Set with very short TTL (negative to force expiry)
      CacheService.set('expired', 'data', -1);
      const result = CacheService.get('expired');
      assert.equal(result, null);
    });
  });

  describe('remove', () => {
    it('removes a cached entry', () => {
      CacheService.set('removable', 'value');
      assert.equal(CacheService.get('removable'), 'value');
      CacheService.remove('removable');
      assert.equal(CacheService.get('removable'), null);
    });
  });

  describe('getStats', () => {
    it('returns stats for existing entries', () => {
      CacheService.set('stat-key', 'value');
      const stats = CacheService.getStats();
      assert.equal(typeof stats, 'object');
    });
  });

  describe('cleanup', () => {
    it('does not throw on empty cache', () => {
      assert.doesNotThrow(() => CacheService.cleanup());
    });
  });
});
