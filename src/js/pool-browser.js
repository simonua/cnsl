// Global data manager instance for pool browser
let poolBrowserDataManager = null;
let userCoords = null;

// Pool-specific week states (poolId -> Date)
const poolWeekStates = new Map();

// ------------------------------
//    UTILITY FUNCTIONS
// ------------------------------

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
    await poolBrowserDataManager.initialize();
  }
}

/**
 * Load and display season information
 */
async function loadSeasonInfo() {
  try {
    console.log('🔄 Loading season information...');
    
    // Add visible debug output to the page
    const seasonInfo = document.getElementById('seasonInfo');
    if (seasonInfo) {
      seasonInfo.innerHTML = '<p class="season-text">DEBUG: Starting to load season info...</p>';
    }
    
    // Ensure FileHelper is available
    if (typeof FileHelper === 'undefined') {
      console.warn('⚠️ FileHelper not yet available, waiting...');
      if (seasonInfo) {
        seasonInfo.innerHTML = '<p class="season-text">DEBUG: FileHelper not available, waiting...</p>';
      }
      await new Promise(resolve => setTimeout(resolve, 100));
      if (typeof FileHelper === 'undefined') {
        if (seasonInfo) {
          seasonInfo.innerHTML = '<p class="season-text">ERROR: FileHelper is not available</p>';
        }
        throw new Error('FileHelper is not available');
      }
    }
    
    // Load the pools.json file directly to get season information
    const poolsFilePath = FileHelper.getPoolsDataPath();
    console.log('📂 Pools file path:', poolsFilePath);
    
    const poolData = await FileHelper.loadJsonFile(poolsFilePath);
    console.log('📊 Pools data loaded:', poolData);
    
    console.log('🎯 Season info element:', seasonInfo);
    
    if (seasonInfo && poolData.seasonStartDate && poolData.seasonEndDate) {
      console.log('✅ Season dates found:', poolData.seasonStartDate, poolData.seasonEndDate);
      
      // Parse dates and handle timezone offset to ensure correct display
      const startDate = new Date(poolData.seasonStartDate + 'T12:00:00');
      const endDate = new Date(poolData.seasonEndDate + 'T12:00:00');
      
      const startDateText = startDate.toLocaleDateString('en-US', { 
        month: 'long', 
        day: 'numeric' 
      });
      const endDateText = endDate.toLocaleDateString('en-US', { 
        month: 'long', 
        day: 'numeric' 
      });
      
      // Add CA pool directory link if available
      let caDirectoryLinkHtml = '';
      if (poolData.caPoolDirectoryUrl) {
        caDirectoryLinkHtml = `
            <a href="${poolData.caPoolDirectoryUrl}" target="_blank" rel="noopener" class="directory-link">
              📍 Interactive CA Pool Directory
            </a>
        `;
      }
      
      // Add CA pool guide link if available
      let caPoolGuideLinkHtml = '';
      if (poolData.caPoolGuideUrl) {
        caPoolGuideLinkHtml = `
            <a href="${poolData.caPoolGuideUrl}" target="_blank" rel="noopener" class="directory-link">
              📖 Your Guide to CA's 2025 Pool Season
            </a>
        `;
      }
      
      // Combine links horizontally if both exist
      let linksHtml = '';
      if (caDirectoryLinkHtml && caPoolGuideLinkHtml) {
        linksHtml = `
          <p class="ca-links">
            ${caPoolGuideLinkHtml} ${caDirectoryLinkHtml}
          </p>
        `;
      } else if (caDirectoryLinkHtml) {
        linksHtml = `<p class="ca-directory-link">${caDirectoryLinkHtml}</p>`;
      } else if (caPoolGuideLinkHtml) {
        linksHtml = `<p class="ca-guide-link">${caPoolGuideLinkHtml}</p>`;
      }
      
      seasonInfo.innerHTML = `
        <p class="season-text">
          The CA Outdoor Pool season runs from ${startDateText} to ${endDateText}<br/> 
          <span class="season-note">(Memorial Day weekend to Labor Day weekend)</span>
        </p>
        ${linksHtml}
      `;
      
      console.log('✅ Season information updated successfully');
    } else {
      console.log('⚠️ Season info element or season dates not found:', {
        seasonInfo: !!seasonInfo,
        seasonStartDate: poolData.seasonStartDate,
        seasonEndDate: poolData.seasonEndDate
      });
    }
  } catch (error) {
    console.error('Failed to load season information:', error);
    const seasonInfo = document.getElementById('seasonInfo');
    if (seasonInfo) {
      seasonInfo.innerHTML = '<p class="season-text">Season information unavailable</p>';
    }
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
  const weekStart = getPoolWeekStart(poolId);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  
  const easternTimeInfo = TimeUtils.getCurrentEasternTimeInfo();
  const poolStatus = poolObj.getCurrentStatus();
  
  // Get week schedule for the selected week
  const weekSchedule = poolObj.getWeekScheduleForDate(weekStart);
  
  // Format the week display text
  const weekStartText = weekStart.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric' 
  });
  const weekEndText = weekEnd.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric' 
  });
  
  // Get pool's valid date range for navigation constraints
  const dateRange = poolObj.getValidDateRange();
  
  // Build navigation controls
  let navigationHtml = `
    <div class="pool-week-navigation" data-pool-id="${poolId}">
      <div class="week-controls-row">
        <div class="week-display">
          <span class="week-text">Week of ${weekStartText} - ${weekEndText}</span>
        </div>
        <div class="nav-buttons">
          <button class="nav-btn calendar-btn" data-pool-id="${poolId}" ${!dateRange ? 'disabled' : ''}>
            📅
          </button>
          <button class="nav-btn prev-week" ${!dateRange || weekStart <= dateRange.startDate ? 'disabled' : ''}>
            ◀ Prev
          </button>
          <button class="nav-btn next-week" ${!dateRange || weekEnd >= dateRange.endDate ? 'disabled' : ''}>
            Next ▶
          </button>
        </div>
      </div>
      <input type="date" class="week-picker hidden" 
             value="${weekStart.toISOString().split('T')[0]}"
             ${dateRange ? `min="${dateRange.startDate.toISOString().split('T')[0]}" max="${dateRange.endDate.toISOString().split('T')[0]}"` : ''}>
    </div>`;

  // Format hours display using new Pool class methods
  let hoursDisplay = '';
  const dayOrder = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  
  dayOrder.forEach((day, index) => {
    const daySchedule = weekSchedule.find(d => d.day === day);
    
    // Calculate the specific date for this day
    const dayDate = new Date(weekStart);
    dayDate.setDate(weekStart.getDate() + index);
    const monthDay = `${dayDate.getMonth() + 1}/${dayDate.getDate()}`;
    
    // Calculate if this is the current day for highlighting
    const today = new Date();
    const currentMondayStart = getMondayOfWeek(today);
    const isCurrentWeek = weekStart.getTime() === currentMondayStart.getTime();
    const isCurrentDay = isCurrentWeek && day === easternTimeInfo.day;
    
    if (daySchedule && daySchedule.timeSlots && daySchedule.timeSlots.length > 0) {
      // Check if any slot in this day is the current timeslot
      const hasCurrentTimeSlot = isCurrentDay && TimeUtils.hasCurrentTimeSlot(daySchedule.timeSlots, poolStatus.isOpen);
      
      // Only style the day heading if it contains the current time slot
      const dayStyle = hasCurrentTimeSlot ? ' style="font-weight: bold; color: var(--primary-color);"' : '';
      
      // Add override indicator to day heading if there are overrides
      let dayHeading = `${day} (${monthDay})`;
      if (daySchedule.hasOverrides) {
        dayHeading += ' ⚠️';
      }
      
      hoursDisplay += `<div class="day-schedule"><strong${dayStyle}>${dayHeading}:</strong></div>`;
      
      // Show override reason if there are overrides for this day
      if (daySchedule.hasOverrides && daySchedule.overrideReason) {
        hoursDisplay += `<div class="override-notice" style="margin-left: 1rem; margin-bottom: 0.2rem;">📋 Special Schedule: ${daySchedule.overrideReason}</div>`;
      }
      
      daySchedule.timeSlots.forEach(slot => {
        let typesText = slot.activities ? ` ${TimeUtils.formatActivityTypes(slot.activities)}` : '';
        
        // Make "Closed to Public" bold
        if (typesText.includes('Closed to Public')) {
          typesText = typesText.replace('Closed to Public', '<span class="closed-to-public">Closed to Public</span>');
        }
        
        // Add override styling if this is an override slot, but don't add extra margin for alignment
        let slotClass = 'time-slot';
        let slotStyle = 'margin-left: 1rem; margin-bottom: 0.2rem;';
        if (slot.isOverride) {
          slotClass += ' override-slot';
          // Override slots get the same indentation as regular slots for proper time alignment
        }
        
        const notesText = slot.notes ? ` - ${slot.notes}` : '';
        const timeRange = `${slot.startTime}-${slot.endTime}`;
        const timeHtml = formatTimeRangeSpans(timeRange, isCurrentDay, null, poolStatus);
        hoursDisplay += `<div class="${slotClass}" style="${slotStyle}">${timeHtml}${typesText}${notesText}</div>`;
      });
    } else {
      // Show "Closed" for days with no schedule
      const dayDate = new Date(weekStart);
      dayDate.setDate(weekStart.getDate() + index);
      const monthDay = `${dayDate.getMonth() + 1}/${dayDate.getDate()}`;
      
      hoursDisplay += `<div class="day-schedule"><strong>${day} (${monthDay}):</strong></div>`;
      hoursDisplay += `<div class="time-slot" style="margin-left: 1rem; margin-bottom: 0.2rem;"><span class="closed-day">Closed</span></div>`;
    }
  });

  return `
    <div class="pool-hours">
      <strong>🕒 Hours:</strong> 
      <span class="open-status status-${poolStatus.color || 'red'} status-tooltip">
        ${poolStatus.icon} ${poolStatus.status}
        <span class="tooltip-text">${getStatusTooltip(poolStatus.color || 'red')}</span>
      </span><br>
      ${navigationHtml}
      <div class="hours-details">
        ${hoursDisplay}
      </div>
    </div>
  `;
}

