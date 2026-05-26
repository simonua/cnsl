// Global data manager instance for pool browser
let poolBrowserDataManager = null;
let userCoords = null;
let poolBrowserPools = [];
let poolSortOrder = 'name';
const PoolBrowserSafety = HtmlSafety;

// Pool-specific week states (poolId -> Date)
const poolWeekStates = new Map();

// ------------------------------
//    SAFE REFERENCE HELPERS
// ------------------------------

/**
 * Safely get TimeUtils reference
 * @returns {object|null} TimeUtils class or null if not available
 */
function _getTimeUtils() {
  return (typeof window !== 'undefined' && window.TimeUtils) ? window.TimeUtils : null;
}

// ------------------------------
//    UTILITY FUNCTIONS
// ------------------------------

// Prevent multiple declarations
if (!window.getMondayOfWeek) {

/**
 * Get the Monday of the week for a given date
 * @param {Date} date - Any date in the week
 * @returns {Date} - The Monday of that week
 */
function getMondayOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  return new Date(d.setDate(diff));
}

/**
 * Check if today's date is within the season date range
 * @param {Object} dateRange - Object with startDate and endDate properties
 * @returns {boolean} - True if today is within the season, false otherwise
 */
function isTodayInSeason(dateRange) {
  if (!dateRange || !dateRange.startDate || !dateRange.endDate) {
    return false;
  }
  
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Reset time to start of day for comparison
  
  const startDate = new Date(dateRange.startDate);
  startDate.setHours(0, 0, 0, 0);
  
  const endDate = new Date(dateRange.endDate);
  endDate.setHours(23, 59, 59, 999); // Set to end of day
  
  return today >= startDate && today <= endDate;
}

/**
 * Get or initialize the week start for a specific pool
 * @param {string} poolId - Pool identifier
 * @returns {Date} - Week start date for this pool
 */
function getPoolWeekStart(poolId) {
  if (!poolWeekStates.has(poolId)) {
    poolWeekStates.set(poolId, getMondayOfWeek(new Date()));
  }
  return poolWeekStates.get(poolId);
}

/**
 * Set the week start for a specific pool
 * @param {string} poolId - Pool identifier
 * @param {Date} weekStart - New week start date
 */
function setPoolWeekStart(poolId, weekStart) {
  poolWeekStates.set(poolId, weekStart);
}

/**
 * Get tooltip text for pool status
 * @param {string} color - Status color (green, red, yellow, gray)
 * @returns {string} - Tooltip text
 */
function getStatusTooltip(color) {
  switch (color) {
    case 'green':
      return 'Open for public use';
    case 'red':
      return 'Currently closed';
    case 'yellow':
      return 'Special schedule or restrictions';
    case 'gray':
      return 'Schedule not available';
    default:
      return 'Status unknown';
  }
}


// ------------------------------
//    INITIALIZATION
// ------------------------------

/**
 * Initialize the pool browser with data manager
 */
async function initializePoolBrowser() {
  if (!poolBrowserDataManager) {
    poolBrowserDataManager = getDataManager();
    await poolBrowserDataManager.initialize(['pools']);
  }
}

/**
 * Update assistive loading feedback for the pool directory.
 * @param {string} message - Status message to announce
 * @param {boolean} isBusy - Whether the directory is loading
 */
function setPoolListStatus(message, isBusy) {
  const list = document.getElementById('poolList');
  const status = document.getElementById('poolListStatus');
  if (list) list.setAttribute('aria-busy', String(isBusy));
  if (status) status.textContent = message;
}

/**
 * Center today's column within visible weekly calendar schedules without moving the page.
 * @param {Document|Element} root - Container to search for visible calendars
 */
function scrollCalendarsToToday(root = document) {
  root.querySelectorAll('.schedule-calendar').forEach(calendar => {
    const today = calendar.querySelector('.schedule-calendar__day.is-today');
    if (!today || calendar.clientWidth === 0) return;

    const calendarBounds = calendar.getBoundingClientRect();
    const todayBounds = today.getBoundingClientRect();
    const centeredLeft = calendar.scrollLeft + todayBounds.left - calendarBounds.left
      - ((calendar.clientWidth - todayBounds.width) / 2);
    const maximumLeft = calendar.scrollWidth - calendar.clientWidth;
    const scrollLeft = Math.max(0, Math.min(maximumLeft, centeredLeft));
    calendar.scrollLeft = scrollLeft;
  });
}

/**
 * Reveal a linked pool without placing its heading beneath the fixed site header.
 * @param {Element} poolCard - Pool card selected from a cross-page link
 */
function scrollLinkedPoolIntoView(poolCard) {
  const header = document.querySelector('.header');
  const headerBottom = header ? header.getBoundingClientRect().bottom : 0;
  const scrollClearance = 12;
  const top = Math.max(0, window.scrollY + poolCard.getBoundingClientRect().top - headerBottom - scrollClearance);
  const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
  window.scrollTo({ top, behavior });
}

/**
 * Load and display the official interactive CA pool directory action.
 */
