const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  CACHE_ON_USE_SCRIPT_RESOURCES,
  INSTALL_CRITICAL_PAGES
} = require('../../scripts/lib/pwa-resource-policy.js');

describe('PWA resource policy', () => {
  it('should keep route-only scripts out of the install-critical tier', () => {
    assert.deepEqual(CACHE_ON_USE_SCRIPT_RESOURCES, [
      'js/flyer-preview.js',
      'js/lessons-browser.js',
      'js/my-meet-day.js',
      'js/services/lesson-provider-service.js'
    ]);
    assert.ok(Object.isFrozen(CACHE_ON_USE_SCRIPT_RESOURCES));
  });

  it('should retain the documented offline routes during installation', () => {
    assert.deepEqual(INSTALL_CRITICAL_PAGES, [
      'index.html',
      'install.html',
      'meets.html',
      'offline.html',
      'pools.html',
      'settings.html',
      'teams.html'
    ]);
    assert.ok(Object.isFrozen(INSTALL_CRITICAL_PAGES));
  });
});
