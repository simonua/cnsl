/**
 * Pool Link Helper - Utilities for linking to pools from various pages
 */

// Prevent multiple declarations
if (typeof globalThis.getPoolIdFromLocation === 'undefined') {

const PoolLinkSafety = globalThis.HtmlSafety;
const PoolLinkIcons = globalThis.IconCatalog;
const APPLE_MAPS_DIRECTIONS_URL = 'https://maps.apple.com/';
const GOOGLE_MAPS_DIRECTIONS_URL = 'https://www.google.com/maps/dir/';

/**
 * Build a directions query from the most specific published pool location.
 * @param {Object|null} poolData - Published pool data
 * @param {string} displayText - Pool label used as a final fallback
 * @returns {string} Directions destination query
 */
function getPoolDirectionsQuery(poolData, displayText) {
  const pool = poolData && typeof poolData === 'object' ? poolData : {};
  const location = pool.location && typeof pool.location === 'object' ? pool.location : {};
  const address = [
    location.street,
    [location.city, location.state].filter(Boolean).join(', '),
    location.zip
  ].filter(Boolean).join(' ');
  const coordinates = Number.isFinite(location.lat) && Number.isFinite(location.lng)
    ? `${location.lat},${location.lng}`
    : '';
  return String(location.mapsQuery || address || coordinates || displayText || '');
}

/**
 * Generate a clear directions action for the visitor's map platform.
 * @param {Object|null} poolData - Published pool data with location information
 * @param {string} displayText - Pool name used in the accessible link name
 * @param {Object|null} navigatorData - Browser navigator-like platform data
 * @returns {string} Safe directions link HTML or an empty string
 */
function generatePoolDirectionsLink(poolData, displayText, navigatorData = globalThis.navigator) {
  const destination = getPoolDirectionsQuery(poolData, displayText);
  if (!destination) return '';

  const useAppleMaps = globalThis.DevicePlatformService.isApplePlatform(navigatorData || {});
  const directionsUrl = new URL(useAppleMaps ? APPLE_MAPS_DIRECTIONS_URL : GOOGLE_MAPS_DIRECTIONS_URL);
  directionsUrl.searchParams.set(useAppleMaps ? 'daddr' : 'destination', destination);
  if (!useAppleMaps) directionsUrl.searchParams.set('api', '1');
  const safeDirectionsUrl = PoolLinkSafety.safeHttpUrl(directionsUrl.toString());
  if (!safeDirectionsUrl) return '';

  const providerName = useAppleMaps ? 'Apple Maps' : 'Google Maps';
  const safeDisplayText = PoolLinkSafety.escapeHtml(displayText || 'this pool');
  return `<a href="${safeDirectionsUrl}" target="_blank" rel="noopener" class="directions-link" aria-label="Get directions to ${safeDisplayText} in ${providerName}">${PoolLinkIcons.render('map')}<span>Directions</span></a>`;
}

/**
 * Build a case-insensitive index of published pool locations.
 * @param {Array} pools - Pool models or records
 * @returns {Map<string, string>} Pool identifiers keyed by location labels
 */
function createPoolLocationIndex(pools = []) {
  const poolLocations = new Map();
  pools.forEach(pool => {
    const poolName = pool.name;
    if (!poolName || !pool.id) return;
    poolLocations.set(poolName.toLowerCase(), pool.id);
    poolLocations.set(`${poolName} Pool`.toLowerCase(), pool.id);
  });
  return poolLocations;
}

/**
 * Find pool ID from location name
 * @param {string} locationName - The location name from meets data
 * @param {Array|Map<string, string>} poolsOrIndex - Pool records or a prepared location index
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
 * @param {Array|Map<string, string>|null} poolsOrIndex - Pool records or a prepared location index
 * @returns {Object|null} - Pool object or null if not found
 */
function getPoolDataFromLocation(locationName, dataManager, poolsOrIndex = null) {
  if (!locationName || !dataManager) return null;

  try {
    const poolsManager = dataManager.getPools();
    const pools = poolsManager.getAllPools();
    const poolId = getPoolIdFromLocation(locationName, poolsOrIndex || pools);
    const pool = poolId ? pools.find(p => p.id === poolId) : null;
    return pool;
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
 * Generate a validated link to one meet on the meet schedule.
 * @param {string} meetDate - Meet date in `YYYY-MM-DD` format
 * @param {string} poolId - Published pool identifier
 * @param {string} displayText - Link text
 * @returns {string} Safe meet link HTML or escaped display text
 */
function generateMeetPageLink(meetDate, poolId, displayText) {
  const safeDisplayText = PoolLinkSafety.escapeHtml(displayText || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(meetDate || '')) return safeDisplayText;
  if (!/^[a-zA-Z0-9_-]+$/.test(poolId || '')) return safeDisplayText;

  const meetUrl = `meets.html?date=${encodeURIComponent(meetDate)}&pool=${encodeURIComponent(poolId)}`;
  return `<a href="${meetUrl}" class="location-link meet-link">${safeDisplayText}</a>`;
}

/**
 * Link every recognizable pool mentioned in published location text.
 * @param {string} locationText - Location text that may contain pool names
 * @param {Array|Map<string, string>} poolsOrIndex - Pool records or a prepared location index
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
  const location = poolData.location && typeof poolData.location === 'object' ? poolData.location : {};

  if (location.googleMapsUrl) {
    mapsUrl = location.googleMapsUrl;
  } else if (location.mapsQuery) {
    const encodedQuery = encodeURIComponent(location.mapsQuery);
    mapsUrl = `${globalThis.GOOGLE_MAPS_SEARCH_BASE_URL}${encodedQuery}`;
  } else if (Number.isFinite(location.lat) && Number.isFinite(location.lng)) {
    mapsUrl = `${globalThis.GOOGLE_MAPS_SEARCH_BASE_URL}${location.lat},${location.lng}`;
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
 * @param {Array|Map<string, string>|null} poolsOrIndex - Pool records or a prepared location index
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

globalThis.getPoolIdFromLocation = getPoolIdFromLocation;
globalThis.createPoolLocationIndex = createPoolLocationIndex;
globalThis.getPoolDataFromLocation = getPoolDataFromLocation;
globalThis.formatPoolCourseLabel = formatPoolCourseLabel;
globalThis.generatePoolsPageLink = generatePoolsPageLink;
globalThis.generateLinkedPoolMentions = generateLinkedPoolMentions;
globalThis.generateMeetPageLink = generateMeetPageLink;
globalThis.generateGoogleMapsLink = generateGoogleMapsLink;
globalThis.generateEnhancedPoolLink = generateEnhancedPoolLink;
globalThis.generatePoolDirectionsLink = generatePoolDirectionsLink;
globalThis.getPoolDirectionsQuery = getPoolDirectionsQuery;

}
