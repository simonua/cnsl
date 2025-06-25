const fs = require('fs');
const path = require('path');
const posthtml = require('posthtml');
const include = require('posthtml-include')({ root: './src/views' });
const extend = require('posthtml-extend')({ root: './src/views/layouts' });

// Helper function to read component file
function readComponent(name) {
  const filePath = path.join('./src/views', name);
  return fs.readFileSync(filePath, 'utf8');
}

// Helper function to copy directory recursively
function copyDir(src, dest) {
  // Create destination directory if it doesn't exist
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  // Read source directory
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
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

// Create output directory if it doesn't exist
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// Copy assets directory
console.log('Copying assets directory...');
copyDir('./src/assets', path.join(outDir, 'assets'));

// Copy CSS directory
console.log('Copying CSS directory...');
copyDir('./src/css', path.join(outDir, 'css'));

// Copy JS directory
console.log('Copying JS directory...');
copyDir('./src/js', path.join(outDir, 'js'));

// Copy static files from root
const rootStaticFiles = ['browserconfig.xml', 'CNAME', 'LICENSE', 'manifest.webmanifest', 'service-worker.js', 'site.webmanifest'];
rootStaticFiles.forEach(file => {
  if (fs.existsSync(file)) {
    fs.copyFileSync(file, path.join(outDir, file));
    console.log(`Copied static file: ${file}`);
  } else {
    console.warn(`Static file not found: ${file}`);
  }
});

// Get all HTML files from src directory
const files = fs.readdirSync(srcDir)
  .filter(file => file.endsWith('.html'));

// Process each file
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
      console.log(`Generated ${outPath}`);
    })
    .catch(error => {
      console.error(`Error processing ${file}:`, error);
    });
});
