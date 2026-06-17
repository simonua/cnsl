/**
 * Manages the durable timestamp for the latest successful weather check.
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
