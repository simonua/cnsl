(function showCachedWeatherAlertBeforePaint() {
  'use strict';

  try {
    const refreshMinutes = typeof PreferencesService === 'undefined' ? globalThis.WEATHER_ALERT_DEFAULT_REFRESH_MINUTES : PreferencesService.get().weatherRefreshMinutes;
    if (refreshMinutes === 0) return;
    const cached = JSON.parse(sessionStorage.getItem(globalThis.WEATHER_ALERT_STATUS_STORAGE_KEY));
    const status = cached && cached.status;
    if (!cached || cached.refreshMinutes !== refreshMinutes || cached.expiresAt <= Date.now() || !status || !status.isInclement) return;

    const isExpanded = sessionStorage.getItem(globalThis.WEATHER_ALERT_DISCLOSURE_STORAGE_KEY) !== 'false';
    WeatherAlertDisplay.render(status, isExpanded, globalThis.APP_TIMEZONE);
  } catch (_error) {
    return;
  }
}());
