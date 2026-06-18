const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  DIRECTORY_ROUTES,
  PERFORMANCE_PROFILES,
  PWA_CRITICAL_RESOURCE_BUDGET,
  ROUTE_PHASE_MARKS,
  ROUTES,
  maximumDomainRequests,
  median,
  spread,
  summarizeRouteSamples,
  summarizeWarmSamples
} = require('../../scripts/measure-performance.js');

function createSample(overrides = {}) {
  return {
    annualDomainRequests: { pools: 1 },
    cacheHits: 0,
    decodedBytes: 800,
    domContentLoadedMs: 150,
    firstContentfulPaintMs: 100,
    initiators: { script: 2 },
    longTaskMs: 0,
    phases: {},
    requests: 40,
    transferredBytes: 700,
    usableMs: 220,
    workerControlled: false,
    ...overrides
  };
}

describe('performance measurement reporting', () => {
  it('should retain measured headroom in the install-critical resource budget', () => {
    assert.equal(PWA_CRITICAL_RESOURCE_BUDGET, 75);
  });

  it('should include Home with a visitor-ready content boundary', () => {
    assert.deepEqual(
      ROUTES.map(({ name, readySelector }) => ({ name, readySelector })),
      [
        { name: 'Home', readySelector: '.home-view' },
        { name: 'Pools', readySelector: '#poolList[aria-busy="false"]' },
        { name: 'Teams', readySelector: '#teamList[aria-busy="false"]' },
        { name: 'Meets', readySelector: '#meetList[aria-busy="false"]' },
        { name: 'My Meet Day', readySelector: '#myMeetDay:not([hidden]), #myMeetDayNoMeet:not([hidden])' }
      ]
    );
  });

  it('should calculate the existing upper median and a compact sample spread', () => {
    assert.equal(median([900, 500, 700, 600]), 700);
    assert.deepEqual(spread([900, 500, 700]), { min: 500, median: 700, max: 900 });
    assert.throws(() => spread([]));
  });

  it('should define measurable progressive lifecycles for optimized routes', () => {
    assert.deepEqual(ROUTE_PHASE_MARKS, {
      Meets: ['primary-data-ready', 'summary-visible', 'optional-enrichment-settled'],
      'My Meet Day': ['primary-data-ready', 'summary-visible'],
      Pools: ['primary-data-ready', 'summary-visible', 'optional-enrichment-settled'],
      Teams: ['primary-data-ready', 'summary-visible', 'optional-enrichment-settled']
    });
  });

  it('should provide desktop, mobile viewport, and slower-mobile measurement profiles', () => {
    assert.deepEqual(PERFORMANCE_PROFILES, {
      desktop: { cpuSlowdownRate: 1, viewport: null },
      mobile: { cpuSlowdownRate: 1, viewport: { width: 390, height: 844 } },
      'mobile-slow': { cpuSlowdownRate: 4, viewport: { width: 390, height: 844 } }
    });
  });

  it('should report route usability separately from progressive directory phases', () => {
    const summary = summarizeRouteSamples([
      createSample({
        annualDomainRequests: { pools: 1, teams: 1 },
        phases: { 'primary-data-ready': 120, 'summary-visible': 180, 'optional-enrichment-settled': 700 },
      }),
      createSample({
        annualDomainRequests: { pools: 1, teams: 1, meets: 1 },
        decodedBytes: 900,
        cacheHits: 3,
        domContentLoadedMs: 140,
        firstContentfulPaintMs: 90,
        initiators: { fetch: 3, script: 1 },
        longTaskMs: 10,
        phases: { 'primary-data-ready': 100, 'summary-visible': 160, 'optional-enrichment-settled': 900 },
        requests: 42,
        transferredBytes: 800,
        usableMs: 200
      }),
      createSample({
        annualDomainRequests: { pools: 1, teams: 1, meets: 1 },
        decodedBytes: 850,
        phases: { 'primary-data-ready': 110, 'summary-visible': 170, 'optional-enrichment-settled': 800 },
        requests: 41,
        transferredBytes: 750,
        usableMs: 210
      })
    ]);

    assert.deepEqual(summary.usableMs, { min: 200, median: 210, max: 220 });
    assert.deepEqual(summary.phases['summary-visible'], { min: 160, median: 170, max: 180 });
    assert.deepEqual(summary.phases['optional-enrichment-settled'], { min: 700, median: 800, max: 900 });
    assert.deepEqual(summary.annualDomainRequests, { pools: 1, teams: 1, meets: 1 });
    assert.equal(summary.decodedBytes, 850);
    assert.equal(summary.requests, 41);
    assert.equal(summary.cacheHits, 0);
    assert.deepEqual(summary.initiators, { script: 2, fetch: 3 });
    assert.deepEqual(summary.firstContentfulPaintMs, { min: 90, median: 100, max: 100 });
    assert.deepEqual(summary.domContentLoadedMs, { min: 140, median: 150, max: 150 });
    assert.deepEqual(summary.longTaskMs, { min: 0, median: 0, max: 10 });
    assert.ok(summary.phases['primary-data-ready'].median < summary.phases['summary-visible'].median);
    assert.ok(summary.phases['summary-visible'].median < summary.phases['optional-enrichment-settled'].median);
  });

  it('should retain the maximum request count for each annual domain', () => {
    assert.deepEqual(maximumDomainRequests([
      { annualDomainRequests: { pools: 1, teams: 1 } },
      { annualDomainRequests: { pools: 2, meets: 1 } }
    ]), { pools: 2, teams: 1, meets: 1 });
  });

  it('should keep controlled first and repeat navigation evidence separate', () => {
    const routes = Object.fromEntries(DIRECTORY_ROUTES.map(route => [route.name, {
      first: createSample({ usableMs: 80, workerControlled: true }),
      repeat: createSample({ cacheHits: 3, transferredBytes: 0, usableMs: 30, workerControlled: true })
    }]));
    const summary = summarizeWarmSamples([{
      cacheResources: 63,
      homeUsableMs: 45,
      routes,
      workerReadyMs: 100,
      workerVersion: 'cnsl-cache-test'
    }]);

    assert.equal(summary.workerVersion, 'cnsl-cache-test');
    assert.equal(summary.routes.Pools.controlled, true);
    assert.equal(summary.routes.Pools.first.usableMs.median, 80);
    assert.equal(summary.routes.Pools.repeat.usableMs.median, 30);
    assert.equal(summary.routes.Pools.repeat.transferredBytes, 0);
  });
});
