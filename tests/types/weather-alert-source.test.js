const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { loadBrowserModule } = require('../helpers/browser-module-loader.js');

function loadWeatherAlertSource() {
  return loadBrowserModule('weather-alert-source').context.WeatherAlertSource;
}

const WeatherAlertSource = loadWeatherAlertSource();

describe('WeatherAlertSource', () => {
  it('defines immutable semantic source values', () => {
    assert.equal(WeatherAlertSource.ALERT, 'alert');
    assert.equal(WeatherAlertSource.FORECAST, 'forecast');
    assert.equal(Object.isFrozen(WeatherAlertSource), true);
  });

  it('validates only supported source values', () => {
    assert.equal(WeatherAlertSource.isValid(WeatherAlertSource.ALERT), true);
    assert.equal(WeatherAlertSource.isValid(WeatherAlertSource.FORECAST), true);
    assert.equal(WeatherAlertSource.isValid('radar'), false);
    assert.equal(WeatherAlertSource.isValid(null), false);
  });

  it('registers the enum as a browser global', () => {
    const context = loadBrowserModule('weather-alert-source').context;

    assert.equal(typeof context.window.WeatherAlertSource, 'function');
    assert.equal(context.window.WeatherAlertSource, context.WeatherAlertSource);
  });
});
