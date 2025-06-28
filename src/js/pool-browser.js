// Global data manager instance for pool browser
let poolBrowserDataManager = null;
let userCoords = null;


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
 * Formats pool schedule for display with time slot highlighting
 * @param {Object} pool - Pool data object (legacy format)
 * @returns {string} - HTML string for displaying hours
 */
function formatPoolHours(pool) {
  if (!poolBrowserDataManager) {
    return '<div class="pool-hours"><strong>🕒 Hours:</strong> Data unavailable</div>';
  }

  const poolObj = poolBrowserDataManager.getPool(pool.name);
  if (!poolObj) {
    return '<div class="pool-hours"><strong>🕒 Hours:</strong> Pool not found</div>';
  }

  const easternTimeInfo = TimeUtils.getCurrentEasternTimeInfo();
  const poolStatus = poolObj.getCurrentStatus();
  const weekSchedule = poolObj.getWeekSchedule();
  
  // Get current schedule period for date range display
  const schedulePeriod = poolObj.getCurrentSchedulePeriod();
  let periodText = 'Current Schedule';
  if (schedulePeriod) {
    // Format dates for display
    const startDate = new Date(schedulePeriod.startDate).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    });
    const endDate = new Date(schedulePeriod.endDate).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    });
    periodText = `Current Schedule (${startDate} - ${endDate})`;
  }

  // Format hours display using new Pool class methods
  let hoursDisplay = '';
  const dayOrder = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  
  dayOrder.forEach(day => {
    const daySchedule = weekSchedule.find(d => d.day === day);
    if (daySchedule && daySchedule.timeSlots && daySchedule.timeSlots.length > 0) {
      const isCurrentDay = day === easternTimeInfo.day;
      
      // Check if any slot in this day is the current timeslot
      const hasCurrentTimeSlot = isCurrentDay && TimeUtils.hasCurrentTimeSlot(daySchedule.timeSlots, poolStatus.isOpen);
      
      // Only style the day heading if it contains the current time slot
      const dayStyle = hasCurrentTimeSlot ? ' style="font-weight: bold; color: var(--primary-color);"' : '';
      
      hoursDisplay += `<div class="day-schedule"><strong${dayStyle}>${day}:</strong></div>`;
      
      daySchedule.timeSlots.forEach(slot => {
        let typesText = slot.activities ? ` ${TimeUtils.formatActivityTypes(slot.activities)}` : '';
        
        // Make "Closed to Public" bold
        if (typesText.includes('Closed to Public')) {
          typesText = typesText.replace('Closed to Public', '<span class="closed-to-public">Closed to Public</span>');
        }
        
        const notesText = slot.notes ? ` - ${slot.notes}` : '';
        const timeRange = `${slot.startTime}-${slot.endTime}`;
        const timeHtml = formatTimeRangeSpans(timeRange, isCurrentDay, null, poolStatus);
        hoursDisplay += `<div class="time-slot">${timeHtml}${typesText}${notesText}</div>`;
      });
    }
  });

  return `
    <div class="pool-hours">
      <strong>🕒 Hours:</strong> <span class="open-status status-${poolStatus.color || 'red'}">${poolStatus.icon} ${poolStatus.status}</span><br>
      <div class="period-info">
        ${periodText}
      </div>
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
    }

    // Format opening hours for display using new helper
    const hoursHtml = formatPoolHours(pool);
    
    // Get pool status for indicator using new helper
    const poolStatus = getPoolStatus(pool);
    const statusClass = poolStatus.color;

    return `
      <div class="pool-card collapsed" data-pool-id="${poolId}">
        <div class="pool-header" onclick="togglePoolCard(this)">
          <h3><span class="pool-status-indicator ${statusClass}"></span>${poolName}</h3>
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
 * Toggles the collapsed state of a pool card
 * @param {Element} headerElement - The clicked header element
 */
function togglePoolCard(headerElement) {
  const poolCard = headerElement.closest('.pool-card');
  poolCard.classList.toggle('collapsed');
}

document.addEventListener("DOMContentLoaded", async () => {
  // Check if we're on the pools page before fetching data
  if (!document.getElementById("poolList")) {
    console.log("Not on pools page, skipping pool data fetch");
    return;
  }
  
  try {
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
