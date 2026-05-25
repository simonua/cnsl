/**
 * Application configuration shared by browser pages and the service worker.
 */
(function initializeAppConfig(globalScope) {
  // Published site and active season metadata.
  const YEAR = 2026;
  const OFFICIAL_SOURCE_CHECKED_ON = '2026-05-24';
  const APP_VERSION = '2.0.0-beta.9';
  const APP_LAST_UPDATED_ON = '2026-05-25';
  const HOME_PAGE_HOSTNAME = 'pools.longreachmarlins.org';
  const HOME_PAGE_URL = `https://${HOME_PAGE_HOSTNAME}`;

  // External services and regional behavior.
  const GA4_MEASUREMENT_ID = 'G-ZMBPYQKLQP';
  const APP_TIMEZONE = 'America/New_York';
  const WEATHER_API_BASE_URL = 'https://api.weather.gov';
  const WEATHER_LOCATION_POINT = '39.2014,-76.8610';
  const GOOGLE_MAPS_SEARCH_BASE_URL = 'https://www.google.com/maps/search/?api=1&query=';

  // Weather alert experience policy.
  const WEATHER_ALERT_DEFAULT_REFRESH_MINUTES = 5;
  const WEATHER_ALERT_REFRESH_MINUTES_OPTIONS = Object.freeze([0, 5, 10]);
  const WEATHER_ALERT_FORECAST_WINDOW_HOURS = 24;
  const WEATHER_ALERT_OPENING_LEAD_MINUTES = 60;
  const WEATHER_ALERT_MOBILE_MEDIA_QUERY = '(max-width: 48rem)';

  // Device-local preference and presentation state keys.
  const PREFERENCES_STORAGE_KEY = 'cnsl_preferences';
  const WEATHER_ALERT_STATUS_STORAGE_KEY = 'cnsl_weather_alert_status';
  const WEATHER_ALERT_DISCLOSURE_STORAGE_KEY = 'cnsl_weather_alert_expanded';

  // Offline caching and local development runtime behavior.
  const PWA_CACHE_PREFIX = 'cnsl-static-';
  const LOCAL_DEVELOPMENT_HOSTNAMES = Object.freeze(['localhost', '127.0.0.1']);
  const LOCAL_DEVELOPMENT_PORT = '9090';

  function exposeConstant(name, value) {
    if (Object.prototype.hasOwnProperty.call(globalScope, name)) {
      if (globalScope[name] !== value) {
        throw new Error(`The configured ${name} does not match the loaded application configuration.`);
      }
      return;
    }

    Object.defineProperty(globalScope, name, {
      configurable: false,
      enumerable: true,
      value,
      writable: false
    });
  }

  exposeConstant('YEAR', YEAR);
  exposeConstant('HOME_PAGE_HOSTNAME', HOME_PAGE_HOSTNAME);
  exposeConstant('HOME_PAGE_URL', HOME_PAGE_URL);
  exposeConstant('GA4_MEASUREMENT_ID', GA4_MEASUREMENT_ID);
  exposeConstant('APP_TIMEZONE', APP_TIMEZONE);
  exposeConstant('PREFERENCES_STORAGE_KEY', PREFERENCES_STORAGE_KEY);
  exposeConstant('WEATHER_API_BASE_URL', WEATHER_API_BASE_URL);
  exposeConstant('WEATHER_LOCATION_POINT', WEATHER_LOCATION_POINT);
  exposeConstant('WEATHER_ALERT_STATUS_STORAGE_KEY', WEATHER_ALERT_STATUS_STORAGE_KEY);
  exposeConstant('WEATHER_ALERT_DISCLOSURE_STORAGE_KEY', WEATHER_ALERT_DISCLOSURE_STORAGE_KEY);
  exposeConstant('WEATHER_ALERT_DEFAULT_REFRESH_MINUTES', WEATHER_ALERT_DEFAULT_REFRESH_MINUTES);
  exposeConstant('WEATHER_ALERT_REFRESH_MINUTES_OPTIONS', WEATHER_ALERT_REFRESH_MINUTES_OPTIONS);
  exposeConstant('WEATHER_ALERT_FORECAST_WINDOW_HOURS', WEATHER_ALERT_FORECAST_WINDOW_HOURS);
  exposeConstant('WEATHER_ALERT_OPENING_LEAD_MINUTES', WEATHER_ALERT_OPENING_LEAD_MINUTES);
  exposeConstant('WEATHER_ALERT_MOBILE_MEDIA_QUERY', WEATHER_ALERT_MOBILE_MEDIA_QUERY);
  exposeConstant('GOOGLE_MAPS_SEARCH_BASE_URL', GOOGLE_MAPS_SEARCH_BASE_URL);
  exposeConstant('PWA_CACHE_PREFIX', PWA_CACHE_PREFIX);
  exposeConstant('LOCAL_DEVELOPMENT_HOSTNAMES', LOCAL_DEVELOPMENT_HOSTNAMES);
  exposeConstant('LOCAL_DEVELOPMENT_PORT', LOCAL_DEVELOPMENT_PORT);

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      APP_LAST_UPDATED_ON,
      APP_TIMEZONE,
      APP_VERSION,
      GA4_MEASUREMENT_ID,
      GOOGLE_MAPS_SEARCH_BASE_URL,
      HOME_PAGE_HOSTNAME,
      HOME_PAGE_URL,
      LOCAL_DEVELOPMENT_HOSTNAMES,
      LOCAL_DEVELOPMENT_PORT,
      OFFICIAL_SOURCE_CHECKED_ON,
      PREFERENCES_STORAGE_KEY,
      PWA_CACHE_PREFIX,
      WEATHER_ALERT_DEFAULT_REFRESH_MINUTES,
      WEATHER_ALERT_DISCLOSURE_STORAGE_KEY,
      WEATHER_ALERT_FORECAST_WINDOW_HOURS,
      WEATHER_ALERT_MOBILE_MEDIA_QUERY,
      WEATHER_ALERT_OPENING_LEAD_MINUTES,
      WEATHER_ALERT_REFRESH_MINUTES_OPTIONS,
      WEATHER_ALERT_STATUS_STORAGE_KEY,
      WEATHER_API_BASE_URL,
      WEATHER_LOCATION_POINT,
      YEAR
    };
  }
})(globalThis);
