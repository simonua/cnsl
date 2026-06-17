/**
 * Application configuration shared by browser pages and the service worker.
 */
(function initializeAppConfig(globalScope) {
  const APP_VERSION = '2.19.2';
  const APP_LAST_UPDATED_ON = '2026-06-16';
  // Published site and active season metadata.
  const YEAR = 2026;
  const APP_TIMEZONE = 'America/New_York';
  const OFFICIAL_SOURCE_CHECKED_AT = '2026-06-17T09:58:31-04:00';
  const OFFICIAL_SOURCE_UPDATED_AT = '2026-06-17T09:58:31-04:00';
  const HOME_PAGE_HOSTNAME = 'pools.longreachmarlins.org';
  const HOME_PAGE_URL = `https://${HOME_PAGE_HOSTNAME}`;
  const AUTHOR_NAME = 'Simon Kurtz';
  const AUTHOR_EMAIL = 'simonkurtz+pool-app@gmail.com';
  const APP_ATTENTION_NOTICE_UPDATED_AT = '2026-06-15T12:31:18-04:00';

  // Published campaign attribution and share destinations.
  const PUBLISHED_CAMPAIGN_NAME = `${YEAR}_pool_season`;
  const APP_SHARE_CAMPAIGNS = Object.freeze({
    EMAIL: Object.freeze({ medium: 'email', name: PUBLISHED_CAMPAIGN_NAME, source: 'app' }),
    FACEBOOK: Object.freeze({ medium: 'facebook', name: PUBLISHED_CAMPAIGN_NAME, source: 'app' }),
    QR: Object.freeze({ medium: 'qr', name: PUBLISHED_CAMPAIGN_NAME, source: 'app' }),
    TEXT: Object.freeze({ medium: 'text', name: PUBLISHED_CAMPAIGN_NAME, source: 'app' }),
    X: Object.freeze({ medium: 'x', name: PUBLISHED_CAMPAIGN_NAME, source: 'app' })
  });
  const FLYER_QR_CAMPAIGN = Object.freeze({ medium: 'qr', name: PUBLISHED_CAMPAIGN_NAME, source: 'flyer' });
  const PUBLISHED_CAMPAIGNS = Object.freeze([
    ...Object.values(APP_SHARE_CAMPAIGNS),
    FLYER_QR_CAMPAIGN
  ]);
  const SHARE_MESSAGE_PREFIX = 'Find Columbia pools and CNSL schedules:';

  /**
   * Builds the reviewed home-page destination for a published campaign.
   * @param {{medium: string, name: string, source: string}} campaign - Approved campaign tuple
   * @returns {string} Home-page URL with fixed attribution parameters
   */
  function buildPublishedCampaignUrl(campaign) {
    const campaignUrl = new URL(HOME_PAGE_URL);
    campaignUrl.searchParams.set('utm_source', campaign.source);
    campaignUrl.searchParams.set('utm_medium', campaign.medium);
    campaignUrl.searchParams.set('utm_campaign', campaign.name);
    return campaignUrl.toString();
  }

  /**
   * Builds concise share copy with its channel-specific destination.
   * @param {{medium: string, name: string, source: string}} campaign - Approved campaign tuple
   * @returns {string} Share message containing the tracked home-page URL
   */
  function buildShareMessage(campaign) {
    return `${SHARE_MESSAGE_PREFIX} ${buildPublishedCampaignUrl(campaign)}`;
  }

  // Visitor-facing feature availability.
  const EXPERIMENTAL_FEATURE_IDS = Object.freeze({
    MY_MEET_DAY: 'my-meet-day'
  });
  const EXPERIMENTAL_SETTINGS_URL = 'assets/experimental-settings.json';
  const MY_MEET_DAY_HOME_LOOKAHEAD_DAYS = 2;
  const TEAM_AGENDA_DEPENDENCIES = Object.freeze([
    'js/services/html-safety.js',
    'js/services/device-platform-service.js',
    'js/services/pool-link-helper.js',
    'js/services/time-utils.js',
    'js/types/pool-enums.js',
    'js/models/pool-schedule.js',
    'js/services/pool-period-schedule-service.js',
    'js/models/pool.js',
    'js/managers/pools-manager.js',
    'js/models/team.js',
    'js/managers/teams-manager.js',
    'js/types/meet-team-role.js',
    'js/types/payment-method.js',
    'js/types/schedule-state.js',
    'js/models/meet.js',
    'js/managers/meets-manager.js',
    'js/services/file-helper.js',
    'js/services/data-manager.js',
    'js/services/team-schedule-service.js',
    'js/services/team-agenda-display.js',
    'js/services/meet-day-guide-service.js'
  ]);

  // External services and regional behavior.
  const ANALYTICS_DEPLOYMENT_META_NAME = 'cnsl-analytics-deployment';
  const ANALYTICS_DEPLOYMENT_MODES = Object.freeze({
    DISABLED: 'disabled',
    PRODUCTION: 'production'
  });
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

  const APP_ATTENTION_NOTICE = Object.freeze({
    DISMISSIBLE: true,
    EXPIRES_AT: '2026-06-19T23:59:59-04:00',
    MESSAGE: 'Some pools may be shown as "Closed for the season" on the official CA website at this time. This may be due to pre-season schedules until the main schedule starts June 20.',
    UPDATED_AT: APP_ATTENTION_NOTICE_UPDATED_AT,
    UPDATED_LABEL: formatOfficialSourceTimestamp(APP_ATTENTION_NOTICE_UPDATED_AT, {
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      month: 'long',
      year: 'numeric'
    })
  });

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
    EMAIL_SHARE: `mailto:?subject=${encodeURIComponent('Columbia Pools and CNSL Schedules')}&body=${encodeURIComponent(buildShareMessage(APP_SHARE_CAMPAIGNS.EMAIL))}`,
    AUTHOR_FACEBOOK_PROFILE_URL: 'https://www.facebook.com/simonkurtz82',
    FACEBOOK_SHARE: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(buildPublishedCampaignUrl(APP_SHARE_CAMPAIGNS.FACEBOOK))}`,
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
    SMS_SHARE: `sms:?&body=${encodeURIComponent(buildShareMessage(APP_SHARE_CAMPAIGNS.TEXT))}`,
    X_SHARE: `https://x.com/intent/post?text=${encodeURIComponent(SHARE_MESSAGE_PREFIX)}&url=${encodeURIComponent(buildPublishedCampaignUrl(APP_SHARE_CAMPAIGNS.X))}`
  });

  // Weather alert experience policy.
  const WEATHER_ALERT_DEFAULT_REFRESH_MINUTES = 5;
  const WEATHER_ALERT_REFRESH_MINUTES_OPTIONS = Object.freeze([0, 5, 10]);
  const WEATHER_ALERT_OPENING_LEAD_MINUTES = 60;
  const WEATHER_ALERT_MOBILE_MEDIA_QUERY = '(max-width: 48rem)';

  // Device-local preference and presentation state keys.
  const ANALYTICS_APP_VERSION_STORAGE_KEY = 'cnsl_analytics_current_version';
  const ANALYTICS_UPGRADE_PATH_STORAGE_KEY = 'cnsl_analytics_pending_upgrade_path';
  const ANALYTICS_VERSION_REPORTED_STORAGE_KEY = 'cnsl_analytics_version_reported';
  const APP_ATTENTION_NOTICE_DISMISSED_STORAGE_KEY = 'cnsl_attention_notice_dismissed';
  const PREFERENCES_STORAGE_KEY = 'cnsl_preferences';
  const APP_VERSION_STORAGE_KEY = 'cnsl_current_version';
  const SERVICE_WORKER_UPDATE_CHECKED_AT_STORAGE_KEY = 'cnsl_service_worker_update_checked_at';
  const SERVICE_WORKER_UPGRADE_FROM_VERSION_STORAGE_KEY = 'cnsl_service_worker_upgrade_from_version';
  const SETTINGS_NOTICE_DISMISSED_STORAGE_KEY = 'cnsl_settings_notice_dismissed';
  const WEATHER_ALERT_LAST_SUCCESSFUL_CHECK_STORAGE_KEY = 'cnsl_weather_alert_last_successful_check';
  const WEATHER_ALERT_STATUS_STORAGE_KEY = 'cnsl_weather_alert_status';
  const WEATHER_ALERT_DISCLOSURE_STORAGE_KEY = 'cnsl_weather_alert_expanded';
  const APP_LOCAL_STORAGE_KEYS = Object.freeze([
    ANALYTICS_APP_VERSION_STORAGE_KEY,
    ANALYTICS_UPGRADE_PATH_STORAGE_KEY,
    ANALYTICS_VERSION_REPORTED_STORAGE_KEY,
    APP_ATTENTION_NOTICE_DISMISSED_STORAGE_KEY,
    PREFERENCES_STORAGE_KEY,
    APP_VERSION_STORAGE_KEY,
    SETTINGS_NOTICE_DISMISSED_STORAGE_KEY,
    WEATHER_ALERT_LAST_SUCCESSFUL_CHECK_STORAGE_KEY
  ]);
  const APP_SESSION_STORAGE_KEYS = Object.freeze([
    SERVICE_WORKER_UPDATE_CHECKED_AT_STORAGE_KEY,
    SERVICE_WORKER_UPGRADE_FROM_VERSION_STORAGE_KEY,
    WEATHER_ALERT_STATUS_STORAGE_KEY,
    WEATHER_ALERT_DISCLOSURE_STORAGE_KEY
  ]);

  // Offline caching and local development runtime behavior.
  const DEPLOYMENT_VERSION_FILE = 'version.txt';
  const PWA_CACHE_PREFIX = 'cnsl-static-';
  const LOCAL_DEVELOPMENT_HOSTNAMES = Object.freeze(['localhost', '127.0.0.1']);
  const LOCAL_DEVELOPMENT_PORT = '9090';

  const RUNTIME_CONFIG = Object.freeze({
    ANALYTICS_DEPLOYMENT_META_NAME,
    ANALYTICS_DEPLOYMENT_MODES,
    ANALYTICS_APP_VERSION_STORAGE_KEY,
    ANALYTICS_UPGRADE_PATH_STORAGE_KEY,
    ANALYTICS_VERSION_REPORTED_STORAGE_KEY,
    APP_ATTENTION_NOTICE,
    APP_ATTENTION_NOTICE_DISMISSED_STORAGE_KEY,
    APP_TIMEZONE,
    APP_LOCAL_STORAGE_KEYS,
    APP_SESSION_STORAGE_KEYS,
    APP_VERSION,
    APP_VERSION_STORAGE_KEY,
    DEPLOYMENT_VERSION_FILE,
    EXPERIMENTAL_FEATURE_IDS,
    EXPERIMENTAL_SETTINGS_URL,
    GA4_MEASUREMENT_ID,
    GOOGLE_MAPS_SEARCH_BASE_URL,
    HOME_PAGE_HOSTNAME,
    HOME_PAGE_URL,
    LOCAL_DEVELOPMENT_HOSTNAMES,
    LOCAL_DEVELOPMENT_PORT,
    MY_MEET_DAY_HOME_LOOKAHEAD_DAYS,
    PUBLISHED_CAMPAIGNS,
    PREFERENCES_STORAGE_KEY,
    PWA_CACHE_PREFIX,
    SERVICE_WORKER_UPDATE_CHECKED_AT_STORAGE_KEY,
    SERVICE_WORKER_UPGRADE_FROM_VERSION_STORAGE_KEY,
    SETTINGS_NOTICE_DISMISSED_STORAGE_KEY,
    TEAM_AGENDA_DEPENDENCIES,
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
