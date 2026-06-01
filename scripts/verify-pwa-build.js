const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('node:vm');
const { APP_VERSION, GA4_MEASUREMENT_ID, HOME_PAGE_HOSTNAME, HOME_PAGE_URL, YEAR } = require('../src/js/config/app-config.js');

const outDir = path.join(__dirname, '..', 'out');
const siteOrigin = HOME_PAGE_URL;
const socialPreviewImage = `${siteOrigin}/assets/images/cnsl-logo.jpg`;
const unpublishedAnnualEvidenceDirectories = [
  `assets/data/${YEAR}/pools/pool-schedules`,
  `assets/data/${YEAR}/meets/meet-schedules`,
  `assets/data/${YEAR}/teams/team-schedules`
];
const requiredArtifacts = [
  'BingSiteAuth.xml',
  'CNAME',
  'google3dd9d57115818ebb.html',
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
  'faq.html': `${siteOrigin}/faq.html`,
  'settings.html': `${siteOrigin}/settings.html`,
  'whats-new.html': `${siteOrigin}/whats-new.html`,
  'about.html': `${siteOrigin}/about.html`,
  'swim-meet-resources.html': `${siteOrigin}/swim-meet-resources.html`
};
const indexablePages = new Set([
  'index.html',
  'pools.html',
  'teams.html',
  'meets.html',
  'faq.html',
  'whats-new.html',
  'about.html',
  'swim-meet-resources.html'
]);

