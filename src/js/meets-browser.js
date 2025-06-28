// Global data manager instance for meets browser
let meetsBrowserDataManager = null;


// ------------------------------
//    INITIALIZATION
// ------------------------------

/**
 * Initialize the meets browser with data manager
 */
async function initializeMeetsBrowser() {
  if (!meetsBrowserDataManager) {
    meetsBrowserDataManager = getDataManager();
    await meetsBrowserDataManager.initialize();
  }
}


// ------------------------------
//    LOCATION SEARCH FUNCTIONS
// ------------------------------

/**
 * Processes location-based search queries for meets
 * @param {string} query - The user's search query
 * @returns {Array} Filtered array of meets based on location
 */
function processLocationSearch(query) {
  if (!meetsBrowserDataManager) {
    console.warn('Data manager not initialized');
    return [];
  }

  const normalizedQuery = query.toLowerCase().trim();
  
  // Check if this is a location-based query
  if (!isLocationQuery(normalizedQuery)) {
    return [];
  }
  
  // Extract location keywords from the query
  const locationKeywords = extractLocationKeywords(normalizedQuery);
  
  // Get all meets from the data manager
  const meetsManager = meetsBrowserDataManager.getMeets();
  const allMeets = meetsManager.getAllMeets();
  
  // Filter meets based on location keywords
  return allMeets.filter(meet => {
    if (!meet.location) return false;
    
    const meetLocation = meet.location.toLowerCase();
    
    // Check if any location keyword matches the meet location
    return locationKeywords.some(keyword => 
      meetLocation.includes(keyword) || 
      keyword.includes(meetLocation.split(' ')[0]) // Match first word of location
    );
  });
}

/**
 * Checks if a query is location-based
 * @param {string} query - The normalized query
 * @returns {boolean} True if the query is asking about location
 */
function isLocationQuery(query) {
  const locationKeywords = [
    'where', 'location', 'address', 'at', 'held at', 'taking place',
    'pool', 'facility', 'venue', 'site'
  ];
  
  return locationKeywords.some(keyword => query.includes(keyword));
}

/**
 * Extracts location keywords from a search query
 * @param {string} query - The normalized query
 * @returns {Array} Array of location keywords to search for
 */
function extractLocationKeywords(query) {
  // Remove common question words and focus on location terms
  const cleanQuery = query
    .replace(/\b(where|is|are|the|a|an|at|in|on|near|location|address|pool|facility|venue|site)\b/g, '')
    .trim();
  
  // Split into individual words and filter out short words
  const words = cleanQuery.split(/\s+/).filter(word => word.length > 2);
  
  // Also check for common pool name patterns from data manager
  let poolNames = [];
  if (meetsBrowserDataManager) {
    const poolsManager = meetsBrowserDataManager.getPools();
    poolNames = poolsManager.getPoolNames().map(name => 
      name.toLowerCase().split(' ')
    ).flat();
  }
  
  // Combine extracted words with known pool names
  return [...words, ...poolNames.filter(name => query.includes(name))];
}

/**
 * Renders location-based search results
 * @param {Array} filteredMeets - Array of meets matching location criteria
 * @param {string} originalQuery - The original search query
 */
function renderLocationSearchResults(filteredMeets, originalQuery) {
  const list = document.getElementById("meetList");
  if (!list) return;
  
  if (filteredMeets.length === 0) {
    list.innerHTML = `
      <div class="search-results">
        <h3>🔍 Location Search Results</h3>
        <p>No meets found matching location: "<strong>${originalQuery}</strong>"</p>
        <div class="search-suggestions">
          <h4>Try searching for:</h4>
          <ul>
            <li>"Where are meets at Kendall Ridge?"</li>
            <li>"Location of Bryant Woods meets"</li>
            <li>"Stevens Forest pool meets"</li>
          </ul>
        </div>
        <button onclick="clearLocationSearch()" class="btn">Show All Meets</button>
      </div>
    `;
    return;
  }
  
  // Use the existing renderMeets function but add search context
  renderMeets(filteredMeets);
  
  // Add search results header
  const searchHeader = `
    <div class="search-results-header">
      <h3>🔍 Location Search Results</h3>
      <p>Found <strong>${filteredMeets.length}</strong> meet(s) matching: "<strong>${originalQuery}</strong>"</p>
      <button onclick="clearLocationSearch()" class="btn">Show All Meets</button>
    </div>
  `;
  
  list.insertAdjacentHTML('afterbegin', searchHeader);
}

/**
 * Clears location search and shows all meets
 */
