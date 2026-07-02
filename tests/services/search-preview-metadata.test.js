const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repositoryRoot = path.join(__dirname, '..', '..');
const layoutSource = fs.readFileSync(
  path.join(repositoryRoot, 'src', 'views', 'layouts', 'base.html'),
  'utf8'
);
const previewPath = path.join(
  repositoryRoot,
  'src',
  'assets',
  'images',
  'ca-pool-cnsl-assistant-social-preview.png'
);

describe('search preview metadata', () => {
  it('publishes one inspectable large-image preview contract', () => {
    const image = fs.readFileSync(previewPath);

    assert.equal(image.readUInt32BE(16), 1200);
    assert.equal(image.readUInt32BE(20), 630);
    assert.match(layoutSource, /property="og:image" content="\{\{ HOME_PAGE_URL \}\}\/assets\/images\/ca-pool-cnsl-assistant-social-preview\.png"/);
    assert.match(layoutSource, /property="og:image:width" content="1200"/);
    assert.match(layoutSource, /property="og:image:height" content="630"/);
    assert.match(layoutSource, /name="twitter:card" content="summary_large_image"/);
    assert.doesNotMatch(layoutSource, /og:image[^>]+cnsl-logo\.jpg/);
  });
});
