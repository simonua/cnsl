// Global data manager instance for meets browser
let meetsBrowserDataManager = null;
let meetsBrowserDependenciesPromise = null;
let meetsBrowserEnrichmentPromise = null;
let meetsBrowserMeetGroups = new Map();
let meetsPoolLocationIndex = new Map();
let meetsBrowserMeets = [];
let meetLiveStatusRefreshTimeout = null;
let meetLiveStatusSignature = '';
const MeetsBrowserSafety = HtmlSafety;
const MEET_DETAILS_LOADING_HTML = '<p>Loading meet details.</p>';
const MEETS_ENRICHMENT_DEPENDENCIES = Object.freeze([
  'js/types/pool-enums.js',
  'js/services/pool-period-schedule-service.js',
  'js/services/pool-link-helper.js',
  'js/models/pool.js',
  'js/models/team.js',
  'js/managers/pools-manager.js',
  'js/managers/teams-manager.js'
]);
const meetsAssetVersion = ClassicScriptLoader.getAssetVersion(document.currentScript);
const meetDetailsHydrationPromises = new WeakMap();
let meetPrimaryDataReady = false;
let meetSummaryReady = false;
let meetSummaryInteractionOccurred = false;

globalThis.cnslRouteWarmupReadiness.report(globalThis.ROUTE_WARMUP_READINESS_STATES.PREPARING);

// ------------------------------
//    INITIALIZATION
// ------------------------------

/**
 * Initialize the meets browser with data manager
 * @returns {Promise<void>} Promise settled after meet dependencies initialize
 */
async function initializeMeetsBrowser() {
  if (!meetsBrowserDataManager) {
    meetsBrowserDataManager = getDataManager();
    await meetsBrowserDataManager.initialize(['meets']);
  }
}

/**
 * Records one Meets route readiness boundary for performance measurement.
 * @param {string} phaseName - Route lifecycle phase
 * @returns {void}
 */
function markMeetPerformance(phaseName) {
  if (globalThis.performance && typeof globalThis.performance.mark === 'function') {
    globalThis.performance.mark(`cnsl:meets:${phaseName}`);
  }
}

/**
 * Reports that build-generated Meet summaries are usable without waiting for annual-data enhancement.
 */
function reportMeetSummaryReady() {
  if (meetSummaryReady) return;
  meetSummaryReady = true;
  markMeetPerformance('summary-visible');
  globalThis.cnslRouteWarmupReadiness.report(globalThis.ROUTE_WARMUP_READINESS_STATES.READY);
}

/**
 * Loads optional pool and team presentation dependencies once in execution order.
 * @returns {Promise<void>} Promise settled after every dependency loads
 */
function loadMeetsEnrichmentDependencies() {
  if (!meetsBrowserDependenciesPromise) {
    meetsBrowserDependenciesPromise = ClassicScriptLoader.load(MEETS_ENRICHMENT_DEPENDENCIES, {
      assetVersion: meetsAssetVersion,
      dataset: source => ({ meetsEnrichmentDependency: source })
    });
  }
  return meetsBrowserDependenciesPromise;
}

/**
 * Loads optional pool and team records once without blocking date summaries.
 * @returns {Promise<void>} Promise settled after enrichment succeeds or degrades to plain details
 */
function startMeetsBrowserEnrichment() {
  if (!meetsBrowserEnrichmentPromise) {
    meetsBrowserEnrichmentPromise = (async () => {
      try {
        await loadMeetsEnrichmentDependencies();
        const results = await Promise.allSettled([
          meetsBrowserDataManager.initialize(['pools']),
          meetsBrowserDataManager.initialize(['teams'])
        ]);
        if (meetsBrowserDataManager.isInitialized(['pools'])) {
          meetsPoolLocationIndex = globalThis.createPoolLocationIndex(
            meetsBrowserDataManager.getPools().getAllPools()
          );
        }
        if (results.some(result => result.status === 'rejected')) {
          console.warn('Some optional Meet schedule details did not load.');
        }
      } catch (error) {
        console.warn('Optional Meet schedule details are unavailable:', error);
      } finally {
        markMeetPerformance('optional-enrichment-settled');
      }
    })();
  }
  return meetsBrowserEnrichmentPromise;
}

