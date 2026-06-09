(function showCachedWeatherAlertBeforePaint() {
  'use strict';

  try {
    const refreshMinutes = typeof PreferencesService === 'undefined' ? globalThis.WEATHER_ALERT_DEFAULT_REFRESH_MINUTES : PreferencesService.get().weatherRefreshMinutes;
    if (refreshMinutes === 0) return;
    const cached = JSON.parse(sessionStorage.getItem(globalThis.WEATHER_ALERT_STATUS_STORAGE_KEY));
    const status = cached && cached.status;
    if (!cached || cached.refreshMinutes !== refreshMinutes || cached.expiresAt <= Date.now() || !status || !status.isInclement) return;

    const banner = document.getElementById('weatherAlert');
    const toggle = document.getElementById('weatherAlertToggle');
    const message = document.getElementById('weatherAlertMessage');
    const updated = document.getElementById('weatherAlertUpdated');
    const isExpanded = sessionStorage.getItem(globalThis.WEATHER_ALERT_DISCLOSURE_STORAGE_KEY) !== 'false';
    const actionLabel = `${isExpanded ? 'Collapse' : 'Expand'} weather safety alert`;
    const updatedAt = new Date(status.updatedAt);

    message.textContent = status.message;
    updated.dateTime = status.updatedAt;
    updated.textContent = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric', minute: '2-digit', timeZone: globalThis.APP_TIMEZONE
    }).format(updatedAt);
    banner.classList.toggle('weather-alert--collapsed', !isExpanded);
    toggle.setAttribute('aria-expanded', String(isExpanded));
    toggle.setAttribute('aria-label', actionLabel);
    toggle.title = actionLabel;
    toggle.hidden = false;
    banner.hidden = false;
  } catch (_error) {
    return;
  }
}());
