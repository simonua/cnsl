/**
 * Loads versioned classic scripts once across independently activated browser features.
 * Preserves caller-owned dependency order, readiness checks, and diagnostic attributes.
 */

(function initializeClassicScriptLoader(globalScope) {
  'use strict';

  const LOAD_MODES = Object.freeze({
    PARALLEL: 'parallel',
    SEQUENTIAL: 'sequential'
  });
  const pendingLoads = new Map();

  /**
   * Reads the build version from a controller script URL.
   * @param {HTMLScriptElement|null} controllerScript - Script that owns the lazy dependencies
   * @returns {string} Build version or an empty string
   */
  function getAssetVersion(controllerScript) {
    if (!controllerScript?.src) return '';
    return new URL(controllerScript.src, document.baseURI).searchParams.get('v') || '';
  }

  /**
   * Creates the requested dependency URL with the controller build version.
   * @param {string} source - Relative or absolute dependency source
   * @param {string} assetVersion - Controller build version
   * @returns {URL} Normalized dependency URL
   * @private
   */
  function createDependencyUrl(source, assetVersion) {
    const dependencyUrl = new URL(source, document.baseURI);
    if (assetVersion) dependencyUrl.searchParams.set('v', assetVersion);
    return dependencyUrl;
  }

  /**
   * Finds an existing script with the same normalized path.
   * @param {URL} dependencyUrl - Dependency URL to locate
   * @returns {HTMLScriptElement|null} Matching script or null
   * @private
   */
  function findExistingScript(dependencyUrl) {
    return Array.from(document.scripts).find(script => {
      const scriptSource = script.getAttribute('src');
      return scriptSource && new URL(scriptSource, document.baseURI).pathname === dependencyUrl.pathname;
    }) || null;
  }

  /**
   * Verifies an optional dependency readiness contract.
   * @param {Object} dependency - Dependency descriptor
   * @throws {Error} When the loaded script did not initialize its expected global
   * @private
   */
  function requireReady(dependency) {
    if (dependency.ready && !dependency.ready()) {
      throw new Error(`Dependency did not initialize: ${dependency.source}`);
    }
  }

  /**
   * Applies caller-owned diagnostic data attributes to a new script.
   * @param {HTMLScriptElement} script - Script receiving attributes
   * @param {Object} dataset - Dataset key-value pairs
   * @private
   */
  function applyDataset(script, dataset) {
    Object.entries(dataset).forEach(([name, value]) => {
      script.dataset[name] = value;
    });
  }

  /**
   * Loads one dependency while sharing any request already in flight.
   * @param {Object} dependency - Dependency source and optional readiness test
   * @param {Object} options - Shared loading options
   * @returns {Promise<void>} Promise settled after loading and readiness validation
   * @private
   */
  function loadOne(dependency, options) {
    if (dependency.ready?.()) return Promise.resolve();

    const dependencyUrl = createDependencyUrl(dependency.source, options.assetVersion);
    const requestKey = dependencyUrl.pathname;
    const pendingLoad = pendingLoads.get(requestKey);
    if (pendingLoad) return pendingLoad.then(() => requireReady(dependency));

    const existingScript = dependency.ready ? findExistingScript(dependencyUrl) : null;
    if (existingScript) {
      if (!dependency.ready) return Promise.resolve();
      const existingLoad = new Promise((resolve, reject) => {
        existingScript.addEventListener('load', resolve, { once: true });
        existingScript.addEventListener('error', () => {
          reject(new Error(`Unable to load dependency: ${dependency.source}`));
        }, { once: true });
      });
      pendingLoads.set(requestKey, existingLoad);
      return existingLoad
        .finally(() => pendingLoads.delete(requestKey))
        .then(() => requireReady(dependency));
    }

    const script = document.createElement('script');
    script.src = dependencyUrl.toString();
    script.async = false;
    applyDataset(script, options.dataset(dependency.source));

    const loadPromise = new Promise((resolve, reject) => {
      script.addEventListener('load', resolve, { once: true });
      script.addEventListener('error', () => {
        script.remove();
        reject(new Error(`Unable to load dependency: ${dependency.source}`));
      }, { once: true });
      options.parent.appendChild(script);
    }).finally(() => pendingLoads.delete(requestKey));

    pendingLoads.set(requestKey, loadPromise);
    return loadPromise.then(() => requireReady(dependency));
  }

  /**
   * Loads classic-script dependencies in ordered parallel or sequential mode.
   * @param {ReadonlyArray<string|Object>} dependencies - Sources or source/readiness descriptors
   * @param {Object} [options] - Loading behavior
   * @param {string} [options.assetVersion] - Build version applied to dependency URLs
   * @param {Function} [options.dataset] - Creates diagnostic dataset values for each source
   * @param {string} [options.mode] - `parallel` or `sequential`
   * @param {HTMLElement} [options.parent] - Script insertion parent
   * @returns {Promise<void>} Promise settled after every dependency initializes
   */
  function load(dependencies, options = {}) {
    const normalizedOptions = {
      assetVersion: options.assetVersion || '',
      dataset: options.dataset || (() => ({})),
      mode: options.mode || LOAD_MODES.PARALLEL,
      parent: options.parent || document.head
    };
    const normalizedDependencies = dependencies.map(dependency => (
      typeof dependency === 'string' ? { source: dependency } : dependency
    ));

    if (normalizedOptions.mode === LOAD_MODES.SEQUENTIAL) {
      return normalizedDependencies.reduce(
        (loadPromise, dependency) => loadPromise.then(() => loadOne(dependency, normalizedOptions)),
        Promise.resolve()
      );
    }
    return Promise.all(
      normalizedDependencies.map(dependency => loadOne(dependency, normalizedOptions))
    ).then(() => undefined);
  }

  globalScope.ClassicScriptLoader = Object.freeze({ getAssetVersion, load, LOAD_MODES });
})(globalThis);
