const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const sourceRoot = path.join(__dirname, '..', '..', 'src');
const layoutSource = fs.readFileSync(path.join(sourceRoot, 'views', 'layouts', 'base.html'), 'utf8');
const posthtmlSource = fs.readFileSync(path.join(sourceRoot, '..', 'posthtml.js'), 'utf8');
const stylesSource = fs.readFileSync(path.join(sourceRoot, 'css', 'styles.css'), 'utf8');

function collectFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? collectFiles(entryPath) : [entryPath];
  });
}

describe('font loading boundary', () => {
  it('keeps initial typography on local system fonts without authored webfont swaps', () => {
    const textSources = collectFiles(sourceRoot)
      .filter(filePath => /\.(?:css|html|js)$/.test(filePath))
      .map(filePath => fs.readFileSync(filePath, 'utf8'))
      .join('\n');
    const fontAssets = collectFiles(path.join(sourceRoot, 'assets'))
      .filter(filePath => /\.(?:eot|otf|ttf|woff2?)$/i.test(filePath));

    assert.doesNotMatch(textSources, /@font-face|fonts\.(?:googleapis|gstatic)|use\.typekit|as=["']font["']|\.(?:eot|otf|ttf|woff2?)(?:["')?\s]|$)/i);
    assert.deepEqual(fontAssets, []);
    assert.match(stylesSource, /font-family:\s*-apple-system,\s*BlinkMacSystemFont,\s*'Segoe UI'/);
  });

  it('paints the initial canvas and loads the one site stylesheet before head scripts', () => {
    const stylesheetTag = '<link rel="stylesheet" href="css/styles.css" />';
    const contentSecurityPolicyIndex = layoutSource.indexOf('<meta http-equiv="Content-Security-Policy"');
    const earlyThemeScriptIndex = layoutSource.indexOf('<script data-cfasync="false" data-theme-bootstrap="true">');
    const initialCanvasIndex = layoutSource.indexOf('<style data-initial-canvas="true">');
    const stylesheetIndex = layoutSource.indexOf(stylesheetTag);
    const initialCanvasSource = layoutSource.slice(0, stylesheetIndex);

    assert.notEqual(contentSecurityPolicyIndex, -1);
    assert.notEqual(earlyThemeScriptIndex, -1);
    assert.notEqual(initialCanvasIndex, -1);
    assert.notEqual(stylesheetIndex, -1);
    assert.match(initialCanvasSource, /localStorage\.getItem\('\{\{ PREFERENCES_STORAGE_KEY \}\}'\)/);
    assert.match(initialCanvasSource, /storedPreferences\.theme === 'light' \|\| storedPreferences\.theme === 'dark'/);
    assert.match(initialCanvasSource, /document\.documentElement\.dataset\.colorScheme = selectedColorScheme/);
    assert.match(initialCanvasSource, /--initial-page-background:\s*#f8f9fa/);
    assert.match(initialCanvasSource, /:root\[data-color-scheme="dark"\][\s\S]*--initial-page-background:\s*#101820/);
    assert.match(initialCanvasSource, /@media\s*\(prefers-color-scheme:\s*dark\)[\s\S]*:root:not\(\[data-color-scheme="light"\]\)/);
    assert.ok(contentSecurityPolicyIndex < earlyThemeScriptIndex);
    assert.ok(earlyThemeScriptIndex < initialCanvasIndex);
    assert.ok(initialCanvasIndex < stylesheetIndex);
    assert.ok(stylesheetIndex < layoutSource.indexOf('</head>'));
    assert.doesNotMatch(stylesheetTag, /media=|disabled|onload/i);
  });

  it('limits the inline-script exception to one Cloudflare-safe theme bootstrap', () => {
    assert.match(posthtmlSource, /node\.attrs\['data-cfasync'\] === 'false'/);
    assert.match(posthtmlSource, /node\.attrs\['data-theme-bootstrap'\] === 'true'/);
    assert.match(posthtmlSource, /earlyThemeBootstrapCount !== 1/);
  });

  it('authorizes only the exact initial canvas style text and controlled runtime style attributes', () => {
    const initialCanvasMatch = layoutSource.match(/<style data-initial-canvas="true">([\s\S]*?)<\/style>/);
    assert.ok(initialCanvasMatch);
    const initialCanvasHash = crypto.createHash('sha256').update(initialCanvasMatch[1]).digest('base64');

    assert.match(layoutSource, new RegExp(`style-src 'self' 'sha256-${initialCanvasHash.replace(/[+/=]/g, '\\$&')}'`));
    assert.match(layoutSource, /style-src-attr 'unsafe-inline'/);
    assert.doesNotMatch(layoutSource, /style-src 'self' 'unsafe-inline'/);
    assert.match(posthtmlSource, /The Content-Security-Policy style hash does not match the initial canvas style block/);
  });
});
