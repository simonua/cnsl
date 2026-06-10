const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { loadBrowserModule } = require('../helpers/browser-module-loader.js');

function loadWeatherHazard() {
  return loadBrowserModule('weather-hazard').context.WeatherHazard;
}

const WeatherHazard = loadWeatherHazard();

describe('WeatherHazard', () => {
  it('defines immutable semantic hazard values', () => {
    assert.equal(WeatherHazard.THUNDERSTORMS, 'thunderstorms');
    assert.equal(WeatherHazard.LIGHTNING, 'lightning');
    assert.equal(WeatherHazard.TORNADOES, 'tornadoes');
    assert.equal(WeatherHazard.HAIL, 'hail');
    assert.equal(Object.isFrozen(WeatherHazard), true);
  });

  it('validates only supported hazard values', () => {
    assert.equal(WeatherHazard.isValid(WeatherHazard.THUNDERSTORMS), true);
    assert.equal(WeatherHazard.isValid(WeatherHazard.LIGHTNING), true);
    assert.equal(WeatherHazard.isValid(WeatherHazard.TORNADOES), true);
    assert.equal(WeatherHazard.isValid(WeatherHazard.HAIL), true);
    assert.equal(WeatherHazard.isValid('rain'), false);
    assert.equal(WeatherHazard.isValid(null), false);
  });

  it('normalizes every accepted source token', () => {
    const cases = [
      ['thunderstorm', WeatherHazard.THUNDERSTORMS],
      ['thunderstorms', WeatherHazard.THUNDERSTORMS],
      ['tstorm', WeatherHazard.THUNDERSTORMS],
      ['tstorms', WeatherHazard.THUNDERSTORMS],
      ['t-storm', WeatherHazard.THUNDERSTORMS],
      ['t-storms', WeatherHazard.THUNDERSTORMS],
      ['LIGHTNING', WeatherHazard.LIGHTNING],
      ['tornado', WeatherHazard.TORNADOES],
      ['tornadoes', WeatherHazard.TORNADOES],
      ['Hail', WeatherHazard.HAIL]
    ];

    cases.forEach(([forecastText, expectedHazard]) => {
      assert.deepEqual(Array.from(WeatherHazard.findAll(forecastText)), [expectedHazard]);
    });
  });

  it('returns unique hazards in stable semantic order', () => {
    assert.deepEqual(
      Array.from(WeatherHazard.findAll('Hail, tornado, lightning, t-storms, and more hail')),
      [WeatherHazard.THUNDERSTORMS, WeatherHazard.LIGHTNING, WeatherHazard.TORNADOES, WeatherHazard.HAIL]
    );
    assert.deepEqual(Array.from(WeatherHazard.findAll('Light rain and patchy fog')), []);
  });

  it('registers the enum as a browser global', () => {
    const context = loadBrowserModule('weather-hazard').context;

    assert.equal(typeof context.window.WeatherHazard, 'function');
    assert.equal(context.window.WeatherHazard, context.WeatherHazard);
  });
});
