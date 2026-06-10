(function initializeServiceWorkerUpdates() {
  'use strict';

  const UPDATE_CHECK_DEBOUNCE_MS = 60 * 1000;
  const BUILD_VERSION_PATTERN = /^\d{8}-\d{6}$/;

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
  let serviceWorkerRegistration = null;
  let lastUpdateCheckAt = 0;
  let updateCheckPromise = null;
  const currentScriptUrl = typeof document === 'undefined' || !document.currentScript?.src
    ? null
    : new URL(document.currentScript.src, window.location.href);
  const currentBuildVersion = currentScriptUrl?.searchParams.get('v');

  try {
    const storedUpdateCheckAt = Number(window.sessionStorage?.getItem(window.SERVICE_WORKER_UPDATE_CHECKED_AT_STORAGE_KEY));
    if (Number.isSafeInteger(storedUpdateCheckAt) && storedUpdateCheckAt > 0) {
      lastUpdateCheckAt = storedUpdateCheckAt;
    }
  } catch {
    // Continue with tab-local memory when session storage is unavailable.
  }

  /**
   * Checks the deployed build marker and requests a service-worker update when needed.
   * @returns {Promise<*>|null} Active update check, or null when no check is needed
   * @private
   */
  function checkForDeploymentUpdate() {
    if (!serviceWorkerRegistration || updateCheckPromise) {
      return updateCheckPromise;
    }

    if (!BUILD_VERSION_PATTERN.test(currentBuildVersion)) {
      return null;
    }

    const updateCheckAt = Date.now();
    if (updateCheckAt >= lastUpdateCheckAt
      && updateCheckAt - lastUpdateCheckAt < UPDATE_CHECK_DEBOUNCE_MS) {
      return null;
    }

    lastUpdateCheckAt = updateCheckAt;
    try {
      window.sessionStorage?.setItem(window.SERVICE_WORKER_UPDATE_CHECKED_AT_STORAGE_KEY, String(updateCheckAt));
    } catch {
      // The in-memory timestamp still limits checks for this document.
    }

    const deploymentVersionUrl = new URL(window.DEPLOYMENT_VERSION_FILE, window.location.href);
    updateCheckPromise = fetch(deploymentVersionUrl, { cache: 'no-store' })
      .then(response => response.ok ? response.text() : null)
      .then(version => {
        const deployedBuildVersion = version?.trim();
        if (!BUILD_VERSION_PATTERN.test(deployedBuildVersion)
          || deployedBuildVersion === currentBuildVersion) {
          return null;
        }
        return serviceWorkerRegistration.update();
      })
      .catch(error => console.error('Deployment version check failed:', error))
      .finally(() => {
        updateCheckPromise = null;
      });

    return updateCheckPromise;
  }

  /**
   * Updates the footer after validating a service-worker application version.
   * @param {string} version - Semantic application version from the service worker
   * @private
   */
  function updateDisplayedAppVersion(version) {
    if (typeof version !== 'string' || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)) {
      return;
    }

    if (version !== window.APP_VERSION) {
      return;
    }

    const versionLink = typeof document === 'undefined' ? null : document.getElementById('footerAppVersion');
    if (!versionLink) return;

    versionLink.textContent = version;
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

  window.addEventListener('pageshow', checkForDeploymentUpdate);

  const serviceWorkerUrl = new URL('service-worker.js', window.location.href);

  navigator.serviceWorker.register(serviceWorkerUrl, { updateViaCache: 'none' })
    .then(registration => {
      serviceWorkerRegistration = registration;
      registration.active?.postMessage({ type: 'GET_APP_VERSION' });
      return checkForDeploymentUpdate();
    })
    .catch(error => console.error('Service Worker registration failed:', error));
}());
