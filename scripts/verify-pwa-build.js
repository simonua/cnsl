const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('node:vm');
const {
  APP_VERSION,
  DEPLOYMENT_VERSION_FILE,
  GA4_MEASUREMENT_ID,
  HOME_PAGE_HOSTNAME,
  HOME_PAGE_URL,
  TEAM_AGENDA_DEPENDENCIES,
  YEAR
} = require('./adapters/app-config.js');
const { CACHE_ON_USE_SCRIPT_RESOURCES, INSTALL_CRITICAL_PAGES } = require('./lib/pwa-resource-policy.js');
const WeatherAlertService = require('./adapters/weather-alert-service.js');

const outDir = path.join(__dirname, '..', 'out');
const siteOrigin = HOME_PAGE_URL;
const socialPreviewImage = `${siteOrigin}/assets/images/cnsl-logo.jpg`;
const unpublishedAnnualEvidenceDirectories = [
  `assets/data/${YEAR}/pools/pool-schedules`,
  `assets/data/${YEAR}/meets/meet-schedules`,
  `assets/data/${YEAR}/teams/team-schedules`
];
const rootIconAliases = Object.freeze({
  'apple-touch-icon-120x120-precomposed.png': 'apple-touch-icon.png',
  'apple-touch-icon-120x120.png': 'apple-touch-icon.png',
  'apple-touch-icon-precomposed.png': 'apple-touch-icon.png',
  'apple-touch-icon.png': 'apple-touch-icon.png',
  'favicon.ico': 'favicon.ico'
});
const requiredArtifacts = [
  'BingSiteAuth.xml',
  'b95676755a0a47f2965553d9f994f87f.txt',
  'CNAME',
  DEPLOYMENT_VERSION_FILE,
  ...Object.keys(rootIconAliases),
  'google3dd9d57115818ebb.html',
  'index.html',
  'lessons.html',
  'offline.html',
  'pools.html',
  'teams.html',
  'meets.html',
  'settings.html',
  'robots.txt',
  'sitemap.xml',
  'manifest.webmanifest',
  'precache-manifest.js',
  'service-worker.js',
  'js/config/weather-operating-windows.js',
  'assets/images/logos/team-logos@2x.png',
  `assets/data/${YEAR}/pools/pools.json`,
  `assets/data/${YEAR}/teams/teams.json`,
  `assets/data/${YEAR}/meets/meets.json`
];
const canonicalPages = {
  'index.html': `${siteOrigin}/`,
  'pools.html': `${siteOrigin}/pools.html`,
  'teams.html': `${siteOrigin}/teams.html`,
  'meets.html': `${siteOrigin}/meets.html`,
  'lessons.html': `${siteOrigin}/`,
  'faq.html': `${siteOrigin}/`,
  'settings.html': `${siteOrigin}/`,
  'whats-new.html': `${siteOrigin}/`,
  'about.html': `${siteOrigin}/`,
  'contact.html': `${siteOrigin}/`,
  'offline.html': `${siteOrigin}/`,
  'swim-meet-resources.html': `${siteOrigin}/`
};
const indexablePages = new Set(['index.html', 'pools.html', 'teams.html', 'meets.html']);
const analyticsPageTitles = {
  'index.html': 'Home',
  'pools.html': 'Pools',
  'teams.html': 'Teams',
  'meets.html': 'Meets'
};
const singleEventPages = new Set();

function findEventStructuredDataNodes(value, eventNodes = []) {
  if (Array.isArray(value)) {
    value.forEach(item => findEventStructuredDataNodes(item, eventNodes));
    return eventNodes;
  }
  if (!value || typeof value !== 'object') return eventNodes;

  const schemaTypes = Array.isArray(value['@type']) ? value['@type'] : [value['@type']];
  if (schemaTypes.some(schemaType => typeof schemaType === 'string' && /Event$/.test(schemaType))) {
    eventNodes.push(value);
  }
  Object.values(value).forEach(item => findEventStructuredDataNodes(item, eventNodes));
  return eventNodes;
}

