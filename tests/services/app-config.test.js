const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const config = require('../../src/js/config/app-config.js');

const sourcePath = path.join(__dirname, '..', '..', 'src', 'js', 'config', 'app-config.js');
const source = fs.readFileSync(sourcePath, 'utf8');

describe('app-config', () => {
  it('publishes the configured author identity', () => {
    assert.equal(config.AUTHOR_NAME, 'Simon Kurtz');
    assert.equal(config.AUTHOR_EMAIL, 'simonkurtz+pool-app@gmail.com');
    assert.equal(config.EXTERNAL_LINKS.AUTHOR_FEEDBACK_EMAIL_URL, 'mailto:simonkurtz+pool-app@gmail.com?subject=CA%20Pool%20%26%20CNSL%20Assistant%20-%20Feedback');
    assert.equal(config.EXTERNAL_LINKS.AUTHOR_BUG_FEATURE_EMAIL_URL, 'mailto:simonkurtz+pool-app@gmail.com?subject=CA%20Pool%20%26%20CNSL%20Assistant%20-%20Bug%20%2F%20Feature');
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
    assert.equal(
      context.WEATHER_PUBLIC_ALERTS_URL,
      'https://forecast.weather.gov/MapClick.php?lat=39.2014&lon=-76.8610'
    );
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
