const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('node:vm');
const { GA4_MEASUREMENT_ID, HOME_PAGE_HOSTNAME, HOME_PAGE_URL, YEAR } = require('../src/js/config/app-config.js');

const outDir = path.join(__dirname, '..', 'out');
const siteOrigin = HOME_PAGE_URL;
const requiredArtifacts = [
  'CNAME',
  'index.html',
  'offline.html',
  'pools.html',
  'teams.html',
  'meets.html',
  'robots.txt',
  'sitemap.xml',
  'manifest.webmanifest',
  'precache-manifest.js',
  'service-worker.js',
  `assets/data/${YEAR}/pools/pools.json`,
  `assets/data/${YEAR}/teams/teams.json`,
  `assets/data/${YEAR}/meets/meets.json`
];
const canonicalPages = {
  'index.html': `${siteOrigin}/`,
  'pools.html': `${siteOrigin}/pools.html`,
  'teams.html': `${siteOrigin}/teams.html`,
  'meets.html': `${siteOrigin}/meets.html`,
  'faq.html': `${siteOrigin}/faq.html`,
  'settings.html': `${siteOrigin}/settings.html`,
  'whats-new.html': `${siteOrigin}/whats-new.html`,
  'about.html': `${siteOrigin}/about.html`,
  'swim-meet-resources.html': `${siteOrigin}/swim-meet-resources.html`
};

assert.ok(fs.existsSync(outDir), 'Build output is missing. Run pnpm run build before verifying the PWA artifact.');
requiredArtifacts.forEach(resource => {
  assert.ok(fs.existsSync(path.join(outDir, resource)), `Required published artifact is missing: ${resource}`);
});
assert.ok(!fs.existsSync(path.join(outDir, 'site.webmanifest')), 'The deprecated duplicate manifest must not be published.');

const manifest = JSON.parse(fs.readFileSync(path.join(outDir, 'manifest.webmanifest'), 'utf8'));
assert.equal(manifest.id, './', 'The install manifest must retain a stable application id.');
assert.match(manifest.description, new RegExp(String(YEAR)), 'The install manifest must describe the active season.');

const manifestContext = { self: {} };
vm.runInNewContext(fs.readFileSync(path.join(outDir, 'precache-manifest.js'), 'utf8'), manifestContext);
const precacheResources = manifestContext.self.PRECACHE_RESOURCES;
assert.ok(Array.isArray(precacheResources), 'The generated precache inventory must define an array.');
requiredArtifacts
  .filter(resource => !['CNAME', 'robots.txt', 'sitemap.xml', 'precache-manifest.js', 'service-worker.js'].includes(resource))
  .forEach(resource => assert.ok(precacheResources.includes(resource), `Precache inventory is missing: ${resource}`));
assert.ok(!precacheResources.some(resource => resource.includes('/data/2025/')), 'Archived season data must not be precached.');
precacheResources.filter(resource => resource !== './').forEach(resource => {
  assert.ok(fs.existsSync(path.join(outDir, resource)), `Precache inventory references an absent artifact: ${resource}`);
});

const worker = fs.readFileSync(path.join(outDir, 'service-worker.js'), 'utf8');
assert.doesNotMatch(worker, /const CACHE_VERSION = 'development'/, 'Built service worker must have a release cache version.');
assert.match(worker, /js\/config\/app-config\.js/, 'Service worker must load shared application configuration.');
assert.match(worker, /precache-manifest\.js/, 'Service worker must import the generated precache inventory.');

