const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const vm = require('node:vm');
const { chromium } = require('@playwright/test');

const ROOT_DIR = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT_DIR, 'out');
const COLD_ORIGIN = 'http://127.0.0.1:4174';
const PWA_ORIGIN = 'http://cnsl.test:4174';
const RUN_COUNT = Number.parseInt(process.env.CNSL_PERF_RUNS || '5', 10);
const BUDGET_SCALE = Number.parseFloat(process.env.CNSL_PERF_BUDGET_SCALE || '1');
const PERFORMANCE_PROFILES = Object.freeze({
  desktop: Object.freeze({ cpuSlowdownRate: 1, viewport: null }),
  mobile: Object.freeze({ cpuSlowdownRate: 1, viewport: Object.freeze({ width: 390, height: 844 }) }),
  'mobile-slow': Object.freeze({ cpuSlowdownRate: 4, viewport: Object.freeze({ width: 390, height: 844 }) })
});
const PERFORMANCE_PROFILE_NAME = process.env.CNSL_PERF_PROFILE || 'desktop';
const PERFORMANCE_PROFILE = PERFORMANCE_PROFILES[PERFORMANCE_PROFILE_NAME];
const PWA_CRITICAL_RESOURCE_BUDGET = 75;
const DIRECTORY_PHASE_MARKS = Object.freeze({
  Pools: Object.freeze(['primary-data-ready', 'summary-visible', 'optional-enrichment-settled']),
  Teams: Object.freeze(['primary-data-ready', 'summary-visible', 'optional-enrichment-settled'])
});
const ROUTES = [
  { budgetBytes: 500000, budgetRequests: 45, budgetUsableMs: 1200, name: 'Home', path: '/index.html', readySelector: '.home-view' },
  { budgetBytes: 900000, budgetRequests: 55, budgetUsableMs: 2000, name: 'Pools', path: '/pools.html', readySelector: '#poolList[aria-busy="false"]' },
  { budgetBytes: 1100000, budgetRequests: 50, budgetUsableMs: 1800, name: 'Teams', path: '/teams.html', readySelector: '#teamList[aria-busy="false"]' },
  { budgetBytes: 800000, budgetRequests: 45, budgetUsableMs: 1800, name: 'Meets', path: '/meets.html', readySelector: '#meetList[aria-busy="false"]' },
  { budgetBytes: 500000, budgetRequests: 45, budgetUsableMs: 1200, name: 'My Meet Day', path: '/my-meet-day.html', readySelector: '#myMeetDayDisabled:not([hidden])' }
];
const DIRECTORY_ROUTES = ROUTES.filter(route => route.name !== 'Home' && route.name !== 'My Meet Day');

function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)];
}

function spread(values) {
  if (values.length === 0) throw new Error('Cannot summarize an empty performance sample.');
  const sorted = [...values].sort((left, right) => left - right);
  return { min: sorted[0], median: median(sorted), max: sorted[sorted.length - 1] };
}

function summarizeNumeric(samples, propertyName) {
  return spread(samples.map(sample => sample[propertyName]).filter(Number.isFinite));
}

function maximumDomainRequests(samples) {
  return samples.reduce((maximums, sample) => {
    Object.entries(sample.annualDomainRequests).forEach(([domain, count]) => {
      maximums[domain] = Math.max(maximums[domain] || 0, count);
    });
    return maximums;
  }, {});
}

function summarizeRouteSamples(samples) {
  const phaseNames = new Set(samples.flatMap(sample => Object.keys(sample.phases || {})));
  return {
    annualDomainRequests: maximumDomainRequests(samples),
    decodedBytes: median(samples.map(sample => sample.decodedBytes)),
    cacheHits: median(samples.map(sample => sample.cacheHits)),
    domContentLoadedMs: summarizeNumeric(samples, 'domContentLoadedMs'),
    firstContentfulPaintMs: summarizeNumeric(samples, 'firstContentfulPaintMs'),
    initiators: samples.reduce((maximums, sample) => {
      Object.entries(sample.initiators).forEach(([initiator, count]) => {
        maximums[initiator] = Math.max(maximums[initiator] || 0, count);
      });
      return maximums;
    }, {}),
    longTaskMs: summarizeNumeric(samples, 'longTaskMs'),
    phases: Object.fromEntries([...phaseNames].map(phaseName => [
      phaseName,
      spread(samples.map(sample => sample.phases[phaseName]).filter(Number.isFinite))
    ])),
    requests: median(samples.map(sample => sample.requests)),
    transferredBytes: median(samples.map(sample => sample.transferredBytes)),
    usableMs: summarizeNumeric(samples, 'usableMs'),
    workerControlledSamples: samples.filter(sample => sample.workerControlled).length
  };
}

