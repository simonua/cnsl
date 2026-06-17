(function initializeCachedWeatherDisplay() {
  'use strict';

  /**
   * Gets the configured weather refresh interval.
   * @returns {number} Refresh interval in minutes
   * @private
   */
  function getWeatherRefreshMinutes() {
    return typeof PreferencesService === 'undefined'
      ? globalThis.WEATHER_ALERT_DEFAULT_REFRESH_MINUTES
      : PreferencesService.get().weatherRefreshMinutes;
  }

  /**
   * Renders the footer's durable weather-check timestamp before paint and after updates.
   * @private
   */
  function renderFooterWeatherFreshness() {
    const freshness = document.getElementById('footerWeatherFreshness');
    const updated = document.getElementById('footerWeatherUpdated');
    if (!freshness || !updated) return;

    const latestStatus = globalThis.WeatherFreshnessService.read();
    const hasVisibleUpdate = getWeatherRefreshMinutes() !== 0 && Boolean(latestStatus);
    freshness.setAttribute('aria-hidden', String(!hasVisibleUpdate));
    updated.hidden = !hasVisibleUpdate;
    if (!hasVisibleUpdate) return;

    const updatedAt = new Date(latestStatus.updatedAt);
    updated.dateTime = latestStatus.updatedAt;
    const updatedDate = new Intl.DateTimeFormat('en-US', {
      day: 'numeric',
      month: 'long',
      timeZone: globalThis.APP_TIMEZONE
    }).format(updatedAt);
    const updatedTime = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: globalThis.APP_TIMEZONE
    }).format(updatedAt);
    updated.textContent = `${updatedDate}, ${updatedTime}`;
  }

  globalThis.renderFooterWeatherFreshness = renderFooterWeatherFreshness;
  renderFooterWeatherFreshness();

  try {
    const refreshMinutes = getWeatherRefreshMinutes();
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
