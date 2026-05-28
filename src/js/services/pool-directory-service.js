/**
 * Reusable presentation calculations for the pool directory route.
 */
if (typeof window === 'undefined' || !window.PoolDirectoryService) {
  class PoolDirectoryService {
    static AVAILABILITY_FILTERS = Object.freeze(['all', 'open-now', 'open-next-two-hours']);

    static isAvailabilityFilter(value) {
      return PoolDirectoryService.AVAILABILITY_FILTERS.includes(value);
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