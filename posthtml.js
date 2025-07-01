const fs = require('fs');
const path = require('path');
const posthtml = require('posthtml');
const include = require('posthtml-include')({ root: './src/views' });
const extend = require('posthtml-extend')({ root: './src/views/layouts' });

// Add timestamp for build logging
const timestamp = () => new Date().toLocaleTimeString();

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

const srcDir = './src/views';
const outDir = './out';

// Clean and create output directory
deleteDir(outDir);
console.log(`📁 [${timestamp()}] Creating output directory: ${outDir}`);
fs.mkdirSync(outDir, { recursive: true });

// Copy assets directory (excluding large file directories)
console.log(`📁 [${timestamp()}] Copying assets directory...`);
copyDir('./src/assets', path.join(outDir, 'assets'), ['data/2025', 'images/logos/originals']);

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

// Copy static files from root, handling service worker specially
const rootStaticFiles = ['browserconfig.xml', 'CNAME', 'LICENSE', 'manifest.webmanifest', 'site.webmanifest'];
rootStaticFiles.forEach(file => {
  if (fs.existsSync(file)) {
    fs.copyFileSync(file, path.join(outDir, file));
    console.log(`Copied static file: ${file}`);
  } else {
    console.warn(`Static file not found: ${file}`);
  }
});

// Handle service-worker.js specially to update the cache version
const serviceWorkerPath = 'service-worker.js';
if (fs.existsSync(serviceWorkerPath)) {
  const now = new Date();
  const buildDate = now.toISOString().split('T')[0].replace(/-/g, '');
  const unixEpoch = Math.floor(now.getTime() / 1000);
  const epochSuffix = unixEpoch.toString().slice(-6); // Last 6 digits of Unix epoch
  const cacheVersion = `${buildDate}-${epochSuffix}`;
  
  let swContent = fs.readFileSync(serviceWorkerPath, 'utf8');
  
  // Replace the cache version with the date and epoch suffix
  swContent = swContent.replace(
    /const CACHE_VERSION = .*?;/,
    `const CACHE_VERSION = '${cacheVersion}';`
  );
  
  fs.writeFileSync(path.join(outDir, serviceWorkerPath), swContent);
  console.log(`Updated and copied service-worker.js with cache version: ${cacheVersion}`);
} else {
  console.warn(`Service worker file not found: ${serviceWorkerPath}`);
}

// Get all HTML files from src directory
const files = fs.readdirSync(srcDir)
  .filter(file => file.endsWith('.html'));

// Process each file
let processedCount = 0;
const totalFiles = files.length;

files.forEach(file => {
  const srcPath = path.join(srcDir, file);
  const outPath = path.join(outDir, file);
  
  const html = fs.readFileSync(srcPath, 'utf8');
  
  posthtml()
    .use(extend)
    .use(includePlugin)
    .process(html)
    .then(result => {
      fs.writeFileSync(outPath, result.html);
      processedCount++;
      console.log(`📄 [${timestamp()}] Generated ${outPath}`);
      
      // Log completion when all files are processed
      if (processedCount === totalFiles) {
        console.log(`✅ [${timestamp()}] Build completed! Processed ${totalFiles} HTML files.`);
      }
    })
    .catch(error => {
      console.error(`❌ [${timestamp()}] Error processing ${file}:`, error);
    });
});