assert.ok(fs.existsSync(outDir), 'Build output is missing. Run pnpm run build before verifying the PWA artifact.');
requiredArtifacts.forEach(resource => {
  assert.ok(fs.existsSync(path.join(outDir, resource)), `Required published artifact is missing: ${resource}`);
});
Object.entries(rootIconAliases).forEach(([alias, sourceFile]) => {
  const sourceContent = fs.readFileSync(path.join(__dirname, '..', 'src', 'assets', 'favicons', sourceFile));
  const publishedContent = fs.readFileSync(path.join(outDir, alias));
  assert.deepEqual(publishedContent, sourceContent, `Published root icon alias is invalid: ${alias}`);
});
const siteVerificationFiles = ['BingSiteAuth.xml', 'b95676755a0a47f2965553d9f994f87f.txt', 'google3dd9d57115818ebb.html'];
siteVerificationFiles.forEach(file => {
  const sourceContent = fs.readFileSync(path.join(__dirname, '..', 'src', 'site-verification', file));
  const publishedContent = fs.readFileSync(path.join(outDir, file));
  assert.deepEqual(publishedContent, sourceContent, `Published site verification content is invalid: ${file}`);
});
assert.ok(!fs.existsSync(path.join(outDir, 'site.webmanifest')), 'The deprecated duplicate manifest must not be published.');
const publishedSeasonDirectories = fs.readdirSync(path.join(outDir, 'assets', 'data'), { withFileTypes: true })
  .filter(entry => entry.isDirectory())
  .map(entry => entry.name)
  .sort();
assert.deepEqual(
  publishedSeasonDirectories,
  [String(YEAR)],
  `The public artifact must include only active season ${YEAR} data; found: ${publishedSeasonDirectories.join(', ') || 'none'}.`
);
unpublishedAnnualEvidenceDirectories.forEach(directory => {
  assert.ok(!fs.existsSync(path.join(outDir, directory)), `Retained annual evidence must not be included in the public artifact: ${directory}`);
});
[
  'assets/swim-meet-resources/Judge - Rev C 060826.pdf',
  'assets/swim-meet-resources/Timer - Rev C 060826.pdf',
  'assets/swim-meet-resources/Timesheet Runner - Rev C 060826.pdf',
  'assets/swim-meet-resources/Line-up Aid - Rev C 060826.pdf'
].forEach(resource => {
  assert.ok(fs.existsSync(path.join(outDir, resource)), `Visitor-facing swim meet resource must remain published: ${resource}`);
});

function calculateDirectoryBytes(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).reduce((total, entry) => {
    const entryPath = path.join(directory, entry.name);
    return total + (entry.isDirectory() ? calculateDirectoryBytes(entryPath) : fs.statSync(entryPath).size);
  }, 0);
}

const artifactBytes = calculateDirectoryBytes(outDir);
const activeSeasonPools = JSON.parse(fs.readFileSync(path.join(outDir, 'assets', 'data', String(YEAR), 'pools', 'pools.json'), 'utf8'));
const weatherOperatingWindowsPath = path.join(outDir, 'js', 'config', 'weather-operating-windows.js');
const weatherOperatingWindowsContext = {};
vm.runInNewContext(fs.readFileSync(weatherOperatingWindowsPath, 'utf8'), weatherOperatingWindowsContext);
assert.ok(fs.statSync(weatherOperatingWindowsPath).size <= 10 * 1024, 'Generated weather operating windows must remain no larger than 10 KB.');
assert.deepEqual(
  JSON.parse(JSON.stringify(weatherOperatingWindowsContext.WEATHER_OPERATING_WINDOWS)),
  JSON.parse(JSON.stringify(WeatherAlertService.createOperatingWindowSchedule(activeSeasonPools))),
  'Generated weather operating windows must match the active annual pools source.'
);
const formatSeasonDate = dateString => new Date(`${dateString}T00:00:00Z`).toLocaleDateString('en-US', {
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC'
});

function createMemoryStorage() {
  const values = new Map();
  return {
    getItem: key => values.get(key) ?? null,
    removeItem: key => values.delete(key),
    setItem: (key, value) => values.set(key, String(value))
  };
}

