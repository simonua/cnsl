// Compact modern Android baseline; recent standard iPhone portrait widths are wider.
const MOBILE_VIEWPORT = Object.freeze({ width: 360, height: 780 });

async function prepareStableWeatherResponses(page) {
  await page.route('https://api.weather.gov/**', async route => {
    const requestUrl = route.request().url();
    if (requestUrl.includes('/alerts/')) {
      await route.fulfill({ json: { features: [] } });
      return;
    }
    if (requestUrl.includes('/points/')) {
      await route.fulfill({ json: { properties: { forecast: 'https://api.weather.gov/gridpoints/test' } } });
      return;
    }
    await route.fulfill({ json: { properties: { periods: [] } } });
  });
}

async function prepareVisibleWeatherAlert(page) {
  await page.unroute('https://api.weather.gov/**');
  await page.route('https://api.weather.gov/**', route => route.fulfill({
    json: { features: [{ properties: { event: 'Severe Thunderstorm Warning' } }] }
  }));
  await page.route('**/js/config/weather-operating-windows.js*', route => {
    return route.fulfill({
      body: 'globalThis.WEATHER_OPERATING_WINDOWS = { dailyOperatingWindows: new Proxy({}, { get: () => [0, 1439] }) };',
      contentType: 'text/javascript'
    });
  });
}

async function seedPreferences(page, preferences) {
  await page.addInitScript(initialPreferences => {
    localStorage.setItem('cnsl_preferences', JSON.stringify(initialPreferences));
  }, preferences);
}

async function initializeAnalyticsRecorder(page) {
  await page.addInitScript(() => {
    const analyticsEventsKey = 'playwright_recorded_analytics_events';
    const savedEvents = JSON.parse(sessionStorage.getItem(analyticsEventsKey) || '[]');
    globalThis.recordedAnalyticsEvents = Array.isArray(savedEvents) ? savedEvents : [];
    globalThis.gtag = (...eventArguments) => {
      globalThis.recordedAnalyticsEvents.push(eventArguments);
      sessionStorage.setItem(analyticsEventsKey, JSON.stringify(globalThis.recordedAnalyticsEvents));
    };
  });
}

async function setAgendaReferenceTime(page) {
  await page.clock.setFixedTime(new Date('2026-05-26T12:00:00'));
}

module.exports = {
  MOBILE_VIEWPORT,
  initializeAnalyticsRecorder,
  prepareStableWeatherResponses,
  prepareVisibleWeatherAlert,
  seedPreferences,
  setAgendaReferenceTime
};
