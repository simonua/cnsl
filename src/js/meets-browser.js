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
//    EXISTING FUNCTIONS (Updated to use pool link helper)
// ------------------------------

/**
 * Renders the list of meets in the #meetList element
 * @param {Array} meets - Array of meet objects
 */
async function renderMeets(meets) {
  const list = document.getElementById("meetList");
  if (!list) return;
  
  // Debug: Show what we received
  console.log("renderMeets called with:", meets);
  console.log("Array?", Array.isArray(meets));
  console.log("Length:", meets?.length);
  
  // Safety check - ensure meets is an array
  if (!Array.isArray(meets) || meets.length === 0) {
    console.log("No meets to render, showing fallback");
    list.innerHTML = "<p>No meet information available.</p>";
    return;
  }

  // Get weather forecasts for upcoming meets if data manager is available
  let meetsWithWeather = meets;
  if (meetsBrowserDataManager && typeof WeatherService !== 'undefined') {
    try {
      console.log('🌦️ Weather service available, initializing...');
      WeatherService.initialize();
      const poolsManager = meetsBrowserDataManager.getPools();
      console.log('🌦️ Getting weather forecasts for', meets.length, 'meets');
      meetsWithWeather = await WeatherService.getForecastsForUpcomingMeets(meets, poolsManager);
      console.log('🌦️ Weather forecasts retrieved for', meetsWithWeather.filter(m => m.weather).length, 'meets');
    } catch (error) {
      console.warn('Weather service unavailable:', error);
      meetsWithWeather = meets;
    }
  } else {
    console.log('🌦️ Weather service not available or data manager not ready');
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
      
      // Generate enhanced location link that links to pools.html page
      const poolsPageLink = generateEnhancedPoolLink(location, meetsBrowserDataManager, {
        preferPoolsPage: true,
        showBothLinks: false
      });
      
      // Also get maps link for the maps icon
      const poolData = getPoolDataFromLocation(location, meetsBrowserDataManager);
      let mapsIcon = '';
      if (poolData && poolData.location && poolData.location.googleMapsUrl) {
        mapsIcon = ` <a href="${poolData.location.googleMapsUrl}" target="_blank" rel="noopener" class="maps-icon" title="View on Google Maps">🗺️</a>`;
      }
      
      const locationLink = poolsPageLink + mapsIcon;
      
      // Generate weather information for upcoming meets
      let weatherInfo = '';
      if (meet.weather && isUpcoming) {
        weatherInfo = generateWeatherDisplay(meet.weather);
      }
      
      // Check if this is a meet involving Long Reach Marlins that has occurred or is happening today
      const isLongReachMeet = (meet.visiting_team && meet.visiting_team.includes('Long Reach')) || 
                              (meet.home_team && meet.home_team.includes('Long Reach'));
      // Compare dates only, not times - meets on today's date should show results
      const meetDateOnly = new Date(meetDate.getFullYear(), meetDate.getMonth(), meetDate.getDate());
      const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const isTodayOrPast = meetDateOnly <= todayOnly;
      const showResultsLink = isLongReachMeet && isTodayOrPast;
      
      // Check if it's a special meet (has name property) or regular meet
      if (meet.name && !meet.home_team && !meet.visiting_team) {
        // Special meet format (only special meets without teams)
        meetClasses += " special-meet";
        meetContent = `
          <div class="${meetClasses}">
            <div class="meet-name">${meet.name}</div>
            <div class="meet-details">
              <div class="meet-location-row">
                <span class="meet-location">${locationLink}</span>
                ${showResultsLink ? '<a href="https://meetresults.longreachmarlins.org" target="_blank" rel="noopener" class="results-link" title="View Meet Results">🏆</a>' : ''}
              </div>
              <div class="meet-time-row">
                <span class="meet-time">${time}</span>
              </div>
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
              <div class="meet-location-row">
                <span class="meet-location">${locationLink}</span>
                ${showResultsLink ? '<a href="https://meetresults.longreachmarlins.org" target="_blank" rel="noopener" class="results-link" title="View Meet Results">🏆</a>' : ''}
              </div>
              <div class="meet-time-row">
                <span class="meet-time">${time}</span>
              </div>
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
  if (typeof WeatherService !== 'undefined') {
    try {
      console.log('🌦️ Weather service available, initializing...');
      WeatherService.initialize();
      console.log('🌦️ Getting weather forecasts for', meets.length, 'meets');
      // For now, skip weather integration to keep it simple
      // meetsWithWeather = await WeatherService.getForecastsForUpcomingMeets(meets, poolsManager);
    } catch (error) {
      console.warn('Weather service unavailable:', error);
      meetsWithWeather = meets;
    }
  }

  // Get current date for highlighting upcoming meets (using Eastern Time)
  const now = new Date();
  const easternTimeString = now.toLocaleDateString("en-US", {timeZone: "America/New_York"});
  const easternTimeDate = new Date(easternTimeString);
  const today = new Date(easternTimeDate.getFullYear(), easternTimeDate.getMonth(), easternTimeDate.getDate());
  
  // Sort meets by date
  const sortedMeets = [...meetsWithWeather].sort((a, b) => {
    const dateA = a.date ? new Date(a.date + 'T12:00:00') : new Date(0);
    const dateB = b.date ? new Date(b.date + 'T12:00:00') : new Date(0);
    return dateA - dateB;
  });

  // Group meets by month/date
  const meetsByDate = {};
  sortedMeets.forEach(meet => {
    if (!meet.date) return;
    
    const meetDate = new Date(meet.date + 'T12:00:00');
    // Use full date format to avoid conflicts and better sorting
    const dateKey = meetDate.toLocaleDateString('en-US', { 
      weekday: 'long',
      month: 'long', 
      day: 'numeric',
      year: 'numeric'
    });
    
    if (!meetsByDate[dateKey]) {
      meetsByDate[dateKey] = [];
    }
    meetsByDate[dateKey].push(meet);
  });

  console.log('📅 Total meets to process:', sortedMeets.length);
  console.log('📅 Grouped meets by date:', Object.keys(meetsByDate));

  // Find the next upcoming meet date to expand
  let nextUpcomingDateKey = null;
  const dateKeys = Object.keys(meetsByDate);
  for (const dateKey of dateKeys) {
    const meetDate = new Date(meetsByDate[dateKey][0].date + 'T12:00:00');
    if (meetDate >= today) {
      nextUpcomingDateKey = dateKey;
      break;
    }
  }

  // Generate HTML for meets grouped by date
  let html = '';
  
  Object.keys(meetsByDate).forEach(dateKey => {
    const meetDate = new Date(meetsByDate[dateKey][0].date + 'T12:00:00');
    const isUpcoming = meetDate >= today;
    const isToday = meetDate.toDateString() === today.toDateString();
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    const isTomorrow = meetDate.toDateString() === tomorrow.toDateString();
    
    // Determine if this card should be expanded (only the next upcoming meet)
    const shouldExpand = dateKey === nextUpcomingDateKey;
    const collapsedClass = shouldExpand ? '' : 'collapsed';
    
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
      <div class="meet-date-card ${collapsedClass}">
        <div class="meet-date-header" onclick="toggleMeetDate(this)">
          <div class="date-and-name">
            <h3>${dateKey}</h3>
            ${meetName ? `<span class="meet-name-header">${meetName}</span>` : ''}
          </div>
          <div class="status-container">
            ${isToday ? '<span class="status-text">TODAY</span>' : isTomorrow ? '<span class="status-text">TOMORROW</span>' : ''}
            <span class="meet-status-indicator ${statusClass}"></span>
          </div>
        </div>
        <div class="meet-date-details">
    `;

    meetsByDate[dateKey].forEach(meet => {
      const location = meet.location || 'TBA';
      const time = meet.time || ('8:00 AM - 12:00 PM');
      let meetContent = '';
      
      // Check if meet is today, tomorrow, or upcoming (using Eastern Time)
      const meetDate = new Date(meet.date + 'T12:00:00');
      const isToday = meetDate.toDateString() === today.toDateString();
      const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
      const isTomorrow = meetDate.toDateString() === tomorrow.toDateString();
      const isUpcoming = meetDate >= today;

      let weatherInfo = '';
      if (meet.weather && meet.weather.forecast) {
        const forecast = meet.weather.forecast;
        weatherInfo = `
          <div class="weather-info">
            <span class="weather-temp">${forecast.temperature}°F</span>
            <span class="weather-desc">${forecast.shortForecast}</span>
          </div>
        `;
      }

      // Handle special meets (Time Trials, Championships) differently
      const isSpecialMeet = !meet.visiting_team && !meet.home_team && !meet.awayTeam && !meet.homeTeam;
      
      // Check if this is a meet involving Long Reach Marlins that has occurred or is happening today
      const isLongReachMeet = (meet.visiting_team && meet.visiting_team.includes('Long Reach')) || 
                              (meet.home_team && meet.home_team.includes('Long Reach'));
      // Compare dates only, not times - meets on today's date should show results
      const meetDateOnly = new Date(meetDate.getFullYear(), meetDate.getMonth(), meetDate.getDate());
      const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const isTodayOrPast = meetDateOnly <= todayOnly;
      const showResultsLink = isLongReachMeet && isTodayOrPast;
      
      if (isSpecialMeet) {
        meetContent = `
          <div class="meet-details special-meet">
            <div class="meet-info">
              <div class="special-meet-title">
                <strong>${meet.name || 'Special Meet'}</strong>
              </div>
              <div class="meet-location-time">
                <div class="meet-location-row">
                  <span class="meet-location">${location}</span>
                  ${showResultsLink ? '<a href="https://meetresults.longreachmarlins.org" target="_blank" rel="noopener" class="results-link" title="View Meet Results">🏆</a>' : ''}
                </div>
                <div class="meet-time-row">
                  <span class="meet-time">${time}</span>
                </div>
              </div>
              ${weatherInfo}
            </div>
          </div>
        `;
      } else {
        meetContent = `
          <div class="meet-details">
            <div class="meet-info">
              <div class="meet-teams">
                <span class="home-team">${meet.home_team || meet.homeTeam || 'Home Team'}</span>
                <span class="vs">vs.</span>
                <span class="visiting-team">${meet.visiting_team || meet.awayTeam || 'Visiting Team'}</span>
              </div>
              <div class="meet-location-time">
                <div class="meet-location-row">
                  <span class="meet-location">${location}</span>
                  ${showResultsLink ? '<a href="https://meetresults.longreachmarlins.org" target="_blank" rel="noopener" class="results-link" title="View Meet Results">🏆</a>' : ''}
                </div>
                <div class="meet-time-row">
                  <span class="meet-time">${time}</span>
                </div>
              </div>
              ${weatherInfo}
            </div>
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

  const meetList = document.getElementById("meetList");
  
  try {
    console.log("Loading meets data...");
    
    // Load meets data directly - simple approach that works
    const response = await fetch('assets/data/meets.json');
    const data = await response.json();
    
    let allMeets = [];
    if (data.regular_meets) {
      allMeets = [...data.regular_meets];
    }
    if (data.special_meets) {
      allMeets = [...allMeets, ...data.special_meets];
    }
    
    console.log(`Found ${allMeets.length} meets`);
    
    // Use the original sophisticated rendering
    await renderMeets(allMeets);
    
  } catch (error) {
    console.error("Error loading meets:", error);
    meetList.innerHTML = "<p>⚠️ Meet data is currently unavailable. Please try again later.</p>";
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