const analytics = fs.readFileSync(path.join(outDir, 'js', 'analytics.js'), 'utf8');
const appConfig = fs.readFileSync(path.join(outDir, 'js', 'config', 'app-config.js'), 'utf8');
const settings = fs.readFileSync(path.join(outDir, 'js', 'settings.js'), 'utf8');
const appEventNames = [...`${analytics}\n${settings}`.matchAll(/window\.gtag\('event', '([^']+)'/g)]
  .map(match => match[1]);
const customAppEventNames = appEventNames.filter(eventName => eventName !== 'page_view');
assert.match(GA4_MEASUREMENT_ID, /^G-[A-Z0-9]+$/, 'Analytics configuration must use a GA4 web-stream measurement ID, not a numeric property ID.');
assert.match(appConfig, new RegExp(GA4_MEASUREMENT_ID), 'Delivered application configuration must include the configured GA4 measurement ID.');
assert.match(analytics, /window\.GA4_MEASUREMENT_ID/, 'Analytics must publish through the configured GA4 web-stream measurement ID.');
assert.match(analytics, /analytics_storage:\s*'denied'/, 'Analytics must deny identifying analytics storage.');
assert.match(analytics, /ad_storage:\s*'denied'/, 'Analytics must deny advertising storage.');
assert.match(analytics, /allow_google_signals:\s*false/, 'Analytics must disable Google advertising signals.');
assert.match(analytics, /allow_ad_personalization_signals:\s*false/, 'Analytics must disable advertising personalization.');
assert.match(analytics, /send_page_view:\s*false/, 'Analytics must suppress automatic unsanitized page views.');
assert.match(analytics, /window\.location\.hostname\s*===\s*window\.HOME_PAGE_HOSTNAME/, 'Analytics must initialize only on the configured production hostname.');
assert.match(analytics, /window\.location\.protocol\s*===\s*'https:'/, 'Analytics must initialize only over HTTPS.');
assert.match(analytics, /page_location:\s*`\$\{window\.HOME_PAGE_URL\}\$\{window\.location\.pathname\}`/, 'Analytics page locations must use the configured production origin without query strings or fragments.');
assert.match(analytics, /page_referrer:\s*''/, 'Analytics must not send page referrers.');
assert.match(analytics, /window\.gtag\('event', 'page_view'/, 'Sanitized page measurement must use the GA4 page_view event recognized by standard reports.');
assert.doesNotMatch(analytics, /window\.gtag\('event', 'ca_page_view'/, 'Page measurement must not be renamed to a custom event that standard GA4 page reporting ignores.');
assert.match(analytics, /window\.gtag\('event', 'ca_share'/, 'Share measurement must use the app-specific analytics event prefix.');
assert.match(settings, /window\.gtag\('event', 'ca_select_favorite'/, 'Favorite measurement must use the app-specific analytics event prefix.');
assert.ok(appEventNames.length > 0, 'The delivered application must declare its expected analytics events.');
customAppEventNames.forEach(eventName => assert.match(eventName, /^ca_/, `Custom application analytics event must use the ca_ prefix: ${eventName}`));
assert.doesNotMatch(analytics, /user_id|user_properties|document\.referrer|location\.search|location\.hash/, 'Analytics must not add identifiers, user profiling values, or unsanitized navigation data.');

Object.entries(canonicalPages).forEach(([page, canonical]) => {
  const html = fs.readFileSync(path.join(outDir, page), 'utf8');
  const canonicalLinks = html.match(/<link rel="canonical" href="[^"]+">/g) || [];
  assert.deepEqual(canonicalLinks, [`<link rel="canonical" href="${canonical}">`], `${page} must publish its one canonical URL.`);
  assert.equal((html.match(/<title>/g) || []).length, 1, `${page} must publish one title.`);
  assert.match(html, /http-equiv="Content-Security-Policy"/, `${page} must publish the shared browser security policy.`);
  assert.ok(
    html.indexOf('js/config/app-config.js?v=') < html.indexOf('js/analytics.js?v='),
    `${page} must load application URL configuration before analytics handling.`
  );
  assert.match(html, /js\/analytics\.js\?v=/, `${page} must load deployed-site analytics handling.`);
  assert.doesNotMatch(html, /analytics-consent\.js|onclick=/, `${page} must not publish the obsolete consent loader or inline click handlers.`);
});

const settingsHtml = fs.readFileSync(path.join(outDir, 'settings.html'), 'utf8');
assert.doesNotMatch(settingsHtml, /name="analyticsEnabled"/, 'Settings must not expose a removed analytics-consent choice.');

const offlineHtml = fs.readFileSync(path.join(outDir, 'offline.html'), 'utf8');
assert.match(offlineHtml, /<meta name="robots" content="noindex">/, 'Offline fallback must not be indexed.');

const sitemap = fs.readFileSync(path.join(outDir, 'sitemap.xml'), 'utf8');
assert.equal((sitemap.match(/<\?xml/g) || []).length, 1, 'Sitemap must contain one XML document.');
assert.equal((sitemap.match(/<urlset/g) || []).length, 1, 'Sitemap must contain one URL set.');
assert.doesNotMatch(sitemap, /offline\.html|settings\.html/, 'Noindex pages must not appear in the sitemap.');
Object.entries(canonicalPages)
  .filter(([page]) => page !== 'settings.html')
  .forEach(([, canonical]) => assert.match(sitemap, new RegExp(canonical.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `Sitemap is missing ${canonical}.`));

const robots = fs.readFileSync(path.join(outDir, 'robots.txt'), 'utf8');
assert.doesNotMatch(robots, /Disallow: \/offline\.html/, 'Crawler rules must allow discovery of the offline noindex directive.');
assert.match(robots, new RegExp(`Sitemap: ${siteOrigin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/sitemap\\.xml`), 'Crawler rules must reference the published sitemap.');

const customDomain = fs.readFileSync(path.join(outDir, 'CNAME'), 'utf8').trim();
assert.equal(customDomain, HOME_PAGE_HOSTNAME, 'Published GitHub Pages output must retain the configured custom domain.');

console.log(`Verified PWA artifact: ${precacheResources.length} cached resources for the ${YEAR} season.`);
