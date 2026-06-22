// Global data manager instance for pool browser
let poolBrowserDataManager = null;
let userCoords = null;
let poolBrowserPools = [];
let poolSortOrder = 'name';
let poolAvailabilityFilter = 'all';
let poolAvailabilityOptionsDate = '';
let poolLiveStatusRefreshTimeout = null;
let poolLiveStatusSignature = '';
let poolBrowserDetailDependenciesPromise = null;
let poolBrowserEnrichmentPromise = null;
let poolLocationRequestInFlight = false;
let poolSummaryVisible = false;
const PoolBrowserSafety = HtmlSafety;
const POOL_DEPENDENCY_GROUPS = Object.freeze({
  DETAIL: 'detail',
  ENRICHMENT: 'enrichment'
});
const POOL_LOCATION_REQUEST_OPTIONS = Object.freeze([
  Object.freeze({ enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 }),
  Object.freeze({ enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 })
]);
const poolBrowserControllerSource = document.currentScript && document.currentScript.src
  ? new URL(document.currentScript.src, document.baseURI)
  : null;
const poolBrowserAssetVersion = poolBrowserControllerSource
  ? poolBrowserControllerSource.searchParams.get('v')
  : '';

globalThis.cnslRouteWarmupReadiness.report(globalThis.ROUTE_WARMUP_READINESS_STATES.PREPARING);

/**
 * Records a pool-directory performance milestone when the Performance API is available.
 * @param {string} markName - Pool milestone name
 */
function markPoolPerformance(markName) {
  if (globalThis.performance && typeof globalThis.performance.mark === 'function') {
    globalThis.performance.mark(`cnsl:pools:${markName}`);
  }
}

// ------------------------------
//    SAFE REFERENCE HELPERS
// ------------------------------

/**
 * Safely get TimeUtils reference
 * @returns {object|null} TimeUtils class or null if not available
 */
function _getTimeUtils() {
  return globalThis.TimeUtils || null;
}

/**
 * Applies the Pool controller asset version to a lazily loaded dependency URL.
 * @param {string} source - Relative dependency source
 * @returns {string} Versioned dependency URL or the unchanged relative source
 */
function getPoolDependencySource(source) {
  if (!poolBrowserAssetVersion) return source;

  const dependencySource = new URL(source, document.baseURI);
  dependencySource.searchParams.set('v', poolBrowserAssetVersion);
  return dependencySource.toString();
}

/**
 * Appends one classic Pool dependency and settles after it loads.
 * @param {string} source - Relative dependency source
 * @param {string} group - Pool dependency group
 * @returns {Promise<void>} Promise settled when the script loads or fails
 */
function loadPoolScript(source, group) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = getPoolDependencySource(source);
    script.async = false;
    script.dataset.poolDependency = source;
    script.dataset.poolDependencyGroup = group;
    script.addEventListener('load', resolve, { once: true });
    script.addEventListener('error', () => reject(new Error(`Unable to load ${source}.`)), { once: true });
    document.head.appendChild(script);
  });
}

/**
 * Loads a Pool dependency group in deterministic classic-script order.
 * @param {ReadonlyArray<string>} sources - Ordered dependency sources
 * @param {string} group - Pool dependency group
 * @returns {Promise<void>} Promise settled when every dependency has loaded
 */
function loadPoolDependencies(sources, group) {
  return Promise.all(sources.map(source => loadPoolScript(source, group))).then(() => undefined);
}

/**
 * Loads detail-rendering dependencies once after summaries are available.
 * @returns {Promise<void>} Promise settled when detail providers have loaded
 */
function loadPoolDetailDependencies() {
  if (!poolBrowserDetailDependenciesPromise) {
    poolBrowserDetailDependenciesPromise = loadPoolDependencies(
      globalThis.POOL_DETAIL_DEPENDENCIES,
      POOL_DEPENDENCY_GROUPS.DETAIL
    );
  }
  return poolBrowserDetailDependenciesPromise;
}

/**
 * Loads optional Team and Meet enrichment dependencies once.
 * @returns {Promise<void>} Promise settled when enrichment providers have loaded
 */
function loadPoolEnrichmentDependencies() {
  return loadPoolDependencies(
    globalThis.POOL_ENRICHMENT_DEPENDENCIES,
    POOL_DEPENDENCY_GROUPS.ENRICHMENT
  );
}

// ------------------------------
//    UTILITY FUNCTIONS
// ------------------------------

/**
 * Get or initialize the week start for a specific pool
 * @param {string} poolId - Pool identifier
 * @returns {Date} - Week start date for this pool
 */
function getPoolWeekStart(poolId) {
  return PoolWeekStateService.getWeekStart(poolId);
}

/**
 * Get tooltip text for pool status
 * @param {string} statusKind - Semantic PoolStatus kind
 * @returns {string} - Tooltip text
 */
function getStatusTooltip(statusKind) {
  return PoolCardDisplay.getStatusTooltip(statusKind);
}


// ------------------------------
//    INITIALIZATION
// ------------------------------

/**
 * Initialize the pool browser with data manager
 * @returns {Promise<void>} Promise settled after primary pool data initializes
 */
async function initializePoolBrowser() {
  if (!poolBrowserDataManager) {
    poolBrowserDataManager = getDataManager();
    await poolBrowserDataManager.initialize(['pools']);
    markPoolPerformance('primary-data-ready');
  }
}

/**
 * Starts optional team and meet enrichment once and reconciles rendered schedule state afterward.
 * @returns {Promise<void>} Promise settled after optional enrichment attempts complete
 */
function startPoolBrowserEnrichment() {
  if (poolBrowserEnrichmentPromise) return poolBrowserEnrichmentPromise;

  poolBrowserEnrichmentPromise = loadPoolEnrichmentDependencies()
    .then(() => Promise.allSettled([
      poolBrowserDataManager.initialize(['teams']),
      poolBrowserDataManager.initialize(['meets'])
    ]))
    .then(([teamsResult, meetsResult]) => {
      if (teamsResult.status === 'rejected') {
        console.warn('[Pool Browser] Team practice labels are unavailable:', teamsResult.reason);
      }
      if (meetsResult.status === 'rejected') {
        console.warn('[Pool Browser] Swim meet calendar highlights are unavailable:', meetsResult.reason);
      }
      if (teamsResult.status === 'fulfilled' && meetsResult.status === 'fulfilled') {
        PoolMeetScheduleService.applyMeetOverrides(
          poolBrowserDataManager.getPools().getAllPools(),
          poolBrowserDataManager.getTeams().getAllTeams(),
          poolBrowserDataManager.getMeets().getAllMeets()
        );
        refreshPoolsForCurrentTime();
      }
      refreshHydratedPoolDetails();
    })
    .catch(error => {
      console.warn('[Pool Browser] Optional schedule enrichment is unavailable:', error);
    })
    .finally(() => markPoolPerformance('optional-enrichment-settled'));
  return poolBrowserEnrichmentPromise;
}

