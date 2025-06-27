/**
 * Coordinates all data managers and provides unified access to CNSL data
 */
class DataManager {
  constructor() {
    this.poolsManager = new PoolsManager();
    this.teamsManager = new TeamsManager();
    this.meetsManager = new MeetsManager();
    this.initialized = false;
    this.loadingPromise = null;
  }

  /**
   * Initialize data manager by loading all data files
   * @returns {Promise} - Promise that resolves when all data is loaded
   */
  async initialize() {
    if (this.loadingPromise) {
      return this.loadingPromise;
    }

    // First validate data files are accessible
    if (window.FileHelper) {
      console.log('🔍 DataManager: Validating data files...');
      const validation = await FileHelper.validateDataFiles();
      
      if (!validation.allValid) {
        console.error('❌ DataManager: Data files validation failed:', validation);
        
        // Try one more time with a different path strategy
        console.log('🔄 DataManager: Trying alternative path strategy...');
        const poolsPath = validation.pools ? FileHelper.getPoolsDataPath() : 'assets/data/pools.json';
        const teamsPath = validation.teams ? FileHelper.getTeamsDataPath() : 'assets/data/teams.json';
        const meetsPath = validation.meets ? FileHelper.getMeetsDataPath() : 'assets/data/meets.json';
        
        this.loadingPromise = this._loadAllData(poolsPath, teamsPath, meetsPath);
        return this.loadingPromise;
      }
    }

    this.loadingPromise = this._loadAllData();
    return this.loadingPromise;
  }

  /**
   * Load all data files
   * @private
   * @returns {Promise} - Promise that resolves when all data is loaded
   */
  async _loadAllData(customPoolsPath, customTeamsPath, customMeetsPath) {
    try {
      console.log('🔄 DataManager: Starting data file loading...');
      
      // Use FileHelper for correct path resolution, or use custom paths if provided
      const poolsPath = customPoolsPath || FileHelper.getPoolsDataPath();
      const teamsPath = customTeamsPath || FileHelper.getTeamsDataPath();
      const meetsPath = customMeetsPath || FileHelper.getMeetsDataPath();
      
      console.log(`📁 Environment: ${FileHelper.getEnvironment()}`);
      console.log(`📄 Loading from paths:`);
      console.log(`   - Pools: ${poolsPath}`);
      console.log(`   - Teams: ${teamsPath}`);
      console.log(`   - Meets: ${meetsPath}`);
      
      // Try multiple path strategies if in development mode
      let poolsData, teamsData, meetsData;
      
      try {
        // First attempt with the provided/calculated paths
        [poolsData, teamsData, meetsData] = await Promise.all([
          this._loadJsonFile(poolsPath),
          this._loadJsonFile(teamsPath),
          this._loadJsonFile(meetsPath).catch(() => null) // Optional file
        ]);
      } catch (err) {
        console.warn('⚠️ First attempt to load data failed, trying alternative paths...');
        
        // Second attempt with forced production-like paths
        [poolsData, teamsData, meetsData] = await Promise.all([
          this._loadJsonFile('assets/data/pools.json'),
          this._loadJsonFile('assets/data/teams.json'),
          this._loadJsonFile('assets/data/meets.json').catch(() => null) // Optional file
        ]);
      }

      console.log('✅ DataManager: JSON files loaded, initializing managers...');
      
      this.poolsManager.loadData(poolsData);
      this.teamsManager.loadData(teamsData);
      if (meetsData) {
        this.meetsManager.loadData(meetsData);
      }

      this.initialized = true;
      console.log('✅ DataManager: All data loaded successfully');
      
    } catch (error) {
      console.error('❌ DataManager: Error loading data:', error);
      throw error;
    }
  }

