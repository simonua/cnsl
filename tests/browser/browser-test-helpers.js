const fs = require('node:fs');
const path = require('node:path');
const AppConfig = require('../../scripts/adapters/app-config.js');

const ALLOWED_ANNUAL_DATA_DOMAINS = new Set(['meets', 'pools', 'teams']);
const ACTIVE_SEASON_YEAR = AppConfig.YEAR;

const AUDIENCE_VIEWPORTS = Object.freeze({
  COMPACT_PHONE: Object.freeze({ width: 360, height: 780 }),
  LARGE_PHONE: Object.freeze({ width: 440, height: 956 }),
  LAPTOP: Object.freeze({ width: 1440, height: 900 }),
  NARROW_PHONE: Object.freeze({ width: 320, height: 693 }),
  PRIMARY_PHONE: Object.freeze({ width: 393, height: 852 }),
  TABLET_PORTRAIT: Object.freeze({ width: 820, height: 1180 }),
  WIDE_DESKTOP: Object.freeze({ width: 1920, height: 1080 })
});
const MOBILE_VIEWPORT = AUDIENCE_VIEWPORTS.PRIMARY_PHONE;

function getAnnualDataRoute(domain) {
  if (!ALLOWED_ANNUAL_DATA_DOMAINS.has(domain)) {
    throw new Error(`Unsupported annual data domain: ${domain}`);
  }
  return `**/assets/data/${ACTIVE_SEASON_YEAR}/${domain}/${domain}.json*`;
}

function getAnnualDataUrlPattern(domain) {
  if (!ALLOWED_ANNUAL_DATA_DOMAINS.has(domain)) {
    throw new Error(`Unsupported annual data domain: ${domain}`);
  }
  return new RegExp(`/assets/data/${ACTIVE_SEASON_YEAR}/${domain}/${domain}\\.json`);
}

function readAnnualData(domain) {
  if (!ALLOWED_ANNUAL_DATA_DOMAINS.has(domain)) {
    throw new Error(`Unsupported annual data domain: ${domain}`);
  }
  const dataPath = path.join(__dirname, '..', '..', 'src', 'assets', 'data', String(ACTIVE_SEASON_YEAR), domain, `${domain}.json`);
  return JSON.parse(fs.readFileSync(dataPath, 'utf8'));
}

function activeSeasonDate(dateAndTime) {
  return new Date(`${ACTIVE_SEASON_YEAR}-${dateAndTime}`);
}

function getOffSeasonReferenceTime() {
  const { seasonEndDate } = readAnnualData('pools');
  const referenceDate = new Date(`${seasonEndDate}T12:00:00-04:00`);
  referenceDate.setDate(referenceDate.getDate() + 1);
  return referenceDate;
}

async function routeAnnualData(page, domain, transform) {
  await page.route(getAnnualDataRoute(domain), async route => {
    const response = await route.fetch();
    const annualData = await response.json();
    const fixtureData = structuredClone(annualData);
    const transformedData = await transform(fixtureData);
    await route.fulfill({ response, json: transformedData ?? fixtureData });
  });
}

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
  await page.clock.setFixedTime(activeSeasonDate('05-26T12:00:00'));
}

module.exports = {
  ACTIVE_SEASON_YEAR,
  AUDIENCE_VIEWPORTS,
  MOBILE_VIEWPORT,
  activeSeasonDate,
  getAnnualDataRoute,
  getAnnualDataUrlPattern,
  getOffSeasonReferenceTime,
  initializeAnalyticsRecorder,
  prepareStableWeatherResponses,
  prepareVisibleWeatherAlert,
  readAnnualData,
  routeAnnualData,
  seedPreferences,
  setAgendaReferenceTime
};
