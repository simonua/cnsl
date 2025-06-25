let meetsData = []; // Avoid global variable name conflicts
let poolsData = []; // Store pool data for location mapping

/**
 * Finds a pool by name or partial name from the poolsData array
 * @param {string} locationName - The name of the location to search for
 * @returns {Object|null} The pool object if found, null otherwise
 */
function findPoolByLocation(locationName) {
  if (!locationName || !poolsData || !poolsData.length) return null;
  
  // Try to find an exact pool name match
  const exactMatch = poolsData.find(pool => 
    pool.name && pool.name.toLowerCase() === locationName.toLowerCase()
  );
  if (exactMatch) return exactMatch;
  
  // Try to find a pool where the name is included in the location string
  const partialMatch = poolsData.find(pool => 
    pool.name && locationName.toLowerCase().includes(pool.name.toLowerCase())
  );
  if (partialMatch) return partialMatch;

  // Try with just the first part of location name (before "Pool" or "Common")
  const simplifiedName = locationName.split(" Pool")[0].split(" Common")[0];
  const simplifiedMatch = poolsData.find(pool => 
    pool.name && pool.name.toLowerCase().includes(simplifiedName.toLowerCase())
  );
  
  return simplifiedMatch || null;
}

/**
 * Renders the list of meets in the #meetList element
 * @param {Array} meets - Array of meet objects
 */
function renderMeets(meets) {
  const list = document.getElementById("meetList");
  if (!list) return;
  
  // Safety check - ensure meets is an array
  if (!Array.isArray(meets) || meets.length === 0) {
    list.innerHTML = "<p>No meet information available.</p>";
    return;
  }

  // Get current date for highlighting upcoming meets
  const currentDate = new Date();
  const today = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
  
  // Sort meets by date
  const sortedMeets = [...meets].sort((a, b) => {
    // Assume meet.date is a string in a format that can be converted to Date
    const dateA = a.date ? new Date(a.date) : new Date(0);
    const dateB = b.date ? new Date(b.date) : new Date(0);
    return dateA - dateB;
  });

  // Group meets by month/date
  const meetsByDate = {};
  sortedMeets.forEach(meet => {
    if (!meet.date) return;
    
    const meetDate = new Date(meet.date);
    const dateKey = meetDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
    
    if (!meetsByDate[dateKey]) {
      meetsByDate[dateKey] = [];
    }
    meetsByDate[dateKey].push(meet);
  });

  // Generate HTML for meets grouped by date
  let html = '';
  
  Object.keys(meetsByDate).forEach(dateKey => {
    html += `<h3 class="meet-date">${dateKey}</h3>`;
    html += '<div class="meet-group">';
    
    meetsByDate[dateKey].forEach(meet => {
      const location = meet.location || 'TBA';
      // Use standard meet time of 8:00-noon for regular meets
      const time = meet.time || (meet.name ? 'TBA' : '8:00 AM - 12:00 PM');
      let meetContent = '';
      
      // Check if meet is today or upcoming
      const meetDate = new Date(meet.date);
      const isToday = meetDate.toDateString() === today.toDateString();
      const isUpcoming = meetDate >= today;
      
      // Add appropriate CSS classes based on date
      let meetClasses = "meet-item";
      if (isToday) {
        meetClasses += " meet-today";
      } else if (isUpcoming) {
        meetClasses += " meet-upcoming";
      } else {
        meetClasses += " meet-past";
      }
      
      // Find the corresponding pool for this meet location
      const poolMatch = findPoolByLocation(location);
      
      // Generate location link for Google Maps
      let locationLink = '';
      if (poolMatch && (poolMatch.address || (poolMatch.lat && poolMatch.lng))) {
        // If we have a matching pool with address or coordinates
        if (poolMatch.address) {
          const encodedAddress = encodeURIComponent(poolMatch.address);
          locationLink = `<a href="https://maps.google.com/?q=${encodedAddress}" target="_blank" rel="noopener" class="location-link">${location}</a>`;
        } else {
          locationLink = `<a href="https://maps.google.com/?q=${poolMatch.lat},${poolMatch.lng}" target="_blank" rel="noopener" class="location-link">${location}</a>`;
        }
      } else {
        // If we don't have a matching pool, just use the location name
        // Try to build a search query based on the location name
        const searchQuery = encodeURIComponent(`${location} Columbia MD`);
        locationLink = `<a href="https://maps.google.com/?q=${searchQuery}" target="_blank" rel="noopener" class="location-link">${location}</a>`;
      }
      
      // Check if it's a special meet (has name property) or regular meet
      if (meet.name) {
        // Special meet format
        meetClasses += " special-meet";
        meetContent = `
          <div class="${meetClasses}">
            <div class="meet-name">${meet.name}</div>
            <div class="meet-details">
              <span class="meet-location">${locationLink}</span>
              <span class="meet-time">${time}</span>
            </div>
            ${isToday ? '<span class="today-tag">TODAY</span>' : ''}
          </div>
        `;
      } else {
        // Regular meet format
        const homeTeam = meet.home_team || 'TBA';
        const visitingTeam = meet.visiting_team || 'TBA';
        
        meetContent = `
          <div class="${meetClasses}">
            <div class="meet-teams">${visitingTeam} vs. ${homeTeam}</div>
            <div class="meet-details">
              <span class="meet-location">${locationLink}</span>
              <span class="meet-time">${time}</span>
            </div>
            ${isToday ? '<span class="today-tag">TODAY</span>' : ''}
          </div>
        `;
      }
      
      html += meetContent;
    });
    
    html += '</div>';
  });

  // If no meets have valid dates
  if (html === '') {
    html = "<p>No scheduled meets found.</p>";
  }

  list.innerHTML = html;
}

document.addEventListener("DOMContentLoaded", () => {
  // Check if we're on the meets page before fetching data
  if (!document.getElementById("meetList")) {
    console.log("Not on meets page, skipping meet data fetch");
    return;
  }

  // Fetch both meets and pools data
  Promise.all([
    fetch("assets/data/meets.json").then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status} for meets data`);
      return res.json();
    }),
    fetch("assets/data/pools.json").then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status} for pools data`);
      return res.json();
    })
  ])
    .then(([meetsJson, poolsJson]) => {
      console.log("Loaded meet and pool data");
      meetsData = meetsJson;
      poolsData = poolsJson;
      
      // Combine regular meets and special meets
      const allMeets = [
        ...(meetsJson.regular_meets || []), 
        ...(meetsJson.special_meets || [])
      ];
      
      console.log(`Processing ${allMeets.length} meets (${meetsJson.regular_meets?.length || 0} regular, ${meetsJson.special_meets?.length || 0} special)`);
      console.log(`Loaded ${poolsData.length} pools for location mapping`);
      
      renderMeets(allMeets);
    })
    .catch(error => {
      console.error("Failed to load data:", error);
      const list = document.getElementById("meetList");
      if (list) {
        list.innerHTML = "<p>⚠️ Meet data is currently unavailable. Please try again later.</p>";
      }
    });
});
