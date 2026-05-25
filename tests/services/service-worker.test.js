const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const workerSource = fs.readFileSync(path.join(__dirname, '..', '..', 'service-worker.js'), 'utf8');
const coreResources = [
  './',
  'index.html',
  'offline.html',
  'css/styles.css',
  'js/navigation.js',
  'manifest.webmanifest'
];

function createWorkerHarness(precacheResources) {
  const listeners = {};
  const cacheRecords = new Map();
  const deletedCaches = [];
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
    location: new URL('https://pools.longreachmarlins.org/service-worker.js'),
    clients: {
      claim: async () => undefined,
      matchAll: async () => []
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
    self: scope,
    fetch: request => fetchImplementation(request),
    caches: {
      open: async () => cache,
      keys: async () => ['cnsl-static-old', 'unrelated-cache'],
      delete: async name => {
        deletedCaches.push(name);
        return true;
      }
    },
    importScripts: () => undefined,
    console: {
      log: () => undefined,
      warn: () => undefined,
      error: () => undefined
    }
  };

  vm.runInNewContext(workerSource, context);

  async function dispatch(type, request) {
    let resultPromise;
    const event = {
      request,
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
    deletedCaches,
    dispatch,
    getSkipWaitingCalls: () => skipWaitingCalls,
    setFetchImplementation(implementation) {
      fetchImplementation = implementation;
    }
  };
}

describe('service worker cache strategy', () => {
  it('should activate after caching the required shell when an optional resource cannot be cached', async () => {
    const harness = createWorkerHarness([...coreResources, 'assets/images/optional.png']);
    harness.setFetchImplementation(async request => {
      const url = typeof request === 'string' ? request : request.url;
      if (url.includes('optional.png')) throw new Error('Optional resource unavailable');
      return new Response(url, { status: 200 });
    });

    await harness.dispatch('install');

    assert.equal(harness.getSkipWaitingCalls(), 1);
    assert.ok([...harness.cacheRecords.keys()].some(url => url.includes('/offline.html?v=development')));
    assert.ok(![...harness.cacheRecords.keys()].some(url => url.includes('optional.png')));
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

  it('should delete obsolete versioned caches during activation', async () => {
    const harness = createWorkerHarness(coreResources);

    await harness.dispatch('activate');

    assert.deepEqual(harness.deletedCaches, ['cnsl-static-old']);
  });
});
