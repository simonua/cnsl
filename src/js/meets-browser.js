// Global data manager instance for meets browser
let meetsBrowserDataManager = null;
const MeetsBrowserSafety = HtmlSafety;


// ------------------------------
//    INITIALIZATION
// ------------------------------

/**
 * Initialize the meets browser with data manager
 */
async function initializeMeetsBrowser() {
  if (!meetsBrowserDataManager) {
    meetsBrowserDataManager = getDataManager();
    await meetsBrowserDataManager.initialize(['pools', 'teams', 'meets']);
  }
}

/**
 * Update assistive loading feedback for the meet schedule.
 * @param {string} message - Status message to announce
 * @param {boolean} isBusy - Whether the schedule is loading
 */
function setMeetListStatus(message, isBusy) {
  const list = document.getElementById('meetList');
  const status = document.getElementById('meetListStatus');
  if (list) list.setAttribute('aria-busy', String(isBusy));
  if (status) status.textContent = message;
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
  
  // Safety check - ensure meets is an array
  if (!Array.isArray(meets) || meets.length === 0) {
    list.innerHTML = "<p>No meet information available.</p>";
    return;
  }

  const favoriteTeamId = PreferencesService.get().favoriteTeamId;
  const favoriteTeam = PreferencesService.findFavoriteTeam(meetsBrowserDataManager.getTeams().getAllTeams(), favoriteTeamId);
  const formatTeamLabel = (label, className) => {
    const displayLabel = label || (className === 'home-team' ? 'Home Team' : 'Visiting Team');
    const isFavorite = PreferencesService.teamMatchesLabel(favoriteTeam, displayLabel);
    return `<span class="${className}${isFavorite ? ' favorite-team' : ''}">${MeetsBrowserSafety.escapeHtml(displayLabel)}</span>`;
  };

  // Get current date for highlighting upcoming meets - simplified approach
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Normalize to start of day
  
  // Sort meets by date
  const sortedMeets = [...meets].sort((a, b) => {
    const dateA = a.date ? TimeUtils.parseDateOnly(a.date) : new Date(0);
    const dateB = b.date ? TimeUtils.parseDateOnly(b.date) : new Date(0);
    return dateA - dateB;
  });

  // Group meets by date with full date format for better organization
  const meetsByDate = {};
  sortedMeets.forEach(meet => {
    if (!meet.date) return;
    
    const meetDate = TimeUtils.parseDateOnly(meet.date);
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

  Object.keys(meetsByDate).forEach(dateKey => {
    meetsByDate[dateKey] = PreferencesService.sortMeetsWithFavorite(meetsByDate[dateKey], favoriteTeam);
  });

  // Find the next upcoming meet date to expand
  let nextUpcomingDateKey = null;
  const dateKeys = Object.keys(meetsByDate);
  for (const dateKey of dateKeys) {
    const meetDate = TimeUtils.parseDateOnly(meetsByDate[dateKey][0].date);
    if (meetDate >= today) {
      nextUpcomingDateKey = dateKey;
      break;
    }
  }

  // Generate HTML for meets grouped by date
  let html = '';
  
  Object.keys(meetsByDate).forEach((dateKey, dateIndex) => {
    const meetDate = TimeUtils.parseDateOnly(meetsByDate[dateKey][0].date);
    const isUpcoming = meetDate >= today;
    const isToday = meetDate.toDateString() === today.toDateString();
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    const isTomorrow = meetDate.toDateString() === tomorrow.toDateString();
    
    // Determine if this card should be expanded (only the next upcoming meet)
    const shouldExpand = dateKey === nextUpcomingDateKey;
    const collapsedClass = shouldExpand ? '' : 'collapsed';
    const detailsId = `meet-details-${dateIndex}`;
    
    // Determine status for the date group
    let statusClass = 'upcoming';
    
    if (isToday) {
      statusClass = 'today';
    } else if (isTomorrow) {
      statusClass = 'tomorrow';
    } else if (!isUpcoming) {
      statusClass = 'past';
    }

    // Get the meet name from the first meet on this date
    const meetName = MeetsBrowserSafety.escapeHtml(meetsByDate[dateKey][0].name || '');
    const safeDateKey = MeetsBrowserSafety.escapeHtml(dateKey);

    html += `
      <div class="meet-date-card ${collapsedClass}">
        <div class="meet-date-header">
          <div class="date-and-name">
            <h2><button type="button" class="meet-date-header__toggle" aria-expanded="${String(shouldExpand)}" aria-controls="${detailsId}">${safeDateKey}</button></h2>
            ${meetName ? `<span class="meet-name-header">${meetName}</span>` : ''}
          </div>
          <div class="status-container">
            ${isToday ? '<span class="status-text">TODAY</span>' : isTomorrow ? '<span class="status-text">TOMORROW</span>' : ''}
            <span class="visually-hidden">${isToday ? 'Meet is today' : isTomorrow ? 'Meet is tomorrow' : isUpcoming ? 'Upcoming meet' : 'Past meet'}</span>
            <span class="meet-status-indicator ${statusClass}" aria-hidden="true"></span>
          </div>
        </div>
        <div class="meet-date-details" id="${detailsId}"${shouldExpand ? '' : ' hidden'}>
    `;

    meetsByDate[dateKey].forEach(meet => {
      const location = meet.location || 'TBA';
      const time = meet.time || ('8:00 AM - 12:00 PM');
      
      // Generate enhanced location link that links to pools.html page
      let locationLink = MeetsBrowserSafety.escapeHtml(location);
      if (meetsBrowserDataManager && typeof generateEnhancedPoolLink === 'function') {
        try {
          locationLink = generateEnhancedPoolLink(location, meetsBrowserDataManager, {
            preferPoolsPage: true,
            showBothLinks: false
          });
          
          // Add maps link for the maps icon
          if (typeof getPoolDataFromLocation === 'function') {
            const poolData = getPoolDataFromLocation(location, meetsBrowserDataManager);
            const safeMapsUrl = poolData && poolData.location
              ? MeetsBrowserSafety.safeHttpUrl(poolData.location.googleMapsUrl)
              : '';
            if (safeMapsUrl) {
              locationLink += ` <a href="${safeMapsUrl}" target="_blank" rel="noopener" class="maps-icon" aria-label="View ${MeetsBrowserSafety.escapeHtml(location)} on Google Maps">🗺️</a>`;
            }
          }
        } catch (error) {
          console.warn('Error generating pool link for', location, ':', error);
          locationLink = MeetsBrowserSafety.escapeHtml(location); // Fall back to plain text
        }
      }
      
      // Generate weather information for upcoming meets
      let weatherInfo = '';
      if (meet.weather && meet.weather.forecast && isUpcoming) {
        const forecast = meet.weather.forecast;
        weatherInfo = `
          <div class="weather-info">
            <span class="weather-temp">${MeetsBrowserSafety.escapeHtml(forecast.temperature)}°F</span>
            <span class="weather-desc">${MeetsBrowserSafety.escapeHtml(forecast.shortForecast)}</span>
          </div>
        `;
      }

      const isSpecialMeet = meet.isSpecialMeet();
      const isFavoriteMeet = PreferencesService.meetIncludesFavoriteTeam(meet, favoriteTeam);
      
      let meetContent;
      if (isSpecialMeet) {
        meetContent = `
          <div class="meet-details special-meet">
            <div class="meet-info">
              <div class="special-meet-title">
                <strong>${MeetsBrowserSafety.escapeHtml(meet.name || 'Special Meet')}</strong>
              </div>
              <div class="meet-location-time">
                <div class="meet-location-row">
                  <span class="meet-location">${locationLink}</span>
                </div>
                <div class="meet-time-row">
                  <span class="meet-time">${MeetsBrowserSafety.escapeHtml(time)}</span>
                </div>
              </div>
              ${weatherInfo}
            </div>
          </div>
        `;
      } else {
        meetContent = `
          <div class="meet-details${isFavoriteMeet ? ' favorite-meet' : ''}">
            <div class="meet-info">
              ${isFavoriteMeet ? '<span class="favorite-meet__label">Favorite team meet</span>' : ''}
              <div class="meet-teams">
                ${formatTeamLabel(meet.getHomeTeam(), 'home-team')}
                <span class="vs">vs.</span>
                ${formatTeamLabel(meet.getVisitingTeam(), 'visiting-team')}
              </div>
              <div class="meet-location-time">
                <div class="meet-location-row">
                  <span class="meet-location">${locationLink}</span>
                </div>
                <div class="meet-time-row">
                  <span class="meet-time">${MeetsBrowserSafety.escapeHtml(time)}</span>
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

function refreshMeetsForPreferences() {
  if (!meetsBrowserDataManager || !document.getElementById('meetList')) return;
  renderMeets(meetsBrowserDataManager.getMeets().getAllMeets());
}

/**
 * Toggles the collapsed state of a meet date card
 * @param {Element} header - The selected meet date header
 */
function toggleMeetDate(header) {
  const meetCard = header.closest('.meet-date-card');
  const toggleButton = header.querySelector('.meet-date-header__toggle');
  const details = meetCard.querySelector('.meet-date-details');
  const isExpanded = toggleButton.getAttribute('aria-expanded') === 'true';
  meetCard.classList.toggle('collapsed', isExpanded);
  toggleButton.setAttribute('aria-expanded', String(!isExpanded));
  if (details) details.hidden = isExpanded;
}

document.addEventListener("DOMContentLoaded", async () => {
  // Check if we're on the meets page before fetching data
  if (!document.getElementById("meetList")) {
    return;
  }

  const meetList = document.getElementById("meetList");
  meetList.addEventListener('click', event => {
    const cardSurface = event.target.closest('.meet-date-card.collapsed, .meet-date-header');
    if (!cardSurface) return;
    const header = cardSurface.closest('.meet-date-card').querySelector('.meet-date-header');
    toggleMeetDate(header);
  });
  
  try {
    await initializeMeetsBrowser();
    const allMeets = meetsBrowserDataManager.getMeets().getAllMeets();
    
    await renderMeets(allMeets);
    setMeetListStatus(`Meet schedule loaded. ${allMeets.length} meets available.`, false);
    
  } catch (error) {
    console.error("Error loading meets:", error);
    meetList.innerHTML = "<p>⚠️ Meet data is currently unavailable. Please try again later.</p>";
    setMeetListStatus('Meet schedule is currently unavailable. Please try again later.', false);
  }
});

window.addEventListener('cnsl:preferences-changed', refreshMeetsForPreferences);

// ------------------------------
//    WEATHER DISPLAY FUNCTIONS
// ------------------------------

/**
 * Generate weather display HTML for a meet
 * @param {Object} weather - Weather forecast object
 * @returns {string} HTML string for weather display
 */
// eslint-disable-next-line no-unused-vars
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
        <span class="weather-temp">${MeetsBrowserSafety.escapeHtml(temp)}</span>
        <span class="weather-condition">${MeetsBrowserSafety.escapeHtml(condition)}</span>
        ${wind ? `<span class="weather-wind">${MeetsBrowserSafety.escapeHtml(wind)}</span>` : ''}
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
