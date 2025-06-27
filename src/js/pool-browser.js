let poolBrowserData = []; // Renamed to avoid conflict with copilot.js
let userCoords = null;


// ------------------------------
//    UTILITY FUNCTIONS
// ------------------------------

/**
 * Gets current time in Eastern Time zone
 * @returns {Date} - Current time in Eastern Time
 */
function getEasternTime() {
  const now = new Date();
  return new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
}

/**
 * Gets pool status with three-color system
 * @param {Object} pool - Pool object with schedules property
 * @returns {Object} - Status object with isOpen, status, color, and icon
 */
function getPoolStatus(pool) {
  if (!pool.schedules || !Array.isArray(pool.schedules)) {
    return {
      isOpen: false,
      status: 'Closed',
      color: 'red',
      icon: '🔴'
    };
  }

  const easternTime = getEasternTime();
  const currentDate = easternTime.toISOString().split('T')[0]; // YYYY-MM-DD format
  const currentDay = easternTime.toLocaleDateString('en-US', { weekday: 'short' }); // Mon, Tue, etc.
  const currentTime = easternTime.getHours() * 60 + easternTime.getMinutes(); // Minutes since midnight

  // Find the current active schedule
  const activeSchedule = pool.schedules.find(schedule => {
    return currentDate >= schedule.startDate && currentDate <= schedule.endDate;
  });

  if (!activeSchedule || !activeSchedule.hours) {
    return {
      isOpen: false,
      status: 'Closed',
      color: 'red',
      icon: '🔴'
    };
  }

  // Find today's hours - there might be multiple time slots for the same day
  const todayHours = activeSchedule.hours.filter(h => 
    h.weekDays && h.weekDays.includes(currentDay)
  );
  
  if (!todayHours.length) {
    return {
      isOpen: false,
      status: 'Closed',
      color: 'red',
      icon: '🔴'
    };
  }

  // Check current time against all time slots
  for (const hour of todayHours) {
    const startMinutes = timeStringToMinutes(hour.startTime);
    const endMinutes = timeStringToMinutes(hour.endTime);
    
    if (currentTime >= startMinutes && currentTime < endMinutes) {
      // Check activity types to determine access level
      const activityTypes = formatActivityTypes(hour.types).toLowerCase();
      
      // Check for restricted access based on activity types
      if (activityTypes.includes('closed to public')) {
        return {
          isOpen: false,
          status: 'Closed to Public',
          color: 'red',
          icon: '�'
        };
      } else if (activityTypes.includes('cnsl practice only')) {
        return {
          isOpen: true,
          status: 'CNSL Practice Only',
          color: 'yellow',
          icon: '🟡'
        };
      } else if (activityTypes.includes('swim meet')) {
        return {
          isOpen: true,
          status: 'Swim Meet',
          color: 'yellow',
          icon: '🟡'
        };
      } else {
        // Regular public access (Laps, Rec Swim, Aqua Fitness, etc.)
        return {
          isOpen: true,
          status: 'Open Now',
          color: 'green',
          icon: '�'
        };
      }
    }
  }

  return {
    isOpen: false,
    status: 'Closed',
    color: 'red',
    icon: '🔴'
  };
}

/**
 * Checks if a pool is currently open for public access based on its schedule
 * @param {Object} pool - Pool object with schedules property
 * @returns {boolean} - True if the pool is currently open to public
 */
function isPoolOpen(pool) {
  const status = getPoolStatus(pool);
  return status.isOpen && status.color === 'green';
}

/**
 * Formats activity types for display
 * @param {string|Array} types - Single type string or array of types
 * @returns {string} - Formatted types string
 */
function formatActivityTypes(types) {
  if (!types) return '';
  if (typeof types === 'string') return types;
  if (Array.isArray(types)) return types.join(', ');
  return '';
}

/**
 * Converts time string (e.g., "6:00AM", "10:30PM") to minutes since midnight
 * @param {string} timeStr - Time string in format "H:MMAM/PM"
 * @returns {number} - Minutes since midnight
 */
function timeStringToMinutes(timeStr) {
  const match = timeStr.match(/(\d{1,2}):?(\d{0,2})(AM|PM)/i);
  if (!match) return 0;

  const hours = parseInt(match[1]);
  const minutes = parseInt(match[2] || '0');
  const period = match[3].toUpperCase();

  let adjustedHours = hours;
  if (period === 'PM' && hours !== 12) {
    adjustedHours += 12;
  } else if (period === 'AM' && hours === 12) {
    adjustedHours = 0;
  }

  return adjustedHours * 60 + minutes;
}

