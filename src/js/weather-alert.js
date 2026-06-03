(function initializeWeatherAlert() {
  'use strict';

  let scheduledRefresh = null;
  let poolDataPromise = null;

  function getWeatherRefreshMinutes() {
    return typeof PreferencesService === 'undefined'
      ? WeatherAlertService.DEFAULT_REFRESH_MINUTES
      : PreferencesService.get().weatherRefreshMinutes;
  }

  function hideWeatherAlert() {
    const banner = document.getElementById('weatherAlert');
    if (banner) banner.hidden = true;
  }

  function readSavedExpandedState() {
    try {
      const savedState = window.sessionStorage.getItem(window.WEATHER_ALERT_DISCLOSURE_STORAGE_KEY);
      return savedState === null ? true : savedState === 'true';
    } catch (_error) {
      return true;
    }
  }

  function saveExpandedState(isExpanded) {
    try {
      window.sessionStorage.setItem(window.WEATHER_ALERT_DISCLOSURE_STORAGE_KEY, String(isExpanded));
    } catch (_error) {
      return;
    }
  }

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

  function toggleWeatherAlert() {
    const toggle = document.getElementById('weatherAlertToggle');
    if (!toggle) return;

    setWeatherAlertExpanded(toggle.getAttribute('aria-expanded') !== 'true', true);
  }

  function scheduleRefresh(delayMilliseconds) {
    window.clearTimeout(scheduledRefresh);
    scheduledRefresh = window.setTimeout(refreshWeatherAlert, delayMilliseconds);
  }

  async function getPoolData() {
    if (poolDataPromise) return poolDataPromise;

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

  function renderWeatherAlert(status) {
    const banner = document.getElementById('weatherAlert');
    const message = document.getElementById('weatherAlertMessage');
    const updated = document.getElementById('weatherAlertUpdated');
    if (!banner || !message || !updated) return;

    notifyWeatherAlertStatus(status);

    if (!status.isInclement) {
      banner.hidden = true;
      return;
    }

    const updatedAt = new Date(status.updatedAt);
    message.textContent = status.message;
    updated.dateTime = status.updatedAt;
    updated.textContent = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: WeatherAlertService.EASTERN_TIMEZONE,
      timeZoneName: 'short'
    }).format(updatedAt);
    setWeatherAlertExpanded(readSavedExpandedState());
    banner.hidden = false;
  }

  function notifyWeatherAlertStatus(status) {
    WeatherAlertService.setLatestStatus(status);
    window.dispatchEvent(new CustomEvent('cnsl:weather-alert-status-changed'));
  }

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

  function startWeatherAlertUpdates() {
    const toggle = document.getElementById('weatherAlertToggle');
    if (toggle) toggle.addEventListener('click', toggleWeatherAlert);

    refreshWeatherAlert();
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) refreshWeatherAlert();
    });
    window.addEventListener('cnsl:preferences-changed', refreshWeatherAlert);
    window.addEventListener('storage', event => {
      if (typeof PreferencesService !== 'undefined' && event.key === PreferencesService.STORAGE_KEY) {
        refreshWeatherAlert();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startWeatherAlertUpdates);
  } else {
    startWeatherAlertUpdates();
  }
}());