function loadSeasonInfo() {
  const seasonInfo = document.getElementById('seasonInfo');
  const poolData = poolBrowserDataManager ? poolBrowserDataManager.getSeasonInfo() : null;
  if (!seasonInfo) return;

  const safeDirectoryUrl = poolData && PoolBrowserSafety.safeHttpUrl(poolData.caPoolDirectoryUrl);
  if (safeDirectoryUrl) {
    seasonInfo.hidden = false;
    seasonInfo.innerHTML = `
      <p class="ca-directory-link">
        <a href="${safeDirectoryUrl}" target="_blank" rel="noopener" class="directory-link">
          📍 Interactive CA Pool Directory
        </a>
      </p>
    `;
  } else {
    seasonInfo.hidden = true;
  }
}

// ------------------------------
//    LEGACY COMPATIBILITY FUNCTIONS
// ------------------------------

/**
 * Legacy wrapper for pool status - uses new Pool class method
 * @param {Object} pool - Pool data object
 * @returns {Object} - Status object with isOpen, status, color, and icon
 */
function getPoolStatus(pool) {
  if (!poolBrowserDataManager) {
    console.warn('Data manager not initialized');
    return {
      isOpen: false,
      status: 'Unavailable',
      color: 'red',
      icon: '🔴'
    };
  }

  const poolObj = poolBrowserDataManager.getPool(pool.name);
  if (!poolObj) {
    return {
      isOpen: false,
      status: 'Closed',
      color: 'red',
      icon: '🔴'
    };
  }

  const status = poolObj.getCurrentStatus();
  return {
    isOpen: status.isOpen,
    status: status.status,
    color: status.color || 'red',
    icon: status.icon || '🔴'
  };
}

/**
 * Legacy wrapper for checking if pool is open
 * @param {Object} pool - Pool data object
 * @returns {boolean} - True if pool is open
 */
// eslint-disable-next-line no-unused-vars
function isPoolOpen(pool) {
  const status = getPoolStatus(pool);
  return status.isOpen && status.color === 'green';
}



/**
 * Formats pool schedule for display with individual week navigation
 * @param {Object} pool - Pool data object (legacy format)
 * @returns {string} - HTML string for displaying hours with navigation
 */
function formatPoolHours(pool) {
  if (!poolBrowserDataManager) {
    return '<div class="pool-hours"><strong>🕒 Hours:</strong> Data unavailable</div>';
  }

  const poolObj = poolBrowserDataManager.getPool(pool.name);
  if (!poolObj) {
    return '<div class="pool-hours"><strong>🕒 Hours:</strong> Pool not found</div>';
  }

  // Check if pool has empty schedules (TBD pools)
  if (!poolObj.legacySchedules || poolObj.legacySchedules.length === 0) {
    return `<div class="pool-hours">
      <strong>🕒 Hours:</strong> 
      <span class="status-gray status-tooltip">
        Schedule TBD
        <span class="tooltip-text">Schedule not available</span>
      </span>
    </div>`;
  }

  const poolId = pool.id || pool.name;
  const controlId = String(poolId).replace(/[^a-zA-Z0-9_-]/g, '-');
  const weekPickerId = `week-picker-${controlId}`;
  const poolName = pool.name || 'this pool';
  const safePoolId = PoolBrowserSafety.escapeHtml(poolId);
  const safePoolName = PoolBrowserSafety.escapeHtml(poolName);
  const weekStart = getPoolWeekStart(poolId);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  
  const timeUtils = _getTimeUtils();
  if (!timeUtils) {
    return '<div class="pool-week-display">Time utilities not available</div>';
  }
  
  const easternTimeInfo = timeUtils.getCurrentEasternTimeInfo();
  
  // Get pool status with error handling
  let poolStatus;
  try {
    poolStatus = poolObj.getCurrentStatus();
  } catch (error) {
    console.error(`[Pool Browser] Error getting status for pool ${poolObj.name}:`, error);
    poolStatus = {
      isOpen: false,
      status: 'Error',
      color: 'gray',
      icon: '⚫'
    };
  }
  
  // Get week schedule for the selected week with error handling
  let weekSchedule;
  try {
    weekSchedule = poolObj.getWeekScheduleForDate(weekStart);
  } catch (error) {
    console.error(`[Pool Browser] Error getting week schedule for pool ${poolObj.name}:`, error);
    weekSchedule = [];
  }
  
  // Format the week display text
  const weekStartText = weekStart.toLocaleDateString('en-US', { 
    month: 'long', 
    day: 'numeric' 
  });
  const weekEndText = weekEnd.toLocaleDateString('en-US', { 
    month: 'long', 
    day: 'numeric' 
  });
  
  // Get pool's valid date range for navigation constraints
  const dateRange = poolObj.getValidDateRange();
  const statusClass = ['green', 'red', 'yellow', 'gray'].includes(poolStatus.color) ? poolStatus.color : 'gray';
  const safeStatusIcon = PoolBrowserSafety.escapeHtml(poolStatus.icon);
  const safeStatusText = PoolBrowserSafety.escapeHtml(poolStatus.status);
  
  // Build navigation controls
  const navigationHtml = `
    <div class="pool-week-navigation" data-pool-id="${safePoolId}">
      <div class="week-controls-row">
        <div class="week-display">
          <span class="week-text">Week of ${weekStartText} - ${weekEndText}</span>
        </div>
        <div class="nav-buttons">
          <button class="nav-btn calendar-btn" data-pool-id="${safePoolId}" aria-label="Choose a week for ${safePoolName}" aria-controls="${weekPickerId}" aria-expanded="false" ${!dateRange ? 'disabled' : ''}>
            📅
          </button>
          <button class="nav-btn today-btn" data-pool-id="${safePoolId}" ${!dateRange || !isTodayInSeason(dateRange) ? 'disabled' : ''}>
            Today
          </button>
          <button class="nav-btn prev-week" ${!dateRange || weekStart <= dateRange.startDate ? 'disabled' : ''}>
            ◀ Prev
          </button>
          <button class="nav-btn next-week" ${!dateRange || weekEnd >= dateRange.endDate ? 'disabled' : ''}>
            Next ▶
          </button>
        </div>
      </div>
      <input type="date" class="week-picker" id="${weekPickerId}" aria-label="Week to display for ${safePoolName}" hidden
             value="${weekStart.toISOString().split('T')[0]}"
             ${dateRange ? `min="${dateRange.startDate.toISOString().split('T')[0]}" max="${dateRange.endDate.toISOString().split('T')[0]}"` : ''}>
    </div>`;

  const preferences = PreferencesService.get();
  const today = new Date(`${easternTimeInfo.date}T12:00:00`);
  const hoursDisplay = PoolScheduleDisplay.render(weekSchedule, {
    layout: preferences.poolScheduleLayout,
    weekStart,
    today,
    timeUtils,
    poolStatus
  });

  return `
    <div class="pool-hours">
      <strong>🕒 Hours:</strong> 
      <span class="open-status status-${statusClass} status-tooltip">
        ${safeStatusIcon} ${safeStatusText}
        <span class="tooltip-text">${getStatusTooltip(statusClass)}</span>
      </span><br>
      ${navigationHtml}
      ${hoursDisplay}
    </div>
  `;
}

