/**
 * Semantic source constants for weather safety statuses.
 */

/** @typedef {'alert'|'forecast'} WeatherAlertSourceValue */

if (typeof globalThis.WeatherAlertSource === 'undefined') {
  /** Defines supported sources for inclement weather statuses. */
  class WeatherAlertSource {
    /** @type {WeatherAlertSourceValue} */
    static ALERT = 'alert';
    /** @type {WeatherAlertSourceValue} */
    static FORECAST = 'forecast';

    /**
     * Checks whether a value is a supported weather alert source.
     * @param {*} value - Value to validate
     * @returns {boolean} Whether the value is a weather alert source
     */
    static isValid(value) {
      return value === WeatherAlertSource.ALERT || value === WeatherAlertSource.FORECAST;
    }
  }

  Object.freeze(WeatherAlertSource);
  globalThis.WeatherAlertSource = WeatherAlertSource;
}
