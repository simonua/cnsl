/**
 * Warms likely next-route documents, scripts, and primary data after the home view settles.
 * Route descriptors keep the background-loading policy separate from route controllers.
 */
(function initializeRouteWarmup(globalScope) {
  'use strict';

  const ROUTE_WARMUP_IDLE_TIMEOUT_MS = 2000;
  const ROUTE_WARMUP_FALLBACK_DELAY_MS = 0;
  const ROUTE_WARMUP_NAVIGATION_WAIT_TIMEOUT_MS = 2000;
  const ROUTE_WARMUP_MODES = Object.freeze({
    NONE: 'none',
    PREFETCH: 'prefetch',
    PRERENDER: 'prerender'
  });
  const ROUTE_WARMUP_PRERENDER_EAGERNESS = 'immediate';
  const POOLS_ROUTE_WARMUP = Object.freeze({
    document: 'pools.html'
  });
  const ACTIVE_ROUTE_WARMUPS = Object.freeze([POOLS_ROUTE_WARMUP]);
  const installedRouteUrls = new Set();
  const routeReadinessByUrl = new Map();
  const routeReadinessWaiters = new Map();
  let pendingNavigationUrl = null;

  /**
   * Resolves every pending navigation waiting for a route to finish preparing.
   * @param {string} routeUrl - Validated absolute application route URL
   * @private
   */
  function resolveRouteReadinessWaiters(routeUrl) {
    const waiters = routeReadinessWaiters.get(routeUrl);
    if (!waiters) return;

    routeReadinessWaiters.delete(routeUrl);
    waiters.forEach(resolve => resolve());
  }

  /**
   * Records validated readiness updates from a same-origin prerendered route.
   * @param {MessageEvent} event - Broadcast channel message event
   * @private
   */
  function handleRouteReadinessMessage(event) {
    const message = event.data;
    if (!message || typeof message !== 'object') return;

    const routeUrl = resolveSameOriginUrl(message.route, document.baseURI);
    const allowedStates = Object.values(globalScope.ROUTE_WARMUP_READINESS_STATES);
    if (!routeUrl
      || !installedRouteUrls.has(routeUrl.href)
      || !allowedStates.includes(message.state)) {
      return;
    }

    routeReadinessByUrl.set(routeUrl.href, message.state);
    if (message.state === globalScope.ROUTE_WARMUP_READINESS_STATES.READY) {
      resolveRouteReadinessWaiters(routeUrl.href);
    }
  }

  /**
   * Waits for a preparing route to become ready, with a bounded fail-open delay.
   * @param {string} routeUrl - Validated absolute application route URL
   * @returns {Promise<void>} Promise settled when the route is ready or the wait expires
   * @private
   */
  function waitForRouteReadiness(routeUrl) {
    if (routeReadinessByUrl.get(routeUrl) !== globalScope.ROUTE_WARMUP_READINESS_STATES.PREPARING) {
      return Promise.resolve();
    }

    return new Promise(resolve => {
      const waiters = routeReadinessWaiters.get(routeUrl) || new Set();
      const settle = () => {
        globalScope.clearTimeout(timeoutId);
        waiters.delete(settle);
        if (waiters.size === 0) routeReadinessWaiters.delete(routeUrl);
        resolve();
      };
      const timeoutId = globalScope.setTimeout(settle, ROUTE_WARMUP_NAVIGATION_WAIT_TIMEOUT_MS);
      waiters.add(settle);
      routeReadinessWaiters.set(routeUrl, waiters);
    });
  }

  /**
   * Holds an ordinary same-tab route click while its active prerender finishes primary rendering.
   * @param {MouseEvent} event - Document click event
   * @private
   */
  async function handlePreparingRouteNavigation(event) {
    if (event.defaultPrevented
      || event.button !== 0
      || event.altKey
      || event.ctrlKey
      || event.metaKey
      || event.shiftKey) {
      return;
    }

    const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
    if (!link
      || link.hasAttribute('download')
      || (link.target && link.target.toLowerCase() !== '_self')) {
      return;
    }

    const routeUrl = resolveSameOriginUrl(link.href, document.baseURI);
    if (!routeUrl
      || routeReadinessByUrl.get(routeUrl.href) !== globalScope.ROUTE_WARMUP_READINESS_STATES.PREPARING) {
      return;
    }

    event.preventDefault();
    if (pendingNavigationUrl) return;

    pendingNavigationUrl = routeUrl.href;
    link.setAttribute('aria-busy', 'true');
    await waitForRouteReadiness(routeUrl.href);
    link.removeAttribute('aria-busy');
    globalScope.location.assign(routeUrl.href);
  }

  /**
   * Starts same-origin prerender readiness observation when the browser supports channels.
   * @private
   */
  function observeRouteReadiness() {
    if (typeof globalScope.BroadcastChannel !== 'function') return;

    const channel = new globalScope.BroadcastChannel(globalScope.ROUTE_WARMUP_CHANNEL_NAME);
    channel.addEventListener('message', handleRouteReadinessMessage);
    document.addEventListener('click', handlePreparingRouteNavigation);
  }

  /**
   * Resolves an application resource and rejects destinations outside this origin.
   * @param {string} source - Relative or absolute resource source
   * @param {URL|string} baseUrl - Trusted application base URL
   * @returns {URL|null} Same-origin URL, or null for an invalid destination
   * @private
   */
  function resolveSameOriginUrl(source, baseUrl) {
    try {
      const resourceUrl = new URL(source, baseUrl);
      return resourceUrl.origin === globalScope.location.origin ? resourceUrl : null;
    } catch (_error) {
      return null;
    }
  }

  /**
   * Warms validated routes through prerendering or a document-prefetch fallback.
   * @param {readonly {document: string}[]} descriptors - Route definitions to warm
   * @returns {{mode: string, routeCount: number}} Installed warm-up mode and route count
   */
  function warmRoutes(descriptors) {
    const routeUrls = descriptors
      .map(descriptor => resolveSameOriginUrl(descriptor.document, document.baseURI))
      .filter(routeUrl => routeUrl
        && routeUrl.pathname !== globalScope.location.pathname
        && !installedRouteUrls.has(routeUrl.href));
    if (routeUrls.length === 0) {
      return { mode: ROUTE_WARMUP_MODES.NONE, routeCount: 0 };
    }

    routeUrls.forEach(routeUrl => installedRouteUrls.add(routeUrl.href));
    if (typeof globalScope.HTMLScriptElement.supports === 'function'
      && globalScope.HTMLScriptElement.supports('speculationrules')) {
      const rules = document.createElement('script');
      rules.type = 'speculationrules';
      rules.textContent = JSON.stringify({
        prerender: [{
          eagerness: ROUTE_WARMUP_PRERENDER_EAGERNESS,
          source: 'list',
          urls: routeUrls.map(routeUrl => routeUrl.href)
        }]
      });
      document.head.appendChild(rules);
      return { mode: ROUTE_WARMUP_MODES.PRERENDER, routeCount: routeUrls.length };
    }

    routeUrls.forEach(routeUrl => {
      const prefetch = document.createElement('link');
      prefetch.as = 'document';
      prefetch.href = routeUrl.href;
      prefetch.rel = 'prefetch';
      document.head.appendChild(prefetch);
    });
    return { mode: ROUTE_WARMUP_MODES.PREFETCH, routeCount: routeUrls.length };
  }

  /**
   * Schedules configured route work after initial page loading and foreground tasks settle.
   * @returns {Promise<{mode: string, routeCount: number}>} Scheduled warm-up outcome
   * @private
   */
  function scheduleActiveRouteWarmups() {
    return new Promise(resolve => {
      const startWarmups = () => {
        resolve(warmRoutes(ACTIVE_ROUTE_WARMUPS));
      };
      if (typeof globalScope.requestIdleCallback === 'function') {
        globalScope.requestIdleCallback(startWarmups, { timeout: ROUTE_WARMUP_IDLE_TIMEOUT_MS });
        return;
      }
      globalScope.setTimeout(startWarmups, ROUTE_WARMUP_FALLBACK_DELAY_MS);
    });
  }

  /**
   * Begins the startup warm-up after the current document finishes loading.
   * @returns {Promise<{mode: string, routeCount: number}>} Startup warm-up outcome
   * @private
   */
  function startRouteWarmup() {
    if (document.readyState === 'complete') return scheduleActiveRouteWarmups();
    return new Promise(resolve => {
      globalScope.addEventListener('load', () => {
        scheduleActiveRouteWarmups().then(resolve);
      }, { once: true });
    });
  }

  observeRouteReadiness();
  const startupPromise = startRouteWarmup();
  globalScope.cnslRouteWarmup = Object.freeze({
    startupPromise,
    warmRoutes
  });
})(globalThis);