/**
 * Gets the user's current location if they grant permission
 * Gracefully handles cases where geolocation is denied or not available
 */
function getUserLocation() {
  // Check if geolocation is supported
  if (!navigator.geolocation) {
    console.log("Geolocation is not supported by this browser");
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
        const poolsManager = poolBrowserDataManager.getPools();
        const pools = poolsManager.getAllPools();
        const legacyPools = pools.map(pool => pool.toJSON());
        renderPools(legacyPools);
      }
    },
    // Error callback
    error => {
      // Handle different error types
      switch(error.code) {
        case error.PERMISSION_DENIED:
          console.log("User denied geolocation permission");
          break;
        case error.POSITION_UNAVAILABLE:
          console.log("Location information unavailable");
          break;
        case error.TIMEOUT:
          console.log("Location request timed out");
          break;
        default:
          console.log("Unknown geolocation error:", error);
          break;
      }
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
        <h3>⚠️ No pools available</h3>
        <p>Pool information is currently unavailable. Please try again later.</p>
      </div>
    `;
    return;
  }

  // Sort pools by name alphabetically
  const sortedPools = [...pools].sort((a, b) => {
    const nameA = (a && a.name) ? a.name : '';
    const nameB = (b && b.name) ? b.name : '';
    return nameA.localeCompare(nameB);
  });

  // If we have user location, calculate distances
  if (userCoords) {
    sortedPools.forEach(pool => {
      try {
        if (pool && ((pool.location && pool.location.lat && pool.location.lng) || (pool.lat && pool.lng))) {
          const poolCoords = pool.location ? pool.location : { lat: pool.lat, lng: pool.lng };
          pool.distance = calculateDistance(userCoords, poolCoords);
        }
      } catch (err) {
        console.error("Error calculating distance for pool:", err);
      }
    });
  }

  // Generate HTML for each pool with mobile-optimized cards
  const html = sortedPools.map(pool => {
    const poolName = pool.name || 'Unknown Pool';
    const poolId = pool.id || '';
    const features = pool.features || [];
    
    let distanceHtml = '';
    if (pool.distance !== undefined && !isNaN(pool.distance)) {
      distanceHtml = `<span class="distance-badge">📍 ${pool.distance.toFixed(1)} mi</span>`;
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
      mapsUrl = pool.location.googleMapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(pool.location.mapsQuery || '')}`;
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
      mapsUrl = `https://www.google.com/maps/search/?api=1&query=${locationQuery}`;
    }

    // Format features for display as horizontal pills
    let featuresHtml = '';
    if (Array.isArray(features) && features.length > 0) {
      const sortedFeatures = features.sort();
      featuresHtml = `
        <div class="pool-features">
          <h4>Features</h4>
          <div class="feature-pills">
            ${sortedFeatures.map(feature => `<span class="feature-pill">${feature}</span>`).join('')}
          </div>
        </div>
      `;
    } else {
      featuresHtml = `
        <div class="pool-features">
          <h4>Features</h4>
          <span class="status-tbd">TBD</span>
        </div>
      `;
    }

    // Format opening hours for display using new helper
    const hoursHtml = formatPoolHours(pool);
    
    // Get pool status for indicator using new helper
    const poolStatus = getPoolStatus(pool);
    const statusClass = poolStatus.color;

    // Check if pool has schedules (same logic as TBD check)
    const poolObj = poolBrowserDataManager.getPool(pool.name);
    const hasSchedules = poolObj && poolObj.legacySchedules && poolObj.legacySchedules.length > 0;
    
    // Show status indicator with tooltip for all pools
    const tooltipText = getStatusTooltip(statusClass);
    const statusIndicatorHtml = `<span class="pool-status-indicator ${statusClass} status-tooltip">
      <span class="tooltip-text">${tooltipText}</span>
    </span>`;

    // Create CA Pool website link if caUrl is available
    let caLinkHtml = '';
    if (pool.caUrl) {
      caLinkHtml = `
        <div class="ca-website-section">
          <a href="${pool.caUrl}" 
             target="_blank" 
             rel="noopener" 
             class="ca-link">
            Visit CA Pool Page
          </a>
        </div>
      `;
    }

    // Create phone number section if phone is available
    let phoneHtml = '';
    if (pool.phone) {
      phoneHtml = `
        <div class="phone-section">
          <strong>📞 Pool Desk:</strong>
          <a href="tel:${pool.phone}" class="phone-link">
            ${pool.phone}
          </a>
        </div>
      `;
    }

    return `
      <div class="pool-card collapsed" data-pool-id="${poolId}">
        <div class="pool-header" onclick="togglePoolCard(this)">
          <h3>${statusIndicatorHtml}${poolName}</h3>
          ${distanceHtml}
        </div>
        <div class="pool-details">
          <div class="address-section">
            <strong>📍 Address:</strong><br>
            <a href="${mapsUrl}" 
               target="_blank" 
               rel="noopener" 
               class="address-link">
              ${streetAddress ? `${streetAddress}${cityStateZip ? '<br>' : ''}` : ''}${cityStateZip || (streetAddress ? '' : 'Address not available')}
            </a>
          </div>
          ${phoneHtml}
          ${caLinkHtml}
          ${hoursHtml}
          ${featuresHtml}
        </div>
      </div>
    `;
  }).join('');

  list.innerHTML = html;
}

