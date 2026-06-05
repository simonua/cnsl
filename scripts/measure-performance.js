const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const vm = require('node:vm');
const { chromium } = require('@playwright/test');

const ROOT_DIR = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT_DIR, 'out');
const ORIGIN = 'http://127.0.0.1:4174';
const RUN_COUNT = Number.parseInt(process.env.CNSL_PERF_RUNS || '3', 10);
const BUDGET_SCALE = Number.parseFloat(process.env.CNSL_PERF_BUDGET_SCALE || '1');
const POOL_PHASE_MARKS = Object.freeze([
  'primary-data-ready',
  'summary-visible',
  'optional-enrichment-settled'
]);
const ROUTES = [
  { budgetBytes: 900000, budgetRequests: 55, budgetUsableMs: 2000, id: 'poolList', name: 'Pools', path: '/pools.html' },
  { budgetBytes: 1100000, budgetRequests: 50, budgetUsableMs: 1800, id: 'teamList', name: 'Teams', path: '/teams.html' },
  { budgetBytes: 800000, budgetRequests: 45, budgetUsableMs: 1800, id: 'meetList', name: 'Meets', path: '/meets.html' }
];

function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)];
}

function spread(values) {
  if (values.length === 0) throw new Error('Cannot summarize an empty performance sample.');
  const sorted = [...values].sort((left, right) => left - right);
  return { min: sorted[0], median: median(sorted), max: sorted[sorted.length - 1] };
}

function summarizeRouteSamples(samples) {
  const phaseNames = new Set(samples.flatMap(sample => Object.keys(sample.phases || {})));
  return {
    annualDomainRequests: samples.reduce((maximums, sample) => {
      Object.entries(sample.annualDomainRequests).forEach(([domain, count]) => {
        maximums[domain] = Math.max(maximums[domain] || 0, count);
      });
      return maximums;
    }, {}),
    bytes: median(samples.map(sample => sample.bytes)),
    phases: Object.fromEntries([...phaseNames].map(phaseName => [
      phaseName,
      spread(samples.map(sample => sample.phases[phaseName]).filter(Number.isFinite))
    ])),
    requests: median(samples.map(sample => sample.requests)),
    usableMs: spread(samples.map(sample => sample.usableMs))
  };
}

async function waitForServer() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(`${ORIGIN}/index.html`);
      if (response.ok) return;
    } catch (_error) {
      // The local server may still be starting.
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Performance server did not start at ${ORIGIN}.`);
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

async function measureRoute(browser, route) {
  const samples = [];
  for (let run = 0; run < RUN_COUNT; run += 1) {
    const context = await browser.newContext({ reducedMotion: 'reduce', serviceWorkers: 'block' });
    const page = await context.newPage();
    const responseJobs = [];
    const annualDomainRequests = new Map();
    let bytes = 0;
    let requests = 0;

    await page.route('**/*', requestRoute => {
      const requestUrl = new URL(requestRoute.request().url());
      return requestUrl.origin === ORIGIN ? requestRoute.continue() : requestRoute.abort();
    });
    page.on('response', response => {
      const responseUrl = new URL(response.url());
      if (responseUrl.origin !== ORIGIN) return;
      requests += 1;
      const domainMatch = responseUrl.pathname.match(/\/assets\/data\/\d+\/(pools|teams|meets)\//);
      if (domainMatch) annualDomainRequests.set(domainMatch[1], (annualDomainRequests.get(domainMatch[1]) || 0) + 1);
      responseJobs.push(response.body().then(body => { bytes += body.byteLength; }).catch(() => undefined));
    });

    const startedAt = performance.now();
    await page.goto(`${ORIGIN}${route.path}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector(`#${route.id}[aria-busy="false"]`);
    const usableMs = Math.round(performance.now() - startedAt);
    await page.waitForLoadState('networkidle');
    await Promise.all(responseJobs);
    const phases = route.name === 'Pools' ? await page.evaluate(phaseNames => Object.fromEntries(phaseNames.map(phaseName => {
      const entries = performance.getEntriesByName(`cnsl:pools:${phaseName}`, 'mark');
      const latestEntry = entries[entries.length - 1];
      return [phaseName, latestEntry ? Math.round(latestEntry.startTime) : null];
    })), POOL_PHASE_MARKS) : {};
    const missingPhase = POOL_PHASE_MARKS.find(phaseName => route.name === 'Pools' && !Number.isFinite(phases[phaseName]));
    if (missingPhase) throw new Error(`Pools performance mark is missing: ${missingPhase}.`);
    samples.push({ annualDomainRequests: Object.fromEntries(annualDomainRequests), bytes, phases, requests, usableMs });
    await context.close();
  }

  return summarizeRouteSamples(samples);
}

