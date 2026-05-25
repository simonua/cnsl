/**
 * Manages device-local application preferences and favorite matching.
 */
if (typeof module !== 'undefined' && module.exports && typeof globalThis.PREFERENCES_STORAGE_KEY === 'undefined') {
  require('../config/app-config.js');
}

if (typeof window === 'undefined' || !window.PreferencesService) {
  class PreferencesService {
    static STORAGE_KEY = globalThis.PREFERENCES_STORAGE_KEY;

    static THEMES = ['system', 'light', 'dark'];

    static POOL_SCHEDULE_LAYOUTS = ['list', 'calendar'];

    static WEATHER_REFRESH_MINUTES = globalThis.WEATHER_ALERT_REFRESH_MINUTES_OPTIONS;

    static POOL_FEATURE_GROUPS = Object.freeze([
      Object.freeze({
        key: 'accessibility',
        label: 'Accessibility & inclusion',
        features: Object.freeze(['ada compliant', 'family changing room', 'pool lift', 'sensory friendly'])
      }),
      Object.freeze({
        key: 'young-swimmers',
        label: 'Young swimmers & non-swimmers',
        features: Object.freeze(['beach entry', 'play features', 'shallow', 'splash', 'tot lot', 'wading'])
      }),
      Object.freeze({
        key: 'water-play',
        label: 'Swimming & water play',
        features: Object.freeze(['climbing wall', 'dive', 'lap', 'slide'])
      }),
      Object.freeze({
        key: 'recreation',
        label: 'Sports & recreation',
        features: Object.freeze(['baseball', 'basketball', 'cornhole', 'fitness pavilion', 'golf course', 'soccer', 'softball', 'sports field', 'tennis', 'volleyball'])
      }),
      Object.freeze({
        key: 'amenities',
        label: 'Amenities',
        features: Object.freeze(['bathhouse', 'deck', 'grill', 'heated', 'hot tub', 'party area', 'picnic area', 'shade', 'wifi'])
      })
    ]);

    static DEFAULT_PREFERENCES = Object.freeze({
      theme: 'system',
      favoriteTeamId: '',
      favoritePoolName: '',
      favoriteTeamExpanded: true,
      favoritePoolExpanded: true,
      poolScheduleLayout: 'list',
      poolFeatureFilters: Object.freeze([]),
      locationAwarenessEnabled: false,
      weatherRefreshMinutes: globalThis.WEATHER_ALERT_DEFAULT_REFRESH_MINUTES
    });

    /**
     * Read preferences from device storage.
     * @param {Storage|null} storage - Browser storage or a test substitute
     * @returns {Object} Normalized preferences
     */
    static get(storage = PreferencesService.getStorage()) {
      if (!storage) return { ...PreferencesService.DEFAULT_PREFERENCES };

      try {
        const storedValue = storage.getItem(PreferencesService.STORAGE_KEY);
        return storedValue ? PreferencesService.normalize(JSON.parse(storedValue)) : { ...PreferencesService.DEFAULT_PREFERENCES };
      } catch (_error) {
        return { ...PreferencesService.DEFAULT_PREFERENCES };
      }
    }

    /**
     * Save normalized preferences to device storage.
     * @param {Object} preferences - Preference values to store
     * @param {Storage|null} storage - Browser storage or a test substitute
     * @returns {Object} Normalized preferences
     */
    static save(preferences, storage = PreferencesService.getStorage()) {
      const normalized = PreferencesService.normalize(preferences);

      if (storage) {
        try {
          storage.setItem(PreferencesService.STORAGE_KEY, JSON.stringify(normalized));
        } catch (_error) {
          return normalized;
        }
      }

      return normalized;
    }

    /**
     * Remove stored preferences from this device.
     * @param {Storage|null} storage - Browser storage or a test substitute
     */
    static clear(storage = PreferencesService.getStorage()) {
      if (!storage) return;

      try {
        storage.removeItem(PreferencesService.STORAGE_KEY);
      } catch (_error) {
        // Storage may be unavailable in privacy-restricted browser contexts.
      }
    }

    /**
     * Validate and normalize preference values.
     * @param {Object} preferences - Raw preference values
     * @returns {Object} Valid preference values
     */
    static normalize(preferences = {}) {
      const theme = PreferencesService.THEMES.includes(preferences.theme) ? preferences.theme : 'system';
      const favoriteTeamId = typeof preferences.favoriteTeamId === 'string' ? preferences.favoriteTeamId.trim() : '';
      const favoritePoolName = typeof preferences.favoritePoolName === 'string' ? preferences.favoritePoolName.trim() : '';
      const favoriteTeamExpanded = preferences.favoriteTeamExpanded !== false;
      const favoritePoolExpanded = preferences.favoritePoolExpanded !== false;
      const poolScheduleLayout = PreferencesService.POOL_SCHEDULE_LAYOUTS.includes(preferences.poolScheduleLayout)
        ? preferences.poolScheduleLayout
        : 'list';
      const poolFeatureFilters = PreferencesService.normalizeFeatureFilters(preferences.poolFeatureFilters);
      const locationAwarenessEnabled = preferences.locationAwarenessEnabled === true;

      const requestedWeatherRefreshMinutes = Number(preferences.weatherRefreshMinutes);
      const weatherRefreshMinutes = PreferencesService.WEATHER_REFRESH_MINUTES.includes(requestedWeatherRefreshMinutes)
        ? requestedWeatherRefreshMinutes
        : PreferencesService.DEFAULT_PREFERENCES.weatherRefreshMinutes;

      return { theme, favoriteTeamId, favoritePoolName, favoriteTeamExpanded, favoritePoolExpanded, poolScheduleLayout, poolFeatureFilters, locationAwarenessEnabled, weatherRefreshMinutes };
    }

    /**
     * Normalize selected feature labels for storage and comparison.
     * @param {Array} features - Raw selected feature labels
     * @returns {Array} Unique normalized feature labels
     */
    static normalizeFeatureFilters(features) {
      if (!Array.isArray(features)) return [];

      return [...new Set(features
        .filter(feature => typeof feature === 'string')
        .map(feature => feature.trim().toLowerCase())
        .filter(Boolean))]
        .sort((first, second) => first.localeCompare(second));
    }

    /**
     * Get the published feature labels available across pool records.
     * @param {Array} pools - Available pool records
     * @returns {Array} Available normalized feature labels
     */
    static getPoolFeatures(pools) {
      if (!Array.isArray(pools)) return [];

      return PreferencesService.normalizeFeatureFilters(
        pools.flatMap(pool => Array.isArray(pool.features) ? pool.features : [])
      );
    }

    /**
     * Arrange available feature filters into visitor-oriented categories.
     * @param {Array} features - Available feature labels
     * @returns {Array} Visible categories containing their available features
     */
    static groupPoolFeatures(features) {
      const availableFeatures = PreferencesService.normalizeFeatureFilters(features);
      const categorizedFeatures = new Set();
      const groups = PreferencesService.POOL_FEATURE_GROUPS.map(group => {
        const visibleFeatures = group.features.filter(feature => availableFeatures.includes(feature));
        visibleFeatures.forEach(feature => categorizedFeatures.add(feature));
        return { key: group.key, label: group.label, features: visibleFeatures };
      }).filter(group => group.features.length > 0);
      const additionalFeatures = availableFeatures.filter(feature => !categorizedFeatures.has(feature));

      if (additionalFeatures.length > 0) {
        groups.push({ key: 'additional', label: 'Additional features', features: additionalFeatures });
      }

      return groups;
    }

    /**
     * Resolve the display category for one published feature.
     * @param {string} feature - Published feature label
     * @returns {string} Stable category key for styling and display grouping
     */
    static getPoolFeatureCategory(feature) {
      const normalizedFeature = PreferencesService.normalizeFeatureFilters([feature])[0];
      const group = PreferencesService.POOL_FEATURE_GROUPS.find(candidate => candidate.features.includes(normalizedFeature));
      return group ? group.key : 'additional';
    }

    /**
     * Keep pools that contain each selected published feature.
     * @param {Array} pools - Available pool records
     * @param {Array} featureFilters - Selected feature labels
     * @returns {Array} Filtered pool records
     */
    static filterPoolsByFeatures(pools, featureFilters) {
      if (!Array.isArray(pools)) return [];

      const selectedFeatures = PreferencesService.normalizeFeatureFilters(featureFilters);
      if (selectedFeatures.length === 0) return [...pools];

      return pools.filter(pool => {
        const availableFeatures = PreferencesService.normalizeFeatureFilters(pool.features);
        return selectedFeatures.every(feature => availableFeatures.includes(feature));
      });
    }

    /**
     * Sort a collection alphabetically while pinning a selected favorite first.
     * @param {Array} items - Items to sort
     * @param {string} favoriteValue - Selected identifier or name
     * @param {Function} getValue - Extracts each item's selected value
     * @param {Function} compareItems - Alphabetical comparator for items
     * @returns {Array} Sorted copy of the supplied items
     */
    static sortWithFavorite(items, favoriteValue, getValue, compareItems) {
      return [...items].sort((first, second) => {
        const firstIsFavorite = getValue(first) === favoriteValue;
        const secondIsFavorite = getValue(second) === favoriteValue;
        if (firstIsFavorite !== secondIsFavorite) return firstIsFavorite ? -1 : 1;
        return compareItems(first, second);
      });
    }

    /**
     * Find the selected team record using its stable id.
     * @param {Array} teams - Available team records
     * @param {string} favoriteTeamId - Stored favorite team id
     * @returns {Object|null} Selected team or null
     */
    static findFavoriteTeam(teams, favoriteTeamId) {
      return Array.isArray(teams) ? teams.find(team => team.id === favoriteTeamId) || null : null;
    }

    /**
     * Check whether a meet's published team label represents a team record.
     * @param {Object|null} team - Team with name and league keyword aliases
     * @param {string} label - Team label from the meet schedule
     * @returns {boolean} True when the label describes this team
     */
    static teamMatchesLabel(team, label) {
      if (!team || typeof label !== 'string') return false;

      const normalizedLabel = PreferencesService.normalizeText(label);
      const aliases = [team.name, ...(Array.isArray(team.keywords) ? team.keywords : [])]
        .filter(alias => typeof alias === 'string')
        .map(alias => PreferencesService.normalizeText(alias))
        .filter(alias => alias.length >= 3);

      return aliases.some(alias => normalizedLabel === alias || normalizedLabel.includes(alias) || alias.includes(normalizedLabel));
    }

    /**
     * Check whether a scheduled dual meet contains the selected team.
     * @param {Object} meet - Meet record
     * @param {Object|null} favoriteTeam - Selected team record
     * @returns {boolean} True when the favorite appears in the matchup
     */
    static meetIncludesFavoriteTeam(meet, favoriteTeam) {
      if (!meet || !favoriteTeam) return false;
      const labels = [meet.home_team, meet.visiting_team, meet.homeTeam, meet.awayTeam];
      return labels.some(label => PreferencesService.teamMatchesLabel(favoriteTeam, label));
    }

    /**
     * Move the selected team's matchup first while preserving published order otherwise.
     * @param {Array} meets - Meets scheduled on a single day
     * @param {Object|null} favoriteTeam - Selected team record
     * @returns {Array} Ordered copy of the supplied meets
     */
    static sortMeetsWithFavorite(meets, favoriteTeam) {
      if (!Array.isArray(meets)) return [];

      return [...meets].sort((first, second) => {
        const firstIsFavorite = PreferencesService.meetIncludesFavoriteTeam(first, favoriteTeam);
        const secondIsFavorite = PreferencesService.meetIncludesFavoriteTeam(second, favoriteTeam);
        if (firstIsFavorite === secondIsFavorite) return 0;
        return firstIsFavorite ? -1 : 1;
      });
    }

    /**
     * Normalize user-visible text for alias matching.
     * @param {string} value - Value to normalize
     * @returns {string} Comparable text
     */
    static normalizeText(value) {
      return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    }

    /**
     * Get browser local storage when it is available.
     * @returns {Storage|null} Browser storage or null
     */
    static getStorage() {
      return typeof localStorage !== 'undefined' ? localStorage : null;
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = PreferencesService;
  }

  if (typeof window !== 'undefined') {
    window.PreferencesService = PreferencesService;
  }
}