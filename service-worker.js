self.addEventListener("install", event => {
  event.waitUntil(
    caches.open("copilot-static-v3").then(cache =>
      cache.addAll([
        "/",
        "/index.html",
        "/pools.html",
        "/css/styles.css",
        "/js/copilot.js",
        "/js/pool-browser.js",
        "/assets/data/teams.json",
        "/assets/data/pools.json",
        "/assets/images/cnsl-logo.jpg",
        "/manifest.webmanifest"
      ])
    )
  );
});

self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request).then(response => response || fetch(event.request))
  );
});