function verifyAnalyticsArtifact(appConfigSource, interactionTypeSource, analyticsSource) {
  const appendedScripts = [];
  const lockRequests = [];
  let scriptLoadListener;
  const localStorage = createMemoryStorage();
  const sessionStorage = createMemoryStorage();
  const location = {
    hash: '',
    hostname: HOME_PAGE_HOSTNAME,
    href: `${HOME_PAGE_URL}/index.html`,
    pathname: '/index.html',
    protocol: 'https:',
    search: ''
  };
  const context = {
    Element: class ArtifactElement {},
    URL,
    console,
    history: { replaceState: () => undefined, state: null },
    localStorage,
    location,
    navigator: {
      locks: {
        request: (name, callback) => {
          lockRequests.push(name);
          return callback();
        }
      },
      userAgent: 'CNSL artifact verifier',
      webdriver: false
    },
    sessionStorage
  };
  context.window = context;
  context.document = {
    addEventListener: () => undefined,
    createElement: tagName => {
      assert.equal(tagName, 'script', 'Analytics must inject a script element for the Google tag library.');
      return {
        addEventListener: (eventName, listener) => {
          if (eventName === 'load') scriptLoadListener = listener;
        }
      };
    },
    getElementById: () => null,
    head: { appendChild: script => appendedScripts.push(script) },
    querySelector: selector => {
      if (selector === `meta[name="${context.ANALYTICS_DEPLOYMENT_META_NAME}"]`) {
        return { content: context.ANALYTICS_DEPLOYMENT_MODES.PRODUCTION };
      }
      if (selector === 'meta[name="analytics-page-title"]') return { content: 'Home' };
      return null;
    },
    title: 'Home'
  };

  vm.createContext(context);
  vm.runInContext(appConfigSource, context, { filename: 'js/config/app-config.js' });
  vm.runInContext(interactionTypeSource, context, { filename: 'js/types/analytics-interaction-type.js' });
  vm.runInContext(analyticsSource, context, { filename: 'js/analytics.js' });

  assert.equal(appendedScripts.length, 1, 'Eligible production analytics must inject one Google tag script.');
  const tagScriptUrl = new URL(appendedScripts[0].src);
  assert.equal(tagScriptUrl.origin, 'https://www.googletagmanager.com', 'Analytics must load the Google tag library from its reviewed origin.');
  assert.equal(tagScriptUrl.searchParams.get('id'), GA4_MEASUREMENT_ID, 'Analytics must request the configured GA4 web-stream measurement ID.');
  assert.equal(typeof scriptLoadListener, 'function', 'Analytics must wait for the Google tag script before publishing events.');

  const getCommands = () => context.dataLayer.map(command => Array.from(command));
  const consentCommand = getCommands().find(command => command[0] === 'consent' && command[1] === 'default');
  assert.ok(consentCommand, 'Analytics must establish default consent before loading the Google tag library.');
  assert.equal(consentCommand[2].analytics_storage, 'granted', 'Analytics must enable first-party storage for aggregate visit and session reporting.');
  ['ad_storage', 'ad_user_data', 'ad_personalization'].forEach(field => {
    assert.equal(consentCommand[2][field], 'denied', `Analytics consent must deny ${field}.`);
  });
  const pageDefaults = getCommands().find(command => command[0] === 'set' && command[1]?.page_location);
  assert.ok(pageDefaults, 'Analytics must establish privacy-reviewed page defaults.');
  assert.equal(pageDefaults[1].page_location, `${HOME_PAGE_URL}/index.html`, 'Analytics page location must use the reviewed production URL without query strings or fragments.');
  assert.equal(pageDefaults[1].page_referrer, '', 'Analytics must not send page referrers.');
  assert.equal(pageDefaults[1].allow_google_signals, false, 'Analytics must disable Google advertising signals.');
  assert.equal(pageDefaults[1].allow_ad_personalization_signals, false, 'Analytics must disable advertising personalization.');

  scriptLoadListener();
  const publishedCommands = getCommands();
  const configCommand = publishedCommands.find(command => command[0] === 'config');
  assert.ok(configCommand, 'Analytics must configure the reviewed GA4 web stream after the tag library loads.');
  assert.equal(configCommand[1], GA4_MEASUREMENT_ID, 'Analytics must configure the published GA4 web-stream measurement ID.');
  assert.equal(configCommand[2].send_page_view, false, 'Analytics must suppress automatic unsanitized page views.');
  assert.equal(configCommand[2].ignore_referrer, true, 'Analytics must ignore browser-provided referrers.');
  const pageViewCommand = publishedCommands.find(command => command[0] === 'event' && command[1] === 'page_view');
  assert.ok(pageViewCommand, 'Analytics must publish a sanitized standard page_view event.');
  assert.equal(pageViewCommand[2].page_location, `${HOME_PAGE_URL}/index.html`, 'Published page views must use the reviewed production URL.');
  assert.equal(pageViewCommand[2].page_referrer, '', 'Published page views must omit referrers.');
  assert.equal(pageViewCommand[2].page_title, 'Home', 'Published page views must use the reviewed concise title.');
  assert.deepEqual(lockRequests, [context.ANALYTICS_VERSION_REPORTED_STORAGE_KEY], 'Profile-scoped analytics publication must be serialized under its configured storage key.');
  assert.equal(localStorage.getItem(context.ANALYTICS_VERSION_REPORTED_STORAGE_KEY), APP_VERSION, 'Version publication must update the browser-profile marker.');
  assert.ok(
    publishedCommands.some(command => command[0] === 'event' && command[1] === 'ca_version' && command[2]?.app_version === APP_VERSION),
    'Analytics must publish the configured application version.'
  );
}

