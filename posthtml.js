const fs = require('fs');
const path = require('path');
const crypto = require('node:crypto');
const posthtml = require('posthtml');
const appConfig = require('./src/js/config/app-config');
const annualDataSourceDir = './src/assets/data';
const activeSeason = String(appConfig.YEAR);
const activeSeasonPoolsPath = path.join(annualDataSourceDir, activeSeason, 'pools', 'pools.json');
const activeSeasonPools = JSON.parse(fs.readFileSync(activeSeasonPoolsPath, 'utf8'));

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
const templateLocals = { ...appConfig, ACTIVE_SEASON };
const expressions = require('posthtml-expressions')({ locals: templateLocals });
require('posthtml-include')({ root: './src/views' });
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
    return { content: content };
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

const authorizeInlineStructuredDataPlugin = (tree) => {
  const inlineScriptHashes = new Set();
  let policyMeta = null;

  tree.walk(node => {
    if (node.tag === 'script' && (!node.attrs || !node.attrs.src)) {
      if (!node.attrs || node.attrs.type !== 'application/ld+json') {
        throw new Error('Inline executable scripts are not permitted; use a same-origin script asset instead.');
      }
      const scriptContent = Array.isArray(node.content) ? node.content.join('') : (node.content || '');
      const digest = crypto.createHash('sha256').update(scriptContent).digest('base64');
      inlineScriptHashes.add(`'sha256-${digest}'`);
    }
    if (node.tag === 'meta' && node.attrs && node.attrs['http-equiv'] === 'Content-Security-Policy') {
      policyMeta = node;
    }
    return node;
  });

  if (!policyMeta) {
    throw new Error('Shared Content-Security-Policy metadata is missing from a rendered page.');
  }

  policyMeta.attrs.content = policyMeta.attrs.content.replace(
    '__INLINE_SCRIPT_HASHES__',
    [...inlineScriptHashes].join(' ')
  );
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
copyDir('./src/js', path.join(outDir, 'js'));

// Copy required publishing artifacts, including search and GitHub Pages domain ownership.
const requiredRootStaticFiles = ['BingSiteAuth.xml', 'browserconfig.xml', 'CNAME', 'google3dd9d57115818ebb.html', 'LICENSE', 'manifest.webmanifest', 'robots.txt', 'sitemap.xml'];
requiredRootStaticFiles.forEach(file => {
  if (!fs.existsSync(file)) {
    throw new Error(`Required static file not found: ${file}`);
  }
  fs.copyFileSync(file, path.join(outDir, file));
  console.log(`Copied static file: ${file}`);
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
  const requiredOfflineResources = [
    'index.html',
    'offline.html',
    'pools.html',
    'teams.html',
    'meets.html',
    'css/styles.css',
    'manifest.webmanifest',
    `assets/data/${appConfig.YEAR}/pools/pools.json`,
    `assets/data/${appConfig.YEAR}/teams/teams.json`,
    `assets/data/${appConfig.YEAR}/meets/meets.json`
  ];
  const resources = ['./', ...collectPrecacheResources(outDir).sort()];
  const missingResources = requiredOfflineResources.filter(resource => !resources.includes(resource));
  if (missingResources.length > 0) {
    throw new Error(`Required offline resources missing from output: ${missingResources.join(', ')}`);
  }

  fs.writeFileSync(
    path.join(outDir, 'precache-manifest.js'),
    `self.PRECACHE_RESOURCES = ${JSON.stringify(resources, null, 2)};\n`
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
  console.log(`Generated PWA precache inventory with ${resources.length} resources.`);
  console.log(`Updated and copied service-worker.js with cache version: ${cacheVersion}`);
}

// Get all HTML files from src directory
const files = fs.readdirSync(srcDir)
  .filter(file => file.endsWith('.html'));

// Process each file
const totalFiles = files.length;

const pageBuilds = files.map(file => {
  const srcPath = path.join(srcDir, file);
  const outPath = path.join(outDir, file);
  
  const html = fs.readFileSync(srcPath, 'utf8');
  
  posthtml()
    .use(extend)
    .use(includePlugin)
    .use(expressions)
    .use(authorizeInlineStructuredDataPlugin)
    .use(versionStaticAssetsPlugin)
    .process(html)
    .then(result => {
      fs.writeFileSync(outPath, result.html);
      console.log(`📄 [${timestamp()}] Generated ${outPath}`);
    })
    .catch(error => {
      console.error(`❌ [${timestamp()}] Error processing ${file}:`, error);
      throw error;
    });
});

Promise.all(pageBuilds)
  .then(() => {
    writePwaArtifacts();
    console.log(`✅ [${timestamp()}] Build completed! Processed ${totalFiles} HTML files.`);
  })
  .catch(() => {
    process.exitCode = 1;
  });
