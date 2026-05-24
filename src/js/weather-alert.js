(function initializeWeatherAlert() {
  'use strict';

  async function showWeatherAlertWhenNeeded() {
    const banner = document.getElementById('weatherAlert');
    const message = document.getElementById('weatherAlertMessage');
    if (!banner || !message || typeof WeatherAlertService === 'undefined') return;

    const status = await WeatherAlertService.getCurrentStatus({
      poolDataUrl: `assets/data/${YEAR}/pools/pools.json`
    });
    if (!status.isInclement) return;

    message.textContent = status.message;
    banner.hidden = false;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', showWeatherAlertWhenNeeded);
  } else {
    showWeatherAlertWhenNeeded();
  }
}());
