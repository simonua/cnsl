const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const pwaSourcePath = path.join(__dirname, '..', '..', 'src', 'js', 'pwa.js');
const pwaSource = fs.readFileSync(pwaSourcePath, 'utf8');

function runPwa(context) {
  vm.runInNewContext(pwaSource, { URL, Promise, ...context }, { filename: pwaSourcePath });
}

function createWindow(location = {}) {
  return {
    LOCAL_DEVELOPMENT_HOSTNAMES: ['localhost', '127.0.0.1'],
    LOCAL_DEVELOPMENT_PORT: '9090',
    PWA_CACHE_PREFIX: 'cnsl-static-',
    location: {
      href: 'https://pools.longreachmarlins.org/index.html',
      hostname: 'pools.longreachmarlins.org',
      port: '',
      reload: () => undefined,
      ...location
    }
  };
}

describe('PWA update startup', () => {
  it('should request a background worker update on production page startup', async () => {
    const registerCalls = [];
    let updateCalls = 0;
    const window = createWindow();
    const navigator = {
      serviceWorker: {
        controller: {},
        addEventListener: () => undefined,
        register: async (url, options) => {
          registerCalls.push({ options, url: url.toString() });
          return { update: async () => { updateCalls += 1; } };
        }
      }
    };

    runPwa({ console, navigator, window });
    await new Promise(resolve => setImmediate(resolve));

    assert.equal(registerCalls.length, 1);
    assert.equal(registerCalls[0].url, 'https://pools.longreachmarlins.org/service-worker.js');
    assert.equal(registerCalls[0].options.updateViaCache, 'none');
    assert.equal(updateCalls, 1);
  });

  it('should do nothing when service workers are unavailable', () => {
    assert.doesNotThrow(() => runPwa({ console, navigator: {}, window: createWindow() }));
  });

  it('should clear local workers and application caches during development', async () => {
    const deletedCaches = [];
    let unregisterCalls = 0;
    const window = createWindow({ href: 'http://localhost:9090/', hostname: 'localhost', port: '9090' });
    window.caches = {};
    const caches = {
      delete: async name => deletedCaches.push(name),
      keys: async () => ['cnsl-static-old', 'unrelated-cache']
    };
    const navigator = {
      serviceWorker: {
        getRegistrations: async () => [{ unregister: async () => { unregisterCalls += 1; } }]
      }
    };

    runPwa({ caches, console, navigator, window });
    await new Promise(resolve => setImmediate(resolve));

    assert.equal(unregisterCalls, 1);
    assert.deepEqual(deletedCaches, ['cnsl-static-old']);
  });

  it('should report local cleanup failures safely', async () => {
    const errors = [];
    const window = createWindow({ href: 'http://localhost:9090/', hostname: 'localhost', port: '9090' });
    window.caches = {};

    runPwa({
      caches: { keys: async () => { throw new Error('cache blocked'); } },
      console: { error: (...args) => errors.push(args) },
      navigator: { serviceWorker: { getRegistrations: async () => { throw new Error('worker blocked'); } } },
      window
    });
    await new Promise(resolve => setImmediate(resolve));

    assert.equal(errors.length, 2);
  });

  it('should reload once after an active worker controller changes', async () => {
    let controllerChange;
    let reloadCalls = 0;
    const window = createWindow({ reload: () => { reloadCalls += 1; } });
    const navigator = {
      serviceWorker: {
        controller: null,
        addEventListener: (type, listener) => { controllerChange = listener; },
        register: async () => ({ update: async () => undefined })
      }
    };

    runPwa({ console, navigator, window });
    await new Promise(resolve => setImmediate(resolve));
    controllerChange();
    controllerChange();
    controllerChange();

    assert.equal(reloadCalls, 1);
  });

  it('should report worker registration failures safely', async () => {
    const errors = [];
    const navigator = {
      serviceWorker: {
        controller: null,
        addEventListener: () => undefined,
        register: async () => { throw new Error('registration blocked'); }
      }
    };

    runPwa({ console: { error: (...args) => errors.push(args) }, navigator, window: createWindow() });
    await new Promise(resolve => setImmediate(resolve));

    assert.equal(errors.length, 1);
  });
});