function summarizeWarmSamples(samples) {
  return {
    cacheResources: summarizeNumeric(samples, 'cacheResources'),
    homeUsableMs: summarizeNumeric(samples, 'homeUsableMs'),
    workerReadyMs: summarizeNumeric(samples, 'workerReadyMs'),
    workerVersion: samples.find(sample => sample.workerVersion)?.workerVersion || 'unknown',
    routes: Object.fromEntries(DIRECTORY_ROUTES.map(route => [route.name, {
      controlled: samples.every(sample => sample.routes[route.name].first.workerControlled
        && sample.routes[route.name].repeat.workerControlled),
      first: summarizeRouteSamples(samples.map(sample => sample.routes[route.name].first)),
      repeat: summarizeRouteSamples(samples.map(sample => sample.routes[route.name].repeat))
    }]))
  };
}

async function waitForServer() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(`${COLD_ORIGIN}/index.html`);
      if (response.ok) return;
    } catch (_error) {
      // The local server may still be starting.
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Performance server did not start at ${COLD_ORIGIN}.`);
}

function measureResourceTier(resources) {
  const bytes = resources
    .filter(resource => resource !== './')
    .reduce((total, resource) => total + fs.statSync(path.join(OUT_DIR, resource)).size, 0);
  return { bytes, resources: resources.length };
}

function measurePwaTiers() {
  const context = { self: {} };
  vm.runInNewContext(fs.readFileSync(path.join(OUT_DIR, 'precache-manifest.js'), 'utf8'), context);
  return {
    inventory: measureResourceTier(context.self.PRECACHE_RESOURCES),
    core: measureResourceTier(context.self.PRECACHE_CORE_RESOURCES),
    optional: measureResourceTier(context.self.PRECACHE_OPTIONAL_RESOURCES)
  };
}

async function configurePage(page, origin) {
  await page.addInitScript(() => {
    globalThis.__cnslLongTasks = [];
    if (typeof PerformanceObserver !== 'undefined') {
      try {
        const observer = new PerformanceObserver(list => {
          globalThis.__cnslLongTasks.push(...list.getEntries().map(entry => entry.duration));
        });
        observer.observe({ type: 'longtask', buffered: true });
      } catch (_error) {
        // Long-task entries are optional browser diagnostics.
      }
    }
  });
  await page.route('**/*', requestRoute => {
    const requestUrl = new URL(requestRoute.request().url());
    return requestUrl.origin === origin ? requestRoute.continue() : requestRoute.abort();
  });
}

async function createMeasurementPage(browser, serviceWorkers) {
  const context = await browser.newContext({
    reducedMotion: 'reduce',
    serviceWorkers,
    ...(PERFORMANCE_PROFILE.viewport ? { viewport: PERFORMANCE_PROFILE.viewport } : {})
  });
  const page = await context.newPage();
  if (PERFORMANCE_PROFILE.cpuSlowdownRate > 1) {
    const session = await context.newCDPSession(page);
    await session.send('Emulation.setCPUThrottlingRate', { rate: PERFORMANCE_PROFILE.cpuSlowdownRate });
  }
  return { context, page };
}

async function collectPageMetrics(page, route, usableMs, responseMetrics = null) {
  const phaseNames = DIRECTORY_PHASE_MARKS[route.name] || [];
  const browserMetrics = await page.evaluate(({ phaseNames, routeName }) => {
    const resources = performance.getEntriesByType('resource');
    const navigation = performance.getEntriesByType('navigation')[0];
    const paints = performance.getEntriesByType('paint');
    const annualDomainRequests = {};
    const initiators = {};
    let cacheHits = 0;
    let transferredBytes = navigation?.transferSize || 0;

    resources.forEach(resource => {
      const domainMatch = new URL(resource.name).pathname.match(/\/assets\/data\/\d+\/(pools|teams|meets)\//);
      if (domainMatch) annualDomainRequests[domainMatch[1]] = (annualDomainRequests[domainMatch[1]] || 0) + 1;
      const initiator = resource.initiatorType || 'other';
      initiators[initiator] = (initiators[initiator] || 0) + 1;
      transferredBytes += resource.transferSize || 0;
      if (resource.transferSize === 0 && resource.decodedBodySize > 0) cacheHits += 1;
    });

    const routeMarkPrefix = routeName.toLowerCase();
    const phases = Object.fromEntries(phaseNames.map(phaseName => {
      const entries = performance.getEntriesByName(`cnsl:${routeMarkPrefix}:${phaseName}`, 'mark');
      const latestEntry = entries[entries.length - 1];
      return [phaseName, latestEntry ? Math.round(latestEntry.startTime) : null];
    }));

    return {
      annualDomainRequests,
      cacheHits,
      domContentLoadedMs: Math.round(navigation?.domContentLoadedEventEnd || 0),
      firstContentfulPaintMs: Math.round(paints.find(entry => entry.name === 'first-contentful-paint')?.startTime || 0),
      initiators,
      longTaskMs: Math.round((globalThis.__cnslLongTasks || []).reduce((total, duration) => total + duration, 0)),
      phases,
      requests: resources.length + (navigation ? 1 : 0),
      transferredBytes,
      workerControlled: Boolean(navigator.serviceWorker?.controller)
    };
  }, { phaseNames, routeName: route.name });

  const missingPhase = phaseNames.find(phaseName => !Number.isFinite(browserMetrics.phases[phaseName]));
  if (missingPhase) throw new Error(`${route.name} performance mark is missing: ${missingPhase}.`);
  if (phaseNames.length > 0) {
    const phaseTimings = phaseNames.map(phaseName => browserMetrics.phases[phaseName]);
    if (phaseTimings.some((timing, index) => index > 0 && timing < phaseTimings[index - 1])) {
      throw new Error(`${route.name} performance marks are not in lifecycle order.`);
    }
  }

  return {
    ...browserMetrics,
    annualDomainRequests: responseMetrics?.annualDomainRequests || browserMetrics.annualDomainRequests,
    decodedBytes: responseMetrics?.decodedBytes ?? browserMetrics.transferredBytes,
    requests: responseMetrics?.requests ?? browserMetrics.requests,
    usableMs
  };
}

async function navigateAndMeasure(page, origin, route, responseMetrics = null) {
  const startedAt = performance.now();
  await page.goto(`${origin}${route.path}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector(route.readySelector);
  const usableMs = Math.round(performance.now() - startedAt);
  await page.waitForLoadState('networkidle');
  return collectPageMetrics(page, route, usableMs, responseMetrics);
}

