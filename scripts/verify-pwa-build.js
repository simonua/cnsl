const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('node:vm');
const { APP_VERSION, DEPLOYMENT_VERSION_FILE, GA4_MEASUREMENT_ID, HOME_PAGE_HOSTNAME, HOME_PAGE_URL, YEAR } = require('./adapters/app-config.js');
const WeatherAlertService = require('./adapters/weather-alert-service.js');

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
  DEPLOYMENT_VERSION_FILE,
  'favicon.ico',
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
  'pools.html': `${siteOrigin}/`,
  'teams.html': `${siteOrigin}/`,
  'meets.html': `${siteOrigin}/`,
  'lessons.html': `${siteOrigin}/`,
  'faq.html': `${siteOrigin}/`,
  'settings.html': `${siteOrigin}/`,
  'whats-new.html': `${siteOrigin}/`,
  'about.html': `${siteOrigin}/`,
  'contact.html': `${siteOrigin}/`,
  'offline.html': `${siteOrigin}/`,
  'swim-meet-resources.html': `${siteOrigin}/`
};
const indexablePages = new Set(['index.html']);

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
assert.ok(!precacheCoreResources.includes('assets/data/lessons.json'), 'The lesson provider directory must not increase the install-critical cache tier.');
assert.ok(precacheOptionalResources.includes('assets/images/logos/team-logos@2x.png'), 'Large visual assets must remain optional during installation.');
assert.ok(precacheOptionalResources.includes('faq.html'), 'Informational routes without an offline requirement must remain optional during installation.');
requiredArtifacts
  .filter(resource => !['CNAME', DEPLOYMENT_VERSION_FILE, 'robots.txt', 'sitemap.xml', 'precache-manifest.js', 'service-worker.js'].includes(resource))
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
assert.match(worker, /self\.PRECACHE_CORE_RESOURCES/, 'Service worker installation must use the generated core inventory.');
assert.doesNotMatch(worker, /cacheOptionalResources/, 'Service worker installation must not wait for optional cache warming.');

