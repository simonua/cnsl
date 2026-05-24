(function initializeWeatherAlert() {
  'use strict';

  async function showWeatherAlertWhenNeeded() {
    const banner = document.getElementById('weatherAlert');
    const message = document.getElementById('weatherAlertMessage');
    if (!banner || !message || typeof WeatherAlertService === 'undefined') return;

    let poolData = null;
    if (typeof getDataManager === 'function') {
      try {
        const dataManager = getDataManager();
        await dataManager.initialize();
        poolData = { pools: dataManager.getPools().getAllPools().map(pool => pool.toJSON()) };
      } catch (_error) {
        poolData = null;
      }
    }

    const status = await WeatherAlertService.getCurrentStatus(poolData ? { poolData } : {
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
