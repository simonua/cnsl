self.addEventListener("install", event => {
  event.waitUntil(
    caches.open("copilot-static").then(cache =>
      cache.addAll([
        "/",
        "/index.html",
        "/css/styles.css",
        "/js/copilot.js",
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