const analytics = fs.readFileSync(path.join(outDir, 'js', 'analytics.js'), 'utf8');
const analyticsInteractionType = fs.readFileSync(path.join(outDir, 'js', 'types', 'analytics-interaction-type.js'), 'utf8');
const appConfig = fs.readFileSync(path.join(outDir, 'js', 'config', 'app-config.js'), 'utf8');
const pwa = fs.readFileSync(path.join(outDir, 'js', 'pwa.js'), 'utf8');
const appConfigBrowserContext = { URL };
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
assert.match(analytics, /analytics_storage:\s*'granted'/, 'Analytics must enable first-party storage for aggregate visit and session reporting.');
assert.doesNotMatch(analytics, /analytics_storage:\s*'denied'/, 'Analytics must not disable the first-party storage required for reportable visit and session measurement.');
assert.match(analytics, /ad_storage:\s*'denied'/, 'Analytics must deny advertising storage.');
assert.match(analytics, /allow_google_signals:\s*false/, 'Analytics must disable Google advertising signals.');
assert.match(analytics, /allow_ad_personalization_signals:\s*false/, 'Analytics must disable advertising personalization.');
assert.match(analytics, /send_page_view:\s*false/, 'Analytics must suppress automatic unsanitized page views.');
assert.match(analytics, /window\.location\.hostname\s*===\s*window\.HOME_PAGE_HOSTNAME/, 'Analytics must initialize only on the configured production hostname.');
assert.match(analytics, /window\.location\.protocol\s*===\s*'https:'/, 'Analytics must initialize only over HTTPS.');
assert.match(analytics, /const currentPagePath = window\.location\.pathname;/, 'Analytics page paths must exclude query strings and fragments.');
assert.match(analytics, /publishedPageUrl\.origin === window\.HOME_PAGE_URL[\s\S]*publishedPageUrl\.search === ''[\s\S]*publishedPageUrl\.hash === '';/, 'Canonical analytics page paths must require the configured production origin without query strings or fragments.');
assert.match(analytics, /page_location:\s*`\$\{window\.HOME_PAGE_URL\}\$\{getMeasuredPagePath\(\)\}`/, 'Analytics page locations must combine the configured production origin with a reviewed page path.');
assert.match(analytics, /page_referrer:\s*''/, 'Analytics must not send page referrers.');
assert.match(analytics, /window\.gtag\('event', 'page_view'/, 'Sanitized page measurement must use the GA4 page_view event recognized by standard reports.');
assert.doesNotMatch(analytics, /window\.gtag\('event', 'ca_page_view'/, 'Page measurement must not be renamed to a custom event that standard GA4 page reporting ignores.');
assert.match(analytics, /publishEvent\('ca_version',[\s\S]*app_version:\s*window\.APP_VERSION/, 'App version measurement must use the configured published version in its dedicated event.');
assert.match(analytics, /window\.sessionStorage\.getItem\(window\.ANALYTICS_VERSION_REPORTED_STORAGE_KEY\)/, 'App version measurement must check its configured session marker before publication.');
assert.match(analytics, /window\.sessionStorage\.setItem\(window\.ANALYTICS_VERSION_REPORTED_STORAGE_KEY, window\.APP_VERSION\)/, 'App version measurement must store the reported app version before publication.');
assert.doesNotMatch(analytics, /cnsl_analytics_version_reported/, 'Analytics must use the session storage key from application configuration.');
assert.doesNotMatch(pwa, /cnsl_service_worker_update_checked_at/, 'The PWA consumer must use its session storage key from application configuration.');
assert.match(analyticsInteractionType, /const AnalyticsInteractionType = Object\.freeze\(/, 'Analytics interaction types must use one immutable shared enum.');
assert.match(analytics, /case AnalyticsInteractionType\.BANNER:/, 'The analytics dispatcher must use the shared interaction type enum.');
assert.match(analytics, /trackInteraction\s*\n?\s*}\);/, 'The analytics module must expose one public interaction tracking entry point.');
assert.doesNotMatch(analytics, /window\.cnslAnalytics = Object\.freeze\(\{[\s\S]*track(?:BannerInteraction|DirectoryDetailOpen|FixedSettingChange|InstallInteraction|PublishedSettingChange)/, 'Private analytics validators must not be exposed as alternate tracking entry points.');
assert.match(analytics, /publishEvent\('ca_share'/, 'Share measurement must be owned by the analytics module.');
assert.match(analytics, /publishEvent\('ca_external_link'/, 'External-link measurement must be owned by the analytics module.');
assert.match(analytics, /link\.closest\('\[data-analytics-context\]'\)/, 'External-link context measurement must read explicit semantic metadata.');
assert.match(analytics, /ALLOWED_EXTERNAL_LINK_CONTEXTS\.has\(context\)/, 'External-link context measurement must allowlist explicit semantic metadata.');
assert.match(analytics, /link\.dataset\.analyticsLinkPurpose/, 'External-link purpose measurement must read explicit semantic metadata.');
assert.match(analytics, /ALLOWED_EXTERNAL_LINK_PURPOSES\.has\(purpose\)/, 'External-link purpose measurement must allowlist explicit semantic metadata.');
assert.doesNotMatch(analytics, /classList\.contains\('team-merchandise'\)/, 'External-link purpose measurement must not derive categories from styling classes.');
assert.match(analytics, /purpose:\s*getExternalLinkPurpose\(clickedLink\)/, 'External-link measurement must pass only its bounded link purpose category to the interaction dispatcher.');
assert.match(analytics, /const EXTERNAL_LINK_DESTINATIONS = Object\.freeze\(/, 'External-link destinations must use one fixed category map.');
assert.match(analytics, /const ALLOWED_EXTERNAL_LINK_DESTINATIONS = new Set\(Object\.values\(EXTERNAL_LINK_DESTINATIONS\)\)/, 'External-link destination measurement must derive its allowlist from the fixed category map.');
assert.match(analytics, /destination:\s*getExternalLinkDestination\(clickedLink\)/, 'External-link measurement must resolve a bounded destination category instead of publishing the URL.');
assert.match(analytics, /ALLOWED_EXTERNAL_LINK_DESTINATIONS\.has\(destination\)/, 'External-link destination measurement must allowlist the resolved category before publication.');
assert.match(analytics, /link_destination:\s*destination/, 'External-link measurement must publish only its validated destination category.');
assert.match(analytics, /ALLOWED_SHARE_METHODS\.has\(method\)/, 'Share measurement must allowlist authored sharing methods.');
assert.match(analytics, /publishEvent\('ca_setting_change'/, 'Settings measurement must be owned by the analytics module.');
assert.match(analytics, /FAVORITE_SETTING_NAMES\.has\(settingName\)/, 'Favorite selection measurement must be limited to favorite setting categories.');
assert.match(analytics, /normalizedValues\.some\(value => !publishedValues\.has\(value\)\)/, 'Published setting values must be validated against current annual data.');
assert.match(analytics, /eventParameters\.selection = normalizedValues\[0\] \|\| EMPTY_FAVORITE_SELECTION/, 'Favorite changes must publish only one validated selection or the fixed cleared value.');
assert.match(analytics, /publishEvent\('ca_banner_interaction'/, 'Banner measurement must be owned by the analytics module.');
assert.match(analytics, /view:\s*'ca_resource_view'/, 'Resource views must use a fixed app-specific analytics event.');
assert.match(analytics, /download:\s*'ca_resource_download'/, 'Resource downloads must use a fixed app-specific analytics event.');
assert.match(analytics, /ALLOWED_RESOURCE_NAMES\.has\(resourceName\)/, 'Resource measurement must allowlist stable document names.');
assert.match(analytics, /resource_name:\s*resourceName/, 'Resource measurement must publish only its reviewed stable document name.');
assert.match(analytics, /publishEvent\('ca_directory_detail_open'/, 'Directory detail measurement must be owned by the analytics module.');
assert.match(analytics, /ALLOWED_DIRECTORY_NAMES\.has\(directoryName\)/, 'Directory detail measurement must allowlist broad directory names.');
assert.match(analytics, /directory_name:\s*directoryName/, 'Directory detail measurement must publish only its broad directory name.');
assert.match(analytics, /publishEvent\('ca_install_interaction'/, 'Install measurement must be owned by the analytics module.');
assert.match(analytics, /ALLOWED_INSTALL_ACTIONS\.has\(action\)/, 'Install measurement must allowlist coarse interaction actions.');
assert.match(analytics, /install_action:\s*action/, 'Install measurement must publish only its coarse interaction action.');
assert.match(analytics, /window\.gtag\('event', 'ca_flyer_visit'\)/, 'Flyer visit measurement must use a fixed app-specific analytics event.');
assert.match(analytics, /source:\s*'flyer'/, 'Flyer attribution must use the reviewed fixed campaign source.');
assert.match(analytics, /medium:\s*'qr'/, 'Flyer attribution must use the reviewed fixed campaign medium.');
assert.match(analytics, /name:\s*'2026_pool_season'/, 'Flyer attribution must use the reviewed fixed campaign name.');
assert.match(analytics, /campaign_source:\s*publishedCampaign\.source/, 'Reviewed campaign attribution must be mapped to standard GA campaign source measurement.');
assert.match(analytics, /campaign_medium:\s*publishedCampaign\.medium/, 'Reviewed campaign attribution must be mapped to standard GA campaign medium measurement.');
assert.match(analytics, /campaign_name:\s*publishedCampaign\.name/, 'Reviewed campaign attribution must be mapped to standard GA campaign name measurement.');
assert.match(analytics, /landingUrl\.searchParams\.delete\('utm_source'\)/, 'Recognized campaign URLs must remove their campaign marker before page measurement.');
assert.match(analytics, /isProductionSite\(\) \? consumePublishedCampaign\(\) : null/, 'Published campaign cleanup must occur only on the deployed application landing page.');
assert.match(analytics, /window\.history\.replaceState\(/, 'Recognized campaign URLs must be cleaned without a navigation or referrer-producing redirect.');
assert.doesNotMatch(analytics, /setting_value\s*:/, 'Settings measurement must not expose a general selected-value field.');
assert.doesNotMatch(analytics, /link_(?:url|host)\s*:/, 'External-link measurement must not send raw URL or host details.');
assert.doesNotMatch(analytics, /resource_(?:url|path|filename)\s*:/, 'Resource measurement must not send URLs, paths, or filenames.');
assert.doesNotMatch(analytics, /(?:pool|team|meet)_(?:id|name)\s*:/, 'Analytics must not send selected pool, team, or meet identities.');
assert.doesNotMatch(analytics, /(?:latitude|longitude|coordinates|user_agent|platform)\s*:/, 'Analytics must not send location or device-identifying values.');
assert.doesNotMatch(analytics, /window\.gtag\('event', 'page_view',[\s\S]*app_version:/, 'Recurring page measurement must not duplicate app version reporting.');
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
  const structuredDataBlocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  assert.deepEqual(canonicalLinks, [`<link rel="canonical" href="${canonical}">`], `${page} must publish its one canonical URL.`);
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
  assert.match(html, /script-src[^;"]*'unsafe-inline'/, `${page} must permit Cloudflare-injected inline scripts that cannot use a nonce or stable hash.`);
  assert.doesNotMatch(html, /script-src[^;"]*'(?:sha(?:256|384|512)-|nonce-)/, `${page} must not include a nonce or hash source that causes browsers to ignore unsafe-inline.`);
  assert.match(html, /connect-src[^;"]*https:\/\/\*\.google-analytics\.com/, `${page} must permit Google Analytics collection requests.`);
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
assert.match(homeHtml, /<title>CA Outdoor Pools &amp; CNSL Swim Teams<\/title>/, 'Home search title must emphasize CA outdoor pools and CNSL swim teams.');
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
assert.equal((sitemap.match(/<url>/g) || []).length, 1, 'Sitemap must contain only the indexable home page.');
assert.match(sitemap, new RegExp(`<loc>${siteOrigin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/<\\/loc>`), 'Sitemap must publish the canonical home page.');
assert.doesNotMatch(sitemap, /\.html<\/loc>/, 'Noindex subpages must not appear in the sitemap.');

const robots = fs.readFileSync(path.join(outDir, 'robots.txt'), 'utf8');
assert.doesNotMatch(robots, /Disallow: \/offline\.html/, 'Crawler rules must allow discovery of the offline noindex directive.');
assert.match(robots, new RegExp(`Sitemap: ${siteOrigin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/sitemap\\.xml`), 'Crawler rules must reference the published sitemap.');

const customDomain = fs.readFileSync(path.join(outDir, 'CNAME'), 'utf8').trim();
assert.equal(customDomain, HOME_PAGE_HOSTNAME, 'Published GitHub Pages output must retain the configured custom domain.');

console.log(`Verified PWA artifact for the ${YEAR} season: ${artifactBytes} delivered bytes.`);
console.log(`PWA cache inventory: ${precacheResources.length} resources / ${calculateResourceBytes(precacheResources)} bytes.`);
console.log(`PWA install-critical core: ${precacheCoreResources.length} resources / ${calculateResourceBytes(precacheCoreResources)} bytes.`);
console.log(`PWA cache-on-use optional tier: ${precacheOptionalResources.length} resources / ${calculateResourceBytes(precacheOptionalResources)} bytes.`);