function clearLocationSearch() {
  if (!meetsBrowserDataManager) {
    console.warn('Data manager not initialized');
    return;
  }

  const meetsManager = meetsBrowserDataManager.getMeets();
  const allMeets = meetsManager.getAllMeets();
  renderMeets(allMeets);
}

/**
 * Handles search input for meets page
 */
function handleMeetsSearch() {
  const searchInput = document.getElementById("meetsSearchInput");
  if (!searchInput || !meetsBrowserDataManager) return;
  
  const query = searchInput.value.trim();
  
  if (!query) {
    clearLocationSearch();
    return;
  }
  
  // Check if it's a location query
  if (isLocationQuery(query.toLowerCase())) {
    const filteredMeets = processLocationSearch(query);
    renderLocationSearchResults(filteredMeets, query);
  } else {
    // Handle other types of searches (team names, dates, etc.) using data manager
    const meetsManager = meetsBrowserDataManager.getMeets();
    const searchResults = meetsManager.searchMeets(query);
    
    renderLocationSearchResults(searchResults, query);
  }
}


// ------------------------------
//    EXISTING FUNCTIONS
// ------------------------------

/**
 * Finds a pool by name or partial name from the data manager
 * @param {string} locationName - The name of the location to search for
 * @returns {Object|null} The pool object if found, null otherwise
 */
function findPoolByLocation(locationName) {
  if (!locationName || !meetsBrowserDataManager) return null;
  
  const poolsManager = meetsBrowserDataManager.getPools();
  const pools = poolsManager.getAllPools();
  
  // Try to find an exact pool name match
  const exactMatch = pools.find(pool => 
    pool.getName().toLowerCase() === locationName.toLowerCase()
  );
  if (exactMatch) return exactMatch.toJSON();
  
  // Try to find a pool where the name is included in the location string
  const partialMatch = pools.find(pool => 
    locationName.toLowerCase().includes(pool.getName().toLowerCase())
  );
  if (partialMatch) return partialMatch.toJSON();

  // Try with just the first part of location name (before "Pool" or "Common")
  const simplifiedName = locationName.split(" Pool")[0].split(" Common")[0];
  const simplifiedMatch = pools.find(pool => 
    pool.getName().toLowerCase().includes(simplifiedName.toLowerCase())
  );
  
  return simplifiedMatch ? simplifiedMatch.toJSON() : null;
}

/**
 * Renders the list of meets in the #meetList element
 * @param {Array} meets - Array of meet objects
 */
