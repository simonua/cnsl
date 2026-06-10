const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const pwaSourcePath = path.join(__dirname, '..', '..', 'src', 'js', 'pwa.js');
const pwaSource = fs.readFileSync(pwaSourcePath, 'utf8');
const CURRENT_BUILD_VERSION = '20260609-123456';

function runPwa(context) {
  const document = {
    currentScript: { src: `https://pools.longreachmarlins.org/js/pwa.js?v=${CURRENT_BUILD_VERSION}` },
    ...context.document
  };
  const fetch = context.fetch || (async () => new Response(`${CURRENT_BUILD_VERSION}\n`, { status: 200 }));
  vm.runInNewContext(pwaSource, { URL, Promise, Response, ...context, document, fetch }, { filename: pwaSourcePath });
}

function createWindow(location = {}) {
  const sessionValues = new Map();
  return {
    LOCAL_DEVELOPMENT_HOSTNAMES: ['localhost', '127.0.0.1'],
    LOCAL_DEVELOPMENT_PORT: '9090',
    DEPLOYMENT_VERSION_FILE: 'version.txt',
    PWA_CACHE_PREFIX: 'cnsl-static-',
    SERVICE_WORKER_UPDATE_CHECKED_AT_STORAGE_KEY: 'cnsl_service_worker_update_checked_at',
    location: {
      href: 'https://pools.longreachmarlins.org/index.html',
      hostname: 'pools.longreachmarlins.org',
      port: '',
      reload: () => undefined,
      ...location
    },
    addEventListener: () => undefined,
    sessionStorage: {
      getItem: key => sessionValues.get(key) ?? null,
      setItem: (key, value) => sessionValues.set(key, value)
    }
  };
}

describe('PWA update startup', () => {
  it('should check the deployment marker without updating a current worker', async () => {
    const fetchCalls = [];
    const registerCalls = [];
    const workerMessages = [];
    let updateCalls = 0;
    const window = createWindow();
    const navigator = {
      serviceWorker: {
        controller: {},
        addEventListener: () => undefined,
        register: async (url, options) => {
          registerCalls.push({ options, url: url.toString() });
          return {
            active: { postMessage: message => workerMessages.push(message) },
            update: async () => { updateCalls += 1; }
          };
        }
      }
    };

    runPwa({
      console,
      fetch: async (url, options) => {
        fetchCalls.push({ options, url: url.toString() });
        return new Response(`${CURRENT_BUILD_VERSION}\n`, { status: 200 });
      },
      navigator,
      window
    });
    await new Promise(resolve => setImmediate(resolve));

    assert.equal(registerCalls.length, 1);
    assert.equal(registerCalls[0].url, 'https://pools.longreachmarlins.org/service-worker.js');
    assert.equal(registerCalls[0].options.updateViaCache, 'none');
    assert.equal(fetchCalls.length, 1);
    assert.equal(fetchCalls[0].url, 'https://pools.longreachmarlins.org/version.txt');
    assert.equal(fetchCalls[0].options.cache, 'no-store');
    assert.equal(updateCalls, 0);
    assert.equal(workerMessages.length, 1);
    assert.equal(workerMessages[0].type, 'GET_APP_VERSION');
  });

  it('should limit update checks to once per minute across page navigation', async () => {
    const sharedSessionValues = new Map();
    let currentTime = 1_000_000;
    let markerFetchCalls = 0;
    const sessionStorage = {
      getItem: key => sharedSessionValues.get(key) ?? null,
      setItem: (key, value) => sharedSessionValues.set(key, value)
    };
    const navigate = async () => {
      const window = createWindow();
      window.sessionStorage = sessionStorage;
      runPwa({
        Date: { now: () => currentTime },
        console,
        fetch: async () => {
          markerFetchCalls += 1;
          return new Response(`${CURRENT_BUILD_VERSION}\n`, { status: 200 });
        },
        navigator: {
          serviceWorker: {
            controller: {},
            addEventListener: () => undefined,
            register: async () => ({
              update: async () => undefined
            })
          }
        },
        window
      });
      await new Promise(resolve => setImmediate(resolve));
    };

    await navigate();
    assert.equal(markerFetchCalls, 1);

    currentTime += 30_000;
    await navigate();
    assert.equal(markerFetchCalls, 1);

    currentTime += 30_000;
    await navigate();
    assert.equal(markerFetchCalls, 2);
  });

  it('should update the worker only for a valid different deployment marker', async () => {
    let deployedVersion = 'not-a-build-version';
    let updateCalls = 0;
    const navigator = {
      serviceWorker: {
        controller: {},
        addEventListener: () => undefined,
        register: async () => ({
          update: async () => { updateCalls += 1; }
        })
      }
    };

    runPwa({
      console,
      fetch: async () => new Response(deployedVersion, { status: 200 }),
      navigator,
      window: createWindow()
    });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(updateCalls, 0);

    deployedVersion = '20260609-123457';
    const nextWindow = createWindow();
    runPwa({
      console,
      fetch: async () => new Response(deployedVersion, { status: 200 }),
      navigator,
      window: nextWindow
    });
    await new Promise(resolve => setImmediate(resolve));
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
        addEventListener: (type, listener) => {
          if (type === 'controllerchange') controllerChange = listener;
        },
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

  it('should update the footer from a valid service worker app version', async () => {
    let messageListener;
    const attributes = new Map([['href', 'whats-new.html#version-2.10.0']]);
    const versionLink = {
      setAttribute: (name, value) => attributes.set(name, value),
      textContent: '2.10.0'
    };
    const navigator = {
      serviceWorker: {
        controller: {},
        addEventListener: (type, listener) => {
          if (type === 'message') messageListener = listener;
        },
        register: async () => ({ update: async () => undefined })
      }
    };

    runPwa({
      console,
      document: { getElementById: id => id === 'footerAppVersion' ? versionLink : null },
      navigator,
      window: createWindow()
    });
    await new Promise(resolve => setImmediate(resolve));
    messageListener({ data: { type: 'SW_UPDATED', version: '2.11.0' } });

    assert.equal(versionLink.textContent, '2.11.0');
    assert.equal(attributes.get('href'), 'whats-new.html#version-2.11.0');
  });

  it('should ignore invalid service worker app versions', async () => {
    let messageListener;
    let attributeUpdates = 0;
    const versionLink = {
      setAttribute: () => { attributeUpdates += 1; },
      textContent: '2.10.0'
    };
    const navigator = {
      serviceWorker: {
        controller: {},
        addEventListener: (type, listener) => {
          if (type === 'message') messageListener = listener;
        },
        register: async () => ({ update: async () => undefined })
      }
    };

    runPwa({
      console,
      document: { getElementById: () => versionLink },
      navigator,
      window: createWindow()
    });
    await new Promise(resolve => setImmediate(resolve));
    messageListener({ data: { type: 'APP_VERSION', version: 'javascript:alert(1)' } });

    assert.equal(versionLink.textContent, '2.10.0');
    assert.equal(attributeUpdates, 0);
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
