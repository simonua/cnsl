const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const browserSyncConfig = require('../../browser-sync.config.js');
const { DEVELOPMENT_BUILD_MARKER } = require('../../scripts/lib/development-server.js');

describe('BrowserSync development configuration', () => {
  it('should force one full reload from the successful build marker', () => {
    assert.deepEqual(browserSyncConfig.files, [DEVELOPMENT_BUILD_MARKER]);
    assert.equal(DEVELOPMENT_BUILD_MARKER.replaceAll('\\', '/'), 'tmp/development-build.txt');
    assert.deepEqual(browserSyncConfig.watchEvents, ['add', 'change']);
    assert.equal(browserSyncConfig.injectChanges, false);
    assert.equal(browserSyncConfig.port, 3100);
    assert.equal(browserSyncConfig.server, 'out');
  });
});