/**
 * Update assistive loading feedback for the pool directory.
 * @param {string} message - Status message to announce
 * @param {boolean} isBusy - Whether the directory is loading
 */
function setPoolListStatus(message, isBusy) {
  const list = document.getElementById('poolList');
  const status = document.getElementById('poolListStatus');
  if (list) list.setAttribute('aria-busy', String(isBusy));
  if (status) status.textContent = message;
}

/**
 * Center today's column within visible weekly calendar schedules without moving the page.
 * @param {Document|Element} root - Container to search for visible calendars
 */
function scrollCalendarsToToday(root = document) {
  root.querySelectorAll('.schedule-calendar').forEach(calendar => {
    const today = calendar.querySelector('.schedule-calendar__day.is-today');
    if (!today || calendar.clientWidth === 0) return;

    const calendarBounds = calendar.getBoundingClientRect();
    const todayBounds = today.getBoundingClientRect();
    const centeredLeft = calendar.scrollLeft + todayBounds.left - calendarBounds.left
      - ((calendar.clientWidth - todayBounds.width) / 2);
    const maximumLeft = calendar.scrollWidth - calendar.clientWidth;
    const scrollLeft = Math.max(0, Math.min(maximumLeft, centeredLeft));
    calendar.scrollLeft = scrollLeft;
  });
}

/**
 * Load and display the official interactive CA pool directory action.
 */
function loadSeasonInfo() {
  const seasonInfo = document.getElementById('seasonInfo');
  const poolData = poolBrowserDataManager ? poolBrowserDataManager.getSeasonInfo() : null;
  if (!seasonInfo) return;

  const safeDirectoryUrl = poolData && PoolBrowserSafety.safeHttpUrl(poolData.caPoolDirectoryUrl);
  if (safeDirectoryUrl) {
    seasonInfo.hidden = false;
    seasonInfo.innerHTML = `
      <p class="ca-directory-link">
        <a href="${safeDirectoryUrl}" target="_blank" rel="noopener" class="directory-link" data-analytics-context="official_information">
          ${IconCatalog.render('map-pin')}Interactive CA Pool Directory
        </a>
      </p>
    `;
  } else {
    seasonInfo.hidden = true;
  }
}

/**
 * Normalize the current pool status for card rendering.
 * @param {Pool} pool - Pool model
 * @returns {Object} - Status object with semantic kind, isOpen, status, and color
 */
function getPoolStatus(pool) {
  if (!pool || typeof pool.getCurrentStatus !== 'function') {
    console.warn('Data manager not initialized');
    return {
      kind: 'unavailable',
      isOpen: false,
      status: 'Unavailable',
      color: 'red'
    };
  }

  const status = pool.getCurrentStatus();
  return {
    kind: status.kind || 'unavailable',
    isOpen: status.isOpen,
    status: status.status,
    color: status.color || 'red'
  };
}

/**
 * Resolve the status indicator shown for the active availability filter.
 * @param {Pool} pool - Pool model
 * @returns {Object} Current status or a neutral future-day status
 */
function getPoolCardStatus(pool) {
  return PoolDirectoryService.getFutureAvailabilityDayOffset(poolAvailabilityFilter) === null
    ? getPoolStatus(pool)
    : PoolStatus.STATUS_NOT_APPLICABLE;
}

/**
 * Builds pool-hours display state and delegates the rendered presentation.
 * @param {Pool} pool - Pool model
 * @returns {string} - HTML string for displaying hours with navigation
 */
function formatPoolHours(pool) {
  if (!poolBrowserDataManager) {
    return PoolHoursDisplay.renderAvailabilityMessage('Data unavailable');
  }

  if (!pool) {
    return PoolHoursDisplay.renderAvailabilityMessage('Pool not found');
  }

  if (!pool.schedulePeriods || pool.schedulePeriods.length === 0) {
    return PoolHoursDisplay.renderScheduleMissing();
  }

  const poolId = pool.id || pool.name;
  const weekStart = getPoolWeekStart(poolId);

  const timeUtils = _getTimeUtils();
  if (!timeUtils) {
    return PoolHoursDisplay.renderTimeUtilityMessage('Time utilities not available');
  }
  const teamsManager = poolBrowserDataManager.isInitialized(['teams'])
    ? poolBrowserDataManager.getTeams()
    : null;
  const practiceTeams = teamsManager ? teamsManager.getPracticeTeamsByPool(pool.name) : [];
  const preferences = PreferencesService.get();
  const favoriteTeam = teamsManager
    ? PreferencesService.findFavoriteTeam(teamsManager.getAllTeams(), preferences.favoriteTeamId)
    : null;
  const viewModel = PoolHoursViewModelService.build(pool, {
    weekStart,
    timeUtils,
    practiceTeams,
    isFavoriteTeamLabel: label => PreferencesService.teamMatchesLabel(favoriteTeam, label),
    layout: preferences.poolScheduleLayout,
    teamScheduleService: TeamScheduleService,
    getStatusTooltip,
    onError: (operation, poolName, error) => {
      console.error(`[Pool Browser] Error getting ${operation} for pool ${poolName}:`, error);
    }
  });

  return PoolHoursDisplay.render(viewModel);
}

/**
 * Builds the display model for an expanded pool card.
 * @param {Pool} pool - Pool model
 * @returns {Object} Pool details display model
 */
