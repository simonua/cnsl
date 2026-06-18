/**
 * Loads reviewed experimental-feature metadata and evaluates device-local opt-ins.
 * Configuration is treated as untrusted input and fails closed when invalid.
 */
if (typeof globalThis.ExperimentalFeaturesService === 'undefined') {
  /** Validates experimental configuration and resolves enabled feature state. */
  class ExperimentalFeaturesService {
    static configurationPromise = null;

    /**
     * Loads and validates experimental feature configuration once.
     * @param {Function} fetchImplementation - Fetch-compatible configuration loader
     * @returns {Promise<Array>} Validated immutable feature records
     */
    static async load(fetchImplementation = globalThis.fetch) {
      if (!ExperimentalFeaturesService.configurationPromise) {
        ExperimentalFeaturesService.configurationPromise = (async () => {
          if (typeof fetchImplementation !== 'function') throw new Error('Experimental feature configuration cannot be loaded.');

          const response = await fetchImplementation(globalThis.EXPERIMENTAL_SETTINGS_URL, { cache: 'no-cache' });
          if (!response.ok) throw new Error(`Experimental feature configuration returned ${response.status}.`);
          return ExperimentalFeaturesService.normalizeConfiguration(await response.json());
        })().catch(error => {
          ExperimentalFeaturesService.configurationPromise = null;
          throw error;
        });
      }

      return ExperimentalFeaturesService.configurationPromise;
    }

    /**
     * Validates configuration records against application-owned feature identifiers.
     * @param {Object} configuration - Candidate JSON configuration
     * @returns {Array} Validated immutable feature records
     */
    static normalizeConfiguration(configuration) {
      if (!configuration || !Array.isArray(configuration.features)) return Object.freeze([]);

      const allowedFeatureIds = new Set(Object.values(globalThis.EXPERIMENTAL_FEATURE_IDS));
      const retainedFeatureIds = new Set();
      const features = configuration.features.flatMap(feature => {
        if (!feature || !allowedFeatureIds.has(feature.id) || retainedFeatureIds.has(feature.id)) return [];
        if (typeof feature.label !== 'string' || typeof feature.description !== 'string' || typeof feature.available !== 'boolean') return [];

        const label = feature.label.trim();
        const description = feature.description.trim();
        const sentenceCount = description.split(/[.!?]+(?:\s|$)/).filter(Boolean).length;
        if (!label || !description || sentenceCount > 3) return [];

        retainedFeatureIds.add(feature.id);
        return [Object.freeze({
          available: feature.available,
          description,
          id: feature.id,
          label
        })];
      });

      return Object.freeze(features);
    }

    /**
     * Determines whether a configured feature is available and selected on this device.
     * @param {string} featureId - Application-owned experimental feature identifier
     * @param {Function} fetchImplementation - Fetch-compatible configuration loader
     * @returns {Promise<boolean>} Whether the feature may be used
     */
    static async isEnabled(featureId, fetchImplementation = globalThis.fetch) {
      const configuredFeatures = await ExperimentalFeaturesService.load(fetchImplementation);
      const feature = configuredFeatures.find(candidate => candidate.id === featureId);
      return Boolean(feature?.available && globalThis.PreferencesService.get().experimentalFeatures.includes(featureId));
    }
  }

  globalThis.ExperimentalFeaturesService = ExperimentalFeaturesService;
}
