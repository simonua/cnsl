const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const posthtml = require('posthtml');
const { copyBrowserJavaScript } = require('./scripts/validate-browser-javascript');
const appConfig = require('./scripts/adapters/app-config.js');
const WeatherAlertService = require('./scripts/adapters/weather-alert-service.js');
const { DEVELOPMENT_BUILD_MARKER } = require('./scripts/lib/development-server.js');
const { coordinatePageBuilds } = require('./scripts/lib/page-build-coordinator.js');
const { stripAuthoringComments } = require('./scripts/lib/html-output.js');
const { CACHE_ON_USE_SCRIPT_RESOURCES, INSTALL_CRITICAL_PAGES } = require('./scripts/lib/pwa-resource-policy.js');
const { createMeetDateSummaryNode } = require('./scripts/lib/meet-date-summary.js');
const { createPoolSummaryNode, createTeamSummaryNode } = require('./scripts/lib/search-directory-summary.js');
const annualDataSourceDir = './src/assets/data';
const activeSeason = String(appConfig.YEAR);
const activeSeasonPoolsPath = path.join(annualDataSourceDir, activeSeason, 'pools', 'pools.json');
const activeSeasonMeetsPath = path.join(annualDataSourceDir, activeSeason, 'meets', 'meets.json');
const activeSeasonTeamsPath = path.join(annualDataSourceDir, activeSeason, 'teams', 'teams.json');
const activeSeasonPools = JSON.parse(fs.readFileSync(activeSeasonPoolsPath, 'utf8'));
const activeSeasonMeets = JSON.parse(fs.readFileSync(activeSeasonMeetsPath, 'utf8'));
const activeSeasonTeams = JSON.parse(fs.readFileSync(activeSeasonTeamsPath, 'utf8'));
const whatsNewSource = fs.readFileSync('./src/views/whats-new.html', 'utf8');

function createAppVersionWhatsNewUrl() {
  const releaseAnchor = `version-${appConfig.APP_VERSION}`;
  return whatsNewSource.includes(`id="${releaseAnchor}"`)
    ? `whats-new.html#${releaseAnchor}`
    : 'whats-new.html';
}

function formatSeasonDate(dateString) {
  const date = new Date(`${dateString}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Active season pool metadata includes an invalid date: ${dateString}.`);
  }

  return date.toLocaleDateString('en-US', { day: 'numeric', month: 'long', timeZone: 'UTC' });
}

