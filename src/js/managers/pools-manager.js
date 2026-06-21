/**
 * Coordinates the published pool collection.
 */

// Prevent multiple declarations
if (typeof globalThis.PoolsManager === 'undefined') {

  /** Coordinates the published pool collection and pool-level queries. */
  class PoolsManager {
  /** Creates an empty pool collection manager. */
  constructor() {
    /** @type {Map<string, Pool>} */
    this.pools = new Map();
    this.dataLoaded = false;
  }

  /**
   * Load pools data from JSON
    * @param {PoolsDocument} poolsData - Published annual pools document
   */
  loadData(poolsData) {
    this.pools.clear();
    this.dataLoaded = false;

    if (poolsData && Array.isArray(poolsData.pools)) {
      poolsData.pools.forEach(poolData => {
        const pool = new Pool(poolData);
        this.pools.set(pool.name, pool);
      });

      this.dataLoaded = true;
    }
  }

  /**
   * Get all pools
    * @returns {Pool[]} - Array of all Pool objects
   */
  getAllPools() {
    return Array.from(this.pools.values());
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
    this.dataLoaded = false;
  }

}

globalThis.PoolsManager = PoolsManager;

}