/**
 * Formats a time range into three separate spans for better alignment
 * @param {string} timeRange - Time range in format "startTime-endTime"
 * @param {boolean} isCurrentDay - Whether this is the current day
 * @param {number|null} currentTime - Current time in minutes since midnight (null = auto-calculate)
 * @param {Object} poolStatus - Pool status object with color information
 * @returns {string} - HTML with three spans for start, dash, and end time
 */
function formatTimeRangeSpans(timeRange, isCurrentDay = false, currentTime = null, poolStatus = null) {
  // Use the shared utility function from TimeUtils
  return TimeUtils.formatTimeRangeWithHighlight(timeRange, isCurrentDay, currentTime, poolStatus);
}

/**
 * Handles URL parameters to show a specific pool
 * If ?pool=poolId is in the URL, expands and highlights that pool
 */
function handlePoolUrlParameter() {
  const urlParams = new URLSearchParams(window.location.search);
  const poolId = urlParams.get('pool');
  
  if (poolId) {
    // Wait a moment for the DOM to be ready, then find and expand the pool
    setTimeout(() => {
      const poolCard = document.querySelector(`[data-pool-id="${poolId}"]`);
      if (poolCard) {
        // Expand the pool card
        poolCard.classList.remove('collapsed');
        
        // Add a highlight class for visual emphasis
        poolCard.classList.add('highlighted');
        
        // Scroll to the pool card
        poolCard.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center' 
        });
        
        // Remove highlight after a few seconds
        setTimeout(() => {
          poolCard.classList.remove('highlighted');
        }, 3000);
      }
    }, 100);
  }
}