/**
 * Formats pool schedule for display with time slot highlighting
 * @param {Object} pool - Pool object with schedules property
 * @returns {string} - HTML string for displaying hours
 */
function formatPoolHours(pool) {
  if (!pool.schedules || !Array.isArray(pool.schedules) || pool.schedules.length === 0) {
    return '<div class="pool-hours"><strong>🕒 Hours:</strong> Not available</div>';
  }

  const easternTime = getEasternTime();
  const currentDate = easternTime.toISOString().split('T')[0]; // YYYY-MM-DD format
  const currentDay = easternTime.toLocaleDateString('en-US', { weekday: 'short' }); // Mon, Tue, etc.
  const currentTime = easternTime.getHours() * 60 + easternTime.getMinutes(); // Minutes since midnight
  
  // Find the current active schedule
  const activeSchedule = pool.schedules.find(schedule => {
    return currentDate >= schedule.startDate && currentDate <= schedule.endDate;
  });

  if (!activeSchedule || !activeSchedule.hours) {
    return '<div class="pool-hours"><strong>🕒 Hours:</strong> No current schedule available</div>';
  }

  const poolStatus = getPoolStatus(pool);
  const statusIcon = poolStatus.icon;
  const statusText = poolStatus.status;

  // Format the period dates
  const startDate = new Date(activeSchedule.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const endDate = new Date(activeSchedule.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const periodText = `Hours for ${startDate} - ${endDate}`;

  // Group hours by day and time range with activity types
  const dayGroups = {};
  activeSchedule.hours.forEach(hour => {
    if (hour.weekDays) {
      hour.weekDays.forEach(day => {
        if (!dayGroups[day]) {
          dayGroups[day] = [];
        }
        dayGroups[day].push({
          timeRange: hour.startTime && hour.endTime ? `${hour.startTime}-${hour.endTime}` : '',
          types: formatActivityTypes(hour.types),
          notes: hour.notes || '',
          access: hour.access || 'Public',
          startTime: hour.startTime,
          endTime: hour.endTime
        });
      });
    }
  });

  // Sort time slots within each day from earliest to latest
  Object.keys(dayGroups).forEach(day => {
    dayGroups[day].sort((a, b) => {
      const aStart = timeStringToMinutes(a.startTime || '12:00AM');
      const bStart = timeStringToMinutes(b.startTime || '12:00AM');
      return aStart - bStart;
    });
  });

  // Add debug info for current day and time
  let debugInfo = `<div style="font-size: 0.8em; color: #666; margin-bottom: 0.5rem;">
    Current: ${currentDay} at ${Math.floor(currentTime/60)}:${String(currentTime%60).padStart(2,'0')} (${currentTime} minutes)
  </div>`;
  
  // Extra debug for Bryant Woods Sunday issue
  if (pool.name === 'Bryant Woods' && dayGroups['Sun']) {
    debugInfo += `<div style="font-size: 0.8em; color: #orange; margin-bottom: 0.5rem;">
      🐛 Bryant Woods Sunday slots: ${dayGroups['Sun'].length}
    </div>`;
  }
  
  // Debug current day schedule
  if (dayGroups[currentDay]) {
    debugInfo += `<div style="font-size: 0.8em; color: #blue; margin-bottom: 0.5rem;">
      📅 ${pool.name} has ${dayGroups[currentDay].length} slots for ${currentDay}
    </div>`;
  } else {
    debugInfo += `<div style="font-size: 0.8em; color: #red; margin-bottom: 0.5rem;">
      ❌ ${pool.name} has NO slots for ${currentDay}
    </div>`;
  }

  // Format hours display
  let hoursDisplay = '';
  const dayOrder = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  
  dayOrder.forEach(day => {
    if (dayGroups[day]) {
      const daySlots = dayGroups[day];
      
      // Check if this is the current day and if pool is open now
      const isCurrentDay = day === currentDay;
      const dayStyle = isCurrentDay && poolStatus.isOpen ? ' style="font-weight: bold; color: var(--primary-color);"' : '';
      
      // Use consistent format for all days - always show day name then time slots below
      hoursDisplay += `<div class="day-schedule"><strong${dayStyle}>${day}:</strong></div>`;
      daySlots.forEach(slot => {
        let typesText = slot.types ? ` ${slot.types}` : '';
        
        // Make "Closed to Public" bold
        if (typesText.includes('Closed to Public')) {
          typesText = typesText.replace('Closed to Public', '<span class="closed-to-public">Closed to Public</span>');
        }
        
        const notesText = slot.notes ? ` - ${slot.notes}` : '';
        const timeHtml = slot.timeRange ? formatTimeRangeSpans(slot.timeRange, isCurrentDay, currentTime, poolStatus) : '';
        hoursDisplay += `<div class="time-slot"><span class="time-range-container">${timeHtml}</span>${typesText}${notesText}</div>`;
      });
    }
  });

  return `
    <div class="pool-hours">
      <strong>🕒 Hours:</strong> <span class="open-status status-${poolStatus.color}">${statusIcon} ${statusText}</span><br>
      <div class="period-info">
        ${periodText}
      </div>
      ${debugInfo}
      <div class="hours-details">
        ${hoursDisplay}
      </div>
    </div>
  `;
}



/**
 * Groups consecutive days for cleaner display
 * @param {Array} days - Array of day names
 * @returns {Array} - Array of formatted day ranges
 */
function groupConsecutiveDays(days) {
  const dayOrder = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const sortedDays = days.sort((a, b) => dayOrder.indexOf(a) - dayOrder.indexOf(b));

  const groups = [];
  let currentGroup = [sortedDays[0]];

  for (let i = 1; i < sortedDays.length; i++) {
    const currentIndex = dayOrder.indexOf(sortedDays[i]);
    const prevIndex = dayOrder.indexOf(sortedDays[i - 1]);

    if (currentIndex === prevIndex + 1) {
      currentGroup.push(sortedDays[i]);
    } else {
      groups.push(formatDayGroup(currentGroup));
      currentGroup = [sortedDays[i]];
    }
  }
  groups.push(formatDayGroup(currentGroup));

  return groups;
}

/**
 * Formats a group of consecutive days
 * @param {Array} group - Array of consecutive day names
 * @returns {string} - Formatted day range string
 */
function formatDayGroup(group) {
  if (group.length === 1) {
    return group[0].substring(0, 3); // Return abbreviated day name
  } else if (group.length === 2) {
    return `${group[0].substring(0, 3)}-${group[group.length - 1].substring(0, 3)}`;
  } else {
    return `${group[0].substring(0, 3)}-${group[group.length - 1].substring(0, 3)}`;
  }
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
      if (document.getElementById("poolList")) {
        renderPools(poolBrowserData);
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
 * @param {Array} pools - Array of pool objects
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
    // Handle potential missing name properties
    const nameA = (a && a.name) ? a.name : '';
    const nameB = (b && b.name) ? b.name : '';
    return nameA.localeCompare(nameB);
  });

  // If we have user location, calculate distances
  if (userCoords) {
    sortedPools.forEach(pool => {
      try {
        // Handle both formats: {location: {lat, lng}} and direct {lat, lng} in pool object
        if (pool) {
          if (pool.location && pool.location.lat && pool.location.lng) {
            pool.distance = calculateDistance(userCoords, {
              lat: pool.location.lat,
              lng: pool.location.lng
            });
          } else if (pool.lat && pool.lng) {
            pool.distance = calculateDistance(userCoords, {
              lat: pool.lat,
              lng: pool.lng
            });
          }
        }
      } catch (err) {
        console.error("Error calculating distance for pool:", err);
        // Don't set distance if calculation fails
      }
    });
  }

  // Generate HTML for each pool with mobile-optimized cards
  const html = sortedPools.map(pool => {
    // Safety checks for all pool properties
    const poolName = pool.name || 'Unknown Pool';
    const poolId = pool.id || '';
    const poolAddress = pool.address || '';
    const poolCity = pool.city || '';
    const poolState = pool.state || '';
    const poolZip = pool.zip || '';
    const features = pool.features || [];
    
    let distanceHtml = '';
    if (pool.distance !== undefined && !isNaN(pool.distance)) {
      distanceHtml = `<span class="distance-badge">📍 ${pool.distance.toFixed(1)} mi</span>`;
    }

    // Build the location query safely
    const locationQuery = encodeURIComponent(
      [poolAddress, poolCity, poolState, poolZip].filter(Boolean).join(', ')
    );

    const fullAddress = [poolAddress, poolCity, poolState, poolZip].filter(Boolean).join(', ');

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

    // Format opening hours for display
    const hoursHtml = formatPoolHours(pool);
    
    // Get pool status for indicator
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
            <a href="https://www.google.com/maps/search/?api=1&query=${locationQuery}" 
               target="_blank" 
               rel="noopener" 
               class="address-link">
              ${fullAddress || 'Address not available'}
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
 * @param {number} currentTime - Current time in minutes since midnight
 * @param {Object} poolStatus - Pool status object with color information
 * @returns {string} - HTML with three spans for start, dash, and end time
 */
function formatTimeRangeSpans(timeRange, isCurrentDay = false, currentTime = 0, poolStatus = null) {
  if (!timeRange) return '';
  
  const parts = timeRange.split('-');
  if (parts.length !== 2) return timeRange;
  
  const startTime = parts[0].trim();
  const endTime = parts[1].trim();
  
  // Check if current time falls within this slot (only for current day)
  let highlightClass = '';
  let inlineStyle = '';
  if (isCurrentDay && poolStatus) {
    const startMinutes = timeStringToMinutes(startTime);
    const endMinutes = timeStringToMinutes(endTime);
    
    // Debug logging for time slot highlighting
    console.log(`🐛 Time slot check: ${startTime}-${endTime}`, {
      startMinutes,
      endMinutes,
      currentTime,
      isInRange: currentTime >= startMinutes && currentTime < endMinutes,
      poolStatusColor: poolStatus.color
    });
    
    // Use < instead of <= to prevent overlapping highlights
    if (currentTime >= startMinutes && currentTime < endMinutes) {
      // For highlighting, always use green for active time slots during current time
      // The poolStatus.color represents the actual access level for the current time
      if (poolStatus.color === 'green') {
        highlightClass = ' highlighted-time-slot-green';
        inlineStyle = ' style="background-color: #28a745 !important; color: white !important; padding: 0.2rem 0.4rem !important; border-radius: 0.3rem !important; font-weight: bold !important;"';
      } else if (poolStatus.color === 'yellow') {
        highlightClass = ' highlighted-time-slot-yellow';
        inlineStyle = ' style="background-color: #ffc107 !important; color: black !important; padding: 0.2rem 0.4rem !important; border-radius: 0.3rem !important; font-weight: bold !important;"';
      } else {
        highlightClass = ' highlighted-time-slot-red';
        inlineStyle = ' style="background-color: #dc3545 !important; color: white !important; padding: 0.2rem 0.4rem !important; border-radius: 0.3rem !important; font-weight: bold !important;"';
      }
      
      console.log(`🎯 MATCH FOUND! Current time slot: ${startTime}-${endTime}`);
      console.log(`🎯 Pool status color: ${poolStatus.color}`);
      console.log(`🎯 Applied highlight class: "${highlightClass.trim()}"`);
      console.log(`🎯 Applied inline style: "${inlineStyle}"`);
      console.log(`🎯 This time slot should be highlighted with ${poolStatus.color} background`);
    }
  }
  
  return `<span class="time-start${highlightClass}"${inlineStyle}>${startTime}</span><span class="time-dash${highlightClass}"${inlineStyle}>-</span><span class="time-end${highlightClass}"${inlineStyle}>${endTime}</span>`;
}

/**
 * Toggles the collapsed state of a pool card
 * @param {Element} headerElement - The clicked header element
 */
function togglePoolCard(headerElement) {
  const poolCard = headerElement.closest('.pool-card');
  poolCard.classList.toggle('collapsed');
}

document.addEventListener("DOMContentLoaded", () => {
  // Check if we're on the pools page before fetching data
  if (!document.getElementById("poolList")) {
    console.log("Not on pools page, skipping pool data fetch");
    return;
  }
  
  // Load pool data asynchronously after the page has rendered
  setTimeout(() => {
    fetch("assets/data/pools.json")
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        const pools = data.pools || data; // Handle both new structure and backward compatibility
        console.log("Loaded pool data:", pools.length, "pools");
        poolBrowserData = pools;
        
        // Always render pools first with no location data
        renderPools(pools);
        
        // Then try to get location - if it works, pools will be re-rendered with distances
        try {
          getUserLocation();
        } catch (locationError) {
          console.log("Location access not available:", locationError);
          // Continue without location data - pools are already rendered
        }
      })
      .catch(error => {
        console.error("Failed to load pool data:", error);
        const list = document.getElementById("poolList");
        if (list) {
          list.innerHTML = "<p>⚠️ Pool data is currently unavailable. Please try again later.</p>";
        }
      });
  }, 0); // Load asynchronously after DOM is ready
});
