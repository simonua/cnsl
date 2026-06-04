// Global data manager instance for meets browser
let meetsBrowserDataManager = null;
let meetsPoolLocationIndex = new Map();
let meetsBrowserMeets = [];
let meetLiveStatusRefreshTimeout = null;
let meetLiveStatusSignature = '';
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
    meetsPoolLocationIndex = globalThis.createPoolLocationIndex(meetsBrowserDataManager.getPools().getAllPools());
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

/**
 * Select the next scheduled event for Upcoming, using Ongoing for a meet with a published timing window.
 * @param {Array} meets - Meet models available to the page
 * @returns {{ date: string, kind: string, label: string }|null} Highlighted meet status
 */
function getMeetLiveStatusTarget(meets) {
  const easternTimeInfo = TimeUtils.getCurrentEasternTimeInfo();
  if (!easternTimeInfo.isValid) return null;

  const orderedMeets = [...meets].sort((first, second) => first.date.localeCompare(second.date));
  const ongoingMeet = orderedMeets.find(meet => meet.getLiveStatus(easternTimeInfo) === 'ongoing');
  if (ongoingMeet) return { date: ongoingMeet.date, kind: 'ongoing', label: 'Ongoing' };

  if (orderedMeets.some(meet => meet.date === easternTimeInfo.date && meet.getLiveStatus(easternTimeInfo) === null)) return null;

  const upcomingMeet = orderedMeets.find(meet => meet.getLiveStatus(easternTimeInfo) === 'upcoming'
    || (meet.getLiveStatus(easternTimeInfo) === null && meet.date > easternTimeInfo.date));
  return upcomingMeet ? { date: upcomingMeet.date, kind: 'upcoming', label: 'Upcoming' } : null;
}

/**
 * Capture the live badge state to avoid replacing the meet list unnecessarily each minute.
 * @param {Array} meets - Meet models available to the page
 * @returns {string} Compact live timing signature
 */
function getMeetLiveStatusSignature(meets) {
  const target = getMeetLiveStatusTarget(meets);
  return target ? `${target.date}:${target.kind}` : '';
}

// ------------------------------
//    EXISTING FUNCTIONS (Updated to use pool link helper)
// ------------------------------

/**
 * Renders the list of meets in the #meetList element
 * @param {Array} meets - Array of meet objects
 */