/**
 * Hydrates meet-date details that are already expanded after optional work is allowed.
 */
function hydrateExpandedMeetDateDetails() {
  document.querySelectorAll('.meet-date-header__toggle[aria-expanded="true"]').forEach(toggle => {
    void hydrateMeetDateDetails(toggle.closest('.meet-date-card'));
  });
}

/**
 * Starts optional meet-detail work after a prerendered route activates.
 */
function startMeetsBrowserActivationWork() {
  void startMeetsBrowserEnrichment();
  hydrateExpandedMeetDateDetails();
  void handleMeetUrlParameters();
}

/**
 * Defers optional Meets work while the route is being prepared in a hidden prerender.
 */
function scheduleMeetsBrowserActivationWork() {
  if (!document.prerendering) {
    startMeetsBrowserActivationWork();
    return;
  }

  document.addEventListener('prerenderingchange', startMeetsBrowserActivationWork, { once: true });
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
  const ongoingMeet = orderedMeets.find(meet => meet.getLiveStatus(easternTimeInfo) === MeetLiveStatus.ONGOING);
  if (ongoingMeet) return { date: ongoingMeet.date, kind: MeetLiveStatus.ONGOING, label: 'Ongoing' };

  if (orderedMeets.some(meet => meet.date === easternTimeInfo.date && meet.getLiveStatus(easternTimeInfo) === null)) return null;

  const upcomingMeet = orderedMeets.find(meet => meet.getLiveStatus(easternTimeInfo) === MeetLiveStatus.UPCOMING
    || (meet.getLiveStatus(easternTimeInfo) === null && meet.date > easternTimeInfo.date));
  return upcomingMeet ? { date: upcomingMeet.date, kind: MeetLiveStatus.UPCOMING, label: 'Upcoming' } : null;
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

/**
 * Resolves the saved favorite against optional team enrichment when available.
 * @returns {Object|null} Favorite team model or null before team enrichment
 */
function getMeetFavoriteTeam() {
  if (!meetsBrowserDataManager?.isInitialized(['teams'])) return null;
  return PreferencesService.findFavoriteTeam(
    meetsBrowserDataManager.getTeams().getAllTeams(),
    PreferencesService.get().favoriteTeamId
  );
}

/**
 * Formats one meet team label with an optional semantic favorite marker.
 * @param {string} label - Published team label
 * @param {string} className - CSS class for the team role
 * @param {Object|null} favoriteTeam - Resolved favorite team
 * @returns {string} Escaped team-label HTML
 */
function formatMeetTeamLabel(label, className, favoriteTeam) {
  const displayLabel = label || (className === 'home-team' ? 'Home Team' : 'Visiting Team');
  const isFavorite = PreferencesService.teamMatchesLabel(favoriteTeam, displayLabel);
  const favoriteMarker = isFavorite
    ? ' <span class="favorite-marker" role="img" aria-label="Favorite team" title="Favorite team">&#9733;</span>'
    : '';
  return `<span class="${className}">${MeetsBrowserSafety.escapeHtml(displayLabel)}${favoriteMarker}</span>`;
}

/**
 * Renders the requested date's meet details from current optional enrichment.
 * @param {Array} meets - Meet models for one published date
 * @returns {string} Safe meet detail markup
 */
function renderMeetDateDetails(meets) {
  const favoriteTeam = getMeetFavoriteTeam();
  const orderedMeets = PreferencesService.sortMeetsWithFavorite(meets, favoriteTeam);
  const easternTimeInfo = TimeUtils.getCurrentEasternTimeInfo();
  const today = easternTimeInfo.isValid ? TimeUtils.parseDateOnly(easternTimeInfo.date) : new Date();
  today.setHours(0, 0, 0, 0);
  const meetDate = TimeUtils.parseDateOnly(orderedMeets[0]?.date);
  const dateLiveStatuses = orderedMeets.map(meet => meet.getLiveStatus(easternTimeInfo));
  const isCompleted = meetDate < today || (orderedMeets[0]?.date === easternTimeInfo.date
    && dateLiveStatuses.length > 0
    && dateLiveStatuses.every(status => status === MeetLiveStatus.CONCLUDED));
  const isUpcoming = !isCompleted && meetDate >= today;
  const canUsePoolEnrichment = meetsBrowserDataManager?.isInitialized(['pools'])
    && typeof globalThis.generateEnhancedPoolLink === 'function';

  return orderedMeets.map(meet => {
    const location = meet.location || 'TBA';
    const time = meet.getDisplayTime();
    let poolData = null;
    let locationLink = MeetsBrowserSafety.escapeHtml(location);
    let courseLabel = '';

    if (canUsePoolEnrichment) {
      try {
        locationLink = globalThis.generateEnhancedPoolLink(location, meetsBrowserDataManager, {
          preferPoolsPage: true,
          showBothLinks: false
        }, meetsPoolLocationIndex);
        poolData = globalThis.getPoolDataFromLocation(location, meetsBrowserDataManager, meetsPoolLocationIndex);
        courseLabel = globalThis.formatPoolCourseLabel(poolData);
        const safeMapsUrl = poolData?.location
          ? MeetsBrowserSafety.safeHttpUrl(poolData.location.googleMapsUrl)
          : '';
        if (safeMapsUrl) {
          locationLink += ` <a href="${safeMapsUrl}" target="_blank" rel="noopener" class="maps-icon" aria-label="View ${MeetsBrowserSafety.escapeHtml(location)} on Google Maps">${IconCatalog.render('map')}</a>`;
        }
      } catch (error) {
        console.warn('Error generating pool link for', location, ':', error);
        locationLink = MeetsBrowserSafety.escapeHtml(location);
      }
    }

    const courseInfo = courseLabel
      ? `<span class="meet-course">${MeetsBrowserSafety.escapeHtml(courseLabel)}</span>`
      : '';
    const weatherInfo = meet.weather?.forecast && isUpcoming
      ? `<div class="weather-info"><span class="weather-temp">${MeetsBrowserSafety.escapeHtml(meet.weather.forecast.temperature)}°F</span><span class="weather-desc">${MeetsBrowserSafety.escapeHtml(meet.weather.forecast.shortForecast)}</span></div>`
      : '';
    const safeMeetPoolId = poolData && /^[a-zA-Z0-9_-]+$/.test(poolData.id || '')
      ? MeetsBrowserSafety.escapeHtml(poolData.id)
      : '';
    const meetPoolAttribute = safeMeetPoolId ? ` data-meet-pool-id="${safeMeetPoolId}"` : '';

    if (meet.isSpecialMeet()) {
      return `
        <div class="meet-details special-meet"${meetPoolAttribute}>
          <div class="meet-info">
            <div class="special-meet-title"><strong>${MeetsBrowserSafety.escapeHtml(meet.name || 'Special Meet')}</strong></div>
            <div class="meet-location-time">
              <div class="meet-location-row"><span class="meet-location">${locationLink}</span>${courseInfo}</div>
              <div class="meet-time-row"><span class="meet-time">${MeetsBrowserSafety.escapeHtml(time)}</span></div>
            </div>
            ${weatherInfo}
          </div>
        </div>`;
    }

    const isFavoriteMeet = PreferencesService.meetIncludesFavoriteTeam(meet, favoriteTeam);
    return `
      <div class="meet-details${isFavoriteMeet ? ' favorite-meet' : ''}"${meetPoolAttribute}>
        <div class="meet-info">
          <div class="meet-teams">
            ${formatMeetTeamLabel(meet.getHomeTeam(), 'home-team', favoriteTeam)}
            <span class="vs">vs.</span>
            ${formatMeetTeamLabel(meet.getVisitingTeam(), 'visiting-team', favoriteTeam)}
          </div>
          <div class="meet-location-time">
            <div class="meet-location-row"><span class="meet-location">${locationLink}</span>${courseInfo}</div>
            <div class="meet-time-row"><span class="meet-time">${MeetsBrowserSafety.escapeHtml(time)}</span></div>
          </div>
          ${weatherInfo}
        </div>
      </div>`;
  }).join('');
}

/**
 * Hydrates one requested meet-date disclosure after optional enrichment settles.
 * @param {Element} meetCard - Meet date card to hydrate
 * @returns {Promise<Element|null>} Hydrated detail container or null
 */
function hydrateMeetDateDetails(meetCard) {
  const details = meetCard?.querySelector('.meet-date-details');
  if (!details || details.dataset.meetDetailsHydrated === 'true') return Promise.resolve(details || null);
  if (!meetPrimaryDataReady) {
    details.setAttribute('aria-busy', 'true');
    if (!details.hidden) details.innerHTML = MEET_DETAILS_LOADING_HTML;
    return Promise.resolve(details);
  }
  if (meetDetailsHydrationPromises.has(details)) return meetDetailsHydrationPromises.get(details);

  details.setAttribute('aria-busy', 'true');
  if (!details.hidden) details.innerHTML = MEET_DETAILS_LOADING_HTML;
  const hydrationPromise = startMeetsBrowserEnrichment()
    .then(() => {
      const meets = meetsBrowserMeetGroups.get(meetCard.dataset.meetDate) || [];
      details.innerHTML = renderMeetDateDetails(meets);
      details.dataset.meetDetailsHydrated = 'true';
      details.setAttribute('aria-busy', 'false');
      return details;
    })
    .finally(() => meetDetailsHydrationPromises.delete(details));
  meetDetailsHydrationPromises.set(details, hydrationPromise);
  return hydrationPromise;
}

/**
 * Refreshes only date details that a visitor already requested.
 * @returns {void}
 */
function refreshHydratedMeetDateDetails() {
  document.querySelectorAll('.meet-date-card').forEach(meetCard => {
    const details = meetCard.querySelector('.meet-date-details[data-meet-details-hydrated="true"]');
    if (!details) return;
    details.innerHTML = renderMeetDateDetails(meetsBrowserMeetGroups.get(meetCard.dataset.meetDate) || []);
  });
}

// ------------------------------
//    EXISTING FUNCTIONS (Updated to use pool link helper)
// ------------------------------

/**
 * Renders the list of meets in the #meetList element
 * @param {Array} meets - Array of meet objects
 * @param {boolean} [preserveExpansion] - Whether to retain expanded meet dates
 * @returns {Promise<void>} Promise settled after the meet list is rendered
 */
async function renderMeets(meets, preserveExpansion = false) {
  const list = document.getElementById("meetList");
  if (!list) return;

  // Safety check - ensure meets is an array
  if (!Array.isArray(meets) || meets.length === 0) {
    list.innerHTML = "<p>There are no meets to show yet.</p>";
    return;
  }

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

  meetsBrowserMeetGroups = new Map(Object.values(meetsByDate).map(dateMeets => [dateMeets[0].date, dateMeets]));
  meetPrimaryDataReady = true;

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

  const dateCardTemplate = document.getElementById('meetDateCardTemplate');
  if (!(dateCardTemplate instanceof HTMLTemplateElement)) {
    throw new Error('Meet date card template is unavailable.');
  }
  const existingCards = new Map(Array.from(list.querySelectorAll('.meet-date-card'))
    .map(card => [card.dataset.meetDate, card]));

  Object.keys(meetsByDate).forEach(dateKey => {
    const meetDate = TimeUtils.parseDateOnly(meetsByDate[dateKey][0].date);
    const meetDateValue = meetsByDate[dateKey][0].date;
    const dateLiveStatuses = meetsByDate[dateKey].map(meet => meet.getLiveStatus(easternTimeInfo));
    const isCompleted = meetDate < today || (meetDateValue === easternTimeInfo.date
      && dateLiveStatuses.length > 0
      && dateLiveStatuses.every(status => status === MeetLiveStatus.CONCLUDED));
    const isToday = meetDate.toDateString() === today.toDateString();
    const relativeDayOffset = TimeUtils.getRelativeFutureDayOffset(meetDate, today);
    const relativeDay = TimeUtils.formatRelativeFutureDay(meetDate, today);

    // Determine if this card should be expanded (only the next upcoming meet)
    const shouldExpand = expandedDateValues ? expandedDateValues.has(meetDateValue) : dateKey === nextUpcomingDateKey;
    const detailsId = `meet-details-${meetDateValue}`;

    // Get the meet name from the first meet on this date
    const meetName = meetsByDate[dateKey][0].name || '';
    const liveStatusBadge = isCompleted
      ? '<span class="meet-live-badge meet-live-badge--completed"><span class="meet-live-badge__check" aria-hidden="true">&#10003;</span> Completed</span>'
      : liveStatusTarget && liveStatusTarget.date === meetDateValue
        ? `<span class="meet-live-badge meet-live-badge--${liveStatusTarget.kind}">${liveStatusTarget.label}</span>`
        : '';
    const relativeDayBadge = relativeDay
      ? `<span class="meet-date-header__relative upcoming-day-pill${relativeDayOffset === 0 ? ' upcoming-day-pill--today' : relativeDayOffset === 1 ? ' upcoming-day-pill--tomorrow' : ''}">${MeetsBrowserSafety.escapeHtml(relativeDay)}</span>`
      : '';

    let meetCard = existingCards.get(meetDateValue);
    if (!meetCard) {
      meetCard = dateCardTemplate.content.firstElementChild.cloneNode(true);
    }
    existingCards.delete(meetDateValue);
    meetCard.id = `meet-date-${meetDateValue}`;
    meetCard.dataset.meetDate = meetDateValue;
    meetCard.classList.toggle('collapsed', !shouldExpand);

    const toggleButton = meetCard.querySelector('.meet-date-header__toggle');
    const nameElement = meetCard.querySelector('.meet-name-header');
    const statusContainer = meetCard.querySelector('.status-container');
    const details = meetCard.querySelector('.meet-date-details');
    let dateElement = toggleButton.querySelector('time');
    if (!dateElement) {
      dateElement = document.createElement('time');
      toggleButton.replaceChildren(dateElement);
    }
    dateElement.dateTime = meetDateValue;
    dateElement.textContent = dateKey;
    toggleButton.setAttribute('aria-expanded', String(shouldExpand));
    toggleButton.setAttribute('aria-controls', detailsId);
    nameElement.textContent = meetName;
    nameElement.hidden = !meetName;
    statusContainer.innerHTML = `${liveStatusBadge}${relativeDayBadge}${isCompleted ? '' : `<span class="visually-hidden">${isToday ? 'Meet is today' : 'Upcoming meet'}</span>`}`;
    details.id = detailsId;
    const isHydrated = details.dataset.meetDetailsHydrated === 'true';
    details.hidden = !shouldExpand;
    details.setAttribute('aria-busy', String(shouldExpand && !isHydrated));
    if (!isHydrated) details.innerHTML = shouldExpand ? MEET_DETAILS_LOADING_HTML : '';
    list.insertBefore(meetCard, dateCardTemplate);
  });

  existingCards.forEach(card => card.remove());
  if (!document.prerendering) hydrateExpandedMeetDateDetails();
}

/**
 * Re-renders meets after favorite-team preferences change.
 */
function refreshMeetsForPreferences() {
  if (!meetsBrowserDataManager || !document.getElementById('meetList')) return;
  refreshHydratedMeetDateDetails();
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

/**
 * Pauses live updates while hidden and catches up when the page becomes visible.
 */
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
  if (!meetPrimaryDataReady) meetSummaryInteractionOccurred = true;
  meetCard.classList.toggle('collapsed', isExpanded);
  toggleButton.setAttribute('aria-expanded', String(!isExpanded));
  if (!isExpanded && window.cnslAnalytics) {
    window.cnslAnalytics.trackInteraction(
      AnalyticsInteractionType.DIRECTORY_DETAIL_OPEN,
      { directoryName: 'meets' }
    );
  }
  if (details) {
    details.hidden = isExpanded;
    if (!isExpanded) void hydrateMeetDateDetails(meetCard);
  }
}

/**
 * Expands and highlights a meet selected by validated URL parameters.
 * @returns {Promise<void>} Promise settled after a valid linked meet is hydrated
 */
async function handleMeetUrlParameters() {
  const urlParams = new URLSearchParams(window.location.search);
  const meetDate = urlParams.get('date');
  const poolId = urlParams.get('pool');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(meetDate || '') || !/^[a-zA-Z0-9_-]+$/.test(poolId || '')) return;

  const meetCard = Array.from(document.querySelectorAll('.meet-date-card'))
    .find(card => card.dataset.meetDate === meetDate);
  if (!meetCard) return;

  meetCard.classList.remove('collapsed');
  const toggleButton = meetCard.querySelector('.meet-date-header__toggle');
  const details = meetCard.querySelector('.meet-date-details');
  if (toggleButton) toggleButton.setAttribute('aria-expanded', 'true');
  if (details) details.hidden = false;
  await hydrateMeetDateDetails(meetCard);

  const linkedMeet = Array.from(meetCard.querySelectorAll('.meet-details'))
    .find(meet => meet.dataset.meetPoolId === poolId);
  if (!linkedMeet) return;

  linkedMeet.classList.add('highlighted');
  linkedMeet.scrollIntoView({
    behavior: window.shouldReduceMotion() ? 'auto' : 'smooth',
    block: 'center'
  });
  setTimeout(() => linkedMeet.classList.remove('highlighted'), 3000);
}