async function measureRoute(browser, route) {
  const samples = [];
  for (let run = 0; run < RUN_COUNT; run += 1) {
    const { context, page } = await createMeasurementPage(browser, 'block');
    const responseJobs = [];
    const annualDomainRequests = new Map();
    const responseMetrics = { annualDomainRequests: {}, decodedBytes: 0, failedBodyReads: 0, requests: 0 };
    await configurePage(page, COLD_ORIGIN);
    page.on('response', response => {
      const responseUrl = new URL(response.url());
      if (responseUrl.origin !== COLD_ORIGIN) return;
      responseMetrics.requests += 1;
      const domainMatch = responseUrl.pathname.match(/\/assets\/data\/\d+\/(pools|teams|meets)\//);
      if (domainMatch) annualDomainRequests.set(domainMatch[1], (annualDomainRequests.get(domainMatch[1]) || 0) + 1);
      responseJobs.push(response.body()
        .then(body => { responseMetrics.decodedBytes += body.byteLength; })
        .catch(() => { responseMetrics.failedBodyReads += 1; }));
    });

    const sample = await navigateAndMeasure(page, COLD_ORIGIN, route, responseMetrics);
    await Promise.all(responseJobs);
    sample.annualDomainRequests = Object.fromEntries(annualDomainRequests);
    if (responseMetrics.failedBodyReads > 0) {
      console.warn(`${route.name} could not read ${responseMetrics.failedBodyReads} response body or bodies in cold run ${run + 1}.`);
    }
    sample.decodedBytes = responseMetrics.decodedBytes;
    samples.push(sample);
    await context.close();
  }
  return summarizeRouteSamples(samples);
}

async function waitForWorkerControl(page) {
  return page.evaluate(async () => {
    const startedAt = performance.now();
    const registration = await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Service worker did not take control.')), 15000);
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          clearTimeout(timeout);
          resolve();
        }, { once: true });
      });
    }
    return {
      readyMs: Math.round(performance.now() - startedAt),
      version: (await globalThis.caches.keys()).find(cacheName => cacheName.startsWith('cnsl-static-'))
        || new URL(registration.active.scriptURL).pathname
    };
  });
}

