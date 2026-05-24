const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('node:vm');
const { YEAR } = require('../src/js/config/app-config.js');

const outDir = path.join(__dirname, '..', 'out');
const siteOrigin = 'https://cnsl.longreachmarlins.org';
const requiredArtifacts = [
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
  .filter(resource => !['robots.txt', 'sitemap.xml', 'precache-manifest.js', 'service-worker.js'].includes(resource))
  .forEach(resource => assert.ok(precacheResources.includes(resource), `Precache inventory is missing: ${resource}`));
assert.ok(!precacheResources.some(resource => resource.includes('/data/2025/')), 'Archived season data must not be precached.');
precacheResources.filter(resource => resource !== './').forEach(resource => {
  assert.ok(fs.existsSync(path.join(outDir, resource)), `Precache inventory references an absent artifact: ${resource}`);
});

const worker = fs.readFileSync(path.join(outDir, 'service-worker.js'), 'utf8');
assert.doesNotMatch(worker, /const CACHE_VERSION = 'development'/, 'Built service worker must have a release cache version.');
assert.match(worker, /precache-manifest\.js/, 'Service worker must import the generated precache inventory.');

Object.entries(canonicalPages).forEach(([page, canonical]) => {
  const html = fs.readFileSync(path.join(outDir, page), 'utf8');
  const canonicalLinks = html.match(/<link rel="canonical" href="[^"]+">/g) || [];
  assert.deepEqual(canonicalLinks, [`<link rel="canonical" href="${canonical}">`], `${page} must publish its one canonical URL.`);
  assert.equal((html.match(/<title>/g) || []).length, 1, `${page} must publish one title.`);
});

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

console.log(`Verified PWA artifact: ${precacheResources.length} cached resources for the ${YEAR} season.`);