/**
 * Gets the user's current location if they grant permission
 * Gracefully handles cases where geolocation is denied or not available
 */
function getUserLocation() {
  if (!PreferencesService.get().locationAwarenessEnabled) {
    return;
  }

  // Check if geolocation is supported
  if (!navigator.geolocation) {
    return; // Exit function early, no location will be used
  }
  
  // Define options for geolocation request
  const options = {
    enableHighAccuracy: false, // Don't need high accuracy for distance estimates
    timeout: 5000,           // Time to wait for location (5 seconds)
    maximumAge: 60000        // Cache location for 1 minute
  };
  
  // Request location
  navigator.geolocation.getCurrentPosition(
    // Success callback
    position => {
      userCoords = {
        lat: position.coords.latitude,
        lng: position.coords.longitude
      };
      // Re-render pools with distance if we're on the pools page
      if (document.getElementById("poolList") && poolBrowserDataManager) {
        setupPoolSortControl();
        const poolsManager = poolBrowserDataManager.getPools();
        const pools = poolsManager.getAllPools();
        const legacyPools = pools.map(pool => pool.toJSON());
        renderPools(legacyPools);
      }
    },
    // Error callback
    () => {
      // Continue without location data - pools are already rendered without distances
    },
    options
  );
}

/**
 * Calculates the distance between two sets of coordinates using the Haversine formula
 * @param {Object} coords1 - First coordinate: {lat, lng}
 * @param {Object} coords2 - Second coordinate: {lat, lng}
 * @returns {number} Distance in miles
 */
