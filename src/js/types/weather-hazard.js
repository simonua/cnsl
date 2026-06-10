/**
 * Semantic hazard constants recognized in National Weather Service forecasts.
 */

/** @typedef {'thunderstorms'|'lightning'|'tornadoes'|'hail'} WeatherHazardValue */

if (typeof globalThis.WeatherHazard === 'undefined') {
  /** Defines supported forecast hazards and their accepted source vocabulary. */
  class WeatherHazard {
    /** @type {WeatherHazardValue} */
    static THUNDERSTORMS = 'thunderstorms';
    /** @type {WeatherHazardValue} */
    static LIGHTNING = 'lightning';
    /** @type {WeatherHazardValue} */
    static TORNADOES = 'tornadoes';
    /** @type {WeatherHazardValue} */
    static HAIL = 'hail';

    /**
     * Finds supported hazards in forecast text in stable semantic order.
     * @param {string} forecastText - Combined short and detailed forecast text
     * @returns {WeatherHazardValue[]} Recognized hazards without duplicates
     */
    static findAll(forecastText) {
      const hazards = [];
      if (/\b(?:thunderstorms?|t-?storms?)\b/i.test(forecastText)) hazards.push(WeatherHazard.THUNDERSTORMS);
      if (/\blightning\b/i.test(forecastText)) hazards.push(WeatherHazard.LIGHTNING);
      if (/\btornado(?:es)?\b/i.test(forecastText)) hazards.push(WeatherHazard.TORNADOES);
      if (/\bhail\b/i.test(forecastText)) hazards.push(WeatherHazard.HAIL);
      return hazards;
    }

    /**
     * Checks whether a value is a supported forecast hazard.
     * @param {*} value - Value to validate
     * @returns {boolean} Whether the value is a forecast hazard
     */
    static isValid(value) {
      return value === WeatherHazard.THUNDERSTORMS
        || value === WeatherHazard.LIGHTNING
        || value === WeatherHazard.TORNADOES
        || value === WeatherHazard.HAIL;
    }
  }

  Object.freeze(WeatherHazard);
  globalThis.WeatherHazard = WeatherHazard;
}
