const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { AppConfig: config } = require('../helpers/browser-module-loader.js').loadBrowserModule('app-config');

const sourcePath = path.join(__dirname, '..', '..', 'src', 'js', 'config', 'app-config.js');
const source = fs.readFileSync(sourcePath, 'utf8');

describe('app-config', () => {
  it('publishes the configured author identity', () => {
    assert.equal(config.AUTHOR_NAME, 'Simon Kurtz');
    assert.equal(config.AUTHOR_EMAIL, 'simonkurtz+pool-app@gmail.com');
    assert.equal(config.EXTERNAL_LINKS.AUTHOR_FEEDBACK_EMAIL_URL, 'mailto:simonkurtz+pool-app@gmail.com?subject=CA%20Pool%20%26%20CNSL%20Assistant%20-%20Feedback');
    assert.ok(config.EXTERNAL_LINKS.AUTHOR_BUG_FEATURE_EMAIL_URL.startsWith('mailto:simonkurtz+pool-app@gmail.com?subject=CA%20Pool%20%26%20CNSL%20Assistant%20-%20Bug%20%2F%20Feature%20-%20Version%20'));
    assert.equal(config.EXTERNAL_LINKS.AUTHOR_DATA_EMAIL_URL, 'mailto:simonkurtz+pool-app@gmail.com?subject=CA%20Pool%20%26%20CNSL%20Assistant%20-%20Data');
    assert.equal(config.EXTERNAL_LINKS.AUTHOR_LESSON_RECOMMENDATION_EMAIL_URL, 'mailto:simonkurtz+pool-app@gmail.com?subject=CA%20Pool%20%26%20CNSL%20Assistant%20-%20Lesson%20Provider%20Recommendation');
    assert.equal(config.EXTERNAL_LINKS.AUTHOR_LINKEDIN_URL, 'https://www.linkedin.com/in/simonkurtz');
    assert.equal(config.EXTERNAL_LINKS.AUTHOR_FACEBOOK_PROFILE_URL, 'https://www.facebook.com/simonkurtz82');
  });

  it('publishes a public NWS link for the configured weather coordinates', () => {
    assert.equal(
      config.EXTERNAL_LINKS.NATIONAL_WEATHER_SERVICE_PUBLIC_ALERTS,
      'https://forecast.weather.gov/MapClick.php?lat=39.2014&lon=-76.8610'
    );
  });

  it('publishes browser configuration when evaluated with standard browser globals', () => {
    const context = { URL };

    vm.runInNewContext(source, context, { filename: sourcePath });

    assert.equal(context.APP_VERSION, config.APP_VERSION);
    assert.equal(context.ANALYTICS_APP_VERSION_STORAGE_KEY, config.ANALYTICS_APP_VERSION_STORAGE_KEY);
    assert.equal(context.ANALYTICS_UPGRADE_PATH_STORAGE_KEY, config.ANALYTICS_UPGRADE_PATH_STORAGE_KEY);
    assert.equal(context.ANALYTICS_VERSION_REPORTED_STORAGE_KEY, config.ANALYTICS_VERSION_REPORTED_STORAGE_KEY);
    assert.equal(context.SERVICE_WORKER_UPDATE_CHECKED_AT_STORAGE_KEY, config.SERVICE_WORKER_UPDATE_CHECKED_AT_STORAGE_KEY);
    assert.equal(context.SERVICE_WORKER_UPGRADE_FROM_VERSION_STORAGE_KEY, config.SERVICE_WORKER_UPGRADE_FROM_VERSION_STORAGE_KEY);
    assert.equal(context.EXPERIMENTAL_SETTINGS_URL, config.EXPERIMENTAL_SETTINGS_URL);
    assert.equal(context.MY_MEET_DAY_LOOKAHEAD_DAYS, 2);
    assert.equal(
      context.WEATHER_PUBLIC_ALERTS_URL,
      'https://forecast.weather.gov/MapClick.php?lat=39.2014&lon=-76.8610'
    );
  });

  it('publishes immutable experimental feature configuration', () => {
    assert.deepEqual(config.EXPERIMENTAL_FEATURE_IDS, { MY_MEET_DAY: 'my-meet-day' });
    assert.equal(Object.isFrozen(config.EXPERIMENTAL_FEATURE_IDS), true);
    assert.equal(config.EXPERIMENTAL_SETTINGS_URL, 'assets/experimental-settings.json');
    assert.equal(config.MY_MEET_DAY_LOOKAHEAD_DAYS, 2);
  });

  it('publishes one immutable dependency manifest for team agenda views', () => {
    assert.equal(config.TEAM_AGENDA_DEPENDENCIES.length, 19);
    assert.ok(config.TEAM_AGENDA_DEPENDENCIES.indexOf('js/services/device-platform-service.js')
      < config.TEAM_AGENDA_DEPENDENCIES.indexOf('js/services/pool-link-helper.js'));
    assert.equal(config.TEAM_AGENDA_DEPENDENCIES.at(-1), 'js/services/meet-day-guide-service.js');
    assert.equal(Object.isFrozen(config.TEAM_AGENDA_DEPENDENCIES), true);
  });

  it('publishes named app-owned session storage keys', () => {
    assert.equal(config.ANALYTICS_VERSION_REPORTED_STORAGE_KEY, 'cnsl_analytics_version_reported');
    assert.equal(config.SERVICE_WORKER_UPDATE_CHECKED_AT_STORAGE_KEY, 'cnsl_service_worker_update_checked_at');
    assert.equal(config.SERVICE_WORKER_UPGRADE_FROM_VERSION_STORAGE_KEY, 'cnsl_service_worker_upgrade_from_version');
    assert.deepEqual(config.APP_SESSION_STORAGE_KEYS, [
      config.ANALYTICS_VERSION_REPORTED_STORAGE_KEY,
      config.SERVICE_WORKER_UPDATE_CHECKED_AT_STORAGE_KEY,
      config.SERVICE_WORKER_UPGRADE_FROM_VERSION_STORAGE_KEY,
      config.WEATHER_ALERT_STATUS_STORAGE_KEY,
      config.WEATHER_ALERT_DISCLOSURE_STORAGE_KEY
    ]);
    assert.equal(Object.isFrozen(config.APP_SESSION_STORAGE_KEYS), true);
  });

  it('publishes named app-owned local storage keys', () => {
    assert.equal(config.ANALYTICS_APP_VERSION_STORAGE_KEY, 'cnsl_analytics_current_version');
    assert.equal(config.ANALYTICS_UPGRADE_PATH_STORAGE_KEY, 'cnsl_analytics_pending_upgrade_path');
    assert.deepEqual(config.APP_LOCAL_STORAGE_KEYS, [
      config.ANALYTICS_APP_VERSION_STORAGE_KEY,
      config.ANALYTICS_UPGRADE_PATH_STORAGE_KEY,
      config.PREFERENCES_STORAGE_KEY,
      config.APP_VERSION_STORAGE_KEY,
      config.SETTINGS_NOTICE_DISMISSED_STORAGE_KEY,
      config.WEATHER_ALERT_LAST_SUCCESSFUL_CHECK_STORAGE_KEY
    ]);
    assert.equal(Object.isFrozen(config.APP_LOCAL_STORAGE_KEYS), true);
  });

  it('falls back to the Columbia ZIP code when weather coordinates are invalid', () => {
    assert.equal(
      config.buildWeatherPublicAlertsUrl('invalid'),
      'https://forecast.weather.gov/zipcity.php?inputstring=21045'
    );
  });

  it('publishes independent official-source timestamps without repeated timezone labels', () => {
    assert.match(config.OFFICIAL_SOURCE_CHECKED_AT, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}-(?:04|05):00$/);
    assert.match(config.OFFICIAL_SOURCE_CHECKED_LABEL, /^[A-Z][a-z]+ \d{1,2}, \d{4} at \d{1,2}:\d{2} [AP]M$/);
    assert.match(config.OFFICIAL_SOURCE_CHECKED_SHORT_LABEL, /^[A-Z][a-z]+ \d{1,2}, \d{1,2}:\d{2} [AP]M$/);
    assert.match(config.OFFICIAL_SOURCE_UPDATED_AT, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}-(?:04|05):00$/);
    assert.match(config.OFFICIAL_SOURCE_UPDATED_LABEL, /^[A-Z][a-z]+ \d{1,2}, \d{4} at \d{1,2}:\d{2} [AP]M$/);
    assert.match(config.OFFICIAL_SOURCE_UPDATED_SHORT_LABEL, /^[A-Z][a-z]+ \d{1,2}, \d{1,2}:\d{2} [AP]M$/);
    assert.ok(new Date(config.OFFICIAL_SOURCE_CHECKED_AT) >= new Date(config.OFFICIAL_SOURCE_UPDATED_AT));
  });

  it('rejects a loaded browser constant that conflicts with published configuration', () => {
    assert.throws(() => config.exposeConstant('YEAR', 2026, { YEAR: 2025 }), /configured YEAR does not match/);
    assert.doesNotThrow(() => config.exposeConstant('YEAR', 2026, { YEAR: 2026 }));
  });

  it('rejects malformed and invalid official-source timestamps', () => {
    assert.throws(() => config.formatOfficialSourceTimestamp('xxxx-xx-xxTxx:xx:xx-04:00', {}), /must use ISO format/);
    assert.throws(() => config.formatOfficialSourceTimestamp('9999-99-99T99:99:99-04:00', {}), /must be valid dates/);
  });
});
