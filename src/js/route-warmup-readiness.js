/**
 * Publishes primary-render readiness from a hidden prerendered route.
 * Active pages and browsers without BroadcastChannel use a no-op reporter.
 */
(function initializeRouteWarmupReadiness(globalScope) {
  'use strict';

  const readinessChannel = document.prerendering && typeof globalScope.BroadcastChannel === 'function'
    ? new globalScope.BroadcastChannel(globalScope.ROUTE_WARMUP_CHANNEL_NAME)
    : null;
  const allowedReadinessStates = new Set(Object.values(globalScope.ROUTE_WARMUP_READINESS_STATES));

  /**
   * Reports one validated readiness state to the page that initiated this prerender.
   * @param {string} state - Shared route warm-up readiness state
   * @returns {boolean} Whether the readiness state was published
   */
  function report(state) {
    if (!readinessChannel || !allowedReadinessStates.has(state)) return false;

    readinessChannel.postMessage({
      route: globalScope.location.href,
      state
    });
    return true;
  }

  globalScope.cnslRouteWarmupReadiness = Object.freeze({ report });
})(globalThis);
