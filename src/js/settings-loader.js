// Loads the shared Settings controller only when a visitor requests it.

(function initializeSettingsLoader(globalScope) {
  'use strict';

  const SETTINGS_CONTROLLER_SOURCE = 'js/settings.js';
  const assetVersion = ClassicScriptLoader.getAssetVersion(document.currentScript);
  let controllerPromise = null;

  /**
   * Loads the Settings controller once.
   * @returns {Promise<void>} Promise settled after controller initialization
   * @private
   */
  function loadSettingsController() {
    if (globalScope.cnslSettings) return Promise.resolve();
    if (controllerPromise) return controllerPromise;

    controllerPromise = ClassicScriptLoader.load([{
      source: SETTINGS_CONTROLLER_SOURCE,
      ready: () => Boolean(globalScope.cnslSettings)
    }], {
      assetVersion,
      dataset: () => ({ settingsController: 'true' }),
      parent: document.body
    }).catch(error => {
      controllerPromise = null;
      throw error;
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
