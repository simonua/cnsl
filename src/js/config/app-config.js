/**
 * Application configuration shared by browser pages and the service worker.
 */
(function initializeAppConfig(globalScope) {
  const YEAR = 2026;

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
    module.exports = { YEAR };
  }
})(globalThis);