assert.ok(fs.existsSync(outDir), 'Build output is missing. Run pnpm run build before verifying the PWA artifact.');
requiredArtifacts.forEach(resource => {
  assert.ok(fs.existsSync(path.join(outDir, resource)), `Required published artifact is missing: ${resource}`);
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
  'assets/swim-meet-resources/Judge - Rev B 062025.pdf',
  'assets/swim-meet-resources/Timer - Rev B 062025.pdf',
  'assets/swim-meet-resources/Timesheet Runner - Rev B 062025.pdf'
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
const formatSeasonDate = dateString => new Date(`${dateString}T00:00:00Z`).toLocaleDateString('en-US', {
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC'
});

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
assert.ok(!precacheResources.some(resource => /^assets\/images\/logos\/(?!team-logos@2x\.png$)[^/]+\.png$/i.test(resource)), 'Individual team logos must not be precached once the sprite is published.');
precacheResources.filter(resource => resource !== './').forEach(resource => {
  assert.ok(fs.existsSync(path.join(outDir, resource)), `Precache inventory references an absent artifact: ${resource}`);
});

const worker = fs.readFileSync(path.join(outDir, 'service-worker.js'), 'utf8');
assert.doesNotMatch(worker, /const CACHE_VERSION = 'development'/, 'Built service worker must have a release cache version.');
assert.match(worker, /js\/config\/app-config\.js/, 'Service worker must load shared application configuration.');
assert.match(worker, /precache-manifest\.js/, 'Service worker must import the generated precache inventory.');

const analytics = fs.readFileSync(path.join(outDir, 'js', 'analytics.js'), 'utf8');
const appConfig = fs.readFileSync(path.join(outDir, 'js', 'config', 'app-config.js'), 'utf8');
const appConfigBrowserContext = {};
vm.runInNewContext(appConfig, appConfigBrowserContext);
const nonAnalyticsBrowserCode = fs.readdirSync(path.join(outDir, 'js'), { recursive: true })
  .filter(resource => resource.endsWith('.js') && resource !== 'analytics.js')
  .map(resource => fs.readFileSync(path.join(outDir, 'js', resource), 'utf8'))
  .join('\n');
const appEventNames = [...analytics.matchAll(/window\.gtag\('event', '([^']+)'/g)]
  .map(match => match[1]);
const customAppEventNames = appEventNames.filter(eventName => eventName !== 'page_view');
assert.match(GA4_MEASUREMENT_ID, /^G-[A-Z0-9]+$/, 'Analytics configuration must use a GA4 web-stream measurement ID, not a numeric property ID.');
assert.match(appConfig, new RegExp(GA4_MEASUREMENT_ID), 'Delivered application configuration must include the configured GA4 measurement ID.');
assert.equal(appConfigBrowserContext.APP_VERSION, APP_VERSION, 'Delivered application configuration must expose the published app version to browser measurement.');
assert.match(analytics, /window\.GA4_MEASUREMENT_ID/, 'Analytics must publish through the configured GA4 web-stream measurement ID.');
assert.match(analytics, /analytics_storage:\s*'denied'/, 'Analytics must deny identifier-backed storage for aggregate reporting.');
assert.doesNotMatch(analytics, /analytics_storage:\s*'granted'/, 'Analytics must not enable identifier-backed usage and session reporting.');
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
assert.match(analytics, /publishEvent\('ca_share'/, 'Share measurement must be owned by the analytics module.');
assert.match(analytics, /window\.gtag\('event', 'ca_version'/, 'Version measurement must use the app-specific analytics event prefix.');
assert.match(analytics, /publishEvent\('ca_external_link'/, 'External-link measurement must be owned by the analytics module.');
assert.match(analytics, /link_purpose:\s*getExternalLinkPurpose\(clickedLink\)/, 'External-link measurement must publish only its bounded link purpose category.');
assert.match(analytics, /publishEvent\('ca_setting_change'/, 'Settings measurement must be owned by the analytics module.');
assert.match(analytics, /publishEvent\('ca_banner_interaction'/, 'Banner measurement must be owned by the analytics module.');
assert.match(analytics, /window\.gtag\('event', 'ca_flyer_visit'\)/, 'Flyer visit measurement must use a fixed app-specific analytics event.');
assert.match(analytics, /source:\s*'flyer'/, 'Flyer attribution must use the reviewed fixed campaign source.');
assert.match(analytics, /medium:\s*'qr'/, 'Flyer attribution must use the reviewed fixed campaign medium.');
assert.match(analytics, /name:\s*'2026_pool_season'/, 'Flyer attribution must use the reviewed fixed campaign name.');
assert.match(analytics, /campaign_source:\s*flyerCampaign\.source/, 'Reviewed flyer attribution must be mapped to standard GA campaign source measurement.');
assert.match(analytics, /campaign_medium:\s*flyerCampaign\.medium/, 'Reviewed flyer attribution must be mapped to standard GA campaign medium measurement.');
assert.match(analytics, /campaign_name:\s*flyerCampaign\.name/, 'Reviewed flyer attribution must be mapped to standard GA campaign name measurement.');
assert.match(analytics, /landingUrl\.searchParams\.delete\('utm_source'\)/, 'Recognized flyer URLs must remove their campaign marker before page measurement.');
assert.match(analytics, /isProductionSite\(\) \? consumeFlyerCampaign\(\) : null/, 'Flyer campaign cleanup must occur only on the deployed application landing page.');
assert.match(analytics, /window\.history\.replaceState\(/, 'Recognized flyer URLs must be cleaned without a navigation or referrer-producing redirect.');
assert.doesNotMatch(analytics, /setting_value\s*:/, 'Settings measurement must not send selected preference values.');
assert.doesNotMatch(analytics, /link_(?:url|host|destination)\s*:/, 'External-link measurement must not send destination details.');
assert.match(analytics, /app_version:\s*window\.APP_VERSION/, 'Version measurement must send only the configured published app version.');
assert.match(appConfig, new RegExp(APP_VERSION.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), 'Delivered application configuration must include the published app version.');
assert.doesNotMatch(nonAnalyticsBrowserCode, /\b(?:window\.)?gtag\s*\(/, 'Delivered browser scripts must publish measurement only through the analytics module API.');
assert.ok(appEventNames.length > 0, 'The delivered application must declare its expected analytics events.');
customAppEventNames.forEach(eventName => assert.match(eventName, /^ca_/, `Custom application analytics event must use the ca_ prefix: ${eventName}`));
assert.doesNotMatch(analytics, /user_id|user_properties|document\.referrer|location\.search|location\.hash/, 'Analytics must not add identifiers, user profiling values, or unsanitized navigation data.');

Object.entries(canonicalPages).forEach(([page, canonical]) => {
  const html = fs.readFileSync(path.join(outDir, page), 'utf8');
  const canonicalLinks = html.match(/<link rel="canonical" href="[^"]+">/g) || [];
  const pageTitle = html.match(/<title>([^<]+)<\/title>/)?.[1];
  const pageDescription = html.match(/<meta name="description" content="([^"]+)">/)?.[1];
  assert.deepEqual(canonicalLinks, [`<link rel="canonical" href="${canonical}">`], `${page} must publish its one canonical URL.`);
  assert.equal((html.match(/<title>/g) || []).length, 1, `${page} must publish one title.`);
  assert.ok(pageTitle && pageTitle.length <= 55, `${page} must publish a concise title of at most 55 characters.`);
  assert.ok(pageDescription, `${page} must publish a meta description.`);
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
  }
  assert.match(html, /http-equiv="Content-Security-Policy"/, `${page} must publish the shared browser security policy.`);
  assert.doesNotMatch(html, /script-src[^;"]*'unsafe-inline'/, `${page} must not permit arbitrary inline executable scripts.`);
  assert.match(html, /script-src[^;"]*'sha256-[A-Za-z0-9+/]+=*'/, `${page} must authorize its inline structured data with a CSP hash.`);
  assert.match(html, /connect-src[^;"]*https:\/\/www\.google-analytics\.com/, `${page} must permit Google Analytics collection requests.`);
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
  assert.doesNotMatch(html, /analytics-consent\.js|onclick=/, `${page} must not publish the obsolete consent loader or inline click handlers.`);
});

const settingsHtml = fs.readFileSync(path.join(outDir, 'settings.html'), 'utf8');
assert.doesNotMatch(settingsHtml, /name="analyticsEnabled"/, 'Settings must not expose a removed analytics-consent choice.');

const homeHtml = fs.readFileSync(path.join(outDir, 'index.html'), 'utf8');
assert.ok(homeHtml.includes(`href="${activeSeasonPools.caPoolGuideUrl}"`), 'Home page must render its official pool-schedule destination from active annual metadata.');
assert.ok(homeHtml.includes(`datetime="${activeSeasonPools.seasonStartDate}">${formatSeasonDate(activeSeasonPools.seasonStartDate)}</time>`), 'Home page must render the active annual season start date.');
assert.ok(homeHtml.includes(`datetime="${activeSeasonPools.seasonEndDate}">${formatSeasonDate(activeSeasonPools.seasonEndDate)}</time>`), 'Home page must render the active annual season end date.');
assert.ok(homeHtml.includes(`href="${activeSeasonPools.caPoolDirectoryUrl}"`), 'Shared weather alert must render its official pool-directory destination from active annual metadata.');

const faqHtml = fs.readFileSync(path.join(outDir, 'faq.html'), 'utf8');
assert.ok(faqHtml.includes(`href="${activeSeasonPools.caPoolGuideUrl}"`), 'FAQ must render its official pool-source destination from active annual metadata.');

const offlineHtml = fs.readFileSync(path.join(outDir, 'offline.html'), 'utf8');
assert.match(offlineHtml, /<meta name="robots" content="noindex">/, 'Offline fallback must not be indexed.');
assert.match(offlineHtml, /id="connectivityStatus"/, 'Offline fallback must include shared offline connection status.');
assert.match(offlineHtml, /js\/connectivity-status\.js\?v=/, 'Offline fallback must load shared offline connection-status handling.');

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

console.log(`Verified PWA artifact: ${precacheResources.length} cached resources and ${artifactBytes} bytes for the ${YEAR} season.`);
