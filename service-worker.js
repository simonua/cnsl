// Cache version - updated with each build
const CACHE_VERSION = new Date().toISOString().split('T')[0].replace(/-/g, '');
const CACHE_NAME = `copilot-static-${CACHE_VERSION}`;

// Check if running in development mode (localhost or port 9090)
const isDevelopment = self.location.hostname === 'localhost' || 
                      self.location.hostname === '127.0.0.1' ||
                      self.location.port === '9090';

self.addEventListener("install", event => {
  // Skip caching in development mode
  if (isDevelopment) {
    console.log('Development mode detected: Skipping cache');
    return;
  }

  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      cache.addAll([
        "/",
        "/index.html",
        "/pools.html",
        "/css/styles.css",
        "/js/copilot.js",
        "/js/navigation.js",
        "/js/speech.js",
        "/js/pool-browser.js",
        "/assets/data/teams.json",
        "/assets/data/pools.json",
        "/assets/images/cnsl-logo.jpg",
        "/manifest.webmanifest"
      ])
      .then(() => {
        console.log(`Cache ${CACHE_NAME} created successfully`);
        // Delete old caches
        return caches.keys().then(cacheNames => {
          return Promise.all(
            cacheNames
              .filter(name => name.startsWith('copilot-static-') && name !== CACHE_NAME)
              .map(name => {
                console.log(`Deleting old cache: ${name}`);
                return caches.delete(name);
              })
          );
        });
      })
    )
  );
});

self.addEventListener("fetch", event => {
  // Skip cache in development mode
  if (isDevelopment) {
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    caches.match(event.request).then(response => {
      // Return cached response if available
      if (response) {
        return response;
      }
      
      // Otherwise fetch from network
      return fetch(event.request).catch(error => {
        console.error('Fetch failed:', error);
        // You might want to show an offline fallback here
      });
    })
  );
});
