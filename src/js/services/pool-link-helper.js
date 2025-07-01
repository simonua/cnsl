/**
 * Pool Link Helper - Utilities for linking to pools from various pages
 */

// ------------------------------
//    POOL MAPPING AND LINKING UTILITIES
// ------------------------------

/**
 * Map pool location names to pool IDs
 * This helps translate meet location names to the actual pool IDs used in pools.json
 */
const POOL_LOCATION_TO_ID_MAP = {
  // Direct name matches
  'Bryant Woods': 'bwp',
  'Bryant Woods Pool': 'bwp',
  'Clarys Forest': 'cfp', 
  'Clarys Forest Pool': 'cfp',
  'Clemens Crossing': 'ccp',
  'Clemens Crossing Pool': 'ccp',
  'Dasher Green': 'dgp',
  'Dasher Green Pool': 'dgp',
  'Dickinson Pool': 'dip',
  'Dorsey Hall': 'dhp',
  'Dorsey Hall Pool': 'dhp',
  'Faulkner Ridge': 'frp',
  'Faulkner Ridge Pool': 'frp',
  'Hawthorn': 'hcp',
  'Hawthorn Pool': 'hcp',
  'Hobbits Glen': 'hgp',
  'Hobbits Glen Pool': 'hgp',
  'Hopewell': 'hop',
  'Hopewell Pool': 'hop',
  'Huntington': 'hup',
  'Huntington Pool': 'hup',
  'Jeffers Hill': 'jhp',
  'Jeffers Hill Pool': 'jhp',
  'Kendall Ridge': 'krp',
  'Kendall Ridge Pool': 'krp',
  'Locust Park': 'lpp',
  'Locust Park Pool': 'lpp',
  'Longfellow': 'lop',
  'Longfellow Pool': 'lop',
  'Macgill\'s Common': 'mcp',
  'Macgill\'s Common': 'mcp',
  'Macgills Common': 'mcp',
  'Macgills Common Pool': 'mcp',
  'Phelps Luck': 'plp',
  'Phelps Luck Pool': 'plp',
  'River Hill': 'rhp',
  'River Hill Pool': 'rhp',
  'Running Brook': 'rbp',
  'Running Brook Pool': 'rbp',
  'Stevens Forest': 'sfp',
  'Stevens Forest Pool': 'sfp',
  'Swansfield': 'swp',
  'Swansfield Pool': 'swp',
  'Talbott Springs': 'tsp',
  'Talbott Springs Pool': 'tsp',
  'Thunder Hill': 'thp',
  'Thunder Hill Pool': 'thp'
};

/**
 * Find pool ID from location name
 * @param {string} locationName - The location name from meets data
 * @returns {string|null} - Pool ID or null if not found
 */
function getPoolIdFromLocation(locationName) {
  if (!locationName) return null;
  
  // Try direct lookup first
  const directMatch = POOL_LOCATION_TO_ID_MAP[locationName];
  if (directMatch) return directMatch;
  
  // Try case-insensitive lookup
  const lowerLocation = locationName.toLowerCase();
  for (const [key, value] of Object.entries(POOL_LOCATION_TO_ID_MAP)) {
    if (key.toLowerCase() === lowerLocation) {
      return value;
    }
  }
  
  // Try partial matching (removing "Pool" suffix)
  const simplifiedName = locationName.replace(/\s+Pool\s*$/i, '').trim();
  const simplifiedMatch = POOL_LOCATION_TO_ID_MAP[simplifiedName];
  if (simplifiedMatch) return simplifiedMatch;
  
  return null;
}

/**
 * Get pool data from data manager by location name
 * @param {string} locationName - The location name from meets data
 * @param {Object} dataManager - The data manager instance
 * @returns {Object|null} - Pool object or null if not found
 */
function getPoolDataFromLocation(locationName, dataManager) {
  if (!locationName || !dataManager) return null;
  
  const poolId = getPoolIdFromLocation(locationName);
  if (!poolId) return null;
  
  try {
    const poolsManager = dataManager.getPools();
    const pool = poolsManager.getAllPools().find(p => p.id === poolId);
    return pool ? pool.toJSON() : null;
  } catch (error) {
    console.warn('Error getting pool data:', error);
    return null;
  }
}

