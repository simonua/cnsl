const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const {
  BROWSER_SOURCE_ROOT,
  createClassicScriptLoader,
  resolveBrowserScript
} = require('../../scripts/lib/classic-script-loader.js');

describe('classic script loader', () => {
  it('loads scripts in a fresh browser-like realm with explicit injection', () => {
    const first = createClassicScriptLoader({ inject: { marker: { value: 1 } } });
    const second = createClassicScriptLoader();
    first.load('types/schedule-state.js');

    assert.equal(first.context.window, first.context.globalThis);
    assert.equal(first.context.self, first.context.globalThis);
    assert.equal(first.get('marker').value, 1);
    assert.equal(typeof first.pick(['MeetLiveStatus']).MeetLiveStatus, 'function');
    assert.equal(second.get('MeetLiveStatus'), undefined);
  });

  it('restricts real script paths to the repository browser source directory', () => {
    const resolvedPath = resolveBrowserScript('types/schedule-state.js');
    assert.equal(path.dirname(path.dirname(resolvedPath)), BROWSER_SOURCE_ROOT);
    assert.throws(() => resolveBrowserScript('../service-worker.js'));
  });

  it('converts realm-owned structured values to host values', () => {
    const loader = createClassicScriptLoader({ inject: { URL, URLSearchParams } });
    loader.load('config/app-config.js');
    const hostValue = loader.toHostValue(loader.get('AppConfig').EXTERNAL_LINKS);

    assert.equal(hostValue.GITHUB_REPOSITORY, 'https://github.com/simonua/cnsl');
  });
});