function reportWarnings(routeResults, pwaTiers) {
  const warnings = [];
  routeResults.forEach(({ measurement, route }) => {
    if (measurement.usableMs.median > route.budgetUsableMs * BUDGET_SCALE) warnings.push(`${route.name} usable median ${measurement.usableMs.median} ms exceeds ${route.budgetUsableMs * BUDGET_SCALE} ms.`);
    if (measurement.requests > route.budgetRequests * BUDGET_SCALE) warnings.push(`${route.name} request median ${measurement.requests} exceeds ${route.budgetRequests * BUDGET_SCALE}.`);
    if (measurement.bytes > route.budgetBytes * BUDGET_SCALE) warnings.push(`${route.name} byte median ${measurement.bytes} exceeds ${route.budgetBytes * BUDGET_SCALE}.`);
    Object.entries(measurement.annualDomainRequests).forEach(([domain, count]) => {
      if (count > 1) warnings.push(`${route.name} requested the ${domain} annual domain ${count} times in one run.`);
    });
  });
  if (pwaTiers.core.resources > 70 * BUDGET_SCALE) warnings.push(`PWA critical install resources ${pwaTiers.core.resources} exceeds ${70 * BUDGET_SCALE}.`);
  if (pwaTiers.core.bytes > 1200000 * BUDGET_SCALE) warnings.push(`PWA critical install bytes ${pwaTiers.core.bytes} exceeds ${1200000 * BUDGET_SCALE}.`);
  warnings.forEach(warning => console.warn(`PERFORMANCE WARNING: ${warning}`));
  return warnings;
}

async function main() {
  assertBuildExists();
  const server = spawn(process.execPath, [require.resolve('http-server/bin/http-server'), OUT_DIR, '-p', '4174', '-c-1'], { stdio: 'ignore' });
  try {
    await waitForServer();
    const browser = await chromium.launch({ channel: 'chromium' });
    const routeResults = [];
    try {
      for (const route of ROUTES) routeResults.push({ measurement: await measureRoute(browser, route), route });
    } finally {
      await browser.close();
    }
    const pwaTiers = measurePwaTiers();
    console.table(routeResults.map(({ measurement, route }) => ({
      route: route.name,
      usableMinMs: measurement.usableMs.min,
      usableMedianMs: measurement.usableMs.median,
      usableMaxMs: measurement.usableMs.max,
      requestMedian: measurement.requests,
      byteMedian: measurement.bytes,
      maxAnnualDomainRequests: JSON.stringify(measurement.annualDomainRequests)
    })));
    const poolMeasurement = routeResults.find(({ route }) => route.name === 'Pools').measurement;
    console.table(Object.entries(poolMeasurement.phases).map(([phase, timing]) => ({
      phase,
      minMs: timing.min,
      medianMs: timing.median,
      maxMs: timing.max
    })));
    console.log(`PWA cache inventory: ${pwaTiers.inventory.resources} resources / ${pwaTiers.inventory.bytes} bytes.`);
    console.log(`PWA install-critical core: ${pwaTiers.core.resources} resources / ${pwaTiers.core.bytes} bytes.`);
    console.log(`PWA cache-on-use optional tier: ${pwaTiers.optional.resources} resources / ${pwaTiers.optional.bytes} bytes.`);
    const warnings = reportWarnings(routeResults, pwaTiers);
    console.log(`Performance measurement completed with ${warnings.length} warning(s) across ${RUN_COUNT} cold run(s) per route.`);
  } finally {
    server.kill();
  }
}

function assertBuildExists() {
  if (!Number.isInteger(RUN_COUNT) || RUN_COUNT < 1) throw new Error('CNSL_PERF_RUNS must be a positive integer.');
  if (!Number.isFinite(BUDGET_SCALE) || BUDGET_SCALE <= 0) throw new Error('CNSL_PERF_BUDGET_SCALE must be a positive number.');
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

module.exports = { median, spread, summarizeRouteSamples };