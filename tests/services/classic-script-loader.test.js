const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { loadBrowserModule } = require('../helpers/browser-module-loader.js');

function createDocument() {
  const scripts = [];
  const createParent = appendLog => ({
    appendChild(script) {
      scripts.push(script);
      appendLog.push(script.src);
    }
  });
  const appendLog = [];
  const document = {
    baseURI: 'https://example.com/',
    body: createParent(appendLog),
    head: createParent(appendLog),
    scripts,
    createElement() {
      const listeners = new Map();
      return {
        async: true,
        dataset: {},
        getAttribute(name) {
          return name === 'src' ? this.src : null;
        },
        addEventListener(name, listener) {
          listeners.set(name, listener);
        },
        dispatch(name) {
          listeners.get(name)?.();
        },
        remove() {
          const index = scripts.indexOf(this);
          if (index >= 0) scripts.splice(index, 1);
        }
      };
    }
  };
  return { appendLog, document };
}

describe('ClassicScriptLoader', () => {
  it('should version ordered parallel dependencies and share pending loads', async () => {
    const { appendLog, document } = createDocument();
    const { ClassicScriptLoader } = loadBrowserModule('classic-script-loader', { inject: { document } });
    const dependencies = ['js/first.js', 'js/second.js'];
    const firstLoad = ClassicScriptLoader.load(dependencies, {
      assetVersion: '1.2.3',
      dataset: source => ({ dependencySource: source })
    });
    const sharedLoad = ClassicScriptLoader.load(['js/first.js'], { assetVersion: '1.2.3' });

    assert.deepEqual(appendLog, [
      'https://example.com/js/first.js?v=1.2.3',
      'https://example.com/js/second.js?v=1.2.3'
    ]);
    assert.equal(document.scripts[0].async, false);
    assert.equal(document.scripts[0].dataset.dependencySource, dependencies[0]);

    document.scripts.forEach(script => script.dispatch('load'));
    await Promise.all([firstLoad, sharedLoad]);
  });

  it('should load sequential dependencies and verify readiness', async () => {
    const { document } = createDocument();
    const { ClassicScriptLoader } = loadBrowserModule('classic-script-loader', { inject: { document } });
    let firstReady = false;
    const loadPromise = ClassicScriptLoader.load([
      { source: 'js/first.js', ready: () => firstReady },
      { source: 'js/second.js', ready: () => true }
    ], { mode: ClassicScriptLoader.LOAD_MODES.SEQUENTIAL });

    await Promise.resolve();
    assert.equal(document.scripts.length, 1);
    firstReady = true;
    document.scripts[0].dispatch('load');
    await loadPromise;
    assert.equal(document.scripts.length, 1);
  });

  it('should wait for an existing script that has not initialized yet', async () => {
    const { document } = createDocument();
    const existingScript = document.createElement('script');
    existingScript.src = 'https://example.com/js/existing.js?v=old';
    document.scripts.push(existingScript);
    const { ClassicScriptLoader } = loadBrowserModule('classic-script-loader', { inject: { document } });
    let ready = false;
    let settled = false;
    const loadPromise = ClassicScriptLoader.load([{
      source: 'js/existing.js',
      ready: () => ready
    }]).then(() => { settled = true; });

    await Promise.resolve();
    assert.equal(settled, false);
    ready = true;
    existingScript.dispatch('load');
    await loadPromise;
    assert.equal(document.scripts.length, 1);
  });

  it('should preserve explicit route dependency insertions without a readiness contract', async () => {
    const { document } = createDocument();
    const existingScript = document.createElement('script');
    existingScript.src = 'https://example.com/js/route.js';
    document.scripts.push(existingScript);
    const { ClassicScriptLoader } = loadBrowserModule('classic-script-loader', { inject: { document } });
    const loadPromise = ClassicScriptLoader.load(['js/route.js'], {
      dataset: source => ({ routeDependency: source })
    });

    assert.equal(document.scripts.length, 2);
    assert.equal(document.scripts[1].dataset.routeDependency, 'js/route.js');
    document.scripts[1].dispatch('load');
    await loadPromise;
  });

  it('should remove failed scripts so a later request can retry', async () => {
    const { document } = createDocument();
    const { ClassicScriptLoader } = loadBrowserModule('classic-script-loader', { inject: { document } });
    const failedLoad = ClassicScriptLoader.load(['js/retry.js']);

    document.scripts[0].dispatch('error');
    await assert.rejects(failedLoad, /Unable to load dependency/);
    assert.equal(document.scripts.length, 0);

    const retryLoad = ClassicScriptLoader.load(['js/retry.js']);
    document.scripts[0].dispatch('load');
    await retryLoad;
  });
});