async function readCacheResourceCount(page) {
  return page.evaluate(async () => {
    const cacheNames = await globalThis.caches.keys();
    const activeCacheName = cacheNames.find(cacheName => cacheName.startsWith('cnsl-static-'));
    if (!activeCacheName) return 0;
    return (await (await globalThis.caches.open(activeCacheName)).keys()).length;
  });
}

async function measureWarmNavigation(browser) {
  const samples = [];
  const homeRoute = ROUTES.find(route => route.name === 'Home');
  for (let run = 0; run < RUN_COUNT; run += 1) {
    const { context, page } = await createMeasurementPage(browser, 'allow');
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    await configurePage(page, PWA_ORIGIN);

    const home = await navigateAndMeasure(page, PWA_ORIGIN, homeRoute);
    const worker = await waitForWorkerControl(page);
    const routes = {};
    for (const route of DIRECTORY_ROUTES) {
      const first = await navigateAndMeasure(page, PWA_ORIGIN, route);
      await navigateAndMeasure(page, PWA_ORIGIN, homeRoute);
      const repeat = await navigateAndMeasure(page, PWA_ORIGIN, route);
      routes[route.name] = { first, repeat };
    }
    if (pageErrors.length > 0) throw new Error(`Warm-navigation page error: ${pageErrors.join('; ')}`);
    samples.push({
      cacheResources: await readCacheResourceCount(page),
      homeUsableMs: home.usableMs,
      routes,
      workerReadyMs: worker.readyMs,
      workerVersion: worker.version
    });
    await context.close();
  }
  return summarizeWarmSamples(samples);
}

function reportWarnings(routeResults, pwaTiers) {
  const warnings = [];
  routeResults.forEach(({ measurement, route }) => {
    if (measurement.usableMs.median > route.budgetUsableMs * BUDGET_SCALE) warnings.push(`${route.name} usable median ${measurement.usableMs.median} ms exceeds ${route.budgetUsableMs * BUDGET_SCALE} ms.`);
    if (measurement.requests > route.budgetRequests * BUDGET_SCALE) warnings.push(`${route.name} request median ${measurement.requests} exceeds ${route.budgetRequests * BUDGET_SCALE}.`);
    if (measurement.decodedBytes > route.budgetBytes * BUDGET_SCALE) warnings.push(`${route.name} decoded-byte median ${measurement.decodedBytes} exceeds ${route.budgetBytes * BUDGET_SCALE}.`);
    Object.entries(measurement.annualDomainRequests).forEach(([domain, count]) => {
      if (count > 1) warnings.push(`${route.name} requested the ${domain} annual domain ${count} times in one run.`);
    });
  });
  if (pwaTiers.core.resources > PWA_CRITICAL_RESOURCE_BUDGET * BUDGET_SCALE) warnings.push(`PWA critical install resources ${pwaTiers.core.resources} exceeds ${PWA_CRITICAL_RESOURCE_BUDGET * BUDGET_SCALE}.`);
  if (pwaTiers.core.bytes > 1200000 * BUDGET_SCALE) warnings.push(`PWA critical install bytes ${pwaTiers.core.bytes} exceeds ${1200000 * BUDGET_SCALE}.`);
  warnings.forEach(warning => console.warn(`PERFORMANCE WARNING: ${warning}`));
  return warnings;
}

function printRouteTable(routeResults) {
  console.table(routeResults.map(({ measurement, route }) => ({
    route: route.name,
    usableMedianMs: measurement.usableMs.median,
    usableSpreadMs: `${measurement.usableMs.min}-${measurement.usableMs.max}`,
    fcpMedianMs: measurement.firstContentfulPaintMs.median,
    domReadyMedianMs: measurement.domContentLoadedMs.median,
    longTaskMedianMs: measurement.longTaskMs.median,
    requestMedian: measurement.requests,
    decodedByteMedian: measurement.decodedBytes,
    transferredByteMedian: measurement.transferredBytes,
    maxAnnualDomainRequests: JSON.stringify(measurement.annualDomainRequests)
  })));
}

function printWarmTable(warmMeasurement) {
  console.table(Object.entries(warmMeasurement.routes).flatMap(([route, measurement]) => ['first', 'repeat'].map(stage => ({
    route,
    stage,
    usableMedianMs: measurement[stage].usableMs.median,
    usableSpreadMs: `${measurement[stage].usableMs.min}-${measurement[stage].usableMs.max}`,
    transferredByteMedian: measurement[stage].transferredBytes,
    cacheHitMedian: measurement[stage].cacheHits,
    controlled: measurement.controlled,
    initiators: JSON.stringify(measurement[stage].initiators),
    maxAnnualDomainRequests: JSON.stringify(measurement[stage].annualDomainRequests)
  }))));
}

