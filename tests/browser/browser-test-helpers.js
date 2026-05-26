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
  await page.route('**/assets/data/2026/pools/pools.json*', async route => {
    const response = await route.fetch();
    const data = await response.json();
    data.pools[0].schedules = [{
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      hours: [{
        weekDays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
        types: ['Rec Swim'],
        startTime: '12:00am',
        endTime: '11:59pm'
      }]
    }];
    await route.fulfill({ response, json: data });
  });
}

async function seedPreferences(page, preferences) {
  await page.addInitScript(initialPreferences => {
    localStorage.setItem('cnsl_preferences', JSON.stringify(initialPreferences));
  }, preferences);
}

async function initializeAnalyticsRecorder(page) {
  await page.addInitScript(() => {
    globalThis.recordedAnalyticsEvents = [];
    globalThis.gtag = (...eventArguments) => globalThis.recordedAnalyticsEvents.push(eventArguments);
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