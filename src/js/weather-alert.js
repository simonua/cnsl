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
    const banner = document.getElementById('weatherAlert');
    const toggle = document.getElementById('weatherAlertToggle');
    if (!banner || !toggle) return;

    const actionLabel = `${isExpanded ? 'Collapse' : 'Expand'} weather safety alert`;
    banner.classList.toggle('weather-alert--collapsed', !isExpanded);
    toggle.hidden = false;
    toggle.setAttribute('aria-expanded', String(isExpanded));
    toggle.setAttribute('aria-label', actionLabel);
    toggle.title = actionLabel;
    if (shouldSave) saveExpandedState(isExpanded);
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
          return { pools: dataManager.getPools().getAllPools().map(pool => pool.toJSON()) };
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
    const message = document.getElementById('weatherAlertMessage');
    const updated = document.getElementById('weatherAlertUpdated');
    const sourceLink = document.getElementById('weatherAlertSourceLink');
    if (!banner || !message || !updated || !sourceLink) return;

    notifyWeatherAlertStatus(status);

    if (!status.isInclement) {
      banner.hidden = true;
      return;
    }

    const updatedAt = new Date(status.updatedAt);
    message.textContent = status.message;
    sourceLink.hidden = status.source !== 'alert';
    updated.dateTime = status.updatedAt;
    updated.textContent = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: WeatherAlertService.EASTERN_TIMEZONE
    }).format(updatedAt);
    setWeatherAlertExpanded(readSavedExpandedState());
    banner.hidden = false;
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
   * Renders the footer's latest successful weather-check timestamp.
   * @private
   */
  function renderFooterWeatherFreshness() {
    const freshness = document.getElementById('footerWeatherFreshness');
    const updated = document.getElementById('footerWeatherUpdated');
    const notChecked = document.getElementById('footerWeatherNotChecked');
    if (!freshness || !updated || !notChecked || typeof WeatherAlertService === 'undefined') return;

    const isEnabled = getWeatherRefreshMinutes() !== 0;
    const latestStatus = WeatherAlertService.readLatestCheckedStatus();
    freshness.hidden = !isEnabled;
    updated.hidden = !latestStatus;
    notChecked.hidden = Boolean(latestStatus);
    if (!isEnabled || !latestStatus) return;

    const updatedAt = new Date(latestStatus.updatedAt);
    updated.dateTime = latestStatus.updatedAt;
    const updatedDate = new Intl.DateTimeFormat('en-US', {
      day: 'numeric',
      month: 'long',
      timeZone: WeatherAlertService.EASTERN_TIMEZONE
    }).format(updatedAt);
    const updatedTime = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: WeatherAlertService.EASTERN_TIMEZONE
    }).format(updatedAt);
    updated.textContent = `${updatedDate}, ${updatedTime}`;
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

    renderFooterWeatherFreshness();
    refreshWeatherAlert();
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) refreshWeatherAlert();
    });
    window.addEventListener('cnsl:preferences-changed', refreshWeatherAlert);
    window.addEventListener('cnsl:preferences-changed', renderFooterWeatherFreshness);
    window.addEventListener('cnsl:weather-alert-status-changed', renderFooterWeatherFreshness);
    window.addEventListener('storage', event => {
      if (typeof PreferencesService !== 'undefined' && event.key === PreferencesService.STORAGE_KEY) {
        refreshWeatherAlert();
      }
      if (event.key === WeatherAlertService.LAST_SUCCESSFUL_CHECK_KEY) {
        renderFooterWeatherFreshness();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startWeatherAlertUpdates);
  } else {
    startWeatherAlertUpdates();
  }
}());