const manifest = JSON.parse(fs.readFileSync(path.join(outDir, 'manifest.webmanifest'), 'utf8'));
assert.equal(manifest.id, './', 'The install manifest must retain a stable application id.');
assert.match(manifest.description, new RegExp(String(YEAR)), 'The install manifest must describe the active season.');

const manifestContext = { self: {} };
vm.runInNewContext(fs.readFileSync(path.join(outDir, 'precache-manifest.js'), 'utf8'), manifestContext);
const precacheResources = manifestContext.self.PRECACHE_RESOURCES;
const precacheCoreResources = manifestContext.self.PRECACHE_CORE_RESOURCES;
const precacheOptionalResources = manifestContext.self.PRECACHE_OPTIONAL_RESOURCES;
const calculateResourceBytes = resources => resources
  .filter(resource => resource !== './')
  .reduce((total, resource) => total + fs.statSync(path.join(outDir, resource)).size, 0);
assert.ok(Array.isArray(precacheResources), 'The generated precache inventory must define an array.');
assert.ok(Array.isArray(precacheCoreResources), 'The generated precache inventory must define a core array.');
assert.ok(Array.isArray(precacheOptionalResources), 'The generated precache inventory must define an optional array.');
const deploymentVersion = fs.readFileSync(path.join(outDir, DEPLOYMENT_VERSION_FILE), 'utf8');
assert.match(deploymentVersion, /^\d{8}-\d{6}$/, 'Deployment version marker must contain one generated build identifier.');
assert.ok(!precacheResources.includes(DEPLOYMENT_VERSION_FILE), 'Deployment version marker must never be precached.');
assert.ok(precacheOptionalResources.length > 0, 'The generated precache inventory must stage optional resources.');
assert.deepEqual(
  [...precacheCoreResources, ...precacheOptionalResources].sort(),
  [...precacheResources].sort(),
  'Core and optional resources must partition the complete precache inventory.'
);
assert.equal(new Set(precacheResources).size, precacheResources.length, 'Precache resources must not be duplicated across cache tiers.');
[
  './',
  'index.html',
  'offline.html',
  'pools.html',
  'teams.html',
  'meets.html',
  'settings.html',
  'css/styles.css',
  'manifest.webmanifest',
  'js/config/weather-operating-windows.js',
  `assets/data/${YEAR}/pools/pools.json`,
  `assets/data/${YEAR}/teams/teams.json`,
  `assets/data/${YEAR}/meets/meets.json`
].forEach(resource => assert.ok(precacheCoreResources.includes(resource), `Install-critical inventory is missing: ${resource}`));
INSTALL_CRITICAL_PAGES.forEach(resource => {
  assert.ok(precacheCoreResources.includes(resource), `Install-critical page must remain in the core tier: ${resource}`);
  const pageHtml = fs.readFileSync(path.join(outDir, resource), 'utf8');
  [...pageHtml.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/gi)].forEach(([, scriptSource]) => {
    const scriptResource = new URL(scriptSource, 'https://cnsl.local/').pathname.replace(/^\//, '');
    if (scriptResource.startsWith('js/')) {
      assert.ok(precacheCoreResources.includes(scriptResource), `${resource} requires a script outside the core tier: ${scriptResource}`);
    }
  });
});
TEAM_AGENDA_DEPENDENCIES.forEach(resource => {
  assert.ok(precacheCoreResources.includes(resource), `Home agenda dependency must remain in the core tier: ${resource}`);
});
assert.ok(!precacheCoreResources.includes('assets/data/lessons.json'), 'The lesson provider directory must not increase the install-critical cache tier.');
CACHE_ON_USE_SCRIPT_RESOURCES.forEach(resource => {
  assert.ok(precacheOptionalResources.includes(resource), `Cache-on-use script must remain in the optional tier: ${resource}`);
});
assert.ok(precacheOptionalResources.includes('assets/images/logos/team-logos@2x.png'), 'Large visual assets must remain optional during installation.');
assert.ok(precacheOptionalResources.includes('faq.html'), 'Informational routes without an offline requirement must remain optional during installation.');
requiredArtifacts
  .filter(resource => !['CNAME', DEPLOYMENT_VERSION_FILE, 'robots.txt', 'sitemap.xml', 'precache-manifest.js', 'service-worker.js', ...siteVerificationFiles].includes(resource))
  .forEach(resource => assert.ok(precacheResources.includes(resource), `Precache inventory is missing: ${resource}`));