function createPoolDetailsViewModel(pool) {
  const features = PreferencesService.getFilterablePoolFeatures(pool);
  const featureOverrides = Array.isArray(pool.featureOverrides) ? pool.featureOverrides : [];
  const overridesByFeature = new Map(featureOverrides.map(override => [override.feature, override]));
  const removedFeatures = featureOverrides
    .filter(override => override.action === 'remove')
    .map(override => override.feature);
  const sortedFeatures = PoolDirectoryService.sortFeaturesForDisplay(
    [...features, ...removedFeatures],
    PreferencesService.groupPoolFeatures
  );
  return {
    pool,
    poolName: pool.name || 'Unknown Pool',
    hoursHtml: formatPoolHours(pool),
    featureItems: sortedFeatures.map(feature => ({
      label: PoolDirectoryService.formatFeatureLabel(feature),
      category: PreferencesService.getPoolFeatureCategory(feature),
      correctionAction: overridesByFeature.get(feature)?.action || '',
      href: feature === 'lessons' ? 'lessons.html' : ''
    })),
    mapsSearchBaseUrl: globalThis.GOOGLE_MAPS_SEARCH_BASE_URL
  };
}

/**
 * Finds a pool model by its stable card identifier.
 * @param {string} poolId - Pool card identifier
 * @returns {Pool|null} Matching pool model, or null
 */
function getPoolModel(poolId) {
  return poolBrowserPools.find(pool => String(pool.id || pool.name) === String(poolId)) || null;
}

/**
 * Build the collapsed-card availability summary for the active filter.
 * @param {Pool|null} poolModel - Pool domain model
 * @returns {{ text: string, label: string, action: string }} Display-ready availability summary
 */
function getPoolCardAvailabilitySummary(poolModel) {
  if (!poolModel) return { text: '', label: '', action: '' };

  const dayOffset = PoolDirectoryService.getFutureAvailabilityDayOffset(poolAvailabilityFilter);
  if (dayOffset !== null) {
    const schedule = poolModel.getGeneralUseScheduleOnDayOffset(dayOffset);
    const summary = PoolDirectoryService.formatGeneralUseScheduleSummary(schedule, _getTimeUtils());
    return { ...summary, action: '' };
  }

  const transition = poolModel.getPublicStatusTransitionToday();
  const action = transition?.action;
  return {
    text: PoolCardDisplay.formatPublicStatusTransition(transition),
    label: PoolCardDisplay.formatPublicStatusTransition(transition, { useLongUnits: true }),
    action: PoolTransitionAction.isValid(action) ? action : ''
  };
}

/**
 * Synchronizes one pool card's live transition summary.
 * @param {Element} poolCard - Pool card to update
 */
function syncPoolTransitionSummary(poolCard) {
  if (!poolCard) return;
  const pool = getPoolModel(poolCard.dataset.poolId);
  const summaryState = getPoolCardAvailabilitySummary(pool);
  let metadata = poolCard.querySelector('.pool-header__metadata');
  let summary = metadata && metadata.querySelector('.pool-transition-summary');

  if (!summaryState.text) {
    if (summary) summary.remove();
    if (metadata && !metadata.querySelector('.distance-badge')) metadata.remove();
    return;
  }

  if (!metadata) {
    metadata = document.createElement('span');
    metadata.className = 'pool-header__metadata';
    poolCard.querySelector('.pool-header')?.append(metadata);
  }
  if (!summary) {
    summary = document.createElement('span');
    summary.className = 'pool-transition-summary';
    metadata.prepend(summary);
  }
  summary.textContent = summaryState.text;
  summary.className = PoolCardDisplay.getTransitionSummaryClass(summaryState.action);
  summary.setAttribute('aria-label', summaryState.label);
}

/**
 * Refreshes live transition summaries and hydrated hours without replacing pool cards.
 */
function refreshPoolTimeDisplays() {
  document.querySelectorAll('#poolList .pool-card').forEach(poolCard => {
    syncPoolTransitionSummary(poolCard);
    const pool = getPoolModel(poolCard.dataset.poolId);
    if (pool) refreshHydratedPoolHours(poolCard, pool);
  });
}

/**
 * Refresh time-sensitive hours in a card whose details were already hydrated.
 * @param {Element} poolCard - Pool card containing deferred details
 * @param {Pool} pool - Current pool model
 */
function refreshHydratedPoolHours(poolCard, pool) {
  const details = poolCard && poolCard.querySelector('.pool-details');
  if (!details || details.dataset.poolDetailsHydrated !== 'true') return;

  const hoursElement = details.querySelector('.pool-hours');
  if (!hoursElement) return;
  hoursElement.outerHTML = formatPoolHours(pool);
  scrollCalendarsToToday(poolCard);
}

/**
 * Synchronizes live status indicators and transition summaries without replacing pool cards.
 */
function refreshPoolCardSummaries() {
  document.querySelectorAll('#poolList .pool-card').forEach(poolCard => {
    const pool = getPoolModel(poolCard.dataset.poolId);
    const statusIndicator = poolCard.querySelector('.pool-status-indicator');
    if (pool && statusIndicator) {
      const poolStatus = getPoolCardStatus(pool);
      statusIndicator.outerHTML = PoolCardDisplay.renderStatusIndicator(
        poolStatus,
        getStatusTooltip(poolStatus.kind)
      );
      refreshHydratedPoolHours(poolCard, pool);
    }
    syncPoolTransitionSummary(poolCard);
  });
}

/**
 * Renders deferred details for an expanded pool card.
 * @param {Element} poolCard - Pool card to hydrate
 * @returns {Promise<Element|null>} Pool details element after hydration settles, when present
 */
async function hydratePoolDetails(poolCard) {
  const details = poolCard && poolCard.querySelector('.pool-details');
  if (!details || details.dataset.poolDetailsHydrated === 'true'
    || details.dataset.poolDetailsUnavailable === 'true') return details;

  details.setAttribute('aria-busy', 'true');
  details.innerHTML = '<p class="pool-details__loading" role="status">Loading pool details...</p>';
  try {
    await loadPoolDetailDependencies();
  } catch (error) {
    console.warn('[Pool Browser] Pool details are unavailable:', error);
    details.innerHTML = '<p class="pool-details__unavailable" role="status">Additional pool details are unavailable. Please refresh the page to try again.</p>';
    details.dataset.poolDetailsUnavailable = 'true';
    details.setAttribute('aria-busy', 'false');
    return details;
  }

  if (!details.isConnected) return null;

  const pool = getPoolModel(poolCard.dataset.poolId);
  if (!pool) {
    details.setAttribute('aria-busy', 'false');
    return details;
  }
  details.innerHTML = PoolCardDisplay.renderDetails(createPoolDetailsViewModel(pool));
  details.dataset.poolDetailsHydrated = 'true';
  details.setAttribute('aria-busy', 'false');
  syncPoolTransitionSummary(poolCard);
  return details;
}

/**
 * Hydrates only cards whose disclosure state is currently expanded.
 * @param {Document|Element} root - Container to search for expanded Pool cards
 * @returns {Promise<void>} Promise settled after requested details finish hydrating
 */
async function hydrateExpandedPoolDetails(root = document) {
  const expandedCards = Array.from(root.querySelectorAll('.pool-card')).filter(poolCard => (
    poolCard.querySelector('.pool-header__toggle')?.getAttribute('aria-expanded') === 'true'
  ));
  await Promise.all(expandedCards.map(poolCard => hydratePoolDetails(poolCard)));
}

/**
 * Hydrates a favorite-expanded or deep-linked card without preloading unused detail providers.
 * @returns {Promise<void>} Promise settled after requested initial detail work completes
 */
function startPoolBrowserDetailWork() {
  const list = document.getElementById('poolList');
  if (list && list.querySelector('.pool-header__toggle[aria-expanded="true"]')) {
    return hydrateExpandedPoolDetails(list);
  }
  return Promise.resolve();
}

/**
 * Re-renders details that were already hydrated after optional data enrichment.
 */
function refreshHydratedPoolDetails() {
  const focusTarget = captureFocusedPoolControl();
  document.querySelectorAll('#poolList .pool-card').forEach(poolCard => {
    const details = poolCard.querySelector('.pool-details');
    if (!details || details.dataset.poolDetailsHydrated !== 'true') return;
    const pool = getPoolModel(poolCard.dataset.poolId);
    if (pool) {
      details.innerHTML = PoolCardDisplay.renderDetails(createPoolDetailsViewModel(pool));
      syncPoolTransitionSummary(poolCard);
    }
  });
  scrollCalendarsToToday(document.getElementById('poolList') || document);
  restoreFocusedPoolControl(focusTarget);
}

/**
 * Gets the user's current location if they grant permission
 * Gracefully handles cases where geolocation is denied or not available
 * @param {number} [attempt] - Geolocation request option index
 */
function getUserLocation(attempt = 0) {
  if (!PreferencesService.get().locationAwarenessEnabled || poolLocationRequestInFlight) return;

  // Check if geolocation is supported
  if (!navigator.geolocation) {
    return; // Exit function early, no location will be used
  }

  poolLocationRequestInFlight = true;
  /**
   * Requests geolocation and retries with the next configured option when appropriate.
   * @param {number} requestAttempt - Geolocation request option index
   * @private
   */
  const requestLocation = requestAttempt => {
    const options = POOL_LOCATION_REQUEST_OPTIONS[requestAttempt];

    navigator.geolocation.getCurrentPosition(
      position => {
        poolLocationRequestInFlight = false;
        if (!PreferencesService.get().locationAwarenessEnabled) return;
        userCoords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        // Re-render pools with distance if we're on the pools page
        if (document.getElementById("poolList") && poolBrowserDataManager) {
          setupPoolSortControl();
          renderPools(poolBrowserPools);
        }
      },
      error => {
        const permissionDenied = error && error.code === 1;
        const nextAttempt = requestAttempt + 1;
        if (!permissionDenied && nextAttempt < POOL_LOCATION_REQUEST_OPTIONS.length
          && PreferencesService.get().locationAwarenessEnabled) {
          requestLocation(nextAttempt);
          return;
        }
        poolLocationRequestInFlight = false;
      },
      options
    );
  };

  requestLocation(attempt);
}

/**
 * Render available amenity controls and restore device-local selections.
 * @param {Array} pools - Available pool data objects
 */
function setupPoolFeatureFilters(pools) {
  const filterSection = document.getElementById('poolFeatureFilter');
  const optionsContainer = document.getElementById('poolFeatureFilterOptions');
  const toggleButton = document.getElementById('togglePoolFeatureFilters');
  const controls = document.getElementById('poolFeatureFilterControls');
  const clearButton = document.getElementById('clearPoolFeatureFilters');
  if (!filterSection || !optionsContainer || !toggleButton || !controls || !clearButton) return;

  const availableFeatures = PreferencesService.getPoolFeatures(pools);
  const preferences = PreferencesService.get();
  const selectedFeatures = preferences.poolFeatureFilters.filter(feature => availableFeatures.includes(feature));
  if (selectedFeatures.length !== preferences.poolFeatureFilters.length) {
    PreferencesService.save({ ...preferences, poolFeatureFilters: selectedFeatures });
  }

  optionsContainer.replaceChildren();
  PreferencesService.getPoolFeatureFilterColumns(availableFeatures).forEach(groups => {
    const column = document.createElement('div');
    column.className = 'pool-filter__column';

    groups.forEach(group => {
    const groupFieldset = document.createElement('fieldset');
    groupFieldset.className = `pool-filter__group pool-filter__group--${group.key}`;

    const groupTitle = document.createElement('legend');
    groupTitle.className = 'pool-filter__group-title';
    groupTitle.textContent = group.label;

    const groupOptions = document.createElement('div');
    groupOptions.className = 'pool-filter__group-options';

    group.features.forEach(feature => {
      const input = document.createElement('input');
      input.name = 'poolFeature';
      input.type = 'checkbox';
      input.value = feature;
      input.checked = selectedFeatures.includes(feature);

      const labelText = document.createElement('span');
      labelText.className = 'pool-filter__label';
      labelText.textContent = PoolDirectoryService.formatFeatureLabel(feature);

      const chip = document.createElement('span');
      chip.append(labelText);

      const label = document.createElement('label');
      label.className = `pool-filter__option pool-filter__option--${group.key}`;
      label.append(input, chip);
      groupOptions.appendChild(label);
    });

      groupFieldset.append(groupTitle, groupOptions);
      column.appendChild(groupFieldset);
    });

    optionsContainer.appendChild(column);
  });
  filterSection.hidden = availableFeatures.length === 0;
  filterSection.classList.toggle('pool-filter--collapsed', controls.hidden);
  clearButton.hidden = selectedFeatures.length === 0 && poolAvailabilityFilter === 'all';

  optionsContainer.onchange = handlePoolFeatureFilterChange;
  toggleButton.onclick = togglePoolFeatureFilters;
  filterSection.onclick = handlePoolFeatureFilterSurfaceClick;
  clearButton.onclick = clearPoolFeatureFilters;
  setupPoolAvailabilityControl();
}

