let poolBrowserData = []; // Renamed to avoid conflict with copilot.js
let userCoords = null;

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
    list.innerHTML = "<p>No pool information available.</p>";
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

  // Generate HTML for each pool
  const html = sortedPools.map(pool => {
    // Safety checks for all pool properties
    const poolName = pool.name || 'Unknown Pool';
    const poolId = pool.id || '';
    const poolAddress = pool.address || '';
    const poolCity = pool.city || '';
    const poolState = pool.state || '';
    const poolZip = pool.zip || '';
    
    let distanceHtml = '';
    if (pool.distance !== undefined && !isNaN(pool.distance)) {
      distanceHtml = `<span class="distance">${pool.distance.toFixed(1)} mi</span>`;
    }

    // Build the location query safely
    const locationQuery = encodeURIComponent(
      [poolAddress, poolCity, poolState, poolZip].filter(Boolean).join(', ')
    );

    return `
      <div class="pool-item" data-pool-id="${poolId}">
        <h3>${poolName} ${distanceHtml}</h3>
        <p>${poolAddress}</p>
        <p>${poolCity}${poolCity && poolState ? ', ' : ''}${poolState} ${poolZip}</p>
        <div class="pool-buttons">
          <a href="https://maps.google.com/?q=${locationQuery}" 
            target="_blank" rel="noopener" class="btn btn-secondary">Directions</a>
        </div>
      </div>
    `;
  }).join('');

  list.innerHTML = html;
}

document.addEventListener("DOMContentLoaded", () => {
  // Check if we're on the pools page before fetching data
  if (!document.getElementById("poolList")) {
    console.log("Not on pools page, skipping pool data fetch");
    return;
  }
  
  fetch("assets/data/pools.json")
    .then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then(data => {
      console.log("Loaded pool data:", data.length, "pools");
      poolBrowserData = data;
      
      // Always render pools first with no location data
      renderPools(data);
      
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
});