async function renderMeets(meets) {
  const list = document.getElementById("meetList");
  if (!list) return;
  
  // Safety check - ensure meets is an array
  if (!Array.isArray(meets) || meets.length === 0) {
    list.innerHTML = "<p>No meet information available.</p>";
    return;
  }

  // Get weather forecasts for upcoming meets if data manager is available
  let meetsWithWeather = meets;
  if (meetsBrowserDataManager && typeof WeatherService !== 'undefined') {
    try {
      WeatherService.initialize();
      const poolsManager = meetsBrowserDataManager.getPools();
      meetsWithWeather = await WeatherService.getForecastsForUpcomingMeets(meets, poolsManager);
    } catch (error) {
      console.warn('Weather service unavailable:', error);
      meetsWithWeather = meets;
    }
  }

  // Get current date for highlighting upcoming meets (using Eastern Time)
  const now = new Date();
  // Get Eastern Time properly
  const easternTimeString = now.toLocaleDateString("en-US", {timeZone: "America/New_York"});
  const easternTimeDate = new Date(easternTimeString);
  const today = new Date(easternTimeDate.getFullYear(), easternTimeDate.getMonth(), easternTimeDate.getDate());
  
  console.log('🗓️ Date debugging:', {
    localTime: now.toLocaleString(),
    easternTimeString,
    easternTimeDate: easternTimeDate.toDateString(),
    today: today.toDateString()
  });
  
  // Sort meets by date
  const sortedMeets = [...meetsWithWeather].sort((a, b) => {
    // Assume meet.date is a string in a format that can be converted to Date
    const dateA = a.date ? new Date(a.date + 'T12:00:00') : new Date(0);
    const dateB = b.date ? new Date(b.date + 'T12:00:00') : new Date(0);
    return dateA - dateB;
  });

  // Group meets by month/date
  const meetsByDate = {};
  sortedMeets.forEach(meet => {
    if (!meet.date) return;
    
    const meetDate = new Date(meet.date + 'T12:00:00');
    const dateKey = meetDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
    
    if (!meetsByDate[dateKey]) {
      meetsByDate[dateKey] = [];
    }
    meetsByDate[dateKey].push(meet);
  });

  // Generate HTML for meets grouped by date
  let html = '';
  
  Object.keys(meetsByDate).forEach(dateKey => {
    const meetDate = new Date(meetsByDate[dateKey][0].date + 'T12:00:00');
    const isUpcoming = meetDate >= today;
    const isToday = meetDate.toDateString() === today.toDateString();
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    const isTomorrow = meetDate.toDateString() === tomorrow.toDateString();
    
    console.log('📅 Date comparison for', dateKey, {
      meetDate: meetDate.toDateString(),
      today: today.toDateString(),
      tomorrow: tomorrow.toDateString(),
      isToday,
      isTomorrow
    });
    
    // Determine status for the date group
    let statusClass = 'upcoming';
    let statusText = 'Upcoming';
    
    if (isToday) {
      statusClass = 'today';
      statusText = 'Today';
    } else if (isTomorrow) {
      statusClass = 'tomorrow';
      statusText = 'Tomorrow';
    } else if (!isUpcoming) {
      statusClass = 'past';
      statusText = 'Past';
    }
    
    // Get the meet name from the first meet on this date
    const meetName = meetsByDate[dateKey][0].name || '';
    
    html += `
      <div class="meet-date-card collapsed">
        <div class="meet-date-header" onclick="toggleMeetDate(this)">
          <div class="date-and-name">
            <h3>${dateKey}</h3>
            ${meetName ? `<span class="meet-name-header">${meetName}</span>` : ''}
          </div>
          <span class="meet-status-indicator ${statusClass}"></span>
        </div>
        <div class="meet-date-details">
    `;
    
    meetsByDate[dateKey].forEach(meet => {
      const location = meet.location || 'TBA';
      // Use standard meet time of 8:00-noon for regular meets
      const time = meet.time || ('8:00 AM - 12:00 PM');
      let meetContent = '';
      
      // Check if meet is today, tomorrow, or upcoming (using Eastern Time)
      const meetDate = new Date(meet.date + 'T12:00:00');
      const isToday = meetDate.toDateString() === today.toDateString();
      const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
      const isTomorrow = meetDate.toDateString() === tomorrow.toDateString();
      const isUpcoming = meetDate >= today;
      
      console.log('🎯 Individual meet check for', meet.date, {
        meetDate: meetDate.toDateString(),
        today: today.toDateString(),
        tomorrow: tomorrow.toDateString(),
        isToday,
        isTomorrow,
        isUpcoming
      });
      
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
      
      // Generate weather information for upcoming meets
      let weatherInfo = '';
      if (meet.weather && isUpcoming) {
        weatherInfo = generateWeatherDisplay(meet.weather);
      }
      
      // Generate location link for Google Maps
      let locationLink = '';
      if (poolMatch) {
        let mapsUrl;
        
        // Use googleMapsUrl if available in new location format
        if (poolMatch.location && poolMatch.location.googleMapsUrl) {
          mapsUrl = poolMatch.location.googleMapsUrl;
        } else if (poolMatch.address) {
          // Legacy format fallback
          const encodedAddress = encodeURIComponent(poolMatch.address);
          mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
        } else if (poolMatch.location && poolMatch.location.mapsQuery) {
          // New format fallback using mapsQuery
          const encodedQuery = encodeURIComponent(poolMatch.location.mapsQuery);
          mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodedQuery}`;
        } else if (poolMatch.lat && poolMatch.lng) {
          // Coordinate fallback
          mapsUrl = `https://www.google.com/maps/search/?api=1&query=${poolMatch.lat},${poolMatch.lng}`;
        }
        
        if (mapsUrl) {
          locationLink = `<a href="${mapsUrl}" target="_blank" rel="noopener" class="location-link">${location}</a>`;
        }
      }
      
      if (!locationLink) {
        // If we don't have a matching pool, just use the location name
        const searchQuery = encodeURIComponent(`${location} Columbia MD`);
        locationLink = `<a href="https://www.google.com/maps/search/?api=1&query=${searchQuery}" target="_blank" rel="noopener" class="location-link">${location}</a>`;
      }
      
      // Check if it's a special meet (has name property) or regular meet
      if (meet.name && !meet.home_team && !meet.visiting_team) {
        // Special meet format (only special meets without teams)
        meetClasses += " special-meet";
        meetContent = `
          <div class="${meetClasses}">
            <div class="meet-name">${meet.name}</div>
            <div class="meet-details">
              <span class="meet-location">${locationLink}</span>
              <span class="meet-time">${time}</span>
            </div>
            ${weatherInfo}
            ${isToday ? '<span class="today-tag">TODAY</span>' : isTomorrow ? '<span class="tomorrow-tag">TOMORROW</span>' : ''}
          </div>
        `;
      } else {
        // Regular meet format (show teams)
        const homeTeam = meet.home_team || 'TBA';
        const visitingTeam = meet.visiting_team || 'TBA';
        
        meetContent = `
          <div class="${meetClasses}">
            <div class="meet-teams">${homeTeam} vs. ${visitingTeam}</div>
            <div class="meet-details">
              <span class="meet-location">${locationLink}</span>
              <span class="meet-time">${time}</span>
            </div>
            ${weatherInfo}
            ${isToday ? '<span class="today-tag">TODAY</span>' : isTomorrow ? '<span class="tomorrow-tag">TOMORROW</span>' : ''}
          </div>
        `;
      }
      
      html += meetContent;
    });
    
    html += `
        </div>
      </div>
    `;
  });

  // If no meets have valid dates
  if (html === '') {
    html = "<p>No scheduled meets found.</p>";
  }

  list.innerHTML = html;
}

