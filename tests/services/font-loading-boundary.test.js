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

  it('loads the one site stylesheet synchronously before body content can render', () => {
    const stylesheetTag = '<link rel="stylesheet" href="css/styles.css" />';
    assert.equal(layoutSource.includes(stylesheetTag), true);
    assert.ok(layoutSource.indexOf(stylesheetTag) < layoutSource.indexOf('</head>'));
    assert.doesNotMatch(stylesheetTag, /media=|disabled|onload/i);
  });
});