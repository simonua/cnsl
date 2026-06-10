/**
 * Reusable presentation calculations for the pool directory route.
 */
if (typeof window === 'undefined' || !window.PoolDirectoryService) {
  class PoolDirectoryService {
    static AVAILABILITY_FILTERS = Object.freeze(['all', 'open-now', 'opens-soon', 'open-today', 'open-tomorrow', 'open-next-two-hours']);
    static OPENING_SOON_MINUTES = 60;

    static isAvailabilityFilter(value) {
      return PoolDirectoryService.AVAILABILITY_FILTERS.includes(value);
    }

    /**
     * Check whether a pool's semantic public-use state satisfies one directory filter.
     * @param {Pool|null} poolModel - Pool model with current public-use schedule state
     * @param {string} filter - Supported directory availability filter
     * @returns {boolean} Whether the model matches the requested availability condition
     */
    static matchesAvailabilityFilter(poolModel, filter) {
      if (!poolModel) return false;
      if (filter === 'opens-soon') return poolModel.opensWithinNextMinutes(PoolDirectoryService.OPENING_SOON_MINUTES);
      if (filter === 'open-today') return poolModel.hasPublicUseToday();
      if (filter === 'open-tomorrow') return poolModel.hasPublicUseTomorrow();
      if (filter === 'open-next-two-hours') return poolModel.isOpenForNextMinutes(120);
      return filter === 'all' || poolModel.isOpenForNextMinutes();
    }

    /**
     * Apply a live availability requirement to records through a model lookup callback.
     * @param {Array} pools - Pool records already matched by other directory filters
     * @param {string} filter - Supported directory availability filter
     * @param {Function} getPoolModel - Resolve a pool record to its model
     * @returns {Array} Records matching the requested availability condition
     */
    static filterByAvailability(pools, filter, getPoolModel) {
      if (filter === 'all' || typeof getPoolModel !== 'function') return pools;

      return pools.filter(pool => PoolDirectoryService.matchesAvailabilityFilter(getPoolModel(pool), filter));
    }

    /**
     * Build a stable live-status signature for visible records and active availability filtering.
     * @param {Array} pools - Available pool records
     * @param {string} filter - Active directory availability filter
     * @param {Function} getPoolModel - Resolve a pool record to its model
     * @returns {string} State signature for detecting schedule transitions
     */
    static getLiveStatusSignature(pools, filter, getPoolModel) {
      if (!Array.isArray(pools) || typeof getPoolModel !== 'function') return '';

      const includesAvailability = filter !== 'all';
      return pools.map(pool => {
        const poolModel = getPoolModel(pool);
        if (!poolModel) return `${pool.id || pool.name}:unavailable`;
        const status = poolModel.getCurrentStatus();
        const availability = includesAvailability ? PoolDirectoryService.matchesAvailabilityFilter(poolModel, filter) : '';
        return `${pool.id || pool.name}:${status.kind}:${String(availability)}`;
      }).join('|');
    }

    static calculateDistance(firstCoordinates, secondCoordinates) {
      const earthRadiusMiles = 3958.8;
      const firstLatitude = firstCoordinates.lat * Math.PI / 180;
      const secondLatitude = secondCoordinates.lat * Math.PI / 180;
      const latitudeDelta = (secondCoordinates.lat - firstCoordinates.lat) * Math.PI / 180;
      const longitudeDelta = (secondCoordinates.lng - firstCoordinates.lng) * Math.PI / 180;
      const arc = Math.sin(latitudeDelta / 2) * Math.sin(latitudeDelta / 2)
        + Math.cos(firstLatitude) * Math.cos(secondLatitude)
        * Math.sin(longitudeDelta / 2) * Math.sin(longitudeDelta / 2);

      return earthRadiusMiles * (2 * Math.atan2(Math.sqrt(arc), Math.sqrt(1 - arc)));
    }

    static formatFeatureLabel(feature) {
      const labels = {
        'ada compliant': 'ADA compliant',
        shallow: 'Shallow area',
        splash: 'Splash pad',
        wading: 'Wading pool',
        wifi: 'Wi-Fi'
      };
      if (labels[feature]) return labels[feature];
      return feature.charAt(0).toUpperCase() + feature.slice(1);
    }

    static sortFeaturesForDisplay(features, groupFeatures) {
      return groupFeatures(features).flatMap(group => [...group.features].sort((first, second) => (
        PoolDirectoryService.formatFeatureLabel(first).localeCompare(PoolDirectoryService.formatFeatureLabel(second))
      )));
    }

    static addDistances(pools, userCoordinates) {
      if (!userCoordinates) return pools;

      return pools.map(pool => {
        if (!pool) return pool;
        const location = pool.location || pool;
        const latitude = Number(location.lat);
        const longitude = Number(location.lng);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return pool;
        return {
          ...pool,
          distance: PoolDirectoryService.calculateDistance(userCoordinates, { lat: latitude, lng: longitude })
        };
      });
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = PoolDirectoryService;
  }

  if (typeof window !== 'undefined') {
    window.PoolDirectoryService = PoolDirectoryService;
  }
}
