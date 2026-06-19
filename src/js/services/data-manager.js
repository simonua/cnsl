/**
 * Coordinates all data managers and provides unified access to CNSL data
 */

// Prevent multiple declarations
if (typeof globalThis.DataManager === 'undefined') {
  /** @type {ReadonlyArray<AnnualDataDomain>} */
  const DATA_DOMAINS = Object.freeze(['pools', 'teams', 'meets']);

  /** Coordinates loading and access for annual data domains. */
  class DataManager {
  /** Creates an unloaded data manager. */
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
    * @param {Object} preloadedData - Optional domain data values or promises already requested by the caller
    * @returns {Promise<void>} - Promise that resolves when all data is loaded
   */
  async initialize(requiredDomains = DATA_DOMAINS, preloadedData = {}) {
    const domains = [...new Set(requiredDomains)];
    const unknownDomain = domains.find(domain => !DATA_DOMAINS.includes(domain));
    if (unknownDomain) {
      throw new Error(`Unknown annual data domain: ${unknownDomain}`);
    }

    await Promise.all(domains.map(domain => this._loadDomain(domain, preloadedData[domain])));
    this.initialized = DATA_DOMAINS.every(domain => this.loadedDomains.has(domain));
  }

  /**
   * Load one annual data domain and share its pending request between consumers.
   * @private
    * @param {AnnualDataDomain} domain - Annual data domain to load
    * @param {*|Promise<*>} preloadedData - Optional already-requested domain data
    * @returns {Promise<void>} - Promise that resolves when all data is loaded
   */
  async _loadDomain(domain, preloadedData) {
    if (this.loadedDomains.has(domain)) return;
    if (this.loadingPromises.has(domain)) return this.loadingPromises.get(domain);

    const dataPromise = preloadedData === undefined ? this._fetchDomain(domain) : Promise.resolve(preloadedData);
    const loadingPromise = dataPromise
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
      ? hasArray('regular_meets') && hasArray('special_meets')
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
   * Get the pools manager through the direct-access property.
   * @returns {PoolsManager} Pools manager instance
   */
  get pools() {
    return this.getPools();
  }

  /**
   * Get the teams manager through the direct-access property.
   * @returns {TeamsManager} Teams manager instance
   */
  get teams() {
    return this.getTeams();
  }

  /**
   * Get the meets manager through the direct-access property.
   * @returns {MeetsManager} Meets manager instance
   */
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
    * @param {AnnualDataDomain[]} requiredDomains - Domains that must be loaded
   * @returns {boolean} - True if all managers have data loaded
   */
  isInitialized(requiredDomains = DATA_DOMAINS) {
    return requiredDomains.every(domain => this.loadedDomains.has(domain));
  }

  /**
   * Refresh all data
    * @param {AnnualDataDomain[]} requiredDomains - Domains to reload
    * @returns {Promise<void>} Promise that resolves when data is refreshed
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

globalThis.DataManager = DataManager;
globalThis.getDataManager = getDataManager;

}
