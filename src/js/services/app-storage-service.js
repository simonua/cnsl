/**
 * Removes browser-persisted state created by this application without clearing unrelated origin data.
 */
if (typeof globalThis.AppStorageService === 'undefined') {
  /** Manages application-owned browser storage and cache entries. */
  class AppStorageService {
    /**
     * Remove all application-owned local, session, and cache data.
     * @param {Object} options - Optional browser storage implementations
     * @returns {Promise<void>} Promise that resolves after cache deletion completes
     */
    static async clearAppData(options = {}) {
      const localStorageImplementation = Object.prototype.hasOwnProperty.call(options, 'localStorage')
        ? options.localStorage
        : AppStorageService.getBrowserStorage('localStorage');
      const sessionStorageImplementation = Object.prototype.hasOwnProperty.call(options, 'sessionStorage')
        ? options.sessionStorage
        : AppStorageService.getBrowserStorage('sessionStorage');
      const cacheStorageImplementation = Object.prototype.hasOwnProperty.call(options, 'cacheStorage')
        ? options.cacheStorage
        : AppStorageService.getCacheStorage();

      AppStorageService.removeKeys(localStorageImplementation, globalThis.APP_LOCAL_STORAGE_KEYS);
      AppStorageService.removeKeys(sessionStorageImplementation, globalThis.APP_SESSION_STORAGE_KEYS);
      await AppStorageService.deleteCaches(cacheStorageImplementation, globalThis.PWA_CACHE_PREFIX);
    }

    /**
     * Remove a list of keys from a storage implementation.
     * @param {Storage|null} storage - Browser storage or a compatible substitute
     * @param {Array} keys - Keys to remove
     * @returns {void}
     * @private
     */
    static removeKeys(storage, keys) {
      if (!storage || !Array.isArray(keys)) return;
      keys.forEach(key => {
        try {
          storage.removeItem(key);
        } catch (_error) {
          return;
        }
      });
    }

    /**
     * Delete application caches whose names start with the configured prefix.
     * @param {CacheStorage|null} cacheStorage - Browser cache storage or a compatible substitute
     * @param {string} cachePrefix - Application cache-name prefix
     * @returns {Promise<void>} Promise that resolves after matching caches are deleted
     * @private
     */
    static async deleteCaches(cacheStorage, cachePrefix) {
      if (!cacheStorage || !cachePrefix) return;
      try {
        const names = await cacheStorage.keys();
        await Promise.all(names
          .filter(name => name.startsWith(cachePrefix))
          .map(name => cacheStorage.delete(name)));
      } catch (_error) {
        return;
      }
    }

    /**
     * Get a browser storage implementation when access is available.
     * @param {string} name - Global storage property name
     * @returns {Storage|null} Browser storage or null when unavailable
     * @private
     */
    static getBrowserStorage(name) {
      let storage = null;
      try {
        storage = typeof globalThis[name] === 'undefined' ? null : globalThis[name];
      /* node:coverage ignore next */
      } catch (_error) {} // eslint-disable-line no-empty
      return storage;
    }

    /**
     * Get browser cache storage when access is available.
     * @returns {CacheStorage|null} Browser cache storage or null when unavailable
     * @private
     */
    static getCacheStorage() {
      let cacheStorage = null;
      try {
        cacheStorage = typeof caches === 'undefined' ? null : caches;
      /* node:coverage ignore next */
      } catch (_error) {} // eslint-disable-line no-empty
      return cacheStorage;
    }
  }

  globalThis.AppStorageService = AppStorageService;
}