/**
 * Starts the meet directory as soon as its deferred controller executes.
 * @returns {Promise<void>} Promise settled after initial summaries and activation work is scheduled
 */
async function startMeetsBrowser() {
  if (globalThis.cnslSeasonState && globalThis.cnslSeasonState.isOffSeason) {
    globalThis.cnslRouteWarmupReadiness.report(globalThis.ROUTE_WARMUP_READINESS_STATES.READY);
    return;
  }
  // Check if we're on the meets page before fetching data
  if (!document.getElementById("meetList")) {
    globalThis.cnslRouteWarmupReadiness.report(globalThis.ROUTE_WARMUP_READINESS_STATES.READY);
    return;
  }

  const meetList = document.getElementById("meetList");
  meetList.addEventListener('click', event => {
    const meetCard = event.target.closest('[data-meet-card]');
    const toggleButton = meetCard && meetCard.querySelector('[data-meet-card-action="toggle"]');
    const header = meetCard && meetCard.querySelector('[data-meet-card-header]');
    if (header && toggleButton && (toggleButton.getAttribute('aria-expanded') !== 'true' || event.target.closest('[data-meet-card-header]'))) toggleMeetDate(header);
  });
  if (meetList.querySelector('.meet-date-card')) reportMeetSummaryReady();

  try {
    await initializeMeetsBrowser();
    markMeetPerformance('primary-data-ready');
    const allMeets = meetsBrowserDataManager.getMeets().getAllMeets();
    meetsBrowserMeets = allMeets;
    await renderMeets(allMeets, meetSummaryInteractionOccurred);
    reportMeetSummaryReady();
    scheduleNextMeetLiveStatusRefresh();
    setMeetListStatus(`Meet schedule loaded. ${allMeets.length} meets available.`, false);
    scheduleMeetsBrowserActivationWork();

  } catch (error) {
    console.error("Error loading meets:", error);
    if (!meetList.querySelector('.meet-date-card')) {
      meetList.innerHTML = `<p>${IconCatalog.getTextGlyph('warning')} The meet schedule did not load. Please check your connection and refresh the page to try again.</p>`;
      globalThis.cnslRouteWarmupReadiness.report(globalThis.ROUTE_WARMUP_READINESS_STATES.READY);
    } else {
      reportMeetSummaryReady();
    }
    setMeetListStatus('Published meet dates remain available, but current details did not load. Please refresh the page to try again.', false);
  }
}

void startMeetsBrowser();

window.addEventListener(globalThis.PREFERENCES_CHANGED_EVENT_NAME, refreshMeetsForPreferences);
document.addEventListener('visibilitychange', handleMeetPageVisibilityChange);