/**
 * Expands the filter controls when the noninteractive filter surface is selected.
 * @param {Event} event - Delegated filter-surface click event
 */
function handlePoolFeatureFilterSurfaceClick(event) {
  const controls = document.getElementById('poolFeatureFilterControls');
  const target = event.target;
  if (!controls || !(target instanceof Element) || target.closest('button, .pool-filter__controls')) return;

  if (controls.hidden || target.closest('.pool-filter__header')) {
    togglePoolFeatureFilters();
  }
}

/**
 * Show or hide the feature options while retaining applied selections.
 */
function togglePoolFeatureFilters() {
  const toggleButton = document.getElementById('togglePoolFeatureFilters');
  const controls = document.getElementById('poolFeatureFilterControls');
  const filterSection = document.getElementById('poolFeatureFilter');
  if (!toggleButton || !controls) return;

  controls.hidden = !controls.hidden;
  if (filterSection) filterSection.classList.toggle('pool-filter--collapsed', controls.hidden);
  toggleButton.setAttribute('aria-expanded', String(!controls.hidden));
}

/**
 * Save selected features and refresh the directory results.
 */
function handlePoolFeatureFilterChange() {
  const availableFeatures = new Set(PreferencesService.getPoolFeatures(poolBrowserPools));
  const selectedFeatures = Array.from(document.querySelectorAll('input[name="poolFeature"]:checked'))
    .map(input => input.value)
    .filter(feature => availableFeatures.has(feature));
  const preferences = PreferencesService.get();
  const saved = PreferencesService.save({ ...preferences, poolFeatureFilters: selectedFeatures });
  if (saved.poolFeatureFilters.join('|') !== preferences.poolFeatureFilters.join('|') && window.cnslAnalytics) {
    window.cnslAnalytics.trackInteraction(AnalyticsInteractionType.PUBLISHED_SETTING_CHANGE, {
      publishedValues: availableFeatures,
      selectedValues: saved.poolFeatureFilters,
      settingName: 'pool_feature_filters'
    });
  }
  renderPools(poolBrowserPools);
}

/**
 * Remove all selected feature filters from this device.
 */
function clearPoolFeatureFilters() {
  const preferences = PreferencesService.get();
  PreferencesService.save({ ...preferences, poolFeatureFilters: [] });
  poolAvailabilityFilter = 'all';
  if (preferences.poolFeatureFilters.length > 0 && window.cnslAnalytics) {
    window.cnslAnalytics.trackInteraction(AnalyticsInteractionType.PUBLISHED_SETTING_CHANGE, {
      publishedValues: new Set(),
      selectedValues: [],
      settingName: 'pool_feature_filters'
    });
  }
  setupPoolFeatureFilters(poolBrowserPools);
  renderPools(poolBrowserPools);
}

/**
 * Configure the clock-dependent availability filter without persisting it between visits.
 */
function setupPoolAvailabilityControl() {
  const select = document.getElementById('poolAvailabilityFilter');
  if (!select) return;

  const currentDate = _getTimeUtils()?.getCurrentEasternTimeInfo()?.date || '';
  if (currentDate !== poolAvailabilityOptionsDate) {
    select.querySelectorAll('option[data-availability-day-offset]').forEach(option => option.remove());
    const options = PoolDirectoryService.getUpcomingDayAvailabilityOptions(currentDate);
    options.forEach(({ value, dayOffset, label }) => {
      const option = document.createElement('option');
      option.value = value;
      option.dataset.availabilityDayOffset = String(dayOffset);
      option.textContent = label;
      select.appendChild(option);
    });
    poolAvailabilityOptionsDate = options.length > 0 ? currentDate : '';
  }
  select.value = poolAvailabilityFilter;
  select.onchange = handlePoolAvailabilityChange;
}

/**
 * Filter the directory by published public-use hours around the current time.
 * @param {Event} event - Availability select change event
 */
function handlePoolAvailabilityChange(event) {
  const requestedFilter = event.target.value;
  poolAvailabilityFilter = PoolDirectoryService.isAvailabilityFilter(requestedFilter) ? requestedFilter : 'all';
  renderPools(poolBrowserPools);
  const currentDate = _getTimeUtils()?.getCurrentEasternTimeInfo()?.date || '';
  const description = PoolDirectoryService.getAvailabilityFilterDescription(poolAvailabilityFilter, currentDate);
  setPoolListStatus(`Pool directory filtered to ${description}.`, false);
}

/**
 * Display sorting options once location-based distances are available.
 */
function setupPoolSortControl() {
  const controls = document.getElementById('poolSortControls');
  const select = document.getElementById('poolSortOrder');
  if (!controls || !select) return;

  controls.hidden = !userCoords;
  select.value = poolSortOrder;
  select.onchange = handlePoolSortChange;
}

/**
 * Reorder visible pools using the visitor's selected ordering.
 * @param {Event} event - Sort select change event
 */
function handlePoolSortChange(event) {
  poolSortOrder = event.target.value === 'distance' && userCoords ? 'distance' : 'name';
  renderPools(poolBrowserPools);
  const description = poolSortOrder === 'distance' ? 'nearest distance' : 'default order';
  setPoolListStatus(`Pool directory sorted by ${description}.`, false);
}

/**
 * Update the active filter result count and clear action.
 * @param {number} matchingCount - Filtered pool count
 * @param {number} totalCount - Total pool count
 * @param {number} filterCount - Active filter count
 */
function updatePoolFilterSummary(matchingCount, totalCount, filterCount) {
  const summary = document.getElementById('poolFilterSummary');
  const clearButton = document.getElementById('clearPoolFeatureFilters');
  const selectionCount = document.getElementById('poolFeatureFilterCount');
  if (summary) {
    summary.textContent = filterCount > 0
      ? `${matchingCount} / ${totalCount} pools`
      : `${totalCount} pools`;
  }
  if (clearButton) clearButton.hidden = filterCount === 0;
  if (selectionCount) {
    selectionCount.hidden = filterCount === 0;
    selectionCount.textContent = filterCount > 0 ? `${filterCount} selected` : '';
  }
}

/**
 * Apply the selected live-availability requirement to matching pools.
 * @param {Array} pools - Pools already matched by facility features
 * @returns {Array} Pools matching the selected availability condition
 */
function filterPoolsByAvailability(pools) {
  if (!poolBrowserDataManager) return pools;

  return PoolDirectoryService.filterByAvailability(
    pools,
    poolAvailabilityFilter
  );
}

