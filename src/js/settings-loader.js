// Loads the shared Settings controller only when a visitor requests it.

(function initializeSettingsLoader(globalScope) {
  'use strict';

  const SETTINGS_CONTROLLER_SOURCE = 'js/settings.js';
  const loaderSource = document.currentScript && document.currentScript.src
    ? new URL(document.currentScript.src, document.baseURI)
    : null;
  const assetVersion = loaderSource ? loaderSource.searchParams.get('v') : '';
  let controllerPromise = null;

  /**
   * Applies the current build version to the Settings controller URL.
   * @returns {string} Versioned controller URL or its relative source
   * @private
   */
  function getControllerSource() {
    if (!assetVersion) return SETTINGS_CONTROLLER_SOURCE;

    const controllerSource = new URL(SETTINGS_CONTROLLER_SOURCE, document.baseURI);
    controllerSource.searchParams.set('v', assetVersion);
    return controllerSource.toString();
  }

  /**
   * Loads the Settings controller once.
   * @returns {Promise<void>} Promise settled after controller initialization
   * @private
   */
  function loadSettingsController() {
    if (globalScope.cnslSettings) return Promise.resolve();
    if (controllerPromise) return controllerPromise;

    controllerPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = getControllerSource();
      script.dataset.settingsController = 'true';
      script.addEventListener('load', () => {
        if (globalScope.cnslSettings) {
          resolve();
          return;
        }
        reject(new Error('Settings controller did not initialize.'));
      }, { once: true });
      script.addEventListener('error', () => reject(new Error('Unable to load the Settings controller.')), { once: true });
      document.body.appendChild(script);
    });
    return controllerPromise;
  }

  /**
   * Loads and opens Settings for an activated launcher.
   * @param {Event} event - Launcher activation event
   * @returns {Promise<void>} Promise settled after Settings opens or fallback navigation begins
   * @private
   */
  async function handleSettingsRequest(event) {
    const trigger = event.target instanceof Element
      ? event.target.closest('a[href="settings.html"], [data-settings-open]')
      : null;
    if (!trigger) return;

    event.preventDefault();
    trigger.setAttribute('aria-busy', 'true');
    try {
      await loadSettingsController();
      globalScope.cnslSettings.open(trigger);
    } catch (error) {
      console.error('Unable to open Settings:', error);
      if (trigger instanceof HTMLAnchorElement) globalScope.location.assign(trigger.href);
    } finally {
      trigger.removeAttribute('aria-busy');
    }
  }

  document.addEventListener('click', handleSettingsRequest);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      if (document.querySelector('[data-settings-auto-open]')) void loadSettingsController();
    }, { once: true });
  } else if (document.querySelector('[data-settings-auto-open]')) {
    void loadSettingsController();
  }
})(globalThis);
