/**
 * Pool Link Helper - Utilities for linking to pools from various pages
 */

if (typeof module !== 'undefined' && module.exports && typeof globalThis.GOOGLE_MAPS_SEARCH_BASE_URL === 'undefined') {
  require('../config/app-config.js');
}

// Prevent multiple declarations
if (typeof window === 'undefined' || !window.getPoolIdFromLocation) {

const PoolLinkSafety = typeof module !== 'undefined' && module.exports
  ? require('./html-safety.js')
  : HtmlSafety;
const PoolLinkIcons = typeof module !== 'undefined' && module.exports
  ? require('./icon-catalog.js')
  : IconCatalog;

function createPoolLocationIndex(pools = []) {
  const poolLocations = new Map();
  pools.forEach(pool => {
    const poolName = typeof pool.getName === 'function' ? pool.getName() : pool.name;
    if (!poolName || !pool.id) return;
    poolLocations.set(poolName.toLowerCase(), pool.id);
    poolLocations.set(`${poolName} Pool`.toLowerCase(), pool.id);
  });
  return poolLocations;
}

/**
 * Find pool ID from location name
 * @param {string} locationName - The location name from meets data
 * @returns {string|null} - Pool ID or null if not found
 */
function getPoolIdFromLocation(locationName, poolsOrIndex = []) {
  if (!locationName) return null;

  const poolLocations = poolsOrIndex instanceof Map ? poolsOrIndex : createPoolLocationIndex(poolsOrIndex);
  const normalizedLocation = String(locationName).trim().toLowerCase();
  const withoutPoolSuffix = normalizedLocation.replace(/\s+pool\s*$/i, '').trim();
  return poolLocations.get(normalizedLocation) || poolLocations.get(withoutPoolSuffix) || null;
}

/**
 * Get pool data from data manager by location name
 * @param {string} locationName - The location name from meets data
 * @param {Object} dataManager - The data manager instance
 * @returns {Object|null} - Pool object or null if not found
 */
function getPoolDataFromLocation(locationName, dataManager, poolsOrIndex = null) {
  if (!locationName || !dataManager) return null;

  try {
    const poolsManager = dataManager.getPools();
    const pools = poolsManager.getAllPools();
    const poolId = getPoolIdFromLocation(locationName, poolsOrIndex || pools);
    const pool = poolId ? pools.find(p => p.id === poolId) : null;
    return pool ? pool.toJSON() : null;
  } catch (error) {
    console.warn('Error getting pool data:', error);
    return null;
  }
}

/**
 * Format modeled lane metadata for course-sensitive meet planning.
 * @param {Object|null} poolData - Published pool data resolved from a meet location
 * @returns {string} Compact lane, length, and unit description, when available
 */
function formatPoolCourseLabel(poolData) {
  const laneCount = Number.isInteger(poolData?.laneCount) && poolData.laneCount > 0 ? poolData.laneCount : null;
  const laneUnit = { meters: 'meter', yards: 'yard' }[poolData?.laneLengthUnits];
  const laneLength = Number.isFinite(poolData?.laneLength) && poolData.laneLength > 0 ? poolData.laneLength : null;
  if (!laneCount || !laneUnit) return '';
  return laneLength ? `${laneCount}-lane / ${laneLength}-${laneUnit}` : `${laneCount}-lane / ${laneUnit}`;
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
  return `<a href="${poolUrl}" class="location-link pool-link">${PoolLinkSafety.escapeHtml(displayText)}</a>`;
}

/**
 * Link every recognizable pool mentioned in published location text.
 * @param {string} locationText - Location text that may contain pool names
 * @returns {string} - Safe HTML containing deep links for known pools
 */
function generateLinkedPoolMentions(locationText, poolsOrIndex = []) {
  if (!locationText) return '';

  const text = String(locationText);
  const poolLocations = poolsOrIndex instanceof Map ? poolsOrIndex : createPoolLocationIndex(poolsOrIndex);
  if (poolLocations.size === 0) return PoolLinkSafety.escapeHtml(text);
  const escapedPoolNames = [...poolLocations.keys()]
    .sort((first, second) => second.length - first.length)
    .map(poolName => poolName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const poolNamePattern = new RegExp(escapedPoolNames.join('|'), 'gi');
  let lastIndex = 0;
  let html = '';

  for (const match of text.matchAll(poolNamePattern)) {
    html += PoolLinkSafety.escapeHtml(text.slice(lastIndex, match.index));
    html += generatePoolsPageLink(getPoolIdFromLocation(match[0], poolLocations), match[0]);
    lastIndex = match.index + match[0].length;
  }

  return `${html}${PoolLinkSafety.escapeHtml(text.slice(lastIndex))}`;
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
    mapsUrl = `${globalThis.GOOGLE_MAPS_SEARCH_BASE_URL}${encodedAddress}`;
  } else if (poolData.location && poolData.location.mapsQuery) {
    // New format fallback using mapsQuery
    const encodedQuery = encodeURIComponent(poolData.location.mapsQuery);
    mapsUrl = `${globalThis.GOOGLE_MAPS_SEARCH_BASE_URL}${encodedQuery}`;
  } else if (poolData.lat && poolData.lng) {
    // Coordinate fallback
    mapsUrl = `${globalThis.GOOGLE_MAPS_SEARCH_BASE_URL}${poolData.lat},${poolData.lng}`;
  } else if (poolData.location && poolData.location.lat && poolData.location.lng) {
    // New format coordinates
    mapsUrl = `${globalThis.GOOGLE_MAPS_SEARCH_BASE_URL}${poolData.location.lat},${poolData.location.lng}`;
  }

  const safeDisplayText = PoolLinkSafety.escapeHtml(displayText);
  const safeMapsUrl = PoolLinkSafety.safeHttpUrl(mapsUrl);
  if (safeMapsUrl) {
    return `<a href="${safeMapsUrl}" target="_blank" rel="noopener" class="location-link maps-link">${safeDisplayText}</a>`;
  }

  // Fallback to generic search
  const searchQuery = encodeURIComponent(`${displayText} Columbia MD`);
  mapsUrl = `${globalThis.GOOGLE_MAPS_SEARCH_BASE_URL}${searchQuery}`;
  return `<a href="${PoolLinkSafety.safeHttpUrl(mapsUrl)}" target="_blank" rel="noopener" class="location-link maps-link">${safeDisplayText}</a>`;
}

/**
 * Generate enhanced pool link with both pools.html and Maps options
 * @param {string} locationName - Location name from meets data
 * @param {Object} dataManager - Data manager instance
 * @param {Object} options - Options for link generation
 * @param {boolean} options.preferPoolsPage - Whether to prefer pools.html link over maps
 * @param {boolean} options.showBothLinks - Whether to show both pools.html and maps links
 * @param {string} [options.displayText] - Optional visible link label while resolving the published location
 * @returns {string} - HTML link(s) for the pool
 */
function generateEnhancedPoolLink(locationName, dataManager, options = {}, poolsOrIndex = null) {
  const {
    preferPoolsPage = true,
    showBothLinks = false,
    displayText = locationName
  } = options;

  if (!locationName) return '';

  const poolData = getPoolDataFromLocation(locationName, dataManager, poolsOrIndex);
  const pools = dataManager && dataManager.getPools ? dataManager.getPools().getAllPools() : [];
  const poolId = getPoolIdFromLocation(locationName, poolsOrIndex || pools);

  if (poolData && poolId) {
    const poolsLink = generatePoolsPageLink(poolId, displayText);
    const mapsLink = generateGoogleMapsLink(poolData, displayText);

    if (showBothLinks) {
      const safeMapsUrl = PoolLinkSafety.safeHttpUrl(poolData.location?.googleMapsUrl);
      const safeLocationName = PoolLinkSafety.escapeHtml(displayText);
      return safeMapsUrl
        ? `${poolsLink} <span class="link-separator">|</span> <a href="${safeMapsUrl}" target="_blank" rel="noopener" class="maps-icon" aria-label="View ${safeLocationName} on Google Maps">${PoolLinkIcons.render('map')}</a>`
        : poolsLink;
    } else if (preferPoolsPage) {
      return poolsLink;
    } else {
      return mapsLink;
    }
  }

  // Fallback when pool data not found
  if (preferPoolsPage) {
    return `<a href="pools.html" class="location-link">${PoolLinkSafety.escapeHtml(displayText)}</a>`;
  } else {
    const searchQuery = encodeURIComponent(`${locationName} Columbia MD`);
    const mapsUrl = `${globalThis.GOOGLE_MAPS_SEARCH_BASE_URL}${searchQuery}`;
    return `<a href="${PoolLinkSafety.safeHttpUrl(mapsUrl)}" target="_blank" rel="noopener" class="location-link">${PoolLinkSafety.escapeHtml(displayText)}</a>`;
  }
}

// Export for Node.js compatibility
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    createPoolLocationIndex,
    getPoolIdFromLocation,
    getPoolDataFromLocation,
    formatPoolCourseLabel,
    generatePoolsPageLink,
    generateLinkedPoolMentions,
    generateGoogleMapsLink,
    generateEnhancedPoolLink
  };
}

// Make functions available globally
if (typeof window !== 'undefined') {
  window.getPoolIdFromLocation = getPoolIdFromLocation;
  window.createPoolLocationIndex = createPoolLocationIndex;
  window.getPoolDataFromLocation = getPoolDataFromLocation;
  window.formatPoolCourseLabel = formatPoolCourseLabel;
  window.generatePoolsPageLink = generatePoolsPageLink;
  window.generateLinkedPoolMentions = generateLinkedPoolMentions;
  window.generateGoogleMapsLink = generateGoogleMapsLink;
  window.generateEnhancedPoolLink = generateEnhancedPoolLink;
}

}