/**
 * Capture a focused control before an automatic status rerender replaces card markup.
 * @returns {{ poolId: string, selector: string }|null} Focus target that may be restored
 */
function captureFocusedPoolControl() {
  const list = document.getElementById('poolList');
  const focusedElement = document.activeElement;
  if (!list || !(focusedElement instanceof Element) || !list.contains(focusedElement)) return null;

  const poolCard = focusedElement.closest('.pool-card');
  if (!poolCard) return null;

  const selectors = [
    '.pool-header__toggle', '.address-link', '.ca-link', '.phone-link', '.feature-pill--link', '.calendar-btn',
    '.today-btn', '.prev-week', '.next-week', '.week-picker', '.schedule-activity__source-link'
  ];
  const selector = selectors.find(candidate => focusedElement.matches(candidate));
  return selector ? { poolId: poolCard.dataset.poolId, selector } : null;
}

/**
 * Restore focus following a time-driven rerender when its originating card remains visible.
 * @param {{ poolId: string, selector: string }|null} focusTarget - Previously focused card control
 */
function restoreFocusedPoolControl(focusTarget) {
  if (!focusTarget) return;

  const card = Array.from(document.querySelectorAll('#poolList .pool-card'))
    .find(poolCard => poolCard.dataset.poolId === focusTarget.poolId);
  const target = card && card.querySelector(focusTarget.selector);
  if (target && !target.disabled) target.focus();
}

/**
 * Build a lightweight representation of status values currently affecting the rendered directory.
 * @param {Array} pools - Available pool records
 * @returns {string} State signature for detecting schedule transitions
 */
function getPoolLiveStatusSignature(pools) {
  if (!poolBrowserDataManager) return '';

  return PoolDirectoryService.getLiveStatusSignature(
    pools,
    poolAvailabilityFilter
  );
}

/**
 * Calculate one pool's distance from the visitor without mutating the model.
 * @param {Pool} pool - Pool model
 * @returns {number|null} Distance in miles, or null when coordinates are unavailable
 */
