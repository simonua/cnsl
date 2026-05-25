/**
 * Application configuration shared by browser pages and the service worker.
 */
(function initializeAppConfig(globalScope) {
  const YEAR = 2026;
  const OFFICIAL_SOURCE_CHECKED_ON = '2026-05-24';
  const APP_VERSION = '2.0.0-beta.7';
  const APP_LAST_UPDATED_ON = '2026-05-25';
  const HOME_PAGE_HOSTNAME = 'pools.longreachmarlins.org';
  const HOME_PAGE_URL = `https://${HOME_PAGE_HOSTNAME}`;

  function exposeConstant(name, value) {
    if (Object.prototype.hasOwnProperty.call(globalScope, name)) {
      if (globalScope[name] !== value) {
        throw new Error(`The configured ${name} does not match the loaded application configuration.`);
      }
      return;
    }

    Object.defineProperty(globalScope, name, {
      configurable: false,
      enumerable: true,
      value,
      writable: false
    });
  }

  exposeConstant('YEAR', YEAR);
  exposeConstant('HOME_PAGE_HOSTNAME', HOME_PAGE_HOSTNAME);
  exposeConstant('HOME_PAGE_URL', HOME_PAGE_URL);

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      APP_LAST_UPDATED_ON,
      APP_VERSION,
      HOME_PAGE_HOSTNAME,
      HOME_PAGE_URL,
      OFFICIAL_SOURCE_CHECKED_ON,
      YEAR
    };
  }
})(globalThis);
