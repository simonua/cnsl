(function initializeServiceWorkerUpdates() {
  'use strict';

  const UPDATE_CHECK_DEBOUNCE_MS = 60 * 1000;
  const BUILD_VERSION_PATTERN = /^\d{8}-\d{6}$/;
  const deploymentVersionUrl = new URL(window.DEPLOYMENT_VERSION_FILE, window.location.href);

  /**
   * Reads the latest valid deployment build marker without using browser caches.
   * @returns {Promise<string|null>} Published build version, or null when the marker is unavailable or invalid
   * @private
   */
  async function fetchDeployedBuildVersion() {
    const response = await fetch(deploymentVersionUrl, { cache: 'no-store' });
    if (!response.ok) return null;

    const deployedBuildVersion = (await response.text()).trim();
    return BUILD_VERSION_PATTERN.test(deployedBuildVersion) ? deployedBuildVersion : null;
  }

  /**
   * Removes this app's active worker and static caches before reloading from the network.
   * @returns {Promise<void>} Promise that settles when the reload has been requested
   */
  async function forceUpdate() {
    const deployedBuildVersion = await fetchDeployedBuildVersion();
    if (!deployedBuildVersion) {
      throw new Error('The latest deployment marker is unavailable.');
    }

    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) await registration.unregister();
    }

    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames
        .filter(name => name.startsWith(window.PWA_CACHE_PREFIX))
        .map(name => caches.delete(name)));
    }

    window.location.reload();
  }

  window.cnslPwa = Object.freeze({ forceUpdate });

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
  let hasRecordedControllerChange = false;
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
   * Registers the worker through a build-specific URL that bypasses stale intermediary caches.
   * @param {string|null} buildVersion - Valid generated build identifier, when available
   * @returns {Promise<ServiceWorkerRegistration>} Registered service worker
   * @private
   */
  function registerServiceWorker(buildVersion) {
    const serviceWorkerUrl = new URL('service-worker.js', window.location.href);
    if (BUILD_VERSION_PATTERN.test(buildVersion)) {
      serviceWorkerUrl.searchParams.set('v', buildVersion);
    }

    return navigator.serviceWorker.register(serviceWorkerUrl, { updateViaCache: 'none' })
      .then(registration => {
        serviceWorkerRegistration = registration;
        return registration;
      });
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

    updateCheckPromise = fetchDeployedBuildVersion()
      .then(deployedBuildVersion => {
        if (!deployedBuildVersion || deployedBuildVersion === currentBuildVersion) {
          return null;
        }
        return registerServiceWorker(deployedBuildVersion);
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

    if (!hasRecordedControllerChange) {
      hasRecordedControllerChange = true;
      try {
        window.sessionStorage?.setItem(window.SERVICE_WORKER_UPGRADE_FROM_VERSION_STORAGE_KEY, window.APP_VERSION);
      } catch {
        // Keep the current view available when session storage is unavailable.
      }
    }
  });

  window.addEventListener('pageshow', checkForDeploymentUpdate);

  registerServiceWorker(currentBuildVersion)
    .then(registration => {
      registration.active?.postMessage({ type: 'GET_APP_VERSION' });
      return checkForDeploymentUpdate();
    })
    .catch(error => console.error('Service Worker registration failed:', error));
}());