function getPoolDistance(pool) {
  if (!userCoords) return null;
  const latitude = Number(pool?.location?.lat);
  const longitude = Number(pool?.location?.lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return PoolDirectoryService.calculateDistance(userCoords, { lat: latitude, lng: longitude });
}

/**
 * Refresh countdowns each minute and re-render only at schedule or filter boundaries.
 */
function refreshPoolsForCurrentTime() {
  if (poolBrowserPools.length === 0) return;

  setupPoolAvailabilityControl();
  const nextSignature = getPoolLiveStatusSignature(poolBrowserPools);
  if (nextSignature === poolLiveStatusSignature) {
    const focusTarget = captureFocusedPoolControl();
    refreshPoolTimeDisplays();
    restoreFocusedPoolControl(focusTarget);
    return;
  }

  if (poolAvailabilityFilter === 'all') {
    const focusTarget = captureFocusedPoolControl();
    poolLiveStatusSignature = nextSignature;
    refreshPoolCardSummaries();
    restoreFocusedPoolControl(focusTarget);
    setPoolListStatus('Pool availability updated for the current time.', false);
    return;
  }

  const focusTarget = captureFocusedPoolControl();
  renderPools(poolBrowserPools);
  restoreFocusedPoolControl(focusTarget);
  setPoolListStatus('Pool availability updated for the current time.', false);
}

/**
 * Check for live schedule changes promptly after each minute boundary.
 */
function scheduleNextPoolLiveStatusRefresh() {
  if (poolLiveStatusRefreshTimeout !== null) window.clearTimeout(poolLiveStatusRefreshTimeout);
  const now = new Date();
  const millisecondsIntoMinute = (now.getSeconds() * 1000) + now.getMilliseconds();
  const delayMilliseconds = (60 * 1000) - millisecondsIntoMinute + 25;
  poolLiveStatusRefreshTimeout = window.setTimeout(() => {
    refreshPoolsForCurrentTime();
    scheduleNextPoolLiveStatusRefresh();
  }, delayMilliseconds);
}

/**
 * Start status updates once pool records are available.
 */
function startPoolLiveStatusUpdates() {
  poolLiveStatusSignature = getPoolLiveStatusSignature(poolBrowserPools);
  scheduleNextPoolLiveStatusRefresh();
}

/**
 * Catch up immediately when returning to a pool directory left open in the background.
 */
function handlePoolPageVisibilityChange() {
  if (document.hidden) {
    if (poolLiveStatusRefreshTimeout !== null) window.clearTimeout(poolLiveStatusRefreshTimeout);
    poolLiveStatusRefreshTimeout = null;
    return;
  }
  refreshPoolsForCurrentTime();
  scheduleNextPoolLiveStatusRefresh();
}

/**
 * Renders the list of pools in the #poolList element
 * @param {Pool[]} pools - Pool models to render
 */
function renderPools(pools) {
  const list = document.getElementById("poolList");
  if (!list) return;

  // Safety check - ensure pools is an array
  if (!Array.isArray(pools) || pools.length === 0) {
    list.innerHTML = `
      <div class="pool-card error">
        <h2>${IconCatalog.getTextGlyph('warning')} Pool directory did not load</h2>
        <p>Please check your connection and refresh the page to try again.</p>
      </div>
    `;
    return;
  }

  const expandedPoolIds = new Set(Array.from(list.querySelectorAll('.pool-card')).filter(poolCard => {
    const toggleButton = poolCard.querySelector('.pool-header__toggle');
    return toggleButton && toggleButton.getAttribute('aria-expanded') === 'true';
  }).map(poolCard => poolCard.dataset.poolId));
  const linkedPoolId = new URLSearchParams(window.location.search).get('pool');
  const isInitialRender = expandedPoolIds.size === 0 && !list.querySelector('.pool-card');
  poolLiveStatusSignature = getPoolLiveStatusSignature(pools);
  const preferences = PreferencesService.get();
  const favoritePoolName = preferences.favoritePoolName;
  const matchingFeaturePools = PreferencesService.filterPoolsByFeatures(pools, preferences.poolFeatureFilters);
  const filteredPools = filterPoolsByAvailability(matchingFeaturePools);
  const activeFilterCount = preferences.poolFeatureFilters.length + (poolAvailabilityFilter === 'all' ? 0 : 1);
  updatePoolFilterSummary(filteredPools.length, pools.length, activeFilterCount);
  if (filteredPools.length === 0) {
    list.innerHTML = `
      <div class="pool-filter__empty" role="status">
        <h2>No matching pools</h2>
        <p>Try changing availability or removing a selected feature.</p>
      </div>
    `;
    return;
  }
  /**
  * Compares pool models by display name.
  * @param {Pool} firstPool - First pool model
  * @param {Pool} secondPool - Second pool model
   * @returns {number} Locale comparison result
   * @private
   */
  const comparePools = (firstPool, secondPool) => {
    const firstName = (firstPool && firstPool.name) ? firstPool.name : '';
    const secondName = (secondPool && secondPool.name) ? secondPool.name : '';
    return firstName.localeCompare(secondName);
  };
  const distances = new Map(filteredPools.map(pool => [pool, getPoolDistance(pool)]));
  const sortedPools = poolSortOrder === 'distance' && userCoords
    ? [...filteredPools].sort((firstPool, secondPool) => {
      const firstDistance = distances.get(firstPool) ?? Number.POSITIVE_INFINITY;
      const secondDistance = distances.get(secondPool) ?? Number.POSITIVE_INFINITY;
      return firstDistance - secondDistance || comparePools(firstPool, secondPool);
    })
    : PreferencesService.sortWithFavorite(filteredPools, favoritePoolName, pool => pool.name || '', comparePools);

  // Build display-ready card state while keeping static markup in PoolCardDisplay.
  const html = sortedPools.map(pool => {
    const poolName = pool.name || 'Unknown Pool';
    const poolId = String(pool.id || '');
    const detailsId = `pool-details-${String(poolId || poolName).replace(/[^a-zA-Z0-9_-]/g, '-')}`;
    const isFavorite = poolName === favoritePoolName;
    const isExpanded = (isInitialRender && poolId === linkedPoolId)
      || (isFavorite ? preferences.favoritePoolExpanded : expandedPoolIds.has(poolId));

    const poolStatus = getPoolCardStatus(pool);
    const tooltipText = getStatusTooltip(poolStatus.kind);
    const availabilitySummary = getPoolCardAvailabilitySummary(pool);

    return PoolCardDisplay.render({
      pool,
      poolName,
      poolId,
      detailsId,
      isFavorite,
      isExpanded,
      distanceMiles: distances.get(pool),
      transitionText: availabilitySummary.text,
      transitionLabel: availabilitySummary.label,
      transitionAction: availabilitySummary.action,
      poolStatus,
      statusTooltip: tooltipText,
      isDetailsHydrated: false
    });
  }).join('');

  list.innerHTML = html;
  const statusLegend = document.getElementById('poolStatusLegend');
  if (statusLegend) statusLegend.hidden = false;
  scrollCalendarsToToday(list);
  if (poolSummaryVisible) void hydrateExpandedPoolDetails(list);
}

/**
 * Handles URL parameters to show a specific pool
 * If ?pool=poolId is in the URL, highlights the already expanded pool.
 */
function handlePoolUrlParameter() {
  const urlParams = new URLSearchParams(window.location.search);
  const poolId = urlParams.get('pool');
  if (!poolId) return;

  const escapedPoolId = window.CSS && typeof window.CSS.escape === 'function'
    ? window.CSS.escape(poolId)
    : poolId.replace(/[^a-zA-Z0-9_-]/g, '');
  const poolCard = escapedPoolId ? document.querySelector(`[data-pool-id="${escapedPoolId}"]`) : null;
  if (!poolCard) return;

  poolCard.classList.add('highlighted');

  setTimeout(() => {
    poolCard.classList.remove('highlighted');
  }, 3000);
}

/**
 * Toggles the collapsed state of a pool card
 * @param {Element} toggleButton - The disclosure button
 */
function togglePoolCard(toggleButton) {
  const poolCard = toggleButton.closest('.pool-card');
  const isExpanded = toggleButton.getAttribute('aria-expanded') === 'true';
  const details = poolCard.querySelector('.pool-details');
  poolCard.classList.toggle('collapsed', isExpanded);
  toggleButton.setAttribute('aria-expanded', String(!isExpanded));
  if (!isExpanded && window.cnslAnalytics) {
    window.cnslAnalytics.trackInteraction(
      AnalyticsInteractionType.DIRECTORY_DETAIL_OPEN,
      { directoryName: 'pools' }
    );
  }
  if (poolCard.dataset.poolName === PreferencesService.get().favoritePoolName) {
    const preferences = PreferencesService.get();
    PreferencesService.save({ ...preferences, favoritePoolExpanded: !isExpanded });
    if (window.cnslAnalytics) {
      window.cnslAnalytics.trackInteraction(AnalyticsInteractionType.FIXED_SETTING_CHANGE, {
        settingName: 'favorite_pool_expanded',
        settingValue: isExpanded ? 'collapsed' : 'expanded'
      });
    }
  }
  if (details) {
    details.hidden = isExpanded;
    if (!isExpanded) {
      void hydratePoolDetails(poolCard).then(hydratedDetails => {
        if (hydratedDetails) scrollCalendarsToToday(hydratedDetails);
      });
    }
  }
}

// ------------------------------
//    WEEK NAVIGATION FUNCTIONS
// ------------------------------

// ------------------------------
//    POOL-SPECIFIC NAVIGATION FUNCTIONS
// ------------------------------

/**
 * Navigate a specific pool to the previous week
 * @param {string} poolId - Pool identifier
 */
function navigatePoolToPreviousWeek(poolId) {
  PoolWeekStateService.moveWeekStart(poolId, -7);
  refreshPoolDisplay(poolId);
}

/**
 * Navigate a specific pool to the next week
 * @param {string} poolId - Pool identifier
 */
function navigatePoolToNextWeek(poolId) {
  PoolWeekStateService.moveWeekStart(poolId, 7);
  refreshPoolDisplay(poolId);
}

/**
 * Navigate a specific pool to a selected week
 * @param {string} poolId - Pool identifier
 * @param {string} dateValue - Selected date value
 */
function navigatePoolToSelectedWeek(poolId, dateValue) {
  if (!PoolWeekStateService.setSelectedWeekStart(poolId, dateValue)) return;
  refreshPoolDisplay(poolId);
}

/**
 * Navigate a specific pool to today's week
 * @param {string} poolId - Pool identifier
 */
function navigatePoolToToday(poolId) {
  PoolWeekStateService.setTodayWeekStart(poolId);
  refreshPoolDisplay(poolId);
}

/**
 * Refresh the display for a specific pool
 * @param {string} poolId - Pool identifier
 */
function refreshPoolDisplay(poolId) {
  if (!poolBrowserDataManager) return;

  // Find the pool card and update just its hours section
  const escapedPoolId = window.CSS && typeof window.CSS.escape === 'function'
    ? window.CSS.escape(poolId)
    : String(poolId).replace(/[^a-zA-Z0-9_-]/g, '');
  const poolCard = escapedPoolId ? document.querySelector(`[data-pool-id="${escapedPoolId}"]`) : null;
  if (!poolCard) return;

  const pool = getPoolModel(poolId);

  if (pool) {
    // Find the pool-hours container in the pool card
    const poolCardContainer = poolCard.closest('.pool-card');
    const hoursElement = poolCardContainer.querySelector('.pool-hours');

    if (hoursElement) {
      // Generate the new hours content
      const newHoursContent = formatPoolHours(pool);

      // Replace the entire content of the pool-hours div
      hoursElement.outerHTML = newHoursContent;
        syncPoolTransitionSummary(poolCard);

      // Re-setup event handlers for the new controls
      setupPoolNavigationHandlers();
      scrollCalendarsToToday(poolCard);
    }
  }
}

/**
 * Setup event handlers for all pool navigation controls
 */
function setupPoolNavigationHandlers() {
  // Remove existing handlers to prevent duplicates
  document.removeEventListener('click', handlePoolNavigationClick);
  document.removeEventListener('change', handlePoolDatePickerChange);

  // Add new handlers
  document.addEventListener('click', handlePoolNavigationClick);
  document.addEventListener('change', handlePoolDatePickerChange);
}

/**
 * Applies changed preferences and requests location when newly enabled.
 */
function refreshPoolsForPreferences() {
  if (!document.getElementById('poolList') || poolBrowserPools.length === 0) return;

  if (!PreferencesService.get().locationAwarenessEnabled) {
    userCoords = null;
    poolSortOrder = 'name';
    setupPoolSortControl();
  }
  setupPoolFeatureFilters(poolBrowserPools);
  renderPools(poolBrowserPools);
  if (!document.prerendering && PreferencesService.get().locationAwarenessEnabled && !userCoords) getUserLocation();
}

/**
 * Handle clicks on pool navigation buttons
 * @param {Event} event - Click event
 */
function handlePoolNavigationClick(event) {
  PoolCalendarControls.handleClick(event, {
    toggleCard: togglePoolCard,
    previousWeek: navigatePoolToPreviousWeek,
    nextWeek: navigatePoolToNextWeek,
    today: navigatePoolToToday,
    selectedWeek: navigatePoolToSelectedWeek
  });
}

/**
 * Handle changes to pool date pickers
 * @param {Event} event - Change event
 */
function handlePoolDatePickerChange(event) {
  PoolCalendarControls.handleChange(event, { selectedWeek: navigatePoolToSelectedWeek });
}

/**
 * Starts work that may request optional domains or browser permissions after activation.
 */
function startPoolBrowserActivationWork() {
  void startPoolBrowserDetailWork();
  startPoolBrowserEnrichment();

  // The preference guard prevents a browser location prompt unless it is enabled in Settings.
  try {
    getUserLocation();
  } catch (_locationError) {
    // Continue without location data - pools are already rendered
  }
}

/**
 * Starts optional Pools work after document readiness can no longer be delayed.
 */
function startPoolBrowserActivationWorkWhenReady() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startPoolBrowserActivationWork, { once: true });
    return;
  }

  startPoolBrowserActivationWork();
}

