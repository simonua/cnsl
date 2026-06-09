const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { APP_VERSION, LOCAL_DEVELOPMENT_HOSTNAMES, LOCAL_DEVELOPMENT_PORT, PWA_CACHE_PREFIX } = require('../../src/js/config/app-config.js');

const workerSourcePath = path.join(__dirname, '..', '..', 'service-worker.js');
const workerSource = fs.readFileSync(workerSourcePath, 'utf8');
const coreResources = [
  './',
  'index.html',
  'offline.html',
  'css/styles.css',
  'js/navigation.js',
  'manifest.webmanifest'
];

function createWorkerHarness(precacheResources, options = {}) {
  const listeners = {};
  const cacheRecords = new Map();
  const deletedCaches = [];
  const clientMessages = [];
  let skipWaitingCalls = 0;
  let fetchImplementation = async request => new Response(`network:${normalizeUrl(request)}`, { status: 200 });

  function normalizeUrl(request) {
    return typeof request === 'string' ? request : request.url;
  }

  const cache = {
    async add(request) {
      const response = await fetchImplementation(request);
      if (!response.ok) throw new Error(`Unable to cache ${normalizeUrl(request)}`);
      await this.put(request, response);
    },
    async addAll(requests) {
      for (const request of requests) {
        await this.add(request);
      }
    },
    async put(request, response) {
      cacheRecords.set(normalizeUrl(request), response.clone());
    },
    async match(request) {
      const response = cacheRecords.get(normalizeUrl(request));
      return response ? response.clone() : undefined;
    }
  };
  const scope = {
    PRECACHE_RESOURCES: precacheResources,
    PRECACHE_CORE_RESOURCES: options.coreResources || precacheResources,
    PRECACHE_OPTIONAL_RESOURCES: options.optionalResources || [],
    location: new URL(options.location || 'https://pools.longreachmarlins.org/service-worker.js'),
    clients: {
      claim: async () => undefined,
      matchAll: async () => [{ postMessage: message => clientMessages.push(message) }]
    },
    addEventListener(type, listener) {
      listeners[type] = listener;
    },
    async skipWaiting() {
      skipWaitingCalls += 1;
    }
  };
  const context = {
    URL,
    Request,
    Response,
    Promise,
    LOCAL_DEVELOPMENT_HOSTNAMES,
    LOCAL_DEVELOPMENT_PORT,
    PWA_CACHE_PREFIX,
    APP_VERSION,
    self: scope,
    fetch: (request, options) => fetchImplementation(request, options),
    caches: {
      open: async () => cache,
      keys: async () => [`${PWA_CACHE_PREFIX}old`, 'unrelated-cache'],
      delete: async name => {
        deletedCaches.push(name);
        return true;
      }
    },
    importScripts: source => {
      if (options.failPrecacheImport && source.includes('precache-manifest')) throw new Error('No precache inventory');
    },
    console: {
      log: () => undefined,
      warn: () => undefined,
      error: () => undefined
    }
  };

  vm.runInNewContext(workerSource, context, { filename: workerSourcePath });

  async function dispatch(type, request) {
    let resultPromise;
    const event = {
      request,
      ...(type === 'message' ? request : {}),
      waitUntil(promise) {
        resultPromise = promise;
      },
      respondWith(promise) {
        resultPromise = promise;
      }
    };
    listeners[type](event);
    return resultPromise ? resultPromise : undefined;
  }

  return {
    cacheRecords,
    clientMessages,
    deletedCaches,
    dispatch,
    getSkipWaitingCalls: () => skipWaitingCalls,
    getStaticResourceCacheKey: resource => context.createStaticResourceCacheKey(resource),
    setFetchImplementation(implementation) {
      fetchImplementation = implementation;
    }
  };
}

