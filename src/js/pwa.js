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

  function updateDisplayedAppVersion(version) {
    if (typeof version !== 'string' || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)) {
      return;
    }

    const versionLink = typeof document === 'undefined' ? null : document.getElementById('footerAppVersion');
    if (!versionLink) return;

    versionLink.textContent = version;
    versionLink.setAttribute('href', `whats-new.html#version-${version}`);
  }

  navigator.serviceWorker.addEventListener('message', event => {
    if (event.data?.type === 'APP_VERSION' || event.data?.type === 'SW_UPDATED') {
      updateDisplayedAppVersion(event.data.version);
    }
  });

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
    .then(registration => {
      registration.active?.postMessage({ type: 'GET_APP_VERSION' });
      return registration.update();
    })
    .catch(error => console.error('Service Worker registration failed:', error));
}());