siteVerificationFiles.forEach(resource => {
  assert.ok(!precacheResources.includes(resource), `Site verification files must not be precached: ${resource}`);
});
assert.ok(!precacheResources.some(resource => resource.includes('/data/2025/')), 'Archived season data must not be precached.');
assert.ok(!precacheResources.some(resource => /^assets\/images\/logos\/(?!team-logos@2x\.png$)[^/]+\.png$/i.test(resource)), 'Individual team logos must not be precached once the sprite is published.');
precacheResources.filter(resource => resource !== './').forEach(resource => {
  assert.ok(fs.existsSync(path.join(outDir, resource)), `Precache inventory references an absent artifact: ${resource}`);
});

const worker = fs.readFileSync(path.join(outDir, 'service-worker.js'), 'utf8');
assert.doesNotMatch(worker, /const CACHE_VERSION = 'development'/, 'Built service worker must have a release cache version.');
assert.match(worker, /js\/config\/app-config\.js/, 'Service worker must load shared application configuration.');
assert.match(worker, /precache-manifest\.js/, 'Service worker must import the generated precache inventory.');
assert.match(worker, /self\.PRECACHE_CORE_RESOURCES/, 'Service worker installation must use the generated core inventory.');
assert.doesNotMatch(worker, /cacheOptionalResources/, 'Service worker installation must not wait for optional cache warming.');

const analytics = fs.readFileSync(path.join(outDir, 'js', 'analytics.js'), 'utf8');
const analyticsInteractionType = fs.readFileSync(path.join(outDir, 'js', 'types', 'analytics-interaction-type.js'), 'utf8');
const appConfig = fs.readFileSync(path.join(outDir, 'js', 'config', 'app-config.js'), 'utf8');
const pwa = fs.readFileSync(path.join(outDir, 'js', 'pwa.js'), 'utf8');
const appConfigBrowserContext = { URL };
vm.runInNewContext(appConfig, appConfigBrowserContext);
const expectedAnalyticsDeployment = process.env.CNSL_ANALYTICS_DEPLOYMENT
  === appConfigBrowserContext.ANALYTICS_DEPLOYMENT_MODES.PRODUCTION
  ? appConfigBrowserContext.ANALYTICS_DEPLOYMENT_MODES.PRODUCTION
  : appConfigBrowserContext.ANALYTICS_DEPLOYMENT_MODES.DISABLED;
const nonAnalyticsBrowserCode = fs.readdirSync(path.join(outDir, 'js'), { recursive: true })
  .filter(resource => resource.endsWith('.js') && resource !== 'analytics.js')
  .map(resource => fs.readFileSync(path.join(outDir, 'js', resource), 'utf8'))
  .join('\n');
