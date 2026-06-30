// Cache version - replaced with the build identifier in generated output.
const CACHE_VERSION = 'development';
const APP_BASE_URL = new URL('./', self.location.href);
importScripts(new URL(`js/config/app-config.js?v=${CACHE_VERSION}`, APP_BASE_URL).toString());
try {
  importScripts(new URL(`precache-manifest.js?v=${CACHE_VERSION}`, APP_BASE_URL).toString());
} catch (error) {
  console.warn('Precache inventory is unavailable; caching the minimum offline shell.', error);
}

const CACHE_NAME = `${PWA_CACHE_PREFIX}${CACHE_VERSION}`;
const HOME_DOCUMENT_RESOURCE = 'index.html';
const HOME_NAVIGATION_ALIAS = './';
const OFFLINE_PAGE = 'offline.html';
const DEPLOYMENT_VERSION_URL = new URL(globalThis.DEPLOYMENT_VERSION_FILE, APP_BASE_URL);

// Check if running in development mode.
const isDevelopment = LOCAL_DEVELOPMENT_HOSTNAMES.includes(self.location.hostname)
                      || self.location.port === LOCAL_DEVELOPMENT_PORT
                      || LOCAL_DEVELOPMENT_HOSTNAMES.some(hostname => self.location.href.includes(hostname));

const MINIMUM_OFFLINE_RESOURCES = [
  HOME_DOCUMENT_RESOURCE,
  OFFLINE_PAGE,
  'css/styles.css',
  'js/navigation.js',
  'manifest.webmanifest'
];

function createVersionedUrl(resource) {
  const url = new URL(typeof resource === 'string' ? resource : resource.url, APP_BASE_URL);
  url.searchParams.set('v', CACHE_VERSION);
  return url.toString();
}

function createStaticResourceCacheKey(resource) {
  const url = new URL(typeof resource === 'string' ? resource : resource.url, APP_BASE_URL);
  return url.searchParams.has('v') ? url.toString() : createVersionedUrl(url.toString());
}

const PRECACHE_CORE_RESOURCES = self.PRECACHE_CORE_RESOURCES || MINIMUM_OFFLINE_RESOURCES;
const CORE_RESOURCES = [...new Set(PRECACHE_CORE_RESOURCES.map(createVersionedUrl))];

/**
 * Cache every required artifact and add the Home navigation alias without another fetch.
 * @param {Cache} cache - Versioned application cache
 * @returns {Promise<void>} Promise settled after required resources and the alias are cached
 */
async function cacheRequiredResources(cache) {
  await cache.addAll(CORE_RESOURCES);
  const homeResponse = await cache.match(createVersionedUrl(HOME_DOCUMENT_RESOURCE));
  if (!homeResponse) throw new Error('The required Home document was not cached.');
  await cache.put(createVersionedUrl(HOME_NAVIGATION_ALIAS), homeResponse);
}

async function findCachedNavigationResponse(request) {
  const cache = await caches.open(CACHE_NAME);
  const requestUrl = new URL(request.url);
  const exactMatch = await cache.match(createVersionedUrl(requestUrl.toString()));
  if (exactMatch) return exactMatch;
  requestUrl.search = '';
  return cache.match(createVersionedUrl(requestUrl.toString()));
}

async function findOfflineNavigationResponse(request) {
  return (await findCachedNavigationResponse(request))
    || caches.open(CACHE_NAME).then(cache => cache.match(createVersionedUrl(OFFLINE_PAGE)));
}

self.addEventListener("install", event => {
  console.log(`Service Worker installing - Cache Version: ${CACHE_VERSION}`);

  // Skip caching in development mode
  if (isDevelopment) {
    console.log('Development mode detected: Skipping cache, activating immediately');
    self.skipWaiting();
    return;
  }

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(async cache => {
        console.log(`Creating cache: ${CACHE_NAME}`);
        await cacheRequiredResources(cache);
      })
      .then(() => {
        console.log(`Cache ${CACHE_NAME} created successfully`);
        // Force the new service worker to activate immediately
        return self.skipWaiting();
      })
      .catch(async error => {
        await caches.delete(CACHE_NAME);
        console.error('Cache creation failed:', error);
        throw error;
      })
  );
});

self.addEventListener("activate", event => {
  console.log(`Service Worker activating - Cache Version: ${CACHE_VERSION}`);

  event.waitUntil(
    Promise.all([
      // Take control of all clients immediately
      self.clients.claim(),
      // Clean up old caches
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames
            .filter(name => name.startsWith(PWA_CACHE_PREFIX) && name !== CACHE_NAME)
            .map(name => {
              console.log(`Deleting old cache: ${name}`);
              return caches.delete(name);
            })
        );
      })
    ]).then(() => {
      console.log(`Service Worker activated - Cache Version: ${CACHE_VERSION}`);
      // Notify clients that the updated worker is active.
      return self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: globalThis.SERVICE_WORKER_MESSAGE_TYPES.UPDATED,
            version: globalThis.APP_VERSION
          });
        });
      });
    })
  );
});

