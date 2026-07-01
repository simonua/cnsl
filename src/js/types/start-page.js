/**
 * Defines the supported application start pages and their internal routes.
 */
class StartPage {
  static VALUES = Object.freeze({
    HOME: 'home',
    POOLS: 'pools',
    TEAMS: 'teams'
  });

  static ROUTES = Object.freeze({
    [StartPage.VALUES.HOME]: '/',
    [StartPage.VALUES.POOLS]: '/pools.html',
    [StartPage.VALUES.TEAMS]: '/teams.html'
  });

  /**
   * Normalizes a stored start-page value to a supported option.
   * @param {*} value - Candidate preference value
   * @returns {string} Supported start-page value
   */
  static normalize(value) {
    return Object.hasOwn(StartPage.ROUTES, value) ? value : StartPage.VALUES.HOME;
  }

  /**
   * Resolves a supported start-page value to its same-origin route.
   * @param {*} value - Candidate preference value
   * @returns {string} Internal application route
   */
  static getRoute(value) {
    return StartPage.ROUTES[StartPage.normalize(value)];
  }
}

Object.freeze(StartPage);
globalThis.StartPage = StartPage;
