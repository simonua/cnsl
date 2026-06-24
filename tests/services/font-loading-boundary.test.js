const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const sourceRoot = path.join(__dirname, '..', '..', 'src');
const layoutSource = fs.readFileSync(path.join(sourceRoot, 'views', 'layouts', 'base.html'), 'utf8');
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
    const initialCanvasIndex = layoutSource.indexOf('<style>');
    const stylesheetIndex = layoutSource.indexOf(stylesheetTag);
    const initialCanvasSource = layoutSource.slice(0, stylesheetIndex);

    assert.notEqual(contentSecurityPolicyIndex, -1);
    assert.notEqual(initialCanvasIndex, -1);
    assert.notEqual(stylesheetIndex, -1);
    assert.match(initialCanvasSource, /--initial-page-background:\s*#f8f9fa/);
    assert.match(initialCanvasSource, /@media\s*\(prefers-color-scheme:\s*dark\)[\s\S]*--initial-page-background:\s*#101820/);
    assert.ok(contentSecurityPolicyIndex < initialCanvasIndex);
    assert.ok(initialCanvasIndex < stylesheetIndex);
    assert.ok(stylesheetIndex < layoutSource.indexOf('<script'));
    assert.ok(stylesheetIndex < layoutSource.indexOf('</head>'));
    assert.doesNotMatch(stylesheetTag, /media=|disabled|onload/i);
  });
});