function calculateDistance(coords1, coords2) {
  const R = 3958.8; // Earth's radius in miles
  const φ1 = coords1.lat * Math.PI / 180;
  const φ2 = coords2.lat * Math.PI / 180;
  const Δφ = (coords2.lat - coords1.lat) * Math.PI / 180;
  const Δλ = (coords2.lng - coords1.lng) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Display a feature label in sentence case.
 * @param {string} feature - Published feature label
 * @returns {string} User-visible label
 */
function formatPoolFeatureLabel(feature) {
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

/**
 * Order feature pills by visitor-facing category, then alphabetically within each category.
 * @param {Array} features - Published feature labels
 * @returns {Array} Ordered normalized feature labels
 */
function sortPoolFeaturesForDisplay(features) {
  return PreferencesService.groupPoolFeatures(features).flatMap(group => [...group.features].sort((first, second) => (
    formatPoolFeatureLabel(first).localeCompare(formatPoolFeatureLabel(second))
  )));
}

/**
 * Render available amenity controls and restore device-local selections.
 * @param {Array} pools - Available pool data objects
 */
function setupPoolFeatureFilters(pools) {
  const filterSection = document.getElementById('poolFeatureFilter');
  const optionsContainer = document.getElementById('poolFeatureFilterOptions');
  const toggleButton = document.getElementById('togglePoolFeatureFilters');
  const controls = document.getElementById('poolFeatureFilterControls');
  const clearButton = document.getElementById('clearPoolFeatureFilters');
  if (!filterSection || !optionsContainer || !toggleButton || !controls || !clearButton) return;

  const availableFeatures = PreferencesService.getPoolFeatures(pools);
  const preferences = PreferencesService.get();
  const selectedFeatures = preferences.poolFeatureFilters.filter(feature => availableFeatures.includes(feature));
  if (selectedFeatures.length !== preferences.poolFeatureFilters.length) {
    PreferencesService.save({ ...preferences, poolFeatureFilters: selectedFeatures });
  }

  optionsContainer.replaceChildren();
  PreferencesService.groupPoolFeatures(availableFeatures).forEach(group => {
    const groupFieldset = document.createElement('fieldset');
    groupFieldset.className = `pool-filter__group pool-filter__group--${group.key}`;

    const groupTitle = document.createElement('legend');
    groupTitle.className = 'pool-filter__group-title';
    groupTitle.textContent = group.label;

    const groupOptions = document.createElement('div');
    groupOptions.className = 'pool-filter__group-options';

    group.features.forEach(feature => {
      const input = document.createElement('input');
      input.name = 'poolFeature';
      input.type = 'checkbox';
      input.value = feature;
      input.checked = selectedFeatures.includes(feature);

      const labelText = document.createElement('span');
      labelText.className = 'pool-filter__label';
      labelText.textContent = formatPoolFeatureLabel(feature);

      const chip = document.createElement('span');
      chip.append(labelText);

      const label = document.createElement('label');
      label.className = `pool-filter__option pool-filter__option--${group.key}`;
      label.append(input, chip);
      groupOptions.appendChild(label);
    });

    groupFieldset.append(groupTitle, groupOptions);
    optionsContainer.appendChild(groupFieldset);
  });
  filterSection.hidden = availableFeatures.length === 0;
  filterSection.classList.toggle('pool-filter--collapsed', controls.hidden);
  clearButton.hidden = selectedFeatures.length === 0;

  optionsContainer.onchange = handlePoolFeatureFilterChange;
  toggleButton.onclick = togglePoolFeatureFilters;
  filterSection.onclick = handlePoolFeatureFilterSurfaceClick;
  clearButton.onclick = clearPoolFeatureFilters;
}

function handlePoolFeatureFilterSurfaceClick(event) {
  const controls = document.getElementById('poolFeatureFilterControls');
  const target = event.target;
  if (!controls || !(target instanceof Element) || target.closest('button, .pool-filter__controls')) return;

  if (controls.hidden || target.closest('.pool-filter__header')) {
    togglePoolFeatureFilters();
  }
}

/**
 * Show or hide the feature options while retaining applied selections.
 */
function togglePoolFeatureFilters() {
  const toggleButton = document.getElementById('togglePoolFeatureFilters');
  const controls = document.getElementById('poolFeatureFilterControls');
  const filterSection = document.getElementById('poolFeatureFilter');
  const indicator = toggleButton ? toggleButton.querySelector('.pool-filter__indicator') : null;
  if (!toggleButton || !controls) return;

  controls.hidden = !controls.hidden;
  if (filterSection) filterSection.classList.toggle('pool-filter--collapsed', controls.hidden);
  toggleButton.setAttribute('aria-expanded', String(!controls.hidden));
  if (indicator) indicator.textContent = controls.hidden ? '+' : '-';
}

/**
 * Save selected features and refresh the directory results.
 */
function handlePoolFeatureFilterChange() {
  const availableFeatures = new Set(PreferencesService.getPoolFeatures(poolBrowserPools));
  const selectedFeatures = Array.from(document.querySelectorAll('input[name="poolFeature"]:checked'))
    .map(input => input.value)
    .filter(feature => availableFeatures.has(feature));
  const preferences = PreferencesService.get();
  const saved = PreferencesService.save({ ...preferences, poolFeatureFilters: selectedFeatures });
  if (saved.poolFeatureFilters.join('|') !== preferences.poolFeatureFilters.join('|') && window.cnslAnalytics) {
    window.cnslAnalytics.trackPublishedSettingChange('pool_feature_filters', saved.poolFeatureFilters, availableFeatures);
  }
  renderPools(poolBrowserPools);
}

/**
 * Remove all selected feature filters from this device.
 */
function clearPoolFeatureFilters() {
  const preferences = PreferencesService.get();
  PreferencesService.save({ ...preferences, poolFeatureFilters: [] });
  if (preferences.poolFeatureFilters.length > 0 && window.cnslAnalytics) {
    window.cnslAnalytics.trackPublishedSettingChange('pool_feature_filters', [], new Set());
  }
  setupPoolFeatureFilters(poolBrowserPools);
  renderPools(poolBrowserPools);
}

/**
 * Display sorting options once location-based distances are available.
 */
function setupPoolSortControl() {
  const controls = document.getElementById('poolSortControls');
  const select = document.getElementById('poolSortOrder');
  if (!controls || !select) return;

  controls.hidden = !userCoords;
  select.value = poolSortOrder;
  select.onchange = handlePoolSortChange;
}

/**
 * Reorder visible pools using the visitor's selected ordering.
 * @param {Event} event - Sort select change event
 */
function handlePoolSortChange(event) {
  poolSortOrder = event.target.value === 'distance' && userCoords ? 'distance' : 'name';
  renderPools(poolBrowserPools);
  const description = poolSortOrder === 'distance' ? 'nearest distance' : 'default order';
  setPoolListStatus(`Pool directory sorted by ${description}.`, false);
}

/**
 * Update the active filter result count and clear action.
 * @param {number} matchingCount - Filtered pool count
 * @param {number} totalCount - Total pool count
 * @param {number} filterCount - Active filter count
 */
function updatePoolFilterSummary(matchingCount, totalCount, filterCount) {
  const summary = document.getElementById('poolFilterSummary');
  const clearButton = document.getElementById('clearPoolFeatureFilters');
  const selectionCount = document.getElementById('poolFeatureFilterCount');
  if (summary) {
    summary.textContent = filterCount > 0
      ? `Showing ${matchingCount} of ${totalCount} pools`
      : `${totalCount} pools`;
  }
  if (clearButton) clearButton.hidden = filterCount === 0;
  if (selectionCount) {
    selectionCount.hidden = filterCount === 0;
    selectionCount.textContent = filterCount > 0 ? `${filterCount} selected` : '';
  }
}

/**
 * Renders the list of pools in the #poolList element
 * @param {Array} pools - Array of pool data objects (legacy format)
 */
function renderPools(pools) {
  const list = document.getElementById("poolList");
  if (!list) return;
  
  // Safety check - ensure pools is an array
  if (!Array.isArray(pools) || pools.length === 0) {
    list.innerHTML = `
      <div class="pool-card error">
        <h2>⚠️ No pools available</h2>
        <p>Pool information is currently unavailable. Please try again later.</p>
      </div>
    `;
    return;
  }

  const expandedPoolIds = new Set(Array.from(list.querySelectorAll('.pool-card')).filter(poolCard => {
    const toggleButton = poolCard.querySelector('.pool-header__toggle');
    return toggleButton && toggleButton.getAttribute('aria-expanded') === 'true';
  }).map(poolCard => poolCard.dataset.poolId));
  const linkedPoolId = new URLSearchParams(window.location.search).get('pool');
  const isInitialRender = expandedPoolIds.size === 0 && !list.querySelector('.pool-card');
  const preferences = PreferencesService.get();
  const favoritePoolName = preferences.favoritePoolName;
  const filteredPools = PreferencesService.filterPoolsByFeatures(pools, preferences.poolFeatureFilters);
  updatePoolFilterSummary(filteredPools.length, pools.length, preferences.poolFeatureFilters.length);
  if (filteredPools.length === 0) {
    list.innerHTML = `
      <div class="pool-filter__empty" role="status">
        <h2>No matching pools</h2>
        <p>Try removing a selected feature.</p>
      </div>
    `;
    return;
  }
  const comparePools = (firstPool, secondPool) => {
    const firstName = (firstPool && firstPool.name) ? firstPool.name : '';
    const secondName = (secondPool && secondPool.name) ? secondPool.name : '';
    return firstName.localeCompare(secondName);
  };
  const displayPools = filteredPools.map(pool => {
    if (!userCoords || !pool) return pool;
    const location = pool.location || pool;
    const latitude = Number(location.lat);
    const longitude = Number(location.lng);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return pool;
    return { ...pool, distance: calculateDistance(userCoords, { lat: latitude, lng: longitude }) };
  });
  const sortedPools = poolSortOrder === 'distance' && userCoords
    ? [...displayPools].sort((firstPool, secondPool) => {
      const firstDistance = Number.isFinite(firstPool.distance) ? firstPool.distance : Number.POSITIVE_INFINITY;
      const secondDistance = Number.isFinite(secondPool.distance) ? secondPool.distance : Number.POSITIVE_INFINITY;
      return firstDistance - secondDistance || comparePools(firstPool, secondPool);
    })
    : PreferencesService.sortWithFavorite(displayPools, favoritePoolName, pool => pool.name || '', comparePools);

  // Generate HTML for each pool with mobile-optimized cards
  const html = sortedPools.map(pool => {
    const poolName = pool.name || 'Unknown Pool';
    const safePoolName = PoolBrowserSafety.escapeHtml(poolName);
    const poolId = String(pool.id || '');
    const safePoolId = PoolBrowserSafety.escapeHtml(poolId);
    const detailsId = `pool-details-${String(poolId || poolName).replace(/[^a-zA-Z0-9_-]/g, '-')}`;
    const features = pool.features || [];
    const isFavorite = poolName === favoritePoolName;
    const isExpanded = (isInitialRender && poolId === linkedPoolId)
      || (isFavorite ? preferences.favoritePoolExpanded : expandedPoolIds.has(poolId));
    
    let distanceHtml = '';
    if (pool.distance !== undefined && !isNaN(pool.distance)) {
      const distanceMiles = pool.distance.toFixed(1);
      distanceHtml = `<span class="distance-badge" aria-label="${distanceMiles} miles away">${distanceMiles} mi</span>`;
    }

    // Handle both location formats (new location object vs legacy flat properties)
    let streetAddress, cityStateZip, mapsUrl;
    
    if (pool.location) {
      // New location format
      streetAddress = pool.location.street || '';
      const city = pool.location.city || '';
      const state = pool.location.state || '';
      const zip = pool.location.zip || '';
      cityStateZip = (city + ', ' + state + ' ' + zip).trim();
      mapsUrl = pool.location.googleMapsUrl || `${globalThis.GOOGLE_MAPS_SEARCH_BASE_URL}${encodeURIComponent(pool.location.mapsQuery || '')}`;
    } else {
      // Legacy format - handle flat address property
      const fullAddress = pool.address || '';
      const addressParts = fullAddress.split(',').map(part => part.trim());
      
      if (addressParts.length >= 2) {
        // Split address into street and city/state/zip
        streetAddress = addressParts[0];
        cityStateZip = addressParts.slice(1).join(', ');
      } else {
        // Fallback if address format is unexpected
        streetAddress = fullAddress;
        cityStateZip = '';
      }
      
      const locationQuery = encodeURIComponent(pool.mapsQuery || fullAddress || '');
      mapsUrl = `${globalThis.GOOGLE_MAPS_SEARCH_BASE_URL}${locationQuery}`;
    }

    // Format features for display as horizontal pills
    let featuresHtml;
    if (Array.isArray(features) && features.length > 0) {
      const sortedFeatures = sortPoolFeaturesForDisplay(features);
      featuresHtml = `
        <div class="pool-features">
          <h3>Features</h3>
          <div class="feature-pills">
            ${sortedFeatures.map(feature => `<span class="feature-pill feature-pill--${PreferencesService.getPoolFeatureCategory(feature)}">${PoolBrowserSafety.escapeHtml(formatPoolFeatureLabel(feature))}</span>`).join('')}
          </div>
        </div>
      `;
    } else {
      featuresHtml = `
        <div class="pool-features">
          <h3>Features</h3>
          <span class="status-tbd">TBD</span>
        </div>
      `;
    }

    // Format opening hours for display using new helper
    const hoursHtml = formatPoolHours(pool);
    
    // Get pool status for indicator using new helper
    const poolStatus = getPoolStatus(pool);
    const statusClass = poolStatus.color;
    
    // Show status indicator with tooltip for all pools
    const tooltipText = getStatusTooltip(statusClass);
    const statusIndicatorHtml = `<span class="pool-status-indicator ${statusClass} status-tooltip" aria-hidden="true">
      <span class="tooltip-text">${tooltipText}</span>
    </span><span class="visually-hidden">${tooltipText}: </span>`;

    // Create CA Pool website link if caUrl is available
    let caLinkHtml = '';
    const safeCaUrl = PoolBrowserSafety.safeHttpUrl(pool.caUrl);
    if (safeCaUrl) {
      caLinkHtml = `
        <div class="ca-website-section">
          <a href="${safeCaUrl}" 
             target="_blank" 
             rel="noopener" 
             class="ca-link">
            Visit CA Pool Page
          </a>
        </div>
      `;
    }

    // Create phone number action if a published phone number is available
    let phoneHtml = '';
    const safePhoneUrl = PoolBrowserSafety.safeTelephoneUrl(pool.phone);
    if (safePhoneUrl) {
      phoneHtml = `
        <div class="address-section__phone">
          <a href="${safePhoneUrl}" class="phone-link" aria-label="Call ${safePoolName} pool desk at ${PoolBrowserSafety.escapeHtml(pool.phone)}">
            <span aria-hidden="true">📞</span> ${PoolBrowserSafety.escapeHtml(pool.phone)}
          </a>
        </div>
      `;
    }

    const safeMapsUrl = PoolBrowserSafety.safeHttpUrl(mapsUrl);
    const safeStreetAddress = PoolBrowserSafety.escapeHtml(streetAddress);
    const safeCityStateZip = PoolBrowserSafety.escapeHtml(cityStateZip);

    return `
      <div class="pool-card ${isFavorite ? 'favorite-card' : ''}${isExpanded ? '' : ' collapsed'}" data-pool-id="${safePoolId}">
        <div class="pool-header">
          <h2><button type="button" class="pool-header__toggle" aria-expanded="${String(isExpanded)}" aria-controls="${detailsId}">${statusIndicatorHtml}${safePoolName}${isFavorite ? ' <span class="favorite-badge">Favorite pool</span>' : ''}</button></h2>
          ${distanceHtml}
        </div>
        <div class="pool-details" id="${detailsId}"${isExpanded ? '' : ' hidden'}>
          <div class="pool-contact">
            <div class="address-section">
              <div class="address-section__details">
                <strong>📍 Address:</strong><br>
                <a href="${safeMapsUrl}"
                   target="_blank"
                   rel="noopener"
                   class="address-link">
                  ${safeStreetAddress ? `${safeStreetAddress}${safeCityStateZip ? '<br>' : ''}` : ''}${safeCityStateZip || (safeStreetAddress ? '' : 'Address not available')}
                </a>
              </div>
              ${(caLinkHtml || phoneHtml) ? `<div class="address-section__actions">${caLinkHtml}${phoneHtml}</div>` : ''}
            </div>
          </div>
          ${hoursHtml}
          ${featuresHtml}
        </div>
      </div>
    `;
  }).join('');

  list.innerHTML = html;
  scrollCalendarsToToday(list);
}

/**
 * Handles URL parameters to show a specific pool
 * If ?pool=poolId is in the URL, expands and highlights that pool
 */
function handlePoolUrlParameter() {
  const urlParams = new URLSearchParams(window.location.search);
  const poolId = urlParams.get('pool');
  if (!poolId) return;

  const escapedPoolId = window.CSS && typeof window.CSS.escape === 'function'
    ? window.CSS.escape(poolId)
    : poolId.replace(/[^a-zA-Z0-9_-]/g, '');
  const poolCard = escapedPoolId ? document.querySelector(`[data-pool-id="${escapedPoolId}"]`) : null;
  if (!poolCard) return;

  poolCard.classList.add('highlighted');
  scrollLinkedPoolIntoView(poolCard);

  setTimeout(() => {
    poolCard.classList.remove('highlighted');
  }, 3000);
}

/**
 * Toggles the collapsed state of a pool card
 * @param {Element} toggleButton - The disclosure button
 */
function togglePoolCard(toggleButton) {
  const poolCard = toggleButton.closest('.pool-card');
  const details = poolCard.querySelector('.pool-details');
  const isExpanded = toggleButton.getAttribute('aria-expanded') === 'true';
  poolCard.classList.toggle('collapsed', isExpanded);
  toggleButton.setAttribute('aria-expanded', String(!isExpanded));
  if (poolCard.classList.contains('favorite-card')) {
    const preferences = PreferencesService.get();
    PreferencesService.save({ ...preferences, favoritePoolExpanded: !isExpanded });
    if (window.cnslAnalytics) window.cnslAnalytics.trackFixedSettingChange('favorite_pool_expanded', isExpanded ? 'collapsed' : 'expanded');
  }
  if (details) {
    details.hidden = isExpanded;
    if (!isExpanded) scrollCalendarsToToday(details);
  }
}

// ------------------------------
//    WEEK NAVIGATION FUNCTIONS
// ------------------------------

// ------------------------------
//    POOL-SPECIFIC NAVIGATION FUNCTIONS
// ------------------------------

/**
 * Navigate a specific pool to the previous week
 * @param {string} poolId - Pool identifier
 */
function navigatePoolToPreviousWeek(poolId) {
  const currentWeek = getPoolWeekStart(poolId);
  const newWeek = new Date(currentWeek);
  newWeek.setDate(newWeek.getDate() - 7);
  setPoolWeekStart(poolId, newWeek);
  refreshPoolDisplay(poolId);
}

/**
 * Navigate a specific pool to the next week
 * @param {string} poolId - Pool identifier
 */
function navigatePoolToNextWeek(poolId) {
  const currentWeek = getPoolWeekStart(poolId);
  const newWeek = new Date(currentWeek);
  newWeek.setDate(newWeek.getDate() + 7);
  setPoolWeekStart(poolId, newWeek);
  refreshPoolDisplay(poolId);
}

/**
 * Navigate a specific pool to a selected week
 * @param {string} poolId - Pool identifier
 * @param {string} dateValue - Selected date value
 */
function navigatePoolToSelectedWeek(poolId, dateValue) {
  if (!dateValue) return;
  
  const selectedDate = new Date(dateValue);
  const weekStart = getMondayOfWeek(selectedDate);
  setPoolWeekStart(poolId, weekStart);
  refreshPoolDisplay(poolId);
}

/**
 * Navigate a specific pool to today's week
 * @param {string} poolId - Pool identifier
 */
function navigatePoolToToday(poolId) {
  const today = new Date();
  const weekStart = getMondayOfWeek(today);
  setPoolWeekStart(poolId, weekStart);
  refreshPoolDisplay(poolId);
}

/**
 * Refresh the display for a specific pool
 * @param {string} poolId - Pool identifier
 */
function refreshPoolDisplay(poolId) {
  if (!poolBrowserDataManager) return;
  
  // Find the pool card and update just its hours section
  const escapedPoolId = window.CSS && typeof window.CSS.escape === 'function'
    ? window.CSS.escape(poolId)
    : String(poolId).replace(/[^a-zA-Z0-9_-]/g, '');
  const poolCard = escapedPoolId ? document.querySelector(`[data-pool-id="${escapedPoolId}"]`) : null;
  if (!poolCard) return;
  
  const poolsManager = poolBrowserDataManager.getPools();
  const allPools = poolsManager.getAllPools();
  const pool = allPools.find(p => (p.id || p.name) === poolId);
  
  if (pool) {
    const legacyPool = pool.toJSON();
    
    // Find the pool-hours container in the pool card
    const poolCardContainer = poolCard.closest('.pool-card');
    const hoursElement = poolCardContainer.querySelector('.pool-hours');
    
    if (hoursElement) {
      // Generate the new hours content
      const newHoursContent = formatPoolHours(legacyPool);
      
      // Replace the entire content of the pool-hours div
      hoursElement.outerHTML = newHoursContent;
      
      // Re-setup event handlers for the new controls
      setupPoolNavigationHandlers();
      scrollCalendarsToToday(poolCard);
    }
  }
}

/**
 * Setup event handlers for all pool navigation controls
 */
function setupPoolNavigationHandlers() {
  // Remove existing handlers to prevent duplicates
  document.removeEventListener('click', handlePoolNavigationClick);
  document.removeEventListener('change', handlePoolDatePickerChange);
  
  // Add new handlers
  document.addEventListener('click', handlePoolNavigationClick);
  document.addEventListener('change', handlePoolDatePickerChange);
}

function refreshPoolsForPreferences() {
  if (!document.getElementById('poolList') || poolBrowserPools.length === 0) return;

  if (!PreferencesService.get().locationAwarenessEnabled) {
    userCoords = null;
    poolSortOrder = 'name';
    setupPoolSortControl();
  }
  setupPoolFeatureFilters(poolBrowserPools);
  renderPools(poolBrowserPools);
  if (PreferencesService.get().locationAwarenessEnabled && !userCoords) getUserLocation();
}

/**
 * Handle clicks on pool navigation buttons
 * @param {Event} event - Click event
 */
function handlePoolNavigationClick(event) {
  const target = event.target;
  const disclosureButton = target.closest('.pool-header__toggle');
  if (disclosureButton) {
    togglePoolCard(disclosureButton);
    return;
  }

  const cardSurface = target.closest('.pool-card.collapsed, .pool-header');
  if (cardSurface) {
    const cardToggle = cardSurface.closest('.pool-card').querySelector('.pool-header__toggle');
    if (cardToggle) togglePoolCard(cardToggle);
    return;
  }
  
  if (target.classList.contains('prev-week')) {
    const poolNav = target.closest('.pool-week-navigation');
    if (poolNav) {
      const poolId = poolNav.dataset.poolId;
      navigatePoolToPreviousWeek(poolId);
    }
  } else if (target.classList.contains('next-week')) {
    const poolNav = target.closest('.pool-week-navigation');
    if (poolNav) {
      const poolId = poolNav.dataset.poolId;
      navigatePoolToNextWeek(poolId);
    }
  } else if (target.classList.contains('today-btn')) {
    const poolNav = target.closest('.pool-week-navigation');
    if (poolNav) {
      const poolId = poolNav.dataset.poolId;
      navigatePoolToToday(poolId);
    }
  } else if (target.classList.contains('calendar-btn')) {
    const poolNav = target.closest('.pool-week-navigation');
    if (poolNav) {
      const datePicker = poolNav.querySelector('.week-picker');
      if (datePicker) {
        // Position the date picker at the calendar button location
        const buttonRect = target.getBoundingClientRect();
        const navRect = poolNav.getBoundingClientRect();
        
        // Calculate position relative to the navigation container
        const relativeLeft = buttonRect.left - navRect.left;
        const relativeTop = buttonRect.bottom - navRect.top + 5; // 5px below button
        
        datePicker.hidden = false;
        target.setAttribute('aria-expanded', 'true');

        // Style the date picker to be visible and positioned
        datePicker.style.position = 'absolute';
        datePicker.style.left = relativeLeft + 'px';
        datePicker.style.top = relativeTop + 'px';
        datePicker.style.opacity = '1';
        datePicker.style.pointerEvents = 'auto';
        datePicker.style.zIndex = '1000';
        datePicker.style.width = 'auto';
        datePicker.style.height = 'auto';
        datePicker.style.padding = '0.4rem 0.8rem';
        datePicker.style.border = '1px solid var(--border-color)';
        datePicker.classList.add('active');
        
        // Trigger the date picker
        datePicker.click();
        datePicker.showPicker ? datePicker.showPicker() : datePicker.focus();
        
      }
    }
  }
}

/**
 * Handle changes to pool date pickers
 * @param {Event} event - Change event
 */
function handlePoolDatePickerChange(event) {
  const target = event.target;
  
  if (target.classList.contains('week-picker')) {
    const poolNav = target.closest('.pool-week-navigation');
    if (poolNav) {
      const poolId = poolNav.dataset.poolId;
      navigatePoolToSelectedWeek(poolId, target.value);
      target.hidden = true;
      const button = poolNav.querySelector('.calendar-btn');
      if (button) {
        button.setAttribute('aria-expanded', 'false');
        button.focus();
      }
    }
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  // Check if we're on the pools page before fetching data
  if (!document.getElementById("poolList")) {
    return;
  }
  
  try {
    // Initialize the data manager with the new OOP system
    await initializePoolBrowser();

    loadSeasonInfo();
    
    // Get pools from the data manager
    const poolsManager = poolBrowserDataManager.getPools();
    const pools = poolsManager.getAllPools();
    
    // Convert Pool objects to legacy format for backward compatibility
    const legacyPools = pools.map(pool => pool.toJSON());
    poolBrowserPools = legacyPools;
    setupPoolFeatureFilters(legacyPools);
    
    // Always render pools first with no location data
    renderPools(legacyPools);
    setPoolListStatus(`Pool directory loaded. ${legacyPools.length} pools available.`, false);
    
    // Set up pool-specific navigation event handlers
    setupPoolNavigationHandlers();
    
    // Handle URL parameters to show specific pool
    handlePoolUrlParameter();
    
    // The preference guard prevents a browser location prompt unless it is enabled in Settings.
    try {
      getUserLocation();
    } catch (_locationError) {
      // Continue without location data - pools are already rendered
    }
    
  } catch (error) {
    console.error("Failed to load pool data:", error);
    const list = document.getElementById("poolList");
    if (list) {
      list.innerHTML = "<p>⚠️ Pool data is currently unavailable. Please try again later.</p>";
    }
    setPoolListStatus('Pool information is currently unavailable. Please try again later.', false);
  }
});

window.addEventListener('cnsl:preferences-changed', refreshPoolsForPreferences);

// Make functions available globally
window.getMondayOfWeek = getMondayOfWeek;
window.isTodayInSeason = isTodayInSeason;
window.getPoolWeekStart = getPoolWeekStart;
window.setPoolWeekStart = setPoolWeekStart;
window.getStatusTooltip = getStatusTooltip;
window.initializePoolBrowser = initializePoolBrowser;
window.loadSeasonInfo = loadSeasonInfo;

}
