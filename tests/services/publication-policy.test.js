const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const {
  REQUIRED_ROOT_STATIC_FILES,
  ROOT_ICON_ALIASES,
  SITE_VERIFICATION_FILES,
  SITE_VERIFICATION_SOURCE_DIRECTORY
} = require('../../scripts/lib/publication-policy.js');

describe('publication policy', () => {
  it('should retain every required root publication contract', () => {
    assert.deepEqual(REQUIRED_ROOT_STATIC_FILES, [
      'browserconfig.xml',
      'CNAME',
      'LICENSE',
      'manifest.webmanifest',
      'robots.txt',
      'sitemap.xml'
    ]);
    assert.deepEqual(SITE_VERIFICATION_FILES, [
      'BingSiteAuth.xml',
      'b95676755a0a47f2965553d9f994f87f.txt',
      'google3dd9d57115818ebb.html'
    ]);
    assert.equal(SITE_VERIFICATION_SOURCE_DIRECTORY, path.join('src', 'site-verification'));
    assert.deepEqual(ROOT_ICON_ALIASES, {
      'apple-touch-icon-120x120-precomposed.png': path.join('src', 'assets', 'favicons', 'apple-touch-icon.png'),
      'apple-touch-icon-120x120.png': path.join('src', 'assets', 'favicons', 'apple-touch-icon.png'),
      'apple-touch-icon-precomposed.png': path.join('src', 'assets', 'favicons', 'apple-touch-icon.png'),
      'apple-touch-icon.png': path.join('src', 'assets', 'favicons', 'apple-touch-icon.png'),
      'favicon.ico': path.join('src', 'assets', 'favicons', 'favicon.ico')
    });
  });
});