/**
 * Defers optional Pools work until document readiness and hidden prerender activation.
 */
function schedulePoolBrowserActivationWork() {
  if (!document.prerendering) {
    startPoolBrowserActivationWorkWhenReady();
    return;
  }

  document.addEventListener('prerenderingchange', startPoolBrowserActivationWorkWhenReady, { once: true });
}

/**
 * Starts the pool directory as soon as its deferred controller executes.
 * @returns {Promise<void>} Promise settled after initial summaries and activation work is scheduled
 */
async function startPoolBrowser() {
  if (globalThis.cnslSeasonState && globalThis.cnslSeasonState.isOffSeason) {
    globalThis.cnslRouteWarmupReadiness.report(globalThis.ROUTE_WARMUP_READINESS_STATES.READY);
    return;
  }
  // Check if we're on the pools page before fetching data
  if (!document.getElementById("poolList")) {
    globalThis.cnslRouteWarmupReadiness.report(globalThis.ROUTE_WARMUP_READINESS_STATES.READY);
    return;
  }

  try {
    // Initialize the data manager with the new OOP system
    await initializePoolBrowser();

    loadSeasonInfo();

    // Get pools from the data manager
    const poolsManager = poolBrowserDataManager.getPools();
    const pools = poolsManager.getAllPools();

    poolBrowserPools = pools;
    setupPoolFeatureFilters(pools);

    // Always render pools first with no location data
    renderPools(pools);
    markPoolPerformance('summary-visible');
    poolSummaryVisible = true;
    startPoolLiveStatusUpdates();
    setPoolListStatus(`Pool directory loaded. ${pools.length} pools available.`, false);
    globalThis.cnslRouteWarmupReadiness.report(globalThis.ROUTE_WARMUP_READINESS_STATES.READY);
    schedulePoolBrowserActivationWork();

    // Set up pool-specific navigation event handlers
    setupPoolNavigationHandlers();

    // Handle URL parameters to show specific pool
    handlePoolUrlParameter();

  } catch (error) {
    console.error("Failed to load pool data:", error);
    const list = document.getElementById("poolList");
    if (list) {
      list.innerHTML = `<p>${IconCatalog.getTextGlyph('warning')} The pool directory did not load. Please check your connection and refresh the page to try again.</p>`;
    }
    setPoolListStatus('The pool directory did not load. Please check your connection and refresh the page to try again.', false);
    globalThis.cnslRouteWarmupReadiness.report(globalThis.ROUTE_WARMUP_READINESS_STATES.READY);
  }
}

void startPoolBrowser();

window.addEventListener(globalThis.PREFERENCES_CHANGED_EVENT_NAME, refreshPoolsForPreferences);
document.addEventListener('visibilitychange', handlePoolPageVisibilityChange);

// Make functions available globally