  /**
   * Load JSON file
   * @private
   * @param {string} filePath - Path to JSON file
   * @returns {Promise} - Promise that resolves with JSON data
   */
  async _loadJsonFile(filePath) {
    try {
      const response = await fetch(filePath);
      if (!response.ok) {
        throw new Error(`Failed to load ${filePath}: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error(`Error loading ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Get pools manager
   * @returns {PoolsManager} - Pools manager instance
   */
  getPools() {
    return this.poolsManager;
  }

  /**
   * Get teams manager
   * @returns {TeamsManager} - Teams manager instance
   */
  getTeams() {
    return this.teamsManager;
  }

  /**
   * Get meets manager
   * @returns {MeetsManager} - Meets manager instance
   */
  getMeets() {
    return this.meetsManager;
  }

  /**
   * Get a specific pool by name
   * @param {string} poolName - Pool name (can use PoolNames enum)
   * @returns {Pool|null} - Pool object or null
   */
  getPool(poolName) {
    return this.poolsManager.getPool(poolName);
  }

  /**
   * Get a specific team by name
   * @param {string} teamName - Team name
   * @returns {Object|null} - Team object or null
   */
  getTeam(teamName) {
    return this.teamsManager.getTeam(teamName);
  }

  /**
   * Search across all data types
   * @param {string} searchTerm - Term to search for
   * @returns {Object} - Search results from all managers
   */
  search(searchTerm) {
    if (!this.initialized) {
      console.warn('DataManager: Not initialized. Call initialize() first.');
      return { pools: [], teams: [], meets: [] };
    }

    return {
      pools: this.poolsManager.searchPools(searchTerm),
      teams: this.teamsManager.searchTeams(searchTerm),
      meets: this.meetsManager.searchMeets(searchTerm)
    };
  }

  /**
   * Get comprehensive statistics
   * @returns {Object} - Combined statistics from all managers
   */
  getStatistics() {
    if (!this.initialized) {
      return null;
    }

    return {
      pools: this.poolsManager.getStatistics(),
      teams: this.teamsManager.getStatistics(),
      meets: this.meetsManager.getStatistics(),
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Get dashboard summary data
   * @returns {Object} - Summary data for dashboard display
   */
  getDashboardSummary() {
    if (!this.initialized) {
      return null;
    }

    const poolsStats = this.poolsManager.getStatistics();
    const teamsStats = this.teamsManager.getStatistics();
    const meetsStats = this.meetsManager.getStatistics();

    return {
      overview: {
        totalPools: poolsStats.totalPools,
        openPools: poolsStats.openPools,
        totalTeams: teamsStats.totalTeams,
        upcomingMeets: meetsStats.upcomingMeets,
        todaysMeets: meetsStats.todaysMeets
      },
      openPools: this.poolsManager.getOpenPools().map(pool => pool.getSummary()),
      todaysEvents: this.poolsManager.getPoolsWithTodaysEvents().map(pool => ({
        poolName: pool.getName(),
        events: pool.getTodaysEvents()
      })),
      upcomingMeets: this.meetsManager.getUpcomingMeets(7), // Next 7 days
      recentUpdates: {
        pools: poolsStats.lastUpdated,
        teams: teamsStats.lastUpdated,
        meets: meetsStats.lastUpdated
      }
    };
  }

  /**
   * Get pool schedule with meet conflicts
   * @param {string} poolName - Pool name
   * @param {string} date - Date to check
   * @returns {Object} - Pool schedule with meet information
   */
  getPoolScheduleWithMeets(poolName, date) {
    const pool = this.poolsManager.getPool(poolName);
    if (!pool) return null;

    const dayName = TimeUtils.getDayName(new Date(date));
    const schedule = pool.getTimeSlots(dayName);
    const meets = this.meetsManager.getPoolConflicts(poolName, date);

    return {
      poolName,
      date,
      dayName,
      schedule,
      meets,
      hasMeets: meets.length > 0
    };
  }

  /**
   * Get team's pool information
   * @param {string} teamName - Team name
   * @returns {Object|null} - Team with pool details
   */
  getTeamWithPool(teamName) {
    const team = this.teamsManager.getTeam(teamName);
    if (!team) return null;

    const pool = team.poolName ? this.poolsManager.getPool(team.poolName) : null;

    return {
      team,
      pool: pool ? pool.getDetailedInfo() : null,
      upcomingMeets: this.meetsManager.getMeetsByTeam(teamName)
        .filter(meet => new Date(meet.date) >= new Date())
        .slice(0, 5) // Next 5 meets
    };
  }

  /**
   * Get comprehensive pool information
   * @param {string} poolName - Pool name
   * @returns {Object|null} - Complete pool information
   */
  getCompletePoolInfo(poolName) {
    const pool = this.poolsManager.getPool(poolName);
    if (!pool) return null;

    const teams = this.teamsManager.getTeamsByPool(poolName);
    const upcomingMeets = this.meetsManager.getHomeMeetsByPool(poolName)
      .filter(meet => new Date(meet.date) >= new Date())
      .slice(0, 10); // Next 10 home meets

    return {
      pool: pool.getDetailedInfo(),
      teams,
      upcomingMeets,
      teamCount: teams.length,
      meetCount: upcomingMeets.length
    };
  }

  /**
   * Check if all data is loaded
   * @returns {boolean} - True if all managers have data loaded
   */
  isInitialized() {
    return this.initialized;
  }

  /**
   * Refresh all data
   * @returns {Promise} - Promise that resolves when data is refreshed
   */
  async refresh() {
    this.initialized = false;
    this.loadingPromise = null;
    
    this.poolsManager.clearData();
    this.teamsManager.clearData();
    this.meetsManager.clearData();
    
    return this.initialize();
  }

  /**
   * Export all data
   * @returns {Object} - All data from all managers
   */
  exportAllData() {
    if (!this.initialized) {
      return null;
    }

    return {
      pools: this.poolsManager.exportData(),
      teams: this.teamsManager.exportData(),
      meets: this.meetsManager.exportData(),
      statistics: this.getStatistics(),
      exportedAt: new Date().toISOString()
    };
  }

  /**
   * Get status of data loading
   * @returns {Object} - Status of each manager
   */
  getLoadingStatus() {
    return {
      initialized: this.initialized,
      pools: this.poolsManager.isDataLoaded(),
      teams: this.teamsManager.isDataLoaded(),
      meets: this.meetsManager.isDataLoaded()
    };
  }
}

// Create global instance for backward compatibility
// This allows existing code to continue working while new code can use the class directly
let globalDataManager = null;

/**
 * Get the global DataManager instance
 * @returns {DataManager} - Global DataManager instance
 */
function getDataManager() {
  if (!globalDataManager) {
    globalDataManager = new DataManager();
  }
  return globalDataManager;
}

/**
 * Initialize the global DataManager (for backward compatibility)
 * @returns {Promise} - Promise that resolves when data is loaded
 */
async function initializeDataManager() {
  const manager = getDataManager();
  return manager.initialize();
}
