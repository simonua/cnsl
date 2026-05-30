/**
 * Coordinates all data managers and provides unified access to CNSL data
 */

// Prevent multiple declarations
if (typeof window === 'undefined' || !window.DataManager) {
  /** @type {ReadonlyArray<AnnualDataDomain>} */
  const DATA_DOMAINS = Object.freeze(['pools', 'teams', 'meets']);

  class DataManager {
  constructor() {
    /** @type {PoolsManager|null} */
    this.poolsManager = null;
    /** @type {TeamsManager|null} */
    this.teamsManager = null;
    /** @type {MeetsManager|null} */
    this.meetsManager = null;
    this.initialized = false;
    /** @type {Map<AnnualDataDomain, Promise<void>>} */
    this.loadingPromises = new Map();
    /** @type {Set<AnnualDataDomain>} */
    this.loadedDomains = new Set();
    /** @type {SeasonInfo|null} */
    this.seasonInfo = null;
  }

  /**
   * Initialize only the annual data required by a page or feature.
    * @param {AnnualDataDomain[]} requiredDomains - Annual data domains needed by the caller
    * @returns {Promise<void>} - Promise that resolves when all data is loaded
   */
  async initialize(requiredDomains = DATA_DOMAINS) {
    const domains = [...new Set(requiredDomains)];
    const unknownDomain = domains.find(domain => !DATA_DOMAINS.includes(domain));
    if (unknownDomain) {
      throw new Error(`Unknown annual data domain: ${unknownDomain}`);
    }

    await Promise.all(domains.map(domain => this._loadDomain(domain)));
    this.initialized = DATA_DOMAINS.every(domain => this.loadedDomains.has(domain));
  }

  /**
   * Load one annual data domain and share its pending request between consumers.
   * @private
    * @param {AnnualDataDomain} domain - Annual data domain to load
    * @returns {Promise<void>} - Promise that resolves when all data is loaded
   */
  async _loadDomain(domain) {
    if (this.loadedDomains.has(domain)) return;
    if (this.loadingPromises.has(domain)) return this.loadingPromises.get(domain);

    const loadingPromise = this._fetchDomain(domain)
      .then(data => {
        this._validateDomainData(domain, data);
        this._getManager(domain).loadData(data);
        this.loadedDomains.add(domain);
        if (domain !== 'pools') return;
        const poolsData = data;
      this.seasonInfo = {
        seasonStartDate: poolsData.seasonStartDate,
        seasonEndDate: poolsData.seasonEndDate,
        caPoolDirectoryUrl: poolsData.caPoolDirectoryUrl,
        caPoolGuideUrl: poolsData.caPoolGuideUrl
      };
      })
      .finally(() => this.loadingPromises.delete(domain));

    this.loadingPromises.set(domain, loadingPromise);
    return loadingPromise;
  }

  /**
   * Fetch the configured document for a domain.
   * @private
    * @param {AnnualDataDomain} domain - Annual data domain to fetch
    * @returns {Promise<PoolsDocument|TeamsDocument|MeetsDocument>} - Published annual document
   */
  _fetchDomain(domain) {
    const pathGetters = {
      pools: () => FileHelper.getPoolsDataPath(),
      teams: () => FileHelper.getTeamsDataPath(),
      meets: () => FileHelper.getMeetsDataPath()
    };
    return this._loadJsonFile(pathGetters[domain]());
  }

  /**
   * Reject structurally unusable published data before a page reports success.
   * @private
    * @param {AnnualDataDomain} domain - Annual data domain being validated
    * @param {PoolsDocument|TeamsDocument|MeetsDocument} data - Parsed annual data document
   */
  _validateDomainData(domain, data) {
    const hasArray = (key) => data && Array.isArray(data[key]);
    const isUsable = domain === 'meets'
      ? hasArray('meets') || (hasArray('regular_meets') && hasArray('special_meets'))
      : hasArray(domain);
    if (!isUsable) {
      throw new Error(`Invalid ${domain} annual data response.`);
    }
  }

  /**
   * Get or create the manager for a loaded data domain.
   * @private
    * @param {AnnualDataDomain} domain - Data domain manager to retrieve
    * @returns {PoolsManager|TeamsManager|MeetsManager} - Domain manager instance
   */
  _getManager(domain) {
    if (domain === 'pools') {
      if (!this.poolsManager) this.poolsManager = new PoolsManager();
      return this.poolsManager;
    }
    if (domain === 'teams') {
      if (!this.teamsManager) this.teamsManager = new TeamsManager();
      return this.teamsManager;
    }
    if (!this.meetsManager) this.meetsManager = new MeetsManager();
    return this.meetsManager;
  }

  /**
   * Load JSON file
   * @private
   * @param {string} filePath - Path to JSON file
    * @template T
    * @returns {Promise<T>} - Promise that resolves with JSON data
   */
  async _loadJsonFile(filePath) {
    try {
      const response = await fetch(filePath, { cache: 'no-cache' });
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
    return this._getManager('pools');
  }

  /**
   * Get teams manager
   * @returns {TeamsManager} - Teams manager instance
   */
  getTeams() {
    return this._getManager('teams');
  }

  /**
   * Get meets manager
   * @returns {MeetsManager} - Meets manager instance
   */
  getMeets() {
    return this._getManager('meets');
  }

  /**
   * Get active pool season metadata already loaded with the directory data.
    * @returns {SeasonInfo|null} - Public season summary metadata or null until loaded
   */
  getSeasonInfo() {
    return this.seasonInfo ? { ...this.seasonInfo } : null;
  }

  /**
   * Property getters for direct access (used by search engine and copilot)
   */
  get pools() {
    return this.getPools();
  }

  get teams() {
    return this.getTeams();
  }

  get meets() {
    return this.getMeets();
  }

  /**
   * Get a specific pool by name
    * @param {string} poolName - Pool name from published annual data
   * @returns {Pool|null} - Pool object or null
   */
  getPool(poolName) {
    return this.getPools().getPool(poolName);
  }

  /**
   * Get a specific team by name
   * @param {string} teamName - Team name
    * @returns {TeamRecord|null} - Team object or null
   */
  getTeam(teamName) {
    return this.getTeams().getTeam(teamName);
  }

  /**
   * Check if all data is loaded
   * @returns {boolean} - True if all managers have data loaded
   */
  isInitialized(requiredDomains = DATA_DOMAINS) {
    return requiredDomains.every(domain => this.loadedDomains.has(domain));
  }

  /**
   * Refresh all data
   * @returns {Promise} - Promise that resolves when data is refreshed
   */
  async refresh(requiredDomains = [...this.loadedDomains]) {
    const domains = requiredDomains.length > 0 ? requiredDomains : DATA_DOMAINS;
    this.initialized = false;
    domains.forEach(domain => {
      this.loadedDomains.delete(domain);
      const manager = this[`${domain}Manager`];
      if (manager) manager.clearData();
    });
    if (domains.includes('pools')) this.seasonInfo = null;

    return this.initialize(domains);
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
async function initializeDataManager(requiredDomains) {
  const manager = getDataManager();
  return manager.initialize(requiredDomains);
}

// Export for Node.js compatibility
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { DataManager, getDataManager, initializeDataManager };
}

// Make sure it's available globally
if (typeof window !== 'undefined') {
  window.DataManager = DataManager;
}

}