/**
 * Toggles the collapsed state of a meet date card
 * @param {Element} headerElement - The clicked header element
 */
function toggleMeetDate(headerElement) {
  const meetCard = headerElement.closest('.meet-date-card');
  meetCard.classList.toggle('collapsed');
}

document.addEventListener("DOMContentLoaded", async () => {
  // Check if we're on the meets page before fetching data
  if (!document.getElementById("meetList")) {
    console.log("Not on meets page, skipping meet data fetch");
    return;
  }

  try {
    // Initialize the data manager with the new OOP system
    await initializeMeetsBrowser();
    
    // Get meets from the data manager
    const meetsManager = meetsBrowserDataManager.getMeets();
    const allMeets = meetsManager.getAllMeets();
    
    console.log(`Processing ${allMeets.length} meets from DataManager`);
    
    renderMeets(allMeets);
    
  } catch (error) {
    console.error("Failed to load data:", error);
    const list = document.getElementById("meetList");
    if (list) {
      list.innerHTML = "<p>⚠️ Meet data is currently unavailable. Please try again later.</p>";
    }
  }
});

// ------------------------------
//    WEATHER DISPLAY FUNCTIONS
// ------------------------------

/**
 * Generate weather display HTML for a meet
 * @param {Object} weather - Weather forecast object
 * @returns {string} HTML string for weather display
 */
function generateWeatherDisplay(weather) {
  if (!weather) return '';
  
  try {
    const temp = weather.temperature ? `${weather.temperature}°${weather.temperatureUnit || 'F'}` : '';
    const condition = weather.shortForecast || '';
    const wind = weather.windSpeed || '';
    
    // Get weather icon or emoji based on conditions
    const weatherIcon = getWeatherIcon(condition);
    
    return `
      <div class="weather-info">
        <span class="weather-icon">${weatherIcon}</span>
        <span class="weather-temp">${temp}</span>
        <span class="weather-condition">${condition}</span>
        ${wind ? `<span class="weather-wind">${wind}</span>` : ''}
      </div>
    `;
  } catch (error) {
    console.warn('Error generating weather display:', error);
    return '';
  }
}

/**
 * Get weather icon/emoji based on forecast conditions
 * @param {string} condition - Weather condition description
 * @returns {string} Weather icon or emoji
 */
function getWeatherIcon(condition) {
  if (!condition) return '🌤️';
  
  const lowerCondition = condition.toLowerCase();
  
  if (lowerCondition.includes('sunny') || lowerCondition.includes('clear')) {
    return '☀️';
  } else if (lowerCondition.includes('partly cloudy') || lowerCondition.includes('partly sunny')) {
    return '⛅';
  } else if (lowerCondition.includes('cloudy') || lowerCondition.includes('overcast')) {
    return '☁️';
  } else if (lowerCondition.includes('rain') || lowerCondition.includes('showers')) {
    return '🌧️';
  } else if (lowerCondition.includes('thunderstorm') || lowerCondition.includes('storm')) {
    return '⛈️';
  } else if (lowerCondition.includes('snow')) {
    return '❄️';
  } else if (lowerCondition.includes('fog') || lowerCondition.includes('mist')) {
    return '🌫️';
  } else {
    return '🌤️';
  }
}