async function renderMeets(meets, preserveExpansion = false) {
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
  const expandedDateValues = preserveExpansion
    ? new Set(Array.from(list.querySelectorAll('.meet-date-card')).filter(card => (
      card.querySelector('.meet-date-header__toggle')?.getAttribute('aria-expanded') === 'true'
    )).map(card => card.dataset.meetDate))
    : null;
  const liveStatusTarget = getMeetLiveStatusTarget(meets);
  meetLiveStatusSignature = getMeetLiveStatusSignature(meets);

  const easternTimeInfo = TimeUtils.getCurrentEasternTimeInfo();
  const today = easternTimeInfo.isValid ? TimeUtils.parseDateOnly(easternTimeInfo.date) : new Date();
  today.setHours(0, 0, 0, 0);
  
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
    const meetDateValue = meetsByDate[dateKey][0].date;
    const isUpcoming = meetDate >= today;
    const isToday = meetDate.toDateString() === today.toDateString();
    const relativeDayOffset = TimeUtils.getRelativeFutureDayOffset(meetDate, today);
    const relativeDay = TimeUtils.formatRelativeFutureDay(meetDate, today);
    
    // Determine if this card should be expanded (only the next upcoming meet)
    const shouldExpand = expandedDateValues ? expandedDateValues.has(meetDateValue) : dateKey === nextUpcomingDateKey;
    const collapsedClass = shouldExpand ? '' : 'collapsed';
    const detailsId = `meet-details-${dateIndex}`;
    
    // Get the meet name from the first meet on this date
    const meetName = MeetsBrowserSafety.escapeHtml(meetsByDate[dateKey][0].name || '');
    const safeDateKey = MeetsBrowserSafety.escapeHtml(dateKey);
    const safeMeetDateValue = MeetsBrowserSafety.escapeHtml(meetDateValue);
    const liveStatusBadge = liveStatusTarget && liveStatusTarget.date === meetDateValue
      ? `<span class="meet-live-badge meet-live-badge--${liveStatusTarget.kind}">${liveStatusTarget.label}</span>`
      : '';
    const relativeDayBadge = relativeDay
      ? `<span class="meet-date-header__relative upcoming-day-pill${relativeDayOffset === 0 ? ' upcoming-day-pill--today' : relativeDayOffset === 1 ? ' upcoming-day-pill--tomorrow' : ''}">${MeetsBrowserSafety.escapeHtml(relativeDay)}</span>`
      : '';

    html += `
      <div class="meet-date-card ${collapsedClass}" data-meet-card data-meet-date="${safeMeetDateValue}" data-analytics-context="meet_details">
        <div class="meet-date-header" data-meet-card-header>
          <div class="date-and-name">
            <h2><button type="button" class="meet-date-header__toggle" data-meet-card-action="toggle" aria-expanded="${String(shouldExpand)}" aria-controls="${detailsId}">${safeDateKey}</button></h2>
            ${meetName ? `<span class="meet-name-header">${meetName}</span>` : ''}
          </div>
          <div class="status-container">
            ${liveStatusBadge}
            ${relativeDayBadge}
            <span class="visually-hidden">${isToday ? 'Meet is today' : isUpcoming ? 'Upcoming meet' : 'Past meet'}</span>
          </div>
        </div>
        <div class="meet-date-details" id="${detailsId}"${shouldExpand ? '' : ' hidden'}>
    `;

    meetsByDate[dateKey].forEach(meet => {
      const location = meet.location || 'TBA';
      const time = meet.getDisplayTime();
      let poolData = null;
      
      // Generate enhanced location link that links to pools.html page
      let locationLink = MeetsBrowserSafety.escapeHtml(location);
      let courseLabel = '';
      if (meetsBrowserDataManager && typeof generateEnhancedPoolLink === 'function') {
        try {
          locationLink = generateEnhancedPoolLink(location, meetsBrowserDataManager, {
            preferPoolsPage: true,
            showBothLinks: false
          }, meetsPoolLocationIndex);
          
          // Add maps link for the maps icon
          if (typeof getPoolDataFromLocation === 'function') {
            poolData = getPoolDataFromLocation(location, meetsBrowserDataManager, meetsPoolLocationIndex);
            courseLabel = formatPoolCourseLabel(poolData);
            const safeMapsUrl = poolData && poolData.location
              ? MeetsBrowserSafety.safeHttpUrl(poolData.location.googleMapsUrl)
              : '';
            if (safeMapsUrl) {
              locationLink += ` <a href="${safeMapsUrl}" target="_blank" rel="noopener" class="maps-icon" aria-label="View ${MeetsBrowserSafety.escapeHtml(location)} on Google Maps">${IconCatalog.render('map')}</a>`;
            }
          }
        } catch (error) {
          console.warn('Error generating pool link for', location, ':', error);
          locationLink = MeetsBrowserSafety.escapeHtml(location); // Fall back to plain text
        }
      }
      const courseInfo = courseLabel
        ? `<span class="meet-course">${MeetsBrowserSafety.escapeHtml(courseLabel)}</span>`
        : '';
      
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
      const safeMeetPoolId = poolData && /^[a-zA-Z0-9_-]+$/.test(poolData.id || '')
        ? MeetsBrowserSafety.escapeHtml(poolData.id)
        : '';
      const meetPoolAttribute = safeMeetPoolId ? ` data-meet-pool-id="${safeMeetPoolId}"` : '';
      
      let meetContent;
      if (isSpecialMeet) {
        meetContent = `
          <div class="meet-details special-meet"${meetPoolAttribute}>
            <div class="meet-info">
              <div class="special-meet-title">
                <strong>${MeetsBrowserSafety.escapeHtml(meet.name || 'Special Meet')}</strong>
              </div>
              <div class="meet-location-time">
                <div class="meet-location-row">
                  <span class="meet-location">${locationLink}</span>
                  ${courseInfo}
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
          <div class="meet-details${isFavoriteMeet ? ' favorite-meet' : ''}"${meetPoolAttribute}>
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
                  ${courseInfo}
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
  renderMeets(meetsBrowserMeets, true);
}

/**
 * Refresh badge state when the next event or a timed meet status changes.
 */
function refreshMeetsForCurrentTime() {
  if (meetsBrowserMeets.length === 0) return;
  const nextSignature = getMeetLiveStatusSignature(meetsBrowserMeets);
  if (nextSignature === meetLiveStatusSignature) return;

  const focusedToggle = document.activeElement instanceof Element && document.activeElement.matches('.meet-date-header__toggle')
    ? document.activeElement.closest('.meet-date-card')?.dataset.meetDate
    : null;
  renderMeets(meetsBrowserMeets, true);
  if (focusedToggle) {
    const focusedCard = Array.from(document.querySelectorAll('.meet-date-card'))
      .find(card => card.dataset.meetDate === focusedToggle);
    focusedCard?.querySelector('.meet-date-header__toggle')?.focus();
  }
  setMeetListStatus('Meet status updated for the current date and time.', false);
}

/**
 * Check promptly after minute boundaries for an Upcoming/Ongoing transition.
 */
function scheduleNextMeetLiveStatusRefresh() {
  if (meetLiveStatusRefreshTimeout !== null) window.clearTimeout(meetLiveStatusRefreshTimeout);
  const now = new Date();
  const millisecondsIntoMinute = (now.getSeconds() * 1000) + now.getMilliseconds();
  const delayMilliseconds = (60 * 1000) - millisecondsIntoMinute + 25;
  meetLiveStatusRefreshTimeout = window.setTimeout(() => {
    refreshMeetsForCurrentTime();
    scheduleNextMeetLiveStatusRefresh();
  }, delayMilliseconds);
}

function handleMeetPageVisibilityChange() {
  if (document.hidden) {
    if (meetLiveStatusRefreshTimeout !== null) window.clearTimeout(meetLiveStatusRefreshTimeout);
    meetLiveStatusRefreshTimeout = null;
    return;
  }
  refreshMeetsForCurrentTime();
  scheduleNextMeetLiveStatusRefresh();
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

function handleMeetUrlParameters() {
  const urlParams = new URLSearchParams(window.location.search);
  const meetDate = urlParams.get('date');
  const poolId = urlParams.get('pool');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(meetDate || '') || !/^[a-zA-Z0-9_-]+$/.test(poolId || '')) return;

  const meetCard = Array.from(document.querySelectorAll('.meet-date-card'))
    .find(card => card.dataset.meetDate === meetDate);
  const linkedMeet = meetCard && Array.from(meetCard.querySelectorAll('.meet-details'))
    .find(meet => meet.dataset.meetPoolId === poolId);
  if (!meetCard || !linkedMeet) return;

  meetCard.classList.remove('collapsed');
  const toggleButton = meetCard.querySelector('.meet-date-header__toggle');
  const details = meetCard.querySelector('.meet-date-details');
  if (toggleButton) toggleButton.setAttribute('aria-expanded', 'true');
  if (details) details.hidden = false;

  linkedMeet.classList.add('highlighted');
  linkedMeet.scrollIntoView({
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    block: 'center'
  });
  setTimeout(() => linkedMeet.classList.remove('highlighted'), 3000);
}

document.addEventListener("DOMContentLoaded", async () => {
  // Check if we're on the meets page before fetching data
  if (!document.getElementById("meetList")) {
    return;
  }

  const meetList = document.getElementById("meetList");
  meetList.addEventListener('click', event => {
    const meetCard = event.target.closest('[data-meet-card]');
    const toggleButton = meetCard && meetCard.querySelector('[data-meet-card-action="toggle"]');
    const header = meetCard && meetCard.querySelector('[data-meet-card-header]');
    if (header && toggleButton && (toggleButton.getAttribute('aria-expanded') !== 'true' || event.target.closest('[data-meet-card-header]'))) toggleMeetDate(header);
  });
  
  try {
    await initializeMeetsBrowser();
    const allMeets = meetsBrowserDataManager.getMeets().getAllMeets();
    meetsBrowserMeets = allMeets;
    await renderMeets(allMeets);
    handleMeetUrlParameters();
    scheduleNextMeetLiveStatusRefresh();
    setMeetListStatus(`Meet schedule loaded. ${allMeets.length} meets available.`, false);
    
  } catch (error) {
    console.error("Error loading meets:", error);
    meetList.innerHTML = `<p>${IconCatalog.getTextGlyph('warning')} Meet data is currently unavailable. Please try again later.</p>`;
    setMeetListStatus('Meet schedule is currently unavailable. Please try again later.', false);
  }
});

window.addEventListener('cnsl:preferences-changed', refreshMeetsForPreferences);
document.addEventListener('visibilitychange', handleMeetPageVisibilityChange);

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
  if (!condition) return IconCatalog.getTextGlyph('weatherUnknown');
  
  const lowerCondition = condition.toLowerCase();
  
  if (lowerCondition.includes('sunny') || lowerCondition.includes('clear')) {
    return IconCatalog.getTextGlyph('weatherClear');
  } else if (lowerCondition.includes('partly cloudy') || lowerCondition.includes('partly sunny')) {
    return IconCatalog.getTextGlyph('weatherPartlyCloudy');
  } else if (lowerCondition.includes('cloudy') || lowerCondition.includes('overcast')) {
    return IconCatalog.getTextGlyph('weatherCloudy');
  } else if (lowerCondition.includes('rain') || lowerCondition.includes('showers')) {
    return IconCatalog.getTextGlyph('weatherRain');
  } else if (lowerCondition.includes('thunderstorm') || lowerCondition.includes('storm')) {
    return IconCatalog.getTextGlyph('weatherStorm');
  } else if (lowerCondition.includes('snow')) {
    return IconCatalog.getTextGlyph('weatherSnow');
  } else if (lowerCondition.includes('fog') || lowerCondition.includes('mist')) {
    return IconCatalog.getTextGlyph('weatherFog');
  } else {
    return IconCatalog.getTextGlyph('weatherUnknown');
  }
}
