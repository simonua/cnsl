/**
 * Removes browser-persisted state created by this application without clearing unrelated origin data.
 */
if (typeof globalThis.AppStorageService === 'undefined') {
  class AppStorageService {
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

    static getBrowserStorage(name) {
      try {
        return typeof globalThis[name] === 'undefined' ? null : globalThis[name];
      } catch (_error) {
        return null;
      }
    }

    static getCacheStorage() {
      try {
        return typeof caches === 'undefined' ? null : caches;
      } catch (_error) {
        return null;
      }
    }
  }

  globalThis.AppStorageService = AppStorageService;
}
