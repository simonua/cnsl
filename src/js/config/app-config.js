/**
 * Application configuration shared by browser pages and the service worker.
 */
(function initializeAppConfig(globalScope) {
  // Published site and active season metadata.
  const YEAR = 2026;
  const OFFICIAL_SOURCE_CHECKED_ON = '2026-05-27';
  const APP_VERSION = '2.2.3';
  const APP_LAST_UPDATED_ON = '2026-05-27';
  const HOME_PAGE_HOSTNAME = 'pools.longreachmarlins.org';
  const HOME_PAGE_URL = `https://${HOME_PAGE_HOSTNAME}`;
  const CONTACT_EMAIL = 'simonkurtz@gmail.com';
  const SHARE_MESSAGE = `Find Columbia pools and CNSL schedules: ${HOME_PAGE_URL}`;

  // Public destinations referenced by authored site content.
  const EXTERNAL_LINKS = Object.freeze({
    DATA_MISMATCH_EMAIL: `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Assistant App Data Mismatch')}`,
    EMAIL_SHARE: `mailto:?subject=${encodeURIComponent('Columbia Pools and CNSL Schedules')}&body=${encodeURIComponent(SHARE_MESSAGE)}`,
    FACEBOOK_SHARE: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(HOME_PAGE_URL)}`,
    FEATURE_REQUEST_EMAIL: `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Assistant App Feature Request')}`,
    FEEDBACK_EMAIL: `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('CA Pool & CNSL Assistant App Feedback')}`,
    GITHUB_REPOSITORY: 'https://github.com/simonua/cnsl',
    GOOGLE_ANALYTICS_PRIVACY_GUIDANCE: 'https://support.google.com/analytics/answer/6366371?hl=en#zippy=%2Cin-this-article',
    LINKEDIN_PROFILE: 'https://www.linkedin.com/in/simonkurtz',
    OFFICIAL_CNSL_SITE: 'https://www.gomotionapp.com/team/reccnsl/page/home',
    SMS_SHARE: `sms:?&body=${encodeURIComponent(SHARE_MESSAGE)}`
  });

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
  const APP_VERSION_STORAGE_KEY = 'cnsl_current_version';
  const WEATHER_ALERT_STATUS_STORAGE_KEY = 'cnsl_weather_alert_status';
  const WEATHER_ALERT_DISCLOSURE_STORAGE_KEY = 'cnsl_weather_alert_expanded';

  // Offline caching and local development runtime behavior.
  const PWA_CACHE_PREFIX = 'cnsl-static-';
  const LOCAL_DEVELOPMENT_HOSTNAMES = Object.freeze(['localhost', '127.0.0.1']);
  const LOCAL_DEVELOPMENT_PORT = '9090';

  const RUNTIME_CONFIG = Object.freeze({
    APP_TIMEZONE,
    APP_VERSION,
    APP_VERSION_STORAGE_KEY,
    GA4_MEASUREMENT_ID,
    GOOGLE_MAPS_SEARCH_BASE_URL,
    HOME_PAGE_HOSTNAME,
    HOME_PAGE_URL,
    LOCAL_DEVELOPMENT_HOSTNAMES,
    LOCAL_DEVELOPMENT_PORT,
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
  });

  const APP_CONFIG = Object.freeze({
    APP_LAST_UPDATED_ON,
    CONTACT_EMAIL,
    EXTERNAL_LINKS,
    OFFICIAL_SOURCE_CHECKED_ON,
    ...RUNTIME_CONFIG
  });

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

  Object.entries(RUNTIME_CONFIG).forEach(([name, value]) => exposeConstant(name, value));

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = APP_CONFIG;
  }
})(globalThis);