describe('service worker cache strategy', () => {
  it('normalizes unversioned request-like static resources', () => {
    const harness = createWorkerHarness(coreResources);

    assert.match(harness.getStaticResourceCacheKey({ url: 'https://pools.longreachmarlins.org/css/styles.css' }), /styles\.css\?v=development$/);
    assert.match(harness.getStaticResourceCacheKey('css/styles.css?v=current'), /styles\.css\?v=current$/);
  });

  it('should activate without requesting optional resources during installation', async () => {
    let optionalRequests = 0;
    const harness = createWorkerHarness([...coreResources, 'assets/images/optional.png'], {
      coreResources,
      optionalResources: ['assets/images/optional.png']
    });
    harness.setFetchImplementation(async request => {
      const url = typeof request === 'string' ? request : request.url;
      if (url.includes('optional.png')) optionalRequests += 1;
      return new Response(url, { status: 200 });
    });

    await harness.dispatch('install');

    assert.equal(harness.getSkipWaitingCalls(), 1);
    assert.ok([...harness.cacheRecords.keys()].some(url => url.includes('/offline.html?v=development')));
    assert.ok(![...harness.cacheRecords.keys()].some(url => url.includes('optional.png')));
    assert.equal(optionalRequests, 0);
  });

  it('should reject installation when the required offline shell cannot be cached', async () => {
    const harness = createWorkerHarness(coreResources);
    harness.setFetchImplementation(async request => {
      const url = typeof request === 'string' ? request : request.url;
      if (url.includes('/offline.html')) throw new Error('Offline page unavailable');
      return new Response(url, { status: 200 });
    });

    await assert.rejects(() => harness.dispatch('install'), /Offline page unavailable/);
    assert.equal(harness.getSkipWaitingCalls(), 0);
  });

  it('should serve the offline page when uncached navigation fails', async () => {
    const harness = createWorkerHarness(coreResources);
    await harness.dispatch('install');
    harness.setFetchImplementation(async () => { throw new Error('Offline'); });

    const response = await harness.dispatch('fetch', {
      method: 'GET',
      mode: 'navigate',
      url: 'https://pools.longreachmarlins.org/not-cached.html'
    });

    assert.match(await response.text(), /offline\.html\?v=development/);
  });

  it('should serve cached annual data when its network request fails', async () => {
    const dataPath = 'assets/data/2026/pools/pools.json';
    const harness = createWorkerHarness([...coreResources, dataPath]);
    await harness.dispatch('install');
    harness.setFetchImplementation(async () => { throw new Error('Offline'); });

    const response = await harness.dispatch('fetch', {
      method: 'GET',
      mode: 'cors',
      url: `https://pools.longreachmarlins.org/${dataPath}`
    });

    assert.equal(response.status, 200);
    assert.match(await response.text(), /pools\.json\?v=development/);
  });

  it('should retry the cache when annual data becomes available after a network failure', async () => {
    const dataPath = 'assets/data/2026/pools/pools.json';
    const dataUrl = `https://pools.longreachmarlins.org/${dataPath}`;
    const harness = createWorkerHarness(coreResources);
    harness.setFetchImplementation(async () => {
      harness.cacheRecords.set(`${dataUrl}?v=development`, new Response('late cached data', { status: 200 }));
      throw new Error('Offline');
    });

    const response = await harness.dispatch('fetch', { method: 'GET', mode: 'cors', url: dataUrl });

    assert.equal(await response.text(), 'late cached data');
  });

  it('should serve precached navigation and annual data without waiting for the network', async () => {
    const directoryNames = ['pools', 'teams', 'meets'];
    const directoryResources = directoryNames.flatMap(name => [
      `${name}.html`,
      `assets/data/2026/${name}/${name}.json`
    ]);
    const harness = createWorkerHarness([...coreResources, ...directoryResources]);
    await harness.dispatch('install');
    let networkRequests = 0;
    harness.setFetchImplementation(async () => {
      networkRequests += 1;
      return new Response('unexpected network response', { status: 200 });
    });

    for (const name of directoryNames) {
      const navigationResponse = await harness.dispatch('fetch', {
        method: 'GET',
        mode: 'navigate',
        url: `https://pools.longreachmarlins.org/${name}.html`
      });
      const dataResponse = await harness.dispatch('fetch', {
        method: 'GET',
        mode: 'cors',
        url: `https://pools.longreachmarlins.org/assets/data/2026/${name}/${name}.json`
      });

      assert.match(await navigationResponse.text(), new RegExp(`${name}\\.html\\?v=development`));
      assert.match(await dataResponse.text(), new RegExp(`${name}\\.json\\?v=development`));
    }
    assert.equal(networkRequests, 0);
  });

  it('should fetch a newer explicitly versioned static resource while an older worker controls the page', async () => {
    const resourcePath = 'js/home-schedule.js';
    const harness = createWorkerHarness([...coreResources, resourcePath]);
    await harness.dispatch('install');

    const requestedUrl = `https://pools.longreachmarlins.org/${resourcePath}?v=next-build`;
    harness.setFetchImplementation(async request => new Response(`fresh:${request.url}`, { status: 200 }));

    const response = await harness.dispatch('fetch', {
      method: 'GET',
      mode: 'cors',
      url: requestedUrl
    });

    assert.equal(await response.text(), `fresh:${requestedUrl}`);
  });

  it('should delete obsolete versioned caches during activation', async () => {
    const harness = createWorkerHarness(coreResources);

    await harness.dispatch('activate');

    assert.deepEqual(harness.deletedCaches, [`${PWA_CACHE_PREFIX}old`]);
    assert.equal(harness.clientMessages.length, 1);
    assert.equal(harness.clientMessages[0].type, 'SW_UPDATED');
    assert.equal(harness.clientMessages[0].version, APP_VERSION);
  });

  it('should report the semantic app version to a requesting client', async () => {
    const harness = createWorkerHarness(coreResources);
    const messages = [];

    await harness.dispatch('message', {
      data: { type: 'GET_APP_VERSION' },
      source: { postMessage: message => messages.push(message) }
    });

    assert.equal(messages.length, 1);
    assert.equal(messages[0].type, 'APP_VERSION');
    assert.equal(messages[0].version, APP_VERSION);
  });

  it('should use the minimum shell if the generated precache inventory is unavailable', async () => {
    const harness = createWorkerHarness(undefined, { failPrecacheImport: true });
    await harness.dispatch('install');
    assert.equal(harness.getSkipWaitingCalls(), 1);
    assert.ok([...harness.cacheRecords.keys()].some(url => url.includes('/offline.html?v=development')));
  });

  it('should bypass caching for local development requests and report failures safely', async () => {
    const harness = createWorkerHarness(coreResources, { location: 'http://localhost:9090/service-worker.js' });
    await harness.dispatch('install');
    assert.equal(harness.getSkipWaitingCalls(), 1);
    harness.setFetchImplementation(async () => new Response('fresh', { status: 200 }));
    const response = await harness.dispatch('fetch', { method: 'GET', headers: {}, mode: 'cors', url: 'http://localhost:9090/index.html' });
    assert.equal(await response.text(), 'fresh');
    harness.setFetchImplementation(async () => { throw new Error('Offline'); });
    const failedResponse = await harness.dispatch('fetch', { method: 'GET', headers: {}, mode: 'cors', url: 'http://localhost:9090/index.html' });
    assert.equal(failedResponse.status, 500);
  });

  it('should ignore cross-origin requests and fetch non-GET same-origin requests directly', async () => {
    const harness = createWorkerHarness(coreResources);
    assert.equal(await harness.dispatch('fetch', { method: 'GET', mode: 'cors', url: 'https://example.com/file.js' }), undefined);
    harness.setFetchImplementation(async () => new Response('posted', { status: 200 }));
    const response = await harness.dispatch('fetch', { method: 'POST', mode: 'cors', url: 'https://pools.longreachmarlins.org/api' });
    assert.equal(await response.text(), 'posted');
  });

  it('should update successful navigation and data responses and preserve unsuccessful network responses', async () => {
    const harness = createWorkerHarness(coreResources);
    harness.setFetchImplementation(async request => new Response(`fresh:${request.url || request}`, { status: 200 }));
    const navigation = await harness.dispatch('fetch', { method: 'GET', mode: 'navigate', url: 'https://pools.longreachmarlins.org/new.html' });
    assert.match(await navigation.text(), /new\.html/);
    const data = await harness.dispatch('fetch', { method: 'GET', mode: 'cors', url: 'https://pools.longreachmarlins.org/assets/data/2026/pools/pools.json' });
    assert.match(await data.text(), /pools\.json/);
    harness.setFetchImplementation(async () => new Response('not found', { status: 404 }));
    const missing = await harness.dispatch('fetch', { method: 'GET', mode: 'navigate', url: 'https://pools.longreachmarlins.org/missing.html' });
    assert.equal(missing.status, 404);
    const missingData = await harness.dispatch('fetch', { method: 'GET', mode: 'cors', url: 'https://pools.longreachmarlins.org/assets/data/2026/pools/missing.json' });
    assert.equal(missingData.status, 404);
  });

  it('should return an offline JSON response when data is unavailable from both network and cache', async () => {
    const harness = createWorkerHarness(coreResources);
    harness.setFetchImplementation(async () => { throw new Error('Offline'); });
    const response = await harness.dispatch('fetch', { method: 'GET', mode: 'cors', url: 'https://pools.longreachmarlins.org/assets/data/2026/pools/missing.json' });
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: 'Data unavailable while offline.' });
  });

  it('should use cached static resources and return a clear offline response when a static fetch fails', async () => {
    const resourcePath = 'js/navigation.js';
    const harness = createWorkerHarness([...coreResources, resourcePath]);
    await harness.dispatch('install');
    const cached = await harness.dispatch('fetch', { method: 'GET', mode: 'cors', url: `https://pools.longreachmarlins.org/${resourcePath}` });
    assert.match(await cached.text(), /navigation\.js\?v=development/);
    harness.setFetchImplementation(async () => { throw new Error('Offline'); });
    const unavailable = await harness.dispatch('fetch', { method: 'GET', mode: 'cors', url: 'https://pools.longreachmarlins.org/new-resource.js' });
    assert.equal(unavailable.status, 503);
  });

  it('should cache basic static network responses and accept skip-waiting messages', async () => {
    const harness = createWorkerHarness(coreResources);
    harness.setFetchImplementation(async request => {
      const response = new Response(`network:${request.url}`, { status: 200 });
      Object.defineProperty(response, 'type', { value: 'basic' });
      return response;
    });
    const response = await harness.dispatch('fetch', { method: 'GET', mode: 'cors', url: 'https://pools.longreachmarlins.org/new-resource.js' });
    assert.match(await response.text(), /new-resource\.js/);
    await harness.dispatch('message', { data: { type: 'SKIP_WAITING' } });
    assert.equal(harness.getSkipWaitingCalls(), 1);
  });
});
