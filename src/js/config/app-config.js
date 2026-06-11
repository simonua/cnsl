/**
 * Application configuration shared by browser pages and the service worker.
 */
(function initializeAppConfig(globalScope) {
  // Published site and active season metadata.
  const YEAR = 2026;
  const APP_TIMEZONE = 'America/New_York';
  const OFFICIAL_SOURCE_CHECKED_AT = '2026-06-10T22:13:23-04:00';
  const OFFICIAL_SOURCE_UPDATED_AT = '2026-06-10T06:58:35-04:00';
  const APP_VERSION = '2.15.0';
  const APP_LAST_UPDATED_ON = '2026-06-10';
  const HOME_PAGE_HOSTNAME = 'pools.longreachmarlins.org';
  const HOME_PAGE_URL = `https://${HOME_PAGE_HOSTNAME}`;
  const AUTHOR_NAME = 'Simon Kurtz';
  const AUTHOR_EMAIL = 'simonkurtz+pool-app@gmail.com';
  const SHARE_MESSAGE = `Find Columbia pools and CNSL schedules: ${HOME_PAGE_URL}`;

  // External services and regional behavior.
  const GA4_MEASUREMENT_ID = 'G-ZMBPYQKLQP';
  const WEATHER_API_BASE_URL = 'https://api.weather.gov';
  const WEATHER_LOCATION_POINT = '39.2014,-76.8610';
  const WEATHER_ACTIVE_ALERTS_URL = `${WEATHER_API_BASE_URL}/alerts/active?point=${encodeURIComponent(WEATHER_LOCATION_POINT)}`;
  const WEATHER_POINT_URL = `${WEATHER_API_BASE_URL}/points/${WEATHER_LOCATION_POINT}`;
  const WEATHER_PUBLIC_FORECAST_URL = 'https://forecast.weather.gov/MapClick.php';
  const WEATHER_PUBLIC_ZIP_FALLBACK_URL = 'https://forecast.weather.gov/zipcity.php?inputstring=21045';
  const GOOGLE_MAPS_SEARCH_BASE_URL = 'https://www.google.com/maps/search/?api=1&query=';

  /**
   * Builds the public National Weather Service forecast URL for a coordinate pair.
   * @param {string} locationPoint - Latitude and longitude separated by a comma
   * @returns {string} Coordinate forecast URL, or the ZIP-code fallback for invalid coordinates
   */
  function buildWeatherPublicAlertsUrl(locationPoint) {
    const [latitude, longitude, ...extraParts] = locationPoint.split(',').map(value => value.trim());
    const latitudeNumber = Number(latitude);
    const longitudeNumber = Number(longitude);
    if (extraParts.length > 0
      || !Number.isFinite(latitudeNumber)
      || !Number.isFinite(longitudeNumber)
      || latitudeNumber < -90
      || latitudeNumber > 90
      || longitudeNumber < -180
      || longitudeNumber > 180) {
      return WEATHER_PUBLIC_ZIP_FALLBACK_URL;
    }

    const publicUrl = new URL(WEATHER_PUBLIC_FORECAST_URL);
    publicUrl.searchParams.set('lat', latitude);
    publicUrl.searchParams.set('lon', longitude);
    return publicUrl.toString();
  }

  const WEATHER_PUBLIC_ALERTS_URL = buildWeatherPublicAlertsUrl(WEATHER_LOCATION_POINT);

  /**
   * Formats a validated Eastern-offset official-source timestamp.
   * @param {string} timestamp - ISO timestamp with an explicit Eastern UTC offset
   * @param {Intl.DateTimeFormatOptions} options - Locale formatting options
   * @returns {string} Localized timestamp in the application timezone
   * @throws {Error} If the timestamp format or date value is invalid
   */
  function formatOfficialSourceTimestamp(timestamp, options) {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}-(?:04|05):00$/.test(timestamp)) {
      throw new Error('Official-source timestamps must use ISO format with an explicit Eastern UTC offset.');
    }
    const sourceTimestamp = new Date(timestamp);
    if (Number.isNaN(sourceTimestamp.getTime())) {
      throw new Error('Official-source timestamps must be valid dates with an explicit Eastern UTC offset.');
    }
    return sourceTimestamp.toLocaleString('en-US', { ...options, timeZone: APP_TIMEZONE });
  }

  /**
   * Formats an official-source timestamp for the compact footer label.
   * @param {string} timestamp - Date-compatible timestamp
   * @returns {string} Month, day, and time in the application timezone
   */
  function formatOfficialSourceFooterTimestamp(timestamp) {
    const sourceTimestamp = new Date(timestamp);
    const date = new Intl.DateTimeFormat('en-US', {
      day: 'numeric',
      month: 'long',
      timeZone: APP_TIMEZONE
    }).format(sourceTimestamp);
    const time = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: APP_TIMEZONE
    }).format(sourceTimestamp);
    return `${date}, ${time}`;
  }

  const OFFICIAL_SOURCE_LONG_LABEL_OPTIONS = Object.freeze({
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    month: 'long',
    year: 'numeric'
  });
  const OFFICIAL_SOURCE_CHECKED_LABEL = formatOfficialSourceTimestamp(OFFICIAL_SOURCE_CHECKED_AT, OFFICIAL_SOURCE_LONG_LABEL_OPTIONS);
  const OFFICIAL_SOURCE_CHECKED_SHORT_LABEL = formatOfficialSourceFooterTimestamp(OFFICIAL_SOURCE_CHECKED_AT);
  const OFFICIAL_SOURCE_UPDATED_LABEL = formatOfficialSourceTimestamp(OFFICIAL_SOURCE_UPDATED_AT, OFFICIAL_SOURCE_LONG_LABEL_OPTIONS);
  const OFFICIAL_SOURCE_UPDATED_SHORT_LABEL = formatOfficialSourceFooterTimestamp(OFFICIAL_SOURCE_UPDATED_AT);

  // Public destinations referenced by authored site content.
  const EXTERNAL_LINKS = Object.freeze({
    AUTHOR_BUG_FEATURE_EMAIL_URL: `mailto:${AUTHOR_EMAIL}?subject=${encodeURIComponent(`CA Pool & CNSL Assistant - Bug / Feature - Version ${APP_VERSION}`)}`,
    AUTHOR_DATA_EMAIL_URL: `mailto:${AUTHOR_EMAIL}?subject=${encodeURIComponent('CA Pool & CNSL Assistant - Data')}`,
    AUTHOR_FEEDBACK_EMAIL_URL: `mailto:${AUTHOR_EMAIL}?subject=${encodeURIComponent('CA Pool & CNSL Assistant - Feedback')}`,
    AUTHOR_LESSON_RECOMMENDATION_EMAIL_URL: `mailto:${AUTHOR_EMAIL}?subject=${encodeURIComponent('CA Pool & CNSL Assistant - Lesson Provider Recommendation')}`,
    EMAIL_SHARE: `mailto:?subject=${encodeURIComponent('Columbia Pools and CNSL Schedules')}&body=${encodeURIComponent(SHARE_MESSAGE)}`,
    AUTHOR_FACEBOOK_PROFILE_URL: 'https://www.facebook.com/simonkurtz82',
    FACEBOOK_SHARE: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(HOME_PAGE_URL)}`,
    GITHUB_DATA_DIRECTORY: 'https://github.com/simonua/cnsl/tree/main/src/assets/data',
    GITHUB_LICENSE: 'https://github.com/simonua/cnsl/blob/main/LICENSE',
    GITHUB_REPOSITORY: 'https://github.com/simonua/cnsl',
    GOOGLE_ANALYTICS_PRIVACY_GUIDANCE: 'https://support.google.com/analytics/answer/6366371?hl=en#zippy=%2Cin-this-article',
    AUTHOR_LINKEDIN_URL: 'https://www.linkedin.com/in/simonkurtz',
    NATIONAL_WEATHER_SERVICE_ACTIVE_ALERTS: WEATHER_ACTIVE_ALERTS_URL,
    NATIONAL_WEATHER_SERVICE_PUBLIC_ALERTS: WEATHER_PUBLIC_ALERTS_URL,
    NATIONAL_WEATHER_SERVICE_POINT: WEATHER_POINT_URL,
    OFFICIAL_CNSL_SITE: 'https://www.gomotionapp.com/team/reccnsl/page/home',
    USA_SWIMMING_RULES_POLICIES: 'https://www.usaswimming.org/resources/rules-regulations',
    SMS_SHARE: `sms:?&body=${encodeURIComponent(SHARE_MESSAGE)}`,
    X_SHARE: `https://x.com/intent/post?text=${encodeURIComponent(SHARE_MESSAGE)}`
  });

  // Weather alert experience policy.
  const WEATHER_ALERT_DEFAULT_REFRESH_MINUTES = 5;
  const WEATHER_ALERT_REFRESH_MINUTES_OPTIONS = Object.freeze([0, 5, 10]);
  const WEATHER_ALERT_OPENING_LEAD_MINUTES = 60;
  const WEATHER_ALERT_MOBILE_MEDIA_QUERY = '(max-width: 48rem)';

  // Device-local preference and presentation state keys.
  const ANALYTICS_VERSION_REPORTED_STORAGE_KEY = 'cnsl_analytics_version_reported';
  const PREFERENCES_STORAGE_KEY = 'cnsl_preferences';
  const APP_VERSION_STORAGE_KEY = 'cnsl_current_version';
  const SERVICE_WORKER_UPDATE_CHECKED_AT_STORAGE_KEY = 'cnsl_service_worker_update_checked_at';
  const SETTINGS_NOTICE_DISMISSED_STORAGE_KEY = 'cnsl_settings_notice_dismissed';
  const WEATHER_ALERT_LAST_SUCCESSFUL_CHECK_STORAGE_KEY = 'cnsl_weather_alert_last_successful_check';
  const WEATHER_ALERT_STATUS_STORAGE_KEY = 'cnsl_weather_alert_status';
  const WEATHER_ALERT_DISCLOSURE_STORAGE_KEY = 'cnsl_weather_alert_expanded';
  const APP_LOCAL_STORAGE_KEYS = Object.freeze([
    PREFERENCES_STORAGE_KEY,
    APP_VERSION_STORAGE_KEY,
    SETTINGS_NOTICE_DISMISSED_STORAGE_KEY,
    WEATHER_ALERT_LAST_SUCCESSFUL_CHECK_STORAGE_KEY
  ]);
  const APP_SESSION_STORAGE_KEYS = Object.freeze([
    ANALYTICS_VERSION_REPORTED_STORAGE_KEY,
    SERVICE_WORKER_UPDATE_CHECKED_AT_STORAGE_KEY,
    WEATHER_ALERT_STATUS_STORAGE_KEY,
    WEATHER_ALERT_DISCLOSURE_STORAGE_KEY
  ]);

  // Offline caching and local development runtime behavior.
  const DEPLOYMENT_VERSION_FILE = 'version.txt';
  const PWA_CACHE_PREFIX = 'cnsl-static-';
  const LOCAL_DEVELOPMENT_HOSTNAMES = Object.freeze(['localhost', '127.0.0.1']);
  const LOCAL_DEVELOPMENT_PORT = '9090';

  const RUNTIME_CONFIG = Object.freeze({
    ANALYTICS_VERSION_REPORTED_STORAGE_KEY,
    APP_TIMEZONE,
    APP_LOCAL_STORAGE_KEYS,
    APP_SESSION_STORAGE_KEYS,
    APP_VERSION,
    APP_VERSION_STORAGE_KEY,
    DEPLOYMENT_VERSION_FILE,
    GA4_MEASUREMENT_ID,
    GOOGLE_MAPS_SEARCH_BASE_URL,
    HOME_PAGE_HOSTNAME,
    HOME_PAGE_URL,
    LOCAL_DEVELOPMENT_HOSTNAMES,
    LOCAL_DEVELOPMENT_PORT,
    PREFERENCES_STORAGE_KEY,
    PWA_CACHE_PREFIX,
    SERVICE_WORKER_UPDATE_CHECKED_AT_STORAGE_KEY,
    SETTINGS_NOTICE_DISMISSED_STORAGE_KEY,
    WEATHER_ALERT_DEFAULT_REFRESH_MINUTES,
    WEATHER_ALERT_DISCLOSURE_STORAGE_KEY,
    WEATHER_ALERT_MOBILE_MEDIA_QUERY,
    WEATHER_ALERT_OPENING_LEAD_MINUTES,
    WEATHER_ALERT_REFRESH_MINUTES_OPTIONS,
    WEATHER_ALERT_LAST_SUCCESSFUL_CHECK_STORAGE_KEY,
    WEATHER_ALERT_STATUS_STORAGE_KEY,
    WEATHER_ACTIVE_ALERTS_URL,
    WEATHER_API_BASE_URL,
    WEATHER_LOCATION_POINT,
    WEATHER_POINT_URL,
    WEATHER_PUBLIC_ALERTS_URL,
    YEAR
  });

  const APP_CONFIG = Object.freeze({
    APP_LAST_UPDATED_ON,
    AUTHOR_EMAIL,
    AUTHOR_NAME,
    EXTERNAL_LINKS,
    OFFICIAL_SOURCE_CHECKED_AT,
    OFFICIAL_SOURCE_CHECKED_LABEL,
    OFFICIAL_SOURCE_CHECKED_SHORT_LABEL,
    OFFICIAL_SOURCE_UPDATED_AT,
    OFFICIAL_SOURCE_UPDATED_LABEL,
    OFFICIAL_SOURCE_UPDATED_SHORT_LABEL,
    ...RUNTIME_CONFIG
  });

  /**
   * Defines an immutable global constant or verifies an existing matching value.
   * @param {string} name - Global property name
   * @param {*} value - Constant value to expose
   * @param {Object} targetScope - Object that receives the constant
   * @throws {Error} If the target already has a different value for the name
   */
  function exposeConstant(name, value, targetScope = globalScope) {
    if (Object.prototype.hasOwnProperty.call(targetScope, name)) {
      if (targetScope[name] !== value) {
        throw new Error(`The configured ${name} does not match the loaded application configuration.`);
      }
      return;
    }

    Object.defineProperty(targetScope, name, {
      configurable: false,
      enumerable: true,
      value,
      writable: false
    });
  }

  Object.entries(RUNTIME_CONFIG).forEach(([name, value]) => exposeConstant(name, value));
  exposeConstant('AppConfig', Object.freeze({
    ...APP_CONFIG,
    buildWeatherPublicAlertsUrl,
    exposeConstant,
    formatOfficialSourceTimestamp
  }));
})(globalThis);
