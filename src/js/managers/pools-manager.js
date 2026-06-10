/**
 * Manages all pools with search, filtering, and utility methods
 */

// Prevent multiple declarations
if (typeof globalThis.PoolsManager === 'undefined') {

  /** Coordinates the published pool collection and pool-level queries. */
  class PoolsManager {
  /** Creates an empty pool collection manager. */
  constructor() {
    /** @type {Map<string, Pool>} */
    this.pools = new Map();
    this.lastUpdated = null;
    this.dataLoaded = false;
  }

  /**
   * Load pools data from JSON
    * @param {PoolsDocument} poolsData - Published annual pools document
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
    * @param {string} poolName - Pool name from published annual data
   * @returns {Pool|null} - Pool object or null if not found
   */
  getPool(poolName) {
    return this.pools.get(poolName) || null;
  }

  /**
   * Get all pools
    * @returns {Pool[]} - Array of all Pool objects
   */
  getAllPools() {
    return Array.from(this.pools.values());
  }

  /**
   * Get pool names
    * @returns {string[]} - Array of pool names
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
    * @returns {Pool[]} - Array of currently open pools
   */
  getOpenPools() {
    return this.getAllPools().filter(pool => pool.isOpenNow());
  }

  /**
   * Get closed pools
    * @returns {Pool[]} - Array of currently closed pools
   */
  getClosedPools() {
    return this.getAllPools().filter(pool => !pool.isOpenNow());
  }

  /**
   * Get pools by status
   * @param {PoolStatus} targetStatus - Status to filter by
    * @returns {Pool[]} - Array of pools with specified status
   */
  getPoolsByStatus(targetStatus) {
    return this.getAllPools().filter(pool => {
      const status = pool.getCurrentStatus();
      return status.kind === targetStatus.kind;
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
    * @param {string[]} features - Array of features to filter by
    * @returns {Pool[]} - Array of pools with specified features
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
    * @param {string[]} amenities - Array of amenities to filter by
    * @returns {Pool[]} - Array of pools with specified amenities
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
    * @returns {Pool[]} - Array of pools with diving boards
   */
  getPoolsWithDivingBoards() {
    return this.getAllPools().filter(pool => pool.divingBoard);
  }

  /**
   * Get pools with baby pools
    * @returns {Pool[]} - Array of pools with baby pools
   */
  getPoolsWithBabyPools() {
    return this.getAllPools().filter(pool => pool.babyPool);
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
    * @returns {string[]} - Array of unique features
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
    * @returns {string[]} - Array of unique amenities
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

}

globalThis.PoolsManager = PoolsManager;

}