function createActiveSeasonTemplateMetadata() {
  const { caPoolDirectoryUrl, caPoolGuideUrl, seasonEndDate, seasonStartDate } = activeSeasonPools;
  const expectedYearPrefix = `${activeSeason}-`;

  if (!seasonStartDate?.startsWith(expectedYearPrefix) || !seasonEndDate?.startsWith(expectedYearPrefix)) {
    throw new Error(`Active season pool metadata dates must belong to configured YEAR ${activeSeason}.`);
  }
  if (seasonStartDate > seasonEndDate) {
    throw new Error('Active season pool metadata start date must not follow its end date.');
  }
  if (![caPoolDirectoryUrl, caPoolGuideUrl].every(url => typeof url === 'string' && /^https:\/\//.test(url))) {
    throw new Error('Active season pool metadata must provide HTTPS Columbia Association source URLs.');
  }

  return Object.freeze({
    CA_POOL_DIRECTORY_URL: caPoolDirectoryUrl,
    CA_POOL_SCHEDULES_URL: caPoolGuideUrl,
    END_DATE_LABEL: formatSeasonDate(seasonEndDate),
    END_DATE_ON: seasonEndDate,
    START_DATE_LABEL: formatSeasonDate(seasonStartDate),
    START_DATE_ON: seasonStartDate
  });
}

const ACTIVE_SEASON = createActiveSeasonTemplateMetadata();
const APP_VERSION_WHATS_NEW_URL = createAppVersionWhatsNewUrl();
const ANALYTICS_DEPLOYMENT_MODE = process.env.CNSL_ANALYTICS_DEPLOYMENT
  === appConfig.ANALYTICS_DEPLOYMENT_MODES.PRODUCTION
  ? appConfig.ANALYTICS_DEPLOYMENT_MODES.PRODUCTION
  : appConfig.ANALYTICS_DEPLOYMENT_MODES.DISABLED;
const templateLocals = {
  ...appConfig,
  ACTIVE_SEASON,
  ANALYTICS_DEPLOYMENT_MODE,
  APP_VERSION_WHATS_NEW_URL
};
const expressions = require('posthtml-expressions')({ locals: templateLocals });
const extend = require('posthtml-extend')({
  expressions: { locals: templateLocals },
  root: './src/views/layouts'
});

// Add timestamp for build logging
const timestamp = () => new Date().toLocaleTimeString();

function createCacheVersion() {
  const now = new Date();
  const buildDate = now.toISOString().split('T')[0].replace(/-/g, '');
  const epochSuffix = Math.floor(now.getTime() / 1000).toString().slice(-6);
  return `${buildDate}-${epochSuffix}`;
}

const cacheVersion = createCacheVersion();

console.log(`🔨 [${timestamp()}] Starting build process...`);

// Helper function to delete directory recursively
function deleteDir(dirPath) {
  if (fs.existsSync(dirPath)) {
    console.log(`🗑️ [${timestamp()}] Cleaning output directory: ${dirPath}`);
    fs.rmSync(dirPath, { recursive: true, force: true });
  }
}

// Helper function to read component file
function readComponent(name) {
  const filePath = path.join('./src/views', name);
  return fs.readFileSync(filePath, 'utf8');
}

// Helper function to copy directory recursively with exclusions
function copyDir(src, dest, excludePaths = [], basePath = src) {
  // Create destination directory if it doesn't exist
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  // Read source directory
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    // Get relative path from the original base path for exclusion checking
    const relativePath = path.relative(basePath, srcPath).replace(/\\/g, '/');

    // Skip excluded paths
    if (excludePaths.some(excludePath => relativePath === excludePath || relativePath.startsWith(excludePath + '/'))) {
      console.log(`⏭️ [${timestamp()}] Skipping excluded path: ${relativePath}`);
      continue;
    }

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath, excludePaths, basePath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// Custom include plugin
const includePlugin = (tree) => {
  tree.match({ tag: 'include' }, (node) => {
    const src = node.attrs.src;
    if (!src) return node;

    const content = readComponent(src);
    return { content: tree.parser(content) };
  });
  return tree;
};

const searchDirectorySummaryPlugin = (tree) => {
  tree.match({ tag: 'meet-date-summary' }, () => createMeetDateSummaryNode(activeSeasonMeets));
  tree.match({ tag: 'search-directory-summary' }, node => {
    if (node.attrs?.domain === 'pools') {
      return createPoolSummaryNode(activeSeasonPools.pools, activeSeason);
    }
    if (node.attrs?.domain === 'teams') {
      return createTeamSummaryNode(activeSeasonTeams.teams, activeSeason);
    }
    throw new Error('Search directory summary requires a supported domain.');
  });
  return tree;
};

function versionStaticAssetUrl(url) {
  if (typeof url !== 'string') return url;

  const match = url.match(/^(\/?(?:(?:css|js|assets)\/[^?#]+|manifest\.webmanifest|browserconfig\.xml))(?:\?[^#]*)?(#.*)?$/);
  if (!match) return url;

  return `${match[1]}?v=${cacheVersion}${match[2] || ''}`;
}

const versionStaticAssetsPlugin = (tree) => {
  tree.walk(node => {
    if (node.attrs) {
      if (node.attrs.src) node.attrs.src = versionStaticAssetUrl(node.attrs.src);
      if (node.attrs.href) node.attrs.href = versionStaticAssetUrl(node.attrs.href);
    }
    return node;
  });
  return tree;
};

const validateInlineContentPlugin = (tree) => {
  let earlyThemeBootstrapCount = 0;
  let initialCanvasStyle = null;
  let initialCanvasStyleCount = 0;
  let policyMeta = null;

  tree.walk(node => {
    if (node.attrs && Object.prototype.hasOwnProperty.call(node.attrs, 'style')) {
      throw new Error('Inline style attributes are not permitted; use the site stylesheet instead.');
    }
    if (node.tag === 'script' && (!node.attrs || !node.attrs.src)) {
      const isStructuredData = node.attrs && node.attrs.type === 'application/ld+json';
      const isEarlyThemeBootstrap = node.attrs
        && node.attrs['data-cfasync'] === 'false'
        && node.attrs['data-theme-bootstrap'] === 'true';
      if (isEarlyThemeBootstrap) earlyThemeBootstrapCount += 1;
      if (!isStructuredData && !isEarlyThemeBootstrap) {
        throw new Error('Inline executable scripts are not permitted; use a same-origin script asset instead.');
      }
    }
    if (node.tag === 'style') {
      const isInitialCanvasStyle = node.attrs && node.attrs['data-initial-canvas'] === 'true';
      if (!isInitialCanvasStyle) {
        throw new Error('Inline style blocks are not permitted; use the site stylesheet instead.');
      }
      initialCanvasStyle = node;
      initialCanvasStyleCount += 1;
    }
    if (node.tag === 'meta' && node.attrs && node.attrs['http-equiv'] === 'Content-Security-Policy') {
      policyMeta = node;
    }
    return node;
  });

  if (!policyMeta) {
    throw new Error('Shared Content-Security-Policy metadata is missing from a rendered page.');
  }
  if (earlyThemeBootstrapCount !== 1) {
    throw new Error('Each rendered page must include exactly one Cloudflare-safe early theme bootstrap.');
  }
  if (initialCanvasStyleCount !== 1) {
    throw new Error('Each rendered page must include exactly one initial canvas style block.');
  }

  const initialCanvasCss = initialCanvasStyle.content.join('');
  const initialCanvasHash = crypto.createHash('sha256').update(initialCanvasCss).digest('base64');
  if (!policyMeta.attrs.content.includes(`'sha256-${initialCanvasHash}'`)) {
    throw new Error('The Content-Security-Policy style hash does not match the initial canvas style block.');
  }

  return tree;
};

const srcDir = './src/views';
const outDir = './out';
const unpublishedSeasonDirectories = fs.readdirSync(annualDataSourceDir, { withFileTypes: true })
  .filter(entry => entry.isDirectory() && entry.name !== activeSeason)
  .map(entry => `data/${entry.name}`);

// Clean and create output directory
deleteDir(outDir);
console.log(`📁 [${timestamp()}] Creating output directory: ${outDir}`);
fs.mkdirSync(outDir, { recursive: true });

// Copy assets directory (excluding large file directories)
console.log(`📁 [${timestamp()}] Copying assets directory...`);
copyDir('./src/assets', path.join(outDir, 'assets'), [
  ...unpublishedSeasonDirectories,
  `data/${appConfig.YEAR}/pools/pool-schedules`,
  `data/${appConfig.YEAR}/meets/meet-schedules`,
  `data/${appConfig.YEAR}/teams/team-schedules`,
  'images/logos/originals'
]);

// Verify swim meet resources were copied
const swimMeetResourcesPath = path.join(outDir, 'assets', 'swim-meet-resources');
if (fs.existsSync(swimMeetResourcesPath)) {
  const files = fs.readdirSync(swimMeetResourcesPath);
  console.log(`📋 [${timestamp()}] Copied ${files.length} swim meet resource files`);
} else {
  console.warn(`⚠️ [${timestamp()}] Swim meet resources directory not found`);
}

// Copy CSS directory
console.log(`🎨 [${timestamp()}] Copying CSS directory...`);
copyDir('./src/css', path.join(outDir, 'css'));

// Copy JS directory
console.log(`⚙️ [${timestamp()}] Copying JS directory...`);
copyBrowserJavaScript('./src/js', path.join(outDir, 'js'));

function writeWeatherOperatingWindowsArtifact() {
  const operatingWindows = WeatherAlertService.createOperatingWindowSchedule(activeSeasonPools);
  const outputPath = path.join(outDir, 'js', 'config', 'weather-operating-windows.js');
  fs.writeFileSync(outputPath, `globalThis.WEATHER_OPERATING_WINDOWS = Object.freeze(${JSON.stringify(operatingWindows)});\n`);
  console.log(`Generated compact weather operating windows: ${fs.statSync(outputPath).size} bytes.`);
}

writeWeatherOperatingWindowsArtifact();

// Copy required publishing artifacts, including GitHub Pages domain ownership.
const requiredRootStaticFiles = ['browserconfig.xml', 'CNAME', 'LICENSE', 'manifest.webmanifest', 'robots.txt', 'sitemap.xml'];
requiredRootStaticFiles.forEach(file => {
  if (!fs.existsSync(file)) {
    throw new Error(`Required static file not found: ${file}`);
  }
  fs.copyFileSync(file, path.join(outDir, file));
  console.log(`Copied static file: ${file}`);
});

const siteVerificationSourceDir = path.join('src', 'site-verification');
const siteVerificationFiles = ['BingSiteAuth.xml', 'b95676755a0a47f2965553d9f994f87f.txt', 'google3dd9d57115818ebb.html'];
siteVerificationFiles.forEach(file => {
  const sourcePath = path.join(siteVerificationSourceDir, file);
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Required site verification file not found: ${sourcePath}`);
  }
  fs.copyFileSync(sourcePath, path.join(outDir, file));
  console.log(`Copied site verification file: ${file}`);
});

const rootIconAliases = Object.freeze({
  'apple-touch-icon-120x120-precomposed.png': path.join('src', 'assets', 'favicons', 'apple-touch-icon.png'),
  'apple-touch-icon-120x120.png': path.join('src', 'assets', 'favicons', 'apple-touch-icon.png'),
  'apple-touch-icon-precomposed.png': path.join('src', 'assets', 'favicons', 'apple-touch-icon.png'),
  'apple-touch-icon.png': path.join('src', 'assets', 'favicons', 'apple-touch-icon.png'),
  'favicon.ico': path.join('src', 'assets', 'favicons', 'favicon.ico')
});
Object.entries(rootIconAliases).forEach(([alias, sourcePath]) => {
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Required icon not found: ${sourcePath}`);
  }
  fs.copyFileSync(sourcePath, path.join(outDir, alias));
  console.log(`Copied root icon alias: ${alias}`);
});

function collectPrecacheResources(directory, rootDirectory = directory) {
  const resources = [];
  const entries = fs.readdirSync(directory, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      resources.push(...collectPrecacheResources(entryPath, rootDirectory));
      continue;
    }

    const relativePath = path.relative(rootDirectory, entryPath).replace(/\\/g, '/');
    if (['LICENSE', 'robots.txt', 'sitemap.xml', 'service-worker.js', 'precache-manifest.js'].includes(relativePath)) continue;
    if (siteVerificationFiles.includes(relativePath)) continue;
    if (relativePath === appConfig.EXPERIMENTAL_SETTINGS_URL) {
      resources.push(relativePath);
      continue;
    }
    if (relativePath.startsWith('assets/data/')) {
      if ([
        `assets/data/${appConfig.YEAR}/pools/pools.json`,
        `assets/data/${appConfig.YEAR}/teams/teams.json`,
        `assets/data/${appConfig.YEAR}/meets/meets.json`
      ].includes(relativePath)) {
        resources.push(relativePath);
      }
      continue;
    }
    if (/\.(?:html|css|js|webmanifest|xml|png|jpg|ico|pdf)$/i.test(relativePath)) {
      resources.push(relativePath);
    }
  }

  return resources;
}

function writePwaArtifacts() {
  fs.writeFileSync(path.join(outDir, appConfig.DEPLOYMENT_VERSION_FILE), cacheVersion);

  const requiredOfflineResources = [
    'index.html',
    'offline.html',
    'pools.html',
    'teams.html',
    'meets.html',
    'css/styles.css',
    appConfig.EXPERIMENTAL_SETTINGS_URL,
    'manifest.webmanifest',
    `assets/data/${appConfig.YEAR}/pools/pools.json`,
    `assets/data/${appConfig.YEAR}/teams/teams.json`,
    `assets/data/${appConfig.YEAR}/meets/meets.json`
  ];
  const resources = collectPrecacheResources(outDir).sort();
  const cacheOnUseScripts = new Set(CACHE_ON_USE_SCRIPT_RESOURCES);
  const installCriticalPages = new Set(INSTALL_CRITICAL_PAGES);
  const coreResources = resources.filter(resource => installCriticalPages.has(resource)
    || resource === appConfig.EXPERIMENTAL_SETTINGS_URL
    || (/\.(?:css|js|webmanifest)$/i.test(resource) && !cacheOnUseScripts.has(resource))
    || resource.startsWith(`assets/data/${appConfig.YEAR}/`));
  const optionalResources = resources.filter(resource => !coreResources.includes(resource));
  const missingResources = requiredOfflineResources.filter(resource => !resources.includes(resource));
  if (missingResources.length > 0) {
    throw new Error(`Required offline resources missing from output: ${missingResources.join(', ')}`);
  }

  fs.writeFileSync(
    path.join(outDir, 'precache-manifest.js'),
    `self.PRECACHE_CORE_RESOURCES = ${JSON.stringify(coreResources, null, 2)};\n`
      + `self.PRECACHE_OPTIONAL_RESOURCES = ${JSON.stringify(optionalResources, null, 2)};\n`
      + 'self.PRECACHE_RESOURCES = [...self.PRECACHE_CORE_RESOURCES, ...self.PRECACHE_OPTIONAL_RESOURCES];\n'
  );

  const serviceWorkerPath = 'service-worker.js';
  if (!fs.existsSync(serviceWorkerPath)) {
    throw new Error(`Required static file not found: ${serviceWorkerPath}`);
  }
  const swContent = fs.readFileSync(serviceWorkerPath, 'utf8').replace(
    /const CACHE_VERSION = .*?;/,
    `const CACHE_VERSION = '${cacheVersion}';`
  );
  fs.writeFileSync(path.join(outDir, serviceWorkerPath), swContent);
  console.log(`Generated PWA precache inventory with ${coreResources.length} core and ${optionalResources.length} optional resources.`);
  console.log(`Updated and copied service-worker.js with cache version: ${cacheVersion}`);
}

function writeDevelopmentBuildMarker() {
  if (process.env.NODE_ENV !== 'development') return;
  fs.mkdirSync(path.dirname(DEVELOPMENT_BUILD_MARKER), { recursive: true });
  fs.writeFileSync(DEVELOPMENT_BUILD_MARKER, cacheVersion);
}

// Get all HTML files from src directory
const files = fs.readdirSync(srcDir)
  .filter(file => file.endsWith('.html'));

// Process each file
const totalFiles = files.length;

coordinatePageBuilds(files, file => {
  const srcPath = path.join(srcDir, file);
  const outPath = path.join(outDir, file);

  const html = fs.readFileSync(srcPath, 'utf8');

  return posthtml()
    .use(extend)
    .use(includePlugin)
    .use(expressions)
    .use(searchDirectorySummaryPlugin)
    .use(validateInlineContentPlugin)
    .use(versionStaticAssetsPlugin)
    .use(stripAuthoringComments)
    .process(html)
    .then(result => {
      fs.writeFileSync(outPath, result.html);
      console.log(`📄 [${timestamp()}] Generated ${outPath}`);
    })
    .catch(error => {
      console.error(`❌ [${timestamp()}] Error processing ${file}:`, error);
      throw error;
    });
}, () => {
    writePwaArtifacts();
    writeDevelopmentBuildMarker();
    console.log(`✅ [${timestamp()}] Build completed! Processed ${totalFiles} HTML files.`);
}, () => {
  process.exitCode = 1;
});
