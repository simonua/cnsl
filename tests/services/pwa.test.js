const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const pwaSourcePath = path.join(__dirname, '..', '..', 'src', 'js', 'pwa.js');
const pwaSource = fs.readFileSync(pwaSourcePath, 'utf8');
const CURRENT_BUILD_VERSION = '20260609-123456';

function runPwa(context) {
  const document = context.document === null ? undefined : {
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
    SERVICE_WORKER_UPGRADE_FROM_VERSION_STORAGE_KEY: 'cnsl_service_worker_upgrade_from_version',
    APP_VERSION: '2.13.1',
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
  it('should check the deployment marker after registering the current build worker', async () => {
    const fetchCalls = [];
    const registerCalls = [];
    const workerMessages = [];
    const window = createWindow();
    const navigator = {
      serviceWorker: {
        controller: {},
        addEventListener: () => undefined,
        register: async (url, options) => {
          registerCalls.push({ options, url: url.toString() });
          return {
            active: { postMessage: message => workerMessages.push(message) }
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
    assert.equal(registerCalls[0].url, `https://pools.longreachmarlins.org/service-worker.js?v=${CURRENT_BUILD_VERSION}`);
    assert.equal(registerCalls[0].options.updateViaCache, 'none');
    assert.equal(fetchCalls.length, 1);
    assert.equal(fetchCalls[0].url, 'https://pools.longreachmarlins.org/version.txt');
    assert.equal(fetchCalls[0].options.cache, 'no-store');
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

  it('should register a build-specific worker only for a valid different deployment marker', async () => {
    let deployedVersion = 'not-a-build-version';
    const registerCalls = [];
    const navigator = {
      serviceWorker: {
        controller: {},
        addEventListener: () => undefined,
        register: async url => {
          registerCalls.push(url.toString());
          return {};
        }
      }
    };

    runPwa({
      console,
      fetch: async () => new Response(deployedVersion, { status: 200 }),
      navigator,
      window: createWindow()
    });
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(registerCalls, [
      `https://pools.longreachmarlins.org/service-worker.js?v=${CURRENT_BUILD_VERSION}`
    ]);

    deployedVersion = '20260609-123457';
    const nextWindow = createWindow();
    runPwa({
      console,
      fetch: async () => new Response(deployedVersion, { status: 200 }),
      navigator,
      window: nextWindow
    });
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(registerCalls, [
      `https://pools.longreachmarlins.org/service-worker.js?v=${CURRENT_BUILD_VERSION}`,
      `https://pools.longreachmarlins.org/service-worker.js?v=${CURRENT_BUILD_VERSION}`,
      'https://pools.longreachmarlins.org/service-worker.js?v=20260609-123457'
    ]);
  });

  it('should reload from the network when service workers and caches are unavailable', async () => {
    let reloadCalls = 0;
    const window = createWindow({ reload: () => { reloadCalls += 1; } });

    assert.doesNotThrow(() => runPwa({ console, navigator: {}, window }));
    await window.cnslPwa.forceUpdate();

    assert.equal(reloadCalls, 1);
    assert.equal(Object.isFrozen(window.cnslPwa), true);
  });

  it('should force an update without clearing preferences or unrelated caches', async () => {
    const deletedCaches = [];
    const fetchCalls = [];
    let reloadCalls = 0;
    let unregisterCalls = 0;
    const caches = {
      delete: async name => deletedCaches.push(name),
      keys: async () => ['cnsl-static-current', 'unrelated-cache']
    };
    const window = createWindow({ reload: () => { reloadCalls += 1; } });
    window.caches = caches;
    const navigator = {
      serviceWorker: {
        controller: {},
        addEventListener: () => undefined,
        getRegistration: async () => ({ unregister: async () => { unregisterCalls += 1; } }),
        register: async () => ({ update: async () => undefined })
      }
    };

    runPwa({
      caches,
      console,
      fetch: async (url, options) => {
        fetchCalls.push({ options, url: url.toString() });
        return new Response(`${CURRENT_BUILD_VERSION}\n`, { status: 200 });
      },
      navigator,
      window
    });
    await new Promise(resolve => setImmediate(resolve));
    await window.cnslPwa.forceUpdate();

    assert.equal(fetchCalls.length, 2);
    assert.equal(fetchCalls[1].url, 'https://pools.longreachmarlins.org/version.txt');
    assert.equal(fetchCalls[1].options.cache, 'no-store');
    assert.equal(unregisterCalls, 1);
    assert.deepEqual(deletedCaches, ['cnsl-static-current']);
    assert.equal(reloadCalls, 1);
  });

  it('should reload when no service-worker registration controls the page', async () => {
    let reloadCalls = 0;
    const window = createWindow({ reload: () => { reloadCalls += 1; } });
    const navigator = {
      serviceWorker: {
        controller: {},
        addEventListener: () => undefined,
        getRegistration: async () => undefined,
        register: async () => ({ update: async () => undefined })
      }
    };

    runPwa({ console, navigator, window });
    await new Promise(resolve => setImmediate(resolve));
    await window.cnslPwa.forceUpdate();

    assert.equal(reloadCalls, 1);
  });

  it('should preserve the current app when the deployment marker is invalid', async () => {
    let registrationReads = 0;
    let reloadCalls = 0;
    const window = createWindow({ reload: () => { reloadCalls += 1; } });
    const navigator = {
      serviceWorker: {
        controller: {},
        addEventListener: () => undefined,
        getRegistration: async () => { registrationReads += 1; },
        register: async () => ({ update: async () => undefined })
      }
    };

    runPwa({
      console,
      fetch: async () => new Response('not-a-build-version', { status: 200 }),
      navigator,
      window
    });
    await new Promise(resolve => setImmediate(resolve));

    await assert.rejects(window.cnslPwa.forceUpdate());
    assert.equal(registrationReads, 0);
    assert.equal(reloadCalls, 0);
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

  it('should keep the current view until the next navigation after a controller change', async () => {
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

    assert.equal(reloadCalls, 0);
    assert.equal(window.sessionStorage.getItem(window.SERVICE_WORKER_UPGRADE_FROM_VERSION_STORAGE_KEY), window.APP_VERSION);
  });

  it('should keep the current view when the upgrade marker cannot be stored', async () => {
    let controllerChange;
    let reloadCalls = 0;
    const window = createWindow({ reload: () => { reloadCalls += 1; } });
    window.sessionStorage = {
      getItem: () => null,
      setItem: () => { throw new Error('storage blocked'); }
    };
    const navigator = {
      serviceWorker: {
        controller: {},
        addEventListener: (type, listener) => {
          if (type === 'controllerchange') controllerChange = listener;
        },
        register: async () => ({ update: async () => undefined })
      }
    };

    runPwa({ console, navigator, window });
    await new Promise(resolve => setImmediate(resolve));
    controllerChange();

    assert.equal(reloadCalls, 0);
  });

  it('should preserve the rendered footer when an older service worker reports its version', async () => {
    let messageListener;
    const attributes = new Map([['href', 'whats-new.html']]);
    const versionLink = {
      setAttribute: (name, value) => attributes.set(name, value),
      textContent: '2.13.1'
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
    messageListener({ data: { type: 'APP_VERSION', version: '2.13.0' } });

    assert.equal(versionLink.textContent, '2.13.1');
    assert.equal(attributes.get('href'), 'whats-new.html');
  });

  it('should ignore invalid service worker app versions', async () => {
    let messageListener;
    let attributeUpdates = 0;
    const versionLink = {
      setAttribute: () => { attributeUpdates += 1; },
      textContent: '2.13.1'
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

    assert.equal(versionLink.textContent, '2.13.1');
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

  it('should tolerate unavailable session storage and a failed deployment check', async () => {
    const errors = [];
    let pageshowListener;
    const window = createWindow();
    Object.defineProperty(window, 'sessionStorage', {
      configurable: true,
      get: () => { throw new Error('storage blocked'); }
    });
    window.addEventListener = (type, listener) => {
      if (type === 'pageshow') pageshowListener = listener;
    };

    runPwa({
      console: { error: (...args) => errors.push(args) },
      fetch: async () => { throw new Error('network blocked'); },
      navigator: {
        serviceWorker: {
          controller: {},
          addEventListener: () => undefined,
          register: async () => ({ update: async () => undefined })
        }
      },
      window
    });
    await new Promise(resolve => setImmediate(resolve));
    await pageshowListener();

    assert.equal(errors.length, 1);
  });

  it('should retain in-memory debounce state when session storage writes fail', async () => {
    const window = createWindow();
    window.sessionStorage = {
      getItem: () => null,
      setItem: () => { throw new Error('storage blocked'); }
    };

    runPwa({
      console,
      navigator: {
        serviceWorker: {
          controller: {},
          addEventListener: () => undefined,
          register: async () => ({ update: async () => undefined })
        }
      },
      window
    });
    await new Promise(resolve => setImmediate(resolve));
  });

  it('should reuse an in-flight deployment check', async () => {
    let pageshowListener;
    let resolveFetch;
    const window = createWindow();
    window.addEventListener = (type, listener) => {
      if (type === 'pageshow') pageshowListener = listener;
    };

    runPwa({
      console,
      fetch: () => new Promise(resolve => { resolveFetch = resolve; }),
      navigator: {
        serviceWorker: {
          controller: {},
          addEventListener: () => undefined,
          register: async () => ({ update: async () => undefined })
        }
      },
      window
    });
    await new Promise(resolve => setImmediate(resolve));
    const inFlightCheck = pageshowListener();
    resolveFetch(new Response(`${CURRENT_BUILD_VERSION}\n`, { status: 200 }));
    await inFlightCheck;
  });

  it('should skip checks without a valid script version and ignore unsuccessful markers', async () => {
    let fetchCalls = 0;
    const navigator = {
      serviceWorker: {
        controller: {},
        addEventListener: () => undefined,
        register: async () => ({ update: async () => undefined })
      }
    };

    runPwa({ console, document: null, navigator, window: createWindow() });
    runPwa({
      console,
      fetch: async () => {
        fetchCalls += 1;
        return new Response('', { status: 503 });
      },
      navigator,
      window: createWindow()
    });
    await new Promise(resolve => setImmediate(resolve));

    assert.equal(fetchCalls, 1);
  });

  it('should update the rendered footer for either supported worker message', async () => {
    let messageListener;
    const versionLink = { textContent: '' };
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
    messageListener({ data: { type: 'SW_UPDATED', version: '2.13.1' } });
    messageListener({ data: { type: 'OTHER', version: '2.13.1' } });

    assert.equal(versionLink.textContent, '2.13.1');
  });

  it('should ignore valid version messages when the footer is unavailable', async () => {
    const messageListeners = [];
    const navigator = {
      serviceWorker: {
        controller: {},
        addEventListener: (type, listener) => {
          if (type === 'message') messageListeners.push(listener);
        },
        register: async () => ({ update: async () => undefined })
      }
    };

    runPwa({ console, document: null, navigator, window: createWindow() });
    runPwa({ console, document: { getElementById: () => null }, navigator, window: createWindow() });
    await new Promise(resolve => setImmediate(resolve));

    messageListeners.forEach(listener => listener({ data: { type: 'APP_VERSION', version: '2.13.1' } }));
  });
});