self.addEventListener("fetch", event => {
  // Check if this request is to localhost/development
  const requestUrl = new URL(event.request.url);
  const isLocalRequest = LOCAL_DEVELOPMENT_HOSTNAMES.includes(requestUrl.hostname)
                         || requestUrl.port === LOCAL_DEVELOPMENT_PORT
                         || LOCAL_DEVELOPMENT_HOSTNAMES.some(hostname => requestUrl.href.includes(hostname));

  // Skip cache in development mode or for local requests - always fetch fresh
  if (isDevelopment || isLocalRequest) {
    event.respondWith(
      fetch(event.request, {
        cache: 'no-store', // Force no caching
        headers: {
          ...event.request.headers,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      })
        .catch(error => {
          console.error('Development fetch failed:', error);
          return new Response('Development mode - fetch failed', { status: 500 });
        })
    );
    return;
  }

  if (requestUrl.origin !== APP_BASE_URL.origin) {
    return;
  }

  if (requestUrl.pathname === DEPLOYMENT_VERSION_URL.pathname) {
    event.respondWith(fetch(event.request, { cache: 'no-store' }));
    return;
  }

  // Only handle GET requests for caching
  if (event.request.method !== 'GET') {
    event.respondWith(fetch(event.request));
    return;
  }

  // Annual data stays coherent with the versioned application build and updates with the next worker.
  const isDataFile = requestUrl.pathname.includes('/assets/data/') && requestUrl.pathname.endsWith('.json');
  const isNavigationRequest = event.request.mode === 'navigate';

  if (isNavigationRequest) {
    event.respondWith(
      findCachedNavigationResponse(event.request)
        .then(cachedResponse => cachedResponse || fetch(event.request, { cache: 'no-cache' })
          .then(response => {
            if (response && response.status === 200) {
              const responseClone = response.clone();
              return caches.open(CACHE_NAME)
                .then(cache => cache.put(createVersionedUrl(event.request), responseClone))
                .then(() => response);
            }
            return response;
          }))
        .catch(() => findOfflineNavigationResponse(event.request))
    );
    return;
  }

  if (isDataFile) {
    const cacheRequest = createVersionedUrl(event.request);

    event.respondWith(
      caches.open(CACHE_NAME).then(cache => cache.match(cacheRequest))
        .then(cachedResponse => cachedResponse || fetch(event.request, { cache: 'no-cache' })
          .then(response => {
            if (response && response.status === 200) {
              const responseClone = response.clone();
              return caches.open(CACHE_NAME)
                .then(cache => cache.put(cacheRequest, responseClone))
                .then(() => response);
            }
            return response;
          }))
        .catch(error => {
          return caches.open(CACHE_NAME).then(cache => cache.match(cacheRequest))
            .then(cachedResponse => {
              if (cachedResponse) {
                console.log('Network failed for data file, serving from cache:', event.request.url);
                return cachedResponse;
              }
              console.error('Both network and cache failed for data file:', error);
              return new Response(JSON.stringify({ error: 'Data unavailable while offline.' }), {
                headers: { 'Content-Type': 'application/json' },
                status: 503,
                statusText: 'Offline'
              });
            });
        })
    );
    return;
  }

  // Preserve an explicitly requested build version while a previous worker still controls a page.
  const staticResourceCacheKey = createStaticResourceCacheKey(event.request);
  event.respondWith(
    caches.open(CACHE_NAME).then(cache => cache.match(staticResourceCacheKey)
      .then(response => response || cache.match(event.request)))
      .then(response => {
        if (response) {
          return response;
        }

        // Not in cache, fetch from network
        return fetch(event.request)
          .then(response => {
            // Only cache successful responses
            if (response && response.status === 200 && response.type === 'basic') {
              const responseClone = response.clone();
              return caches.open(CACHE_NAME)
                .then(cache => cache.put(staticResourceCacheKey, responseClone))
                .then(() => response);
            }
            return response;
          })
          .catch(error => {
            console.error('Fetch failed:', error);
            return new Response('This resource is unavailable while offline.', {
              status: 503,
              statusText: 'Offline'
            });
          });
      })
  );
});

// Handle messages from clients
self.addEventListener('message', event => {
  if (event.data && event.data.type === globalThis.SERVICE_WORKER_MESSAGE_TYPES.VERSION_REQUEST && event.source) {
    event.source.postMessage({
      type: globalThis.SERVICE_WORKER_MESSAGE_TYPES.VERSION_RESPONSE,
      version: globalThis.APP_VERSION
    });
  }
});