/**
 * Generate a link to pools.html for a specific pool
 * @param {string} poolId - Pool ID (3-letter code)
 * @param {string} displayText - Text to display in the link
 * @returns {string} - HTML link to pools.html with pool parameter
 */
function generatePoolsPageLink(poolId, displayText) {
  if (!poolId || !displayText) return displayText || '';
  
  const poolUrl = `pools.html?pool=${encodeURIComponent(poolId)}`;
  return `<a href="${poolUrl}" class="location-link pool-link">${displayText}</a>`;
}

/**
 * Generate a Google Maps link for a pool
 * @param {Object} poolData - Pool data object with location information
 * @param {string} displayText - Text to display in the link
 * @returns {string} - HTML link to Google Maps
 */
function generateGoogleMapsLink(poolData, displayText) {
  if (!poolData || !displayText) return displayText || '';
  
  let mapsUrl = '';
  
  // Use googleMapsUrl if available in new location format
  if (poolData.location && poolData.location.googleMapsUrl) {
    mapsUrl = poolData.location.googleMapsUrl;
  } else if (poolData.address) {
    // Legacy format fallback
    const encodedAddress = encodeURIComponent(poolData.address);
    mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
  } else if (poolData.location && poolData.location.mapsQuery) {
    // New format fallback using mapsQuery
    const encodedQuery = encodeURIComponent(poolData.location.mapsQuery);
    mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodedQuery}`;
  } else if (poolData.lat && poolData.lng) {
    // Coordinate fallback
    mapsUrl = `https://www.google.com/maps/search/?api=1&query=${poolData.lat},${poolData.lng}`;
  } else if (poolData.location && poolData.location.lat && poolData.location.lng) {
    // New format coordinates
    mapsUrl = `https://www.google.com/maps/search/?api=1&query=${poolData.location.lat},${poolData.location.lng}`;
  }
  
  if (mapsUrl) {
    return `<a href="${mapsUrl}" target="_blank" rel="noopener" class="location-link maps-link">${displayText}</a>`;
  }
  
  // Fallback to generic search
  const searchQuery = encodeURIComponent(`${displayText} Columbia MD`);
  mapsUrl = `https://www.google.com/maps/search/?api=1&query=${searchQuery}`;
  return `<a href="${mapsUrl}" target="_blank" rel="noopener" class="location-link maps-link">${displayText}</a>`;
}

/**
 * Generate enhanced pool link with both pools.html and Maps options
 * @param {string} locationName - Location name from meets data
 * @param {Object} dataManager - Data manager instance
 * @param {Object} options - Options for link generation
 * @param {boolean} options.preferPoolsPage - Whether to prefer pools.html link over maps
 * @param {boolean} options.showBothLinks - Whether to show both pools.html and maps links
 * @returns {string} - HTML link(s) for the pool
 */
function generateEnhancedPoolLink(locationName, dataManager, options = {}) {
  const {
    preferPoolsPage = true,
    showBothLinks = false
  } = options;
  
  if (!locationName) return '';
  
  const poolData = getPoolDataFromLocation(locationName, dataManager);
  const poolId = getPoolIdFromLocation(locationName);
  
  if (poolData && poolId) {
    const poolsLink = generatePoolsPageLink(poolId, locationName);
    const mapsLink = generateGoogleMapsLink(poolData, locationName);
    
    if (showBothLinks) {
      return `${poolsLink} <span class="link-separator">|</span> <a href="${poolData.location?.googleMapsUrl || '#'}" target="_blank" rel="noopener" class="maps-icon" title="View on Google Maps">🗺️</a>`;
    } else if (preferPoolsPage) {
      return poolsLink;
    } else {
      return mapsLink;
    }
  }
  
  // Fallback when pool data not found
  if (preferPoolsPage) {
    return `<a href="pools.html" class="location-link">${locationName}</a>`;
  } else {
    const searchQuery = encodeURIComponent(`${locationName} Columbia MD`);
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${searchQuery}`;
    return `<a href="${mapsUrl}" target="_blank" rel="noopener" class="location-link">${locationName}</a>`;
  }
}
