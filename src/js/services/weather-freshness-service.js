/**
 * Manages durable weather freshness and the tab-local alert cache.
 */
if (typeof globalThis.WeatherFreshnessService === 'undefined') {
  /** Reads, validates, and stores weather-check freshness metadata. */
  class WeatherFreshnessService {
    static STORAGE_KEY = globalThis.WEATHER_ALERT_LAST_SUCCESSFUL_CHECK_STORAGE_KEY;

    /**
     * Get local storage when browser access is available.
     * @returns {Storage|null} Local storage or null
     */
    static getStorage() {
      let storage = null;
      try {
        storage = typeof localStorage === 'undefined' ? null : localStorage;
      /* node:coverage ignore next */
      } catch (_error) {} // eslint-disable-line no-empty
      return storage;
    }

    /**
     * Read the latest successful weather-check timestamp.
     * @param {Storage|null} storage - Browser storage or a compatible substitute
     * @returns {Object|null} Latest timestamp record
     */
    static read(storage = WeatherFreshnessService.getStorage()) {
      if (!storage) return null;
      try {
        const status = JSON.parse(storage.getItem(WeatherFreshnessService.STORAGE_KEY));
        const updatedAt = status && typeof status.updatedAt === 'string' ? new Date(status.updatedAt) : null;
        return updatedAt && !Number.isNaN(updatedAt.getTime()) ? { updatedAt: status.updatedAt } : null;
      } catch (_error) {
        return null;
      }
    }

    /**
     * Persist a newer successful weather-check timestamp.
     * @param {Object} status - Weather status with update timestamp
     * @param {Storage|null} storage - Browser storage or a compatible substitute
     */
    static remember(status, storage = WeatherFreshnessService.getStorage()) {
      if (!storage || !status || typeof status.isInclement !== 'boolean' || typeof status.updatedAt !== 'string') return;
      const updatedAt = new Date(status.updatedAt);
      if (Number.isNaN(updatedAt.getTime())) return;

      const latestStatus = WeatherFreshnessService.read(storage);
      if (latestStatus && new Date(latestStatus.updatedAt) >= updatedAt) return;

      try {
        storage.setItem(WeatherFreshnessService.STORAGE_KEY, JSON.stringify({ updatedAt: status.updatedAt }));
      } catch (_error) {
        return;
      }
    }
  }

  globalThis.WeatherFreshnessService = WeatherFreshnessService;
}

if (typeof globalThis.WeatherAlertCacheService === 'undefined') {
  /** Owns the serialized weather alert cache envelope and status contract. */
  class WeatherAlertCacheService {
    static STORAGE_KEY = globalThis.WEATHER_ALERT_STATUS_STORAGE_KEY;

    /**
     * Get session storage when browser access is available.
     * @returns {Storage|null} Session storage or null
     */
    static getStorage() {
      let storage = null;
      try {
        storage = typeof sessionStorage === 'undefined' ? null : sessionStorage;
      /* node:coverage ignore next */
      } catch (_error) {} // eslint-disable-line no-empty
      return storage;
    }

    /**
     * Check whether a cached status can be consumed by the weather display contract.
     * @param {*} status - Candidate weather status
     * @returns {boolean} Whether the status has a safe supported shape
     */
    static isValidStatus(status) {
      if (!status || typeof status !== 'object' || typeof status.isInclement !== 'boolean') return false;
      if (typeof status.updatedAt !== 'string' || Number.isNaN(new Date(status.updatedAt).getTime())) return false;
      if (!status.isInclement) return true;
      return globalThis.WeatherAlertSource.isValid(status.source)
        && typeof status.message === 'string'
        && status.message.trim().length > 0;
    }

    /**
     * Read a fresh weather cache entry for the configured interval.
     * @param {number} refreshMinutes - Expected refresh interval
     * @param {Storage|null} storage - Session storage or a compatible substitute
     * @param {Date} now - Cache evaluation time
     * @returns {Object|null} Valid fresh cache entry or null
     */
    static read(refreshMinutes, storage = WeatherAlertCacheService.getStorage(), now = new Date()) {
      if (!storage) return null;
      try {
        const cached = JSON.parse(storage.getItem(WeatherAlertCacheService.STORAGE_KEY));
        return cached
          && cached.refreshMinutes === refreshMinutes
          && Number.isFinite(cached.expiresAt)
          && cached.expiresAt > now.getTime()
          && WeatherAlertCacheService.isValidStatus(cached.status)
          ? cached
          : null;
      } catch (_error) {
        return null;
      }
    }

    /**
     * Persist a validated weather status for one refresh interval.
     * @param {Object} status - Weather status to cache
     * @param {number} refreshMinutes - Cache lifetime in minutes
     * @param {Storage|null} storage - Session storage or a compatible substitute
     * @param {Date} now - Cache write time
     * @returns {boolean} Whether the cache entry was stored
     */
    static write(status, refreshMinutes, storage = WeatherAlertCacheService.getStorage(), now = new Date()) {
      if (!storage
        || !Number.isFinite(refreshMinutes)
        || refreshMinutes <= 0
        || !WeatherAlertCacheService.isValidStatus(status)) return false;
      try {
        storage.setItem(WeatherAlertCacheService.STORAGE_KEY, JSON.stringify({
          expiresAt: now.getTime() + refreshMinutes * 60 * 1000,
          refreshMinutes,
          status
        }));
        return true;
      } catch (_error) {
        return false;
      }
    }
  }

  globalThis.WeatherAlertCacheService = WeatherAlertCacheService;
}