async function main() {
  assertBuildExists();
  const server = spawn(process.execPath, [require.resolve('http-server/bin/http-server'), OUT_DIR, '-p', '4174', '-c-1'], { stdio: 'ignore' });
  try {
    await waitForServer();
    const browser = await chromium.launch({
      channel: 'chromium',
      args: [
        '--host-resolver-rules=MAP cnsl.test 127.0.0.1',
        `--unsafely-treat-insecure-origin-as-secure=${PWA_ORIGIN}`
      ]
    });
    let routeResults;
    let warmMeasurement;
    try {
      routeResults = [];
      for (const route of ROUTES) routeResults.push({ measurement: await measureRoute(browser, route), route });
      warmMeasurement = await measureWarmNavigation(browser);
    } finally {
      await browser.close();
    }

    const pwaTiers = measurePwaTiers();
    console.log(`Measurement context: ${JSON.stringify({
      capturedAt: new Date().toISOString(),
      cpu: os.cpus()[0]?.model || 'unknown',
      logicalCpus: os.cpus().length,
      memoryBytes: os.totalmem(),
      node: process.version,
      platform: `${process.platform}-${process.arch}`,
      profile: PERFORMANCE_PROFILE_NAME,
      cpuSlowdownRate: PERFORMANCE_PROFILE.cpuSlowdownRate,
      viewport: PERFORMANCE_PROFILE.viewport,
      runCount: RUN_COUNT
    })}`);
    console.log('Cold uncontrolled navigation:');
    printRouteTable(routeResults);
    routeResults.filter(({ measurement }) => Object.keys(measurement.phases).length > 0)
      .forEach(({ measurement, route }) => {
        console.log(`${route.name} progressive phases:`);
        console.table(Object.entries(measurement.phases).map(([phase, timing]) => ({
          phase,
          minMs: timing.min,
          medianMs: timing.median,
          maxMs: timing.max
        })));
      });
    console.log('Installed/controlled navigation in a persistent context:');
    printWarmTable(warmMeasurement);
    console.log(`Worker ${warmMeasurement.workerVersion}: ready median ${warmMeasurement.workerReadyMs.median} ms (${warmMeasurement.workerReadyMs.min}-${warmMeasurement.workerReadyMs.max} ms), cache resources median ${warmMeasurement.cacheResources.median}.`);
    console.log(`PWA cache inventory: ${pwaTiers.inventory.resources} resources / ${pwaTiers.inventory.bytes} bytes.`);
    console.log(`PWA install-critical core: ${pwaTiers.core.resources} resources / ${pwaTiers.core.bytes} bytes.`);
    console.log(`PWA cache-on-use optional tier: ${pwaTiers.optional.resources} resources / ${pwaTiers.optional.bytes} bytes.`);
    const warnings = reportWarnings(routeResults, pwaTiers);
    console.log(`Performance measurement completed with ${warnings.length} warning(s) across ${RUN_COUNT} cold and installed-navigation run(s) per route.`);
  } finally {
    server.kill();
  }
}

function assertBuildExists() {
  if (!Number.isInteger(RUN_COUNT) || RUN_COUNT < 1) throw new Error('CNSL_PERF_RUNS must be a positive integer.');
  if (!Number.isFinite(BUDGET_SCALE) || BUDGET_SCALE <= 0) throw new Error('CNSL_PERF_BUDGET_SCALE must be a positive number.');
  if (!PERFORMANCE_PROFILE) {
    throw new Error(`CNSL_PERF_PROFILE must be one of: ${Object.keys(PERFORMANCE_PROFILES).join(', ')}.`);
  }
  if (!fs.existsSync(path.join(OUT_DIR, 'precache-manifest.js'))) {
    throw new Error('Build output is missing. Run pnpm run build before measuring performance.');
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = {
  DIRECTORY_PHASE_MARKS,
  DIRECTORY_ROUTES,
  PERFORMANCE_PROFILES,
  PWA_CRITICAL_RESOURCE_BUDGET,
  ROUTES,
  maximumDomainRequests,
  median,
  spread,
  summarizeRouteSamples,
  summarizeWarmSamples
};