/**
 * Toggles the collapsed state of a pool card
 * @param {Element} headerElement - The clicked header element
 */
function togglePoolCard(headerElement) {
  const poolCard = headerElement.closest('.pool-card');
  poolCard.classList.toggle('collapsed');
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
 * Refresh the display for a specific pool
 * @param {string} poolId - Pool identifier
 */
function refreshPoolDisplay(poolId) {
  if (!poolBrowserDataManager) return;
  
  // Find the pool card and update just its hours section
  const poolCard = document.querySelector(`[data-pool-id="${poolId}"]`);
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

/**
 * Handle clicks on pool navigation buttons
 * @param {Event} event - Click event
 */
function handlePoolNavigationClick(event) {
  const target = event.target;
  
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
  } else if (target.classList.contains('calendar-btn')) {
    const poolNav = target.closest('.pool-week-navigation');
    if (poolNav) {
      const datePicker = poolNav.querySelector('.week-picker');
      if (datePicker) {
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
    }
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  // Check if we're on the pools page before fetching data
  if (!document.getElementById("poolList")) {
    console.log("Not on pools page, skipping pool data fetch");
    return;
  }
  
  try {
    // Load season information first
    await loadSeasonInfo();
    
    // Initialize the data manager with the new OOP system
    await initializePoolBrowser();
    
    // Get pools from the data manager
    const poolsManager = poolBrowserDataManager.getPools();
    const pools = poolsManager.getAllPools();
    
    console.log("Loaded pool data from DataManager:", pools.length, "pools");
    
    // Convert Pool objects to legacy format for backward compatibility
    const legacyPools = pools.map(pool => pool.toJSON());
    
    // Always render pools first with no location data
    renderPools(legacyPools);
    
    // Set up pool-specific navigation event handlers
    setupPoolNavigationHandlers();
    
    // Handle URL parameters to show specific pool
    handlePoolUrlParameter();
    
    // Then try to get location - if it works, pools will be re-rendered with distances
    try {
      getUserLocation();
    } catch (locationError) {
      console.log("Location access not available:", locationError);
      // Continue without location data - pools are already rendered
    }
    
  } catch (error) {
    console.error("Failed to load pool data:", error);
    const list = document.getElementById("poolList");
    if (list) {
      list.innerHTML = "<p>⚠️ Pool data is currently unavailable. Please try again later.</p>";
    }
  }
});
