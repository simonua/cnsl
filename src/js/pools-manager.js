/**
 * Manages all pools with search, filtering, and utility methods
 */
class PoolsManager {
  constructor() {
    this.pools = new Map();
    this.lastUpdated = null;
    this.dataLoaded = false;
  }

  /**
   * Load pools data from JSON
   * @param {Object} poolsData - Raw pools data from JSON
   */
  loadData(poolsData) {
    this.pools.clear();
    
    if (poolsData && poolsData.pools) {
      poolsData.pools.forEach(poolData => {
        const pool = new Pool(poolData);
        this.pools.set(pool.getName(), pool);
      });
      
      this.lastUpdated = poolsData.lastUpdated || new Date().toISOString();
      this.dataLoaded = true;
    }
  }

  /**
   * Get a specific pool by name
   * @param {string} poolName - Pool name (can use PoolNames enum)
   * @returns {Pool|null} - Pool object or null if not found
   */
  getPool(poolName) {
    return this.pools.get(poolName) || null;
  }

  /**
   * Get all pools
   * @returns {Array} - Array of all Pool objects
   */
  getAllPools() {
    return Array.from(this.pools.values());
  }

  /**
   * Get pool names
   * @returns {Array} - Array of pool names
   */
  getPoolNames() {
    return Array.from(this.pools.keys());
  }

  /**
   * Get pools count
   * @returns {number} - Number of pools
   */
  getPoolCount() {
    return this.pools.size;
  }

  /**
   * Get open pools
   * @returns {Array} - Array of currently open pools
   */
  getOpenPools() {
    return this.getAllPools().filter(pool => pool.isOpenNow());
  }

  /**
   * Get closed pools
   * @returns {Array} - Array of currently closed pools
   */
  getClosedPools() {
    return this.getAllPools().filter(pool => !pool.isOpenNow());
  }

  /**
   * Get pools by status
   * @param {PoolStatus} targetStatus - Status to filter by
   * @returns {Array} - Array of pools with specified status
   */
  getPoolsByStatus(targetStatus) {
    return this.getAllPools().filter(pool => {
      const status = pool.getCurrentStatus();
      return status.status === targetStatus.status;
    });
  }

  /**
   * Search pools by term
   * @param {string} searchTerm - Term to search for
   * @returns {Array} - Array of pools matching search term
   */
  searchPools(searchTerm) {
    if (!searchTerm || searchTerm.trim() === '') {
      return this.getAllPools();
    }

    const results = [];
    for (const pool of this.getAllPools()) {
      const searchResult = pool.search(searchTerm);
      if (searchResult.hasMatch) {
        results.push({
          pool: searchResult.pool,
          matches: searchResult.matches
        });
      }
    }

    return results;
  }

  /**
   * Filter pools by features
   * @param {Array} features - Array of features to filter by
   * @returns {Array} - Array of pools with specified features
   */
  filterByFeatures(features) {
    if (!features || features.length === 0) {
      return this.getAllPools();
    }

    return this.getAllPools().filter(pool => {
      return features.every(feature => pool.hasFeature(feature));
    });
  }

  /**
   * Filter pools by amenities
   * @param {Array} amenities - Array of amenities to filter by
   * @returns {Array} - Array of pools with specified amenities
   */
  filterByAmenities(amenities) {
    if (!amenities || amenities.length === 0) {
      return this.getAllPools();
    }

    return this.getAllPools().filter(pool => {
      return amenities.every(amenity => pool.hasAmenity(amenity));
    });
  }

  /**
   * Get pools with diving boards
   * @returns {Array} - Array of pools with diving boards
   */
  getPoolsWithDivingBoards() {
    return this.getAllPools().filter(pool => pool.divingBoard);
  }

  /**
   * Get pools with baby pools
   * @returns {Array} - Array of pools with baby pools
   */
  getPoolsWithBabyPools() {
    return this.getAllPools().filter(pool => pool.babyPool);
  }

  /**
   * Get pools sorted by distance (placeholder for future GPS implementation)
   * @param {Object} userLocation - User's lat/lng coordinates
   * @returns {Array} - Array of pools sorted by distance
   */
  getPoolsByDistance(userLocation) {
    // Placeholder implementation - would need actual coordinates for pools
    // For now, return pools in alphabetical order
    return this.getAllPools().sort((a, b) => a.getName().localeCompare(b.getName()));
  }

  /**
   * Get pool statistics
   * @returns {Object} - Statistics about all pools
   */
  getStatistics() {
    const allPools = this.getAllPools();
    const openPools = this.getOpenPools();
    const closedPools = this.getClosedPools();
    
    // Feature statistics
    const allFeatures = new Set();
    const allAmenities = new Set();
    let divingBoardCount = 0;
    let babyPoolCount = 0;

    allPools.forEach(pool => {
      pool.getFeatures().forEach(feature => allFeatures.add(feature));
      pool.getAmenities().forEach(amenity => allAmenities.add(amenity));
      if (pool.divingBoard) divingBoardCount++;
      if (pool.babyPool) babyPoolCount++;
    });

    return {
      totalPools: allPools.length,
      openPools: openPools.length,
      closedPools: closedPools.length,
      openPercentage: allPools.length > 0 ? Math.round((openPools.length / allPools.length) * 100) : 0,
      uniqueFeatures: allFeatures.size,
      uniqueAmenities: allAmenities.size,
      poolsWithDivingBoards: divingBoardCount,
      poolsWithBabyPools: babyPoolCount,
      lastUpdated: this.lastUpdated
    };
  }

  /**
   * Get pools summary for dashboard
   * @returns {Array} - Array of pool summaries
   */
  getPoolsSummary() {
    return this.getAllPools().map(pool => pool.getSummary());
  }

  /**
   * Get pools with events today
   * @returns {Array} - Array of pools with events today
   */
  getPoolsWithTodaysEvents() {
    return this.getAllPools().filter(pool => {
      const todaysEvents = pool.getTodaysEvents();
      return todaysEvents.length > 0;
    });
  }

  /**
   * Get all unique features across all pools
   * @returns {Array} - Array of unique features
   */
  getAllFeatures() {
    const features = new Set();
    this.getAllPools().forEach(pool => {
      pool.getFeatures().forEach(feature => features.add(feature));
    });
    return Array.from(features).sort();
  }

  /**
   * Get all unique amenities across all pools
   * @returns {Array} - Array of unique amenities
   */
  getAllAmenities() {
    const amenities = new Set();
    this.getAllPools().forEach(pool => {
      pool.getAmenities().forEach(amenity => amenities.add(amenity));
    });
    return Array.from(amenities).sort();
  }

  /**
   * Export all pools data
   * @returns {Object} - All pools data as plain object
   */
  exportData() {
    return {
      pools: this.getAllPools().map(pool => pool.toJSON()),
      lastUpdated: this.lastUpdated,
      statistics: this.getStatistics()
    };
  }

  /**
   * Check if data is loaded
   * @returns {boolean} - True if data is loaded
   */
  isDataLoaded() {
    return this.dataLoaded;
  }

  /**
   * Clear all data
   */
  clearData() {
    this.pools.clear();
    this.lastUpdated = null;
    this.dataLoaded = false;
  }

  /**
   * Refresh pool data (for future API integration)
   * @returns {Promise} - Promise that resolves when data is refreshed
   */
  async refreshData() {
    // Placeholder for future API integration
    // For now, just update the last updated timestamp
    this.lastUpdated = new Date().toISOString();
    return Promise.resolve();
  }
}
