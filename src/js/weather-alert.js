(function initializeWeatherAlert() {
  'use strict';

  let scheduledRefresh = null;
  let poolDataPromise = null;

  /**
   * Gets the configured weather refresh interval.
   * @returns {number} Refresh interval in minutes
   * @private
   */
  function getWeatherRefreshMinutes() {
    return typeof PreferencesService === 'undefined'
      ? WeatherAlertService.DEFAULT_REFRESH_MINUTES
      : PreferencesService.get().weatherRefreshMinutes;
  }

  /**
   * Hides the weather alert banner when present.
   * @private
   */
  function hideWeatherAlert() {
    const banner = document.getElementById('weatherAlert');
    if (banner) banner.hidden = true;
  }

  /**
   * Reads the saved weather-alert disclosure state.
   * @returns {boolean} Whether the alert should be expanded
   * @private
   */
  function readSavedExpandedState() {
    try {
      const savedState = window.sessionStorage.getItem(window.WEATHER_ALERT_DISCLOSURE_STORAGE_KEY);
      return savedState === null ? true : savedState === 'true';
    } catch (_error) {
      return true;
    }
  }

  /**
   * Persists the weather-alert disclosure state for the session.
   * @param {boolean} isExpanded - Whether the alert is expanded
   * @private
   */
  function saveExpandedState(isExpanded) {
    try {
      window.sessionStorage.setItem(window.WEATHER_ALERT_DISCLOSURE_STORAGE_KEY, String(isExpanded));
    } catch (_error) {
      return;
    }
  }

  /**
   * Applies weather-alert disclosure state and accessible control labels.
   * @param {boolean} isExpanded - Whether the alert should be expanded
   * @param {boolean} [shouldSave] - Whether to persist the state
   * @private
   */
  function setWeatherAlertExpanded(isExpanded, shouldSave = false) {
    const didRender = WeatherAlertDisplay.setExpanded(isExpanded);
    if (didRender && shouldSave) saveExpandedState(isExpanded);
  }

  /**
   * Toggles and saves the weather-alert disclosure state.
   * @private
   */
  function toggleWeatherAlert() {
    const toggle = document.getElementById('weatherAlertToggle');
    if (!toggle) return;

    setWeatherAlertExpanded(toggle.getAttribute('aria-expanded') !== 'true', true);
  }

  /**
   * Replaces the pending weather refresh timer.
   * @param {number} delayMilliseconds - Delay before refreshing
   * @private
   */
  function scheduleRefresh(delayMilliseconds) {
    window.clearTimeout(scheduledRefresh);
    scheduledRefresh = window.setTimeout(refreshWeatherAlert, delayMilliseconds);
  }

  /**
   * Loads pool operating-window data once for weather checks.
   * @returns {Promise<Object>} Pool data or precomputed operating-window data
   * @private
   */
  async function getPoolData() {
    if (poolDataPromise) return poolDataPromise;

    if (globalThis.WEATHER_OPERATING_WINDOWS) {
      poolDataPromise = Promise.resolve(globalThis.WEATHER_OPERATING_WINDOWS);
      return poolDataPromise;
    }

    poolDataPromise = (async () => {
      if (typeof getDataManager === 'function') {
        try {
          const dataManager = getDataManager();
          await dataManager.initialize(['pools']);
          return {
            pools: dataManager.getPools().getAllPools().map(pool => ({
              location: pool.location,
              schedules: pool.schedulePeriods,
              scheduleOverrides: pool.scheduleOverrides
            }))
          };
        } catch (_error) {
          return WeatherAlertService.fetchJson(`assets/data/${YEAR}/pools/pools.json`, fetch);
        }
      }

      return WeatherAlertService.fetchJson(`assets/data/${YEAR}/pools/pools.json`, fetch);
    })();

    return poolDataPromise;
  }

  /**
   * Renders the current weather status and alert disclosure state.
   * @param {Object} status - Normalized weather alert status
   * @private
   */
  function renderWeatherAlert(status) {
    const banner = document.getElementById('weatherAlert');
    if (!banner) return;

    notifyWeatherAlertStatus(status);

    if (!status.isInclement) {
      banner.hidden = true;
      return;
    }

    WeatherAlertDisplay.render(status, readSavedExpandedState(), WeatherAlertService.EASTERN_TIMEZONE);
  }

  /**
   * Stores the latest status and notifies other weather-status views.
   * @param {Object} status - Normalized weather alert status
   * @private
   */
  function notifyWeatherAlertStatus(status) {
    WeatherAlertService.setLatestStatus(status);
    window.dispatchEvent(new CustomEvent('cnsl:weather-alert-status-changed'));
  }

  /**
   * Refreshes weather status and schedules the next eligible check.
   * @returns {Promise<void>} Promise settled after the current refresh attempt
   * @private
   */
  async function refreshWeatherAlert() {
    window.clearTimeout(scheduledRefresh);
    if (typeof WeatherAlertService === 'undefined') return;

    const refreshMinutes = getWeatherRefreshMinutes();
    if (refreshMinutes === 0) {
      notifyWeatherAlertStatus({ isInclement: false, reason: 'updates-disabled' });
      hideWeatherAlert();
      return;
    }

    const cached = WeatherAlertService.readCachedStatusEntry(WeatherAlertService.getSessionStorage(), refreshMinutes);
    if (cached) {
      WeatherAlertService.rememberLatestCheckedStatus(cached.status);
      renderWeatherAlert(cached.status);
      scheduleRefresh(Math.max(0, cached.expiresAt - Date.now()));
      return;
    }

    const poolData = await getPoolData();
    const operatingWindow = WeatherAlertService.getPoolOperatingWindow(poolData);
    if (!operatingWindow || operatingWindow.currentMinutes >= operatingWindow.closeMinutes) {
      notifyWeatherAlertStatus({ isInclement: false, reason: 'outside-pool-operating-window' });
      hideWeatherAlert();
      return;
    }

    if (operatingWindow.currentMinutes < operatingWindow.notificationStartMinutes) {
      notifyWeatherAlertStatus({ isInclement: false, reason: 'outside-pool-operating-window' });
      hideWeatherAlert();
      scheduleRefresh((operatingWindow.notificationStartMinutes - operatingWindow.currentMinutes) * 60 * 1000);
      return;
    }

    const status = await WeatherAlertService.getCurrentStatus({ poolData, refreshMinutes });
    renderWeatherAlert(status);
    scheduleRefresh(refreshMinutes * 60 * 1000);
  }

  /**
   * Binds weather controls and starts status and freshness updates.
   * @private
   */
  function startWeatherAlertUpdates() {
    const toggle = document.getElementById('weatherAlertToggle');
    if (toggle) toggle.addEventListener('click', toggleWeatherAlert);

    globalThis.renderFooterWeatherFreshness();
    refreshWeatherAlert();
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) refreshWeatherAlert();
    });
    window.addEventListener(globalThis.PREFERENCES_CHANGED_EVENT_NAME, refreshWeatherAlert);
    window.addEventListener(globalThis.PREFERENCES_CHANGED_EVENT_NAME, globalThis.renderFooterWeatherFreshness);
    window.addEventListener('cnsl:weather-alert-status-changed', globalThis.renderFooterWeatherFreshness);
    window.addEventListener('storage', event => {
      if (event.key === WeatherAlertService.LAST_SUCCESSFUL_CHECK_KEY) {
        globalThis.renderFooterWeatherFreshness();
      }
    });
  }

  startWeatherAlertUpdates();
}());
