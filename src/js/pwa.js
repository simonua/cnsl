(function initializeServiceWorkerUpdates() {
  'use strict';

  if (!('serviceWorker' in navigator)) {
    return;
  }

  const isLocalDevelopment = window.LOCAL_DEVELOPMENT_HOSTNAMES.includes(window.location.hostname)
    || window.location.port === window.LOCAL_DEVELOPMENT_PORT;

  if (isLocalDevelopment) {
    navigator.serviceWorker.getRegistrations()
      .then(registrations => Promise.all(registrations.map(registration => registration.unregister())))
      .catch(error => console.error('Unable to clear local service workers:', error));

    if ('caches' in window) {
      caches.keys()
        .then(names => Promise.all(names
          .filter(name => name.startsWith(window.PWA_CACHE_PREFIX))
          .map(name => caches.delete(name))))
        .catch(error => console.error('Unable to clear local application caches:', error));
    }
    return;
  }

  let hasActiveController = Boolean(navigator.serviceWorker.controller);
  let refreshing = false;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hasActiveController) {
      hasActiveController = true;
      return;
    }

    if (!refreshing) {
      refreshing = true;
      window.location.reload();
    }
  });

  const serviceWorkerUrl = new URL('service-worker.js', window.location.href);

  navigator.serviceWorker.register(serviceWorkerUrl, { updateViaCache: 'none' })
    .then(registration => registration.update())
    .catch(error => console.error('Service Worker registration failed:', error));
}());
