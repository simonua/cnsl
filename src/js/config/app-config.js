/**
 * Application configuration shared by browser pages and the service worker.
 */
(function initializeAppConfig(globalScope) {
  const YEAR = 2026;
  const OFFICIAL_SOURCE_CHECKED_ON = '2026-05-24';
  const APP_VERSION = '2.0.0-beta.1';
  const APP_LAST_UPDATED_ON = '2026-05-24';

  if (Object.prototype.hasOwnProperty.call(globalScope, 'YEAR')) {
    if (globalScope.YEAR !== YEAR) {
      throw new Error('The configured season year does not match the loaded application configuration.');
    }
  } else {
    Object.defineProperty(globalScope, 'YEAR', {
      configurable: false,
      enumerable: true,
      value: YEAR,
      writable: false
    });
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      APP_LAST_UPDATED_ON,
      APP_VERSION,
      OFFICIAL_SOURCE_CHECKED_ON,
      YEAR
    };
  }
})(globalThis);
