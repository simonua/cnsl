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
const OFFLINE_PAGE = 'offline.html';

// Check if running in development mode (localhost or port 9090)
const isDevelopment = LOCAL_DEVELOPMENT_HOSTNAMES.includes(self.location.hostname)
                      || self.location.port === LOCAL_DEVELOPMENT_PORT
                      || LOCAL_DEVELOPMENT_HOSTNAMES.some(hostname => self.location.href.includes(hostname));

const MINIMUM_OFFLINE_RESOURCES = [
  './',
  'index.html',
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

const CORE_RESOURCES = MINIMUM_OFFLINE_RESOURCES.map(createVersionedUrl);
const STATIC_RESOURCES = [...new Set((self.PRECACHE_RESOURCES || MINIMUM_OFFLINE_RESOURCES).map(createVersionedUrl))];

async function cacheOptionalResources(cache) {
  const coreResources = new Set(CORE_RESOURCES);
  const optionalResources = STATIC_RESOURCES.filter(resource => !coreResources.has(resource));
  const failedResources = (await Promise.all(optionalResources.map(async resource => {
    try {
      await cache.add(resource);
      return null;
    } catch (_error) {
      return resource;
    }
  }))).filter(Boolean);

  if (failedResources.length > 0) {
    console.warn(`Unable to precache ${failedResources.length} optional resource(s). They remain available online.`);
  }
}

async function findOfflineNavigationResponse(request) {
  const cache = await caches.open(CACHE_NAME);
  const requestUrl = new URL(request.url);
  const exactMatch = await cache.match(createVersionedUrl(requestUrl.toString()));
  if (exactMatch) return exactMatch;
  requestUrl.search = '';
  return (await cache.match(createVersionedUrl(requestUrl.toString())))
    || cache.match(createVersionedUrl(OFFLINE_PAGE));
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
        await cache.addAll(CORE_RESOURCES);
        await cacheOptionalResources(cache);
      })
      .then(() => {
        console.log(`Cache ${CACHE_NAME} created successfully`);
        // Force the new service worker to activate immediately
        return self.skipWaiting();
      })
      .catch(error => {
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
      // Notify all clients to reload for updates
      return self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: 'SW_UPDATED',
            version: CACHE_VERSION
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

  // Only handle GET requests for caching
  if (event.request.method !== 'GET') {
    event.respondWith(fetch(event.request));
    return;
  }

  // Check if this is a data file (JSON) - use network-first for data files for faster updates
  const isDataFile = requestUrl.pathname.includes('/assets/data/') && requestUrl.pathname.endsWith('.json');
  const isNavigationRequest = event.request.mode === 'navigate';

  if (isNavigationRequest) {
    event.respondWith(
      fetch(event.request, { cache: 'no-cache' })
        .then(response => {
          if (response && response.status === 200) {
            const responseClone = response.clone();
            return caches.open(CACHE_NAME)
              .then(cache => cache.put(createVersionedUrl(event.request), responseClone))
              .then(() => response);
          }
          return response;
        })
        .catch(() => findOfflineNavigationResponse(event.request))
    );
    return;
  }
  
  if (isDataFile) {
    const cacheRequest = createVersionedUrl(event.request);

    // Network-first strategy for JSON data files
    event.respondWith(
      fetch(event.request, { cache: 'no-cache' })
        .then(response => {
          if (response && response.status === 200) {
            const responseClone = response.clone();
            return caches.open(CACHE_NAME)
              .then(cache => cache.put(cacheRequest, responseClone))
              .then(() => response);
          }
          return response;
        })
        .catch(error => {
          // Network failed, try cache
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

  // Versioned static resources stay cache-first until a new worker installs a new cache.
  event.respondWith(
    caches.open(CACHE_NAME).then(cache => cache.match(createVersionedUrl(event.request))
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
                .then(cache => cache.put(createVersionedUrl(event.request), responseClone))
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
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