assert.match(GA4_MEASUREMENT_ID, /^G-[A-Z0-9]+$/, 'Analytics configuration must use a GA4 web-stream measurement ID, not a numeric property ID.');
assert.equal(appConfigBrowserContext.APP_VERSION, APP_VERSION, 'Delivered application configuration must expose the published app version to browser measurement.');
assert.doesNotMatch(analytics, /cnsl_analytics_version_reported/, 'Analytics must use the session storage key from application configuration.');
assert.doesNotMatch(pwa, /cnsl_service_worker_update_checked_at/, 'The PWA consumer must use its session storage key from application configuration.');
assert.deepEqual(JSON.parse(JSON.stringify(appConfigBrowserContext.PUBLISHED_CAMPAIGNS)), [
  { medium: 'email', name: `${YEAR}_pool_season`, source: 'app' },
  { medium: 'facebook', name: `${YEAR}_pool_season`, source: 'app' },
  { medium: 'qr', name: `${YEAR}_pool_season`, source: 'app' },
  { medium: 'text', name: `${YEAR}_pool_season`, source: 'app' },
  { medium: 'x', name: `${YEAR}_pool_season`, source: 'app' },
  { medium: 'qr', name: `${YEAR}_pool_season`, source: 'flyer' }
], 'Delivered campaign attribution must contain only the reviewed app-share and flyer tuples.');
assert.doesNotMatch(analytics, /setting_value\s*:/, 'Settings measurement must not expose a general selected-value field.');
assert.doesNotMatch(analytics, /link_(?:url|host)\s*:/, 'External-link measurement must not send raw URL or host details.');
assert.doesNotMatch(analytics, /resource_(?:url|path|filename)\s*:/, 'Resource measurement must not send URLs, paths, or filenames.');
assert.doesNotMatch(analytics, /(?:pool|team|meet)_(?:id|name)\s*:/, 'Analytics must not send selected pool, team, or meet identities.');
assert.doesNotMatch(analytics, /(?:latitude|longitude|coordinates|user_agent|platform)\s*:/, 'Analytics must not send location or device-identifying values.');
assert.doesNotMatch(nonAnalyticsBrowserCode, /\b(?:window\.)?gtag\s*\(/, 'Delivered browser scripts must publish measurement only through the analytics module API.');
assert.doesNotMatch(analytics, /\b(?:user_id|user_properties|document\.referrer)\b/, 'Analytics must not add identifiers, user profiling values, or browser referrers.');
verifyAnalyticsArtifact(appConfig, analyticsInteractionType, analytics);

const generatedViewPages = fs.readdirSync(path.join(__dirname, '..', 'src', 'views'), { withFileTypes: true })
  .filter(entry => entry.isFile() && entry.name.endsWith('.html'))
  .map(entry => entry.name);
generatedViewPages.forEach(page => {
  const html = fs.readFileSync(path.join(outDir, page), 'utf8');
  const primaryHeadings = html.match(/<h1(?:\s|>)/g) || [];
  const structuredDataBlocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  assert.equal(primaryHeadings.length, 1, `${page} must publish exactly one h1 element in its HTML source.`);

  structuredDataBlocks.forEach(([, structuredData]) => {
    const eventNodes = findEventStructuredDataNodes(JSON.parse(structuredData));
    if (!singleEventPages.has(page)) {
      assert.equal(eventNodes.length, 0, `${page} must not publish Event structured data because it is not a single-event leaf page.`);
      return;
    }
    eventNodes.forEach(eventNode => {
      assert.ok(eventNode.name, `${page} Event structured data must include name.`);
      assert.ok(eventNode.startDate, `${page} Event structured data must include startDate.`);
      assert.ok(eventNode.location, `${page} Event structured data must include location.`);
      assert.ok(eventNode.url, `${page} Event structured data must include its unique leaf-page URL.`);
    });
  });
});

Object.entries(canonicalPages).forEach(([page, canonical]) => {
  const html = fs.readFileSync(path.join(outDir, page), 'utf8');
  const canonicalLinks = html.match(/<link rel="canonical" href="[^"]+">/g) || [];
  const pageTitle = html.match(/<title>([^<]+)<\/title>/)?.[1];
  const pageDescription = html.match(/<meta name="description" content="([^"]+)">/)?.[1];
  const structuredDataBlocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  assert.deepEqual(canonicalLinks, [`<link rel="canonical" href="${canonical}">`], `${page} must publish its one canonical URL.`);
  if (analyticsPageTitles[page]) {
    assert.ok(
      html.includes(`<meta name="analytics-page-title" content="${analyticsPageTitles[page]}">`),
      `${page} must publish its reviewed concise analytics page title.`
    );
  }
  assert.equal((html.match(/<title>/g) || []).length, 1, `${page} must publish one title.`);
  assert.ok(pageTitle && pageTitle.length <= 55, `${page} must publish a concise title of at most 55 characters.`);
  assert.ok(pageDescription, `${page} must publish a meta description.`);
  assert.ok(structuredDataBlocks.length > 0, `${page} must publish structured website data.`);
  structuredDataBlocks.forEach(([, structuredData]) => {
    assert.doesNotThrow(() => JSON.parse(structuredData), `${page} must publish valid JSON-LD.`);
  });
  assert.ok(html.includes(`<meta property="og:image" content="${socialPreviewImage}">`), `${page} must publish its absolute Open Graph image URL.`);
  assert.match(html, /<meta property="og:image:type" content="image\/jpeg">/, `${page} must identify the social preview image type.`);
  assert.match(html, /<meta property="og:image:width" content="230">/, `${page} must identify the social preview image width.`);
  assert.match(html, /<meta property="og:image:height" content="180">/, `${page} must identify the social preview image height.`);
  assert.match(html, /<meta name="twitter:card" content="summary">/, `${page} must use the preview card supported by its logo image.`);
  assert.ok(html.includes(`<meta name="twitter:image" content="${socialPreviewImage}">`), `${page} must publish its absolute Twitter image URL.`);
  if (indexablePages.has(page)) {
    assert.match(html, /<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1">/, `${page} must allow enhanced search previews.`);
    assert.match(html, /<meta property="og:type" content="website">/, `${page} must declare its Open Graph page type.`);
    assert.ok(html.includes(`<meta property="og:title" content="${pageTitle}">`), `${page} must align its Open Graph title with its page title.`);
    assert.ok(html.includes(`<meta name="twitter:title" content="${pageTitle}">`), `${page} must align its Twitter title with its page title.`);
    assert.ok(html.includes(`<meta property="og:description" content="${pageDescription}">`), `${page} must align its Open Graph description with its search description.`);
    assert.ok(html.includes(`<meta name="twitter:description" content="${pageDescription}">`), `${page} must align its Twitter description with its search description.`);
    assert.ok(html.includes(`<meta property="og:url" content="${canonical}">`), `${page} must publish its canonical URL for social sharing.`);
  } else {
    assert.match(html, /<meta name="robots" content="noindex, follow">/, `${page} must stay out of search results while allowing link discovery.`);
  }
  assert.match(html, /http-equiv="Content-Security-Policy"/, `${page} must publish the shared browser security policy.`);
  assert.ok(
    html.includes(`<meta name="${appConfigBrowserContext.ANALYTICS_DEPLOYMENT_META_NAME}" content="${expectedAnalyticsDeployment}">`),
    `${page} must publish the fail-closed analytics deployment mode for this build.`
  );
  assert.match(html, /script-src[^;"]*'unsafe-inline'/, `${page} must permit Cloudflare-injected inline scripts that cannot use a nonce or stable hash.`);
  assert.doesNotMatch(html, /script-src[^;"]*'(?:sha(?:256|384|512)-|nonce-)/, `${page} must not include a nonce or hash source that causes browsers to ignore unsafe-inline.`);
  assert.match(html, /connect-src[^;"]*https:\/\/\*\.google-analytics\.com/, `${page} must permit Google Analytics collection requests.`);
  assert.match(html, /connect-src[^;"]*https:\/\/\*\.analytics\.google\.com/, `${page} must permit Google Analytics regional collection requests.`);
  assert.match(html, /connect-src[^;"]*https:\/\/\*\.googletagmanager\.com/, `${page} must permit Google tag connection requests.`);
  assert.match(html, /img-src[^;"]*https:\/\/www\.googletagmanager\.com/, `${page} must permit Google tag image transport.`);
  assert.match(html, /script-src[^;"]*https:\/\/static\.cloudflareinsights\.com/, `${page} must permit the Cloudflare Insights beacon script.`);
  assert.match(html, /connect-src[^;"]*https:\/\/cloudflareinsights\.com/, `${page} must permit Cloudflare Insights beacon reporting.`);
  assert.ok(
    html.indexOf('js/config/app-config.js?v=') < html.indexOf('js/analytics.js?v='),
    `${page} must load application URL configuration before analytics handling.`
  );
  assert.match(html, /js\/analytics\.js\?v=/, `${page} must load deployed-site analytics handling.`);
  assert.match(html, /id="connectivityStatus"/, `${page} must include shared offline connection status.`);
  assert.match(html, /js\/connectivity-status\.js\?v=/, `${page} must load shared offline connection-status handling.`);
  assert.match(html, /js\/weather-alert-cached\.js\?v=/, `${page} must load cached weather rendering from a same-origin script.`);
  assert.ok(
    html.indexOf('js/config/weather-operating-windows.js?v=') < html.indexOf('js/services/weather-alert-service.js?v='),
    `${page} must load compact weather operating windows before weather evaluation.`
  );
  assert.doesNotMatch(html, /analytics-consent\.js|onclick=/, `${page} must not publish the obsolete consent loader or inline click handlers.`);
});

const settingsHtml = fs.readFileSync(path.join(outDir, 'settings.html'), 'utf8');
assert.doesNotMatch(settingsHtml, /name="analyticsEnabled"/, 'Settings must not expose a removed analytics-consent choice.');

const homeHtml = fs.readFileSync(path.join(outDir, 'index.html'), 'utf8');
assert.ok(homeHtml.includes(`<title>${YEAR} CA Outdoor Pools &amp; CNSL Swim Teams</title>`), 'Home search title must emphasize the active season, CA outdoor pools, and CNSL swim teams.');
assert.match(homeHtml, /<meta name="description" content="[^"]*Columbia Association outdoor pool[^"]*CNSL swim teams[^"]*">/, 'Home search description must explain its CA outdoor pool and CNSL swim team coverage.');
assert.match(homeHtml, /<h1 class="welcome-title">CA Outdoor Pools &amp; CNSL Swim Teams<\/h1>/, 'Home heading must clearly identify its primary pool and swim team topics.');
assert.ok(homeHtml.includes(`href="${activeSeasonPools.caPoolGuideUrl}"`), 'Home page must render its official pool-schedule destination from active annual metadata.');
assert.ok(homeHtml.includes(`datetime="${activeSeasonPools.seasonStartDate}">${formatSeasonDate(activeSeasonPools.seasonStartDate)}</time>`), 'Home page must render the active annual season start date.');
assert.ok(homeHtml.includes(`datetime="${activeSeasonPools.seasonEndDate}">${formatSeasonDate(activeSeasonPools.seasonEndDate)}</time>`), 'Home page must render the active annual season end date.');
assert.ok(homeHtml.includes(`href="${activeSeasonPools.caPoolDirectoryUrl}"`), 'Shared weather alert must render its official pool-directory destination from active annual metadata.');

const faqHtml = fs.readFileSync(path.join(outDir, 'faq.html'), 'utf8');
assert.ok(faqHtml.includes(`href="${activeSeasonPools.caPoolGuideUrl}"`), 'FAQ must render its official pool-source destination from active annual metadata.');
assert.match(faqHtml, /Google Analytics uses its own first-party identifier to provide combined reports/, 'FAQ must disclose the first-party Google Analytics storage used for aggregate reporting.');
assert.match(faqHtml, /does not send Google Analytics your name, contact details, account information/, 'FAQ must disclose that app-defined measurement does not send direct visitor identity fields.');

const offlineHtml = fs.readFileSync(path.join(outDir, 'offline.html'), 'utf8');
assert.match(offlineHtml, /<meta name="robots" content="noindex, follow">/, 'Offline fallback must not be indexed.');
assert.match(offlineHtml, /id="connectivityStatus"/, 'Offline fallback must include shared offline connection status.');
assert.match(offlineHtml, /js\/connectivity-status\.js\?v=/, 'Offline fallback must load shared offline connection-status handling.');

const sitemap = fs.readFileSync(path.join(outDir, 'sitemap.xml'), 'utf8');
assert.equal((sitemap.match(/<\?xml/g) || []).length, 1, 'Sitemap must contain one XML document.');
assert.equal((sitemap.match(/<urlset/g) || []).length, 1, 'Sitemap must contain one URL set.');
const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(([, url]) => url);
const indexableCanonicalUrls = [...indexablePages].map(page => canonicalPages[page]);
assert.deepEqual(sitemapUrls, indexableCanonicalUrls, 'Sitemap must publish exactly the canonical URLs of indexable pages.');

const robots = fs.readFileSync(path.join(outDir, 'robots.txt'), 'utf8');
assert.doesNotMatch(robots, /Disallow: \/offline\.html/, 'Crawler rules must allow discovery of the offline noindex directive.');
assert.match(robots, new RegExp(`Sitemap: ${siteOrigin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/sitemap\\.xml`), 'Crawler rules must reference the published sitemap.');

const customDomain = fs.readFileSync(path.join(outDir, 'CNAME'), 'utf8').trim();
assert.equal(customDomain, HOME_PAGE_HOSTNAME, 'Published GitHub Pages output must retain the configured custom domain.');

console.log(`Verified PWA artifact for the ${YEAR} season: ${artifactBytes} delivered bytes.`);
console.log(`PWA cache inventory: ${precacheResources.length} resources / ${calculateResourceBytes(precacheResources)} bytes.`);
console.log(`PWA install-critical core: ${precacheCoreResources.length} resources / ${calculateResourceBytes(precacheCoreResources)} bytes.`);
console.log(`PWA cache-on-use optional tier: ${precacheOptionalResources.length} resources / ${calculateResourceBytes(precacheOptionalResources)} bytes.`);
