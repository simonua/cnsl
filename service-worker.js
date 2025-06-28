// Cache version - updated with each build
const CACHE_VERSION = new Date().toISOString().split('T')[0].replace(/-/g, '');
const CACHE_NAME = `cnsl-static-${CACHE_VERSION}`;

// Check if running in development mode (localhost or port 9090)
const isDevelopment = self.location.hostname === 'localhost' || 
                      self.location.hostname === '127.0.0.1' ||
                      self.location.port === '9090';

// Resources to cache
const STATIC_RESOURCES = [
  "/",
  "/index.html",
  "/pools.html",
  "/teams.html",
  "/meets.html",
  "/faq.html",
  "/css/styles.css",
  "/js/copilot.js",
  "/js/navigation.js",
  "/js/services/speech.js",
  "/js/pool-browser.js",
  "/js/teams-browser.js",
  "/js/meets-browser.js",
  "/js/services/data-manager.js",
  "/js/services/file-helper.js",
  "/js/services/time-utils.js",
  "/js/services/cache-service.js",
  "/js/services/weather-service.js",
  "/js/services/search-engine.js",
  "/js/config/weather-config.js",
  "/js/types/pool-enums.js",
  "/js/models/pool.js",
  "/js/pools-manager.js",
  "/js/teams-manager.js",
  "/js/meets-manager.js",
  "/js/pool-schedule.js",
  "/assets/data/teams.json",
  "/assets/data/pools.json",
  "/assets/data/meets.json",
  "/assets/images/cnsl-logo.jpg",
  "/assets/images/cnsl-logo-230x230.jpg",
  "/assets/images/logos/logo-lrm.png",
  "/assets/favicons/android-chrome-192x192.png",
  "/assets/favicons/android-chrome-512x512.png",
  "/assets/favicons/apple-touch-icon.png",
  "/assets/favicons/favicon-32x32.png",
  "/assets/favicons/favicon-16x16.png",
  "/assets/favicons/favicon.ico",
  "/manifest.webmanifest"
];

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
      .then(cache => {
        console.log(`Creating cache: ${CACHE_NAME}`);
        return cache.addAll(STATIC_RESOURCES);
      })
      .then(() => {
        console.log(`Cache ${CACHE_NAME} created successfully`);
        // Force the new service worker to activate immediately
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('Cache creation failed:', error);
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
            .filter(name => name.startsWith('cnsl-static-') && name !== CACHE_NAME)
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
  // Skip cache in development mode - always fetch fresh
  if (isDevelopment) {
    event.respondWith(
      fetch(event.request)
        .catch(error => {
          console.error('Development fetch failed:', error);
          return new Response('Development mode - fetch failed', { status: 500 });
        })
    );
    return;
  }

  // For production, use cache-first strategy with network fallback
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          // Found in cache, but also check for updates in background
          fetch(event.request)
            .then(fetchResponse => {
              if (fetchResponse && fetchResponse.status === 200) {
                const responseClone = fetchResponse.clone();
                caches.open(CACHE_NAME).then(cache => {
                  cache.put(event.request, responseClone);
                });
              }
            })
            .catch(() => {
              // Network failed, but we have cache - that's fine
            });
          
          return response;
        }
        
        // Not in cache, fetch from network
        return fetch(event.request)
          .then(response => {
            // Only cache successful responses
            if (response && response.status === 200 && response.type === 'basic') {
              const responseClone = response.clone();
              caches.open(CACHE_NAME).then(cache => {
                cache.put(event.request, responseClone);
              });
            }
            return response;
          })
          .catch(error => {
            console.error('Fetch failed:', error);
            return new Response('Network error occurred', { 
              status: 408,
              statusText: 'Network error'
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
