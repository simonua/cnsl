let poolBrowserData = []; // Renamed to avoid conflict with copilot.js
let userCoords = null;


// ------------------------------
//    UTILITY FUNCTIONS
// ------------------------------

/**
 * Checks if a pool is currently open based on its schedule
 * @param {Object} pool - Pool object with schedules property
 * @returns {boolean} - True if the pool is currently open
 */
function isPoolOpen(pool) {
  if (!pool.schedules || !Array.isArray(pool.schedules)) {
    return false;
  }

  const now = new Date();
  const currentDate = now.toISOString().split('T')[0]; // YYYY-MM-DD format
  const currentDay = now.toLocaleDateString('en-US', { weekday: 'short' }); // Mon, Tue, etc.
  const currentTime = now.getHours() * 60 + now.getMinutes(); // Minutes since midnight

  // Find the current active schedule
  const activeSchedule = pool.schedules.find(schedule => {
    return currentDate >= schedule.startDate && currentDate <= schedule.endDate;
  });

  if (!activeSchedule || !activeSchedule.hours) {
    return false;
  }

  // Find today's hours - there might be multiple time slots for the same day
  const todayHours = activeSchedule.hours.filter(h => 
    h.weekDays && h.weekDays.includes(currentDay)
  );
  if (!todayHours.length) {
    return false;
  }

  // Check if current time falls within any of today's time slots
  return todayHours.some(hour => {
    const startMinutes = timeStringToMinutes(hour.startTime);
    const endMinutes = timeStringToMinutes(hour.endTime);
    return currentTime >= startMinutes && currentTime <= endMinutes;
  });
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
 * Formats pool schedule for display
 * @param {Object} pool - Pool object with schedules property
 * @returns {string} - HTML string for displaying hours
 */
function formatPoolHours(pool) {
  if (!pool.schedules || !Array.isArray(pool.schedules) || pool.schedules.length === 0) {
    return '<div class="pool-hours"><strong>🕒 Hours:</strong> Not available</div>';
  }

  const now = new Date();
  const currentDate = now.toISOString().split('T')[0]; // YYYY-MM-DD format
  
  // Find the current active schedule
  const activeSchedule = pool.schedules.find(schedule => {
    return currentDate >= schedule.startDate && currentDate <= schedule.endDate;
  });

  if (!activeSchedule || !activeSchedule.hours) {
    return '<div class="pool-hours"><strong>🕒 Hours:</strong> No current schedule available</div>';
  }

  const isOpen = isPoolOpen(pool);
  const statusIcon = isOpen ? '🟢' : '🔴';
  const statusText = isOpen ? 'Open Now' : 'Closed';

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
          notes: hour.notes || ''
        });
      });
    }
  });

  // Format hours display
  let hoursDisplay = '';
  const dayOrder = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  
  dayOrder.forEach(day => {
    if (dayGroups[day]) {
      const daySlots = dayGroups[day];
      if (daySlots.length === 1) {
        // Single time slot for the day
        const slot = daySlots[0];
        let typesText = slot.types ? ` ${slot.types}` : '';
        
        // Make "Closed to Public" bold
        if (typesText.includes('Closed to Public')) {
          typesText = typesText.replace('Closed to Public', '<span class="closed-to-public">Closed to Public</span>');
        }
        
        const notesText = slot.notes ? ` - ${slot.notes}` : '';
        const timeHtml = slot.timeRange ? formatTimeRangeSpans(slot.timeRange) : '';
        hoursDisplay += `<div class="day-schedule"><strong>${day}:</strong> <span class="time-range-container">${timeHtml}</span>${typesText}${notesText}</div>`;
      } else {
        // Multiple time slots for the day
        hoursDisplay += `<div class="day-schedule"><strong>${day}:</strong></div>`;
        daySlots.forEach(slot => {
          let typesText = slot.types ? ` ${slot.types}` : '';
          
          // Make "Closed to Public" bold
          if (typesText.includes('Closed to Public')) {
            typesText = typesText.replace('Closed to Public', '<span class="closed-to-public">Closed to Public</span>');
          }
          
          const notesText = slot.notes ? ` - ${slot.notes}` : '';
          const timeHtml = slot.timeRange ? formatTimeRangeSpans(slot.timeRange) : '';
          hoursDisplay += `<div class="time-slot"><span class="time-range-container">${timeHtml}</span>${typesText}${notesText}</div>`;
        });
      }
    }
  });

  return `
    <div class="pool-hours">
      <strong>🕒 Hours:</strong> <span class="open-status">${statusIcon} ${statusText}</span><br>
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

    // Format features for display
    let featuresHtml = '';
    if (Array.isArray(features) && features.length > 0) {
      featuresHtml = `
        <div class="pool-features">
          <h4>Features</h4>
          <ul class="features-list">
            ${features.sort().map(feature => `<li>${feature}</li>`).join('')}
          </ul>
        </div>
      `;
    }

    // Format opening hours for display
    const hoursHtml = formatPoolHours(pool);
    
    // Get pool open status for indicator
    const isOpen = isPoolOpen(pool);
    const statusClass = isOpen ? 'open' : 'closed';

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
          ${featuresHtml}
          ${hoursHtml}
        </div>
      </div>
    `;
  }).join('');

  list.innerHTML = html;
}

/**
 * Formats a time range into three separate spans for better alignment
 * @param {string} timeRange - Time range in format "startTime-endTime"
 * @returns {string} - HTML with three spans for start, dash, and end time
 */
function formatTimeRangeSpans(timeRange) {
  if (!timeRange) return '';
  
  const parts = timeRange.split('-');
  if (parts.length !== 2) return timeRange;
  
  const startTime = parts[0].trim();
  const endTime = parts[1].trim();
  
  return `<span class="time-start">${startTime}</span><span class="time-dash">-</span><span class="time-end">${endTime}</span>`;
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
