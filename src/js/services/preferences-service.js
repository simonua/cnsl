/**
 * Manages device-local application preferences and favorite matching.
 */
if (typeof module !== 'undefined' && module.exports && typeof globalThis.PREFERENCES_STORAGE_KEY === 'undefined') {
  require('../config/app-config.js');
}

if (typeof window === 'undefined' || !window.PreferencesService) {
  class PreferencesService {
    static STORAGE_KEY = globalThis.PREFERENCES_STORAGE_KEY;

    static CONTRASTS = ['system', 'high'];

    static MOTIONS = ['system', 'reduced'];

    static TEXT_SIZES = ['default', 'large', 'extra-large'];

    static THEMES = ['system', 'light', 'dark'];

    static POOL_SCHEDULE_LAYOUTS = ['list', 'calendar'];

    static WEATHER_REFRESH_MINUTES = globalThis.WEATHER_ALERT_REFRESH_MINUTES_OPTIONS;

    static PRACTICE_GROUPS = Object.freeze([
      Object.freeze({ key: 'first-splash', label: 'First Splash', publishedLabels: Object.freeze(['first splash', 'first splash (new swimmers)']) }),
      Object.freeze({ key: '8-under', label: '8 and under', minimumAge: 0, maximumAge: 8 }),
      Object.freeze({ key: '9-10', label: '9-10', minimumAge: 9, maximumAge: 10 }),
      Object.freeze({ key: '11-12', label: '11-12', minimumAge: 11, maximumAge: 12 }),
      Object.freeze({ key: '13-14', label: '13-14', minimumAge: 13, maximumAge: 14 }),
      Object.freeze({ key: '15-18', label: '15-18', minimumAge: 15, maximumAge: 18 })
    ]);

    static POOL_FEATURE_GROUPS = Object.freeze([
      Object.freeze({
        key: 'accessibility',
        label: 'Accessibility & inclusion',
        features: Object.freeze(['ada compliant', 'family changing room', 'pool lift', 'sensory friendly'])
      }),
      Object.freeze({
        key: 'young-swimmers',
        label: 'Young swimmers & non-swimmers',
        features: Object.freeze(['beach entry', 'lessons', 'play features', 'shallow', 'splash', 'tot lot', 'wading'])
      }),
      Object.freeze({
        key: 'water-play',
        label: 'Swimming & water play',
        features: Object.freeze(['6 lanes', '8 lanes', 'meter lanes', 'yard lanes', 'climbing wall', 'dive', 'lap', 'slide'])
      }),
      Object.freeze({
        key: 'recreation',
        label: 'Sports & recreation',
        features: Object.freeze(['baseball', 'basketball', 'cornhole', 'fitness pavilion', 'golf course', 'soccer', 'softball', 'sports field', 'tennis', 'volleyball', 'yoga'])
      }),
      Object.freeze({
        key: 'amenities',
        label: 'Amenities',
        features: Object.freeze(['bathhouse', 'deck', 'grill', 'heated', 'hot tub', 'party area', 'picnic area', 'shade', 'wifi'])
      })
    ]);

    static DEFAULT_PREFERENCES = Object.freeze({
      theme: 'system',
      textSize: 'default',
      contrast: 'system',
      motion: 'system',
      underlineLinks: false,
      favoriteTeamId: '',
      favoritePoolName: '',
      favoriteTeamExpanded: true,
      favoritePoolExpanded: true,
      poolScheduleLayout: 'list',
      poolFeatureFilters: Object.freeze([]),
      practiceGroups: Object.freeze(['first-splash', '8-under', '9-10', '11-12', '13-14', '15-18']),
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
      const textSize = PreferencesService.TEXT_SIZES.includes(preferences.textSize) ? preferences.textSize : 'default';
      const contrast = PreferencesService.CONTRASTS.includes(preferences.contrast) ? preferences.contrast : 'system';
      const motion = PreferencesService.MOTIONS.includes(preferences.motion) ? preferences.motion : 'system';
      const underlineLinks = preferences.underlineLinks === true;
      const favoriteTeamId = typeof preferences.favoriteTeamId === 'string' ? preferences.favoriteTeamId.trim() : '';
      const favoritePoolName = typeof preferences.favoritePoolName === 'string' ? preferences.favoritePoolName.trim() : '';
      const favoriteTeamExpanded = preferences.favoriteTeamExpanded !== false;
      const favoritePoolExpanded = preferences.favoritePoolExpanded !== false;
      const poolScheduleLayout = PreferencesService.POOL_SCHEDULE_LAYOUTS.includes(preferences.poolScheduleLayout)
        ? preferences.poolScheduleLayout
        : 'list';
      const poolFeatureFilters = PreferencesService.normalizeFeatureFilters(preferences.poolFeatureFilters);
      const practiceGroups = PreferencesService.normalizePracticeGroups(preferences.practiceGroups, preferences.practiceAgeGroups);
      const locationAwarenessEnabled = preferences.locationAwarenessEnabled === true;

      const requestedWeatherRefreshMinutes = Number(preferences.weatherRefreshMinutes);
      const weatherRefreshMinutes = PreferencesService.WEATHER_REFRESH_MINUTES.includes(requestedWeatherRefreshMinutes)
        ? requestedWeatherRefreshMinutes
        : PreferencesService.DEFAULT_PREFERENCES.weatherRefreshMinutes;

      return { theme, textSize, contrast, motion, underlineLinks, favoriteTeamId, favoritePoolName, favoriteTeamExpanded, favoritePoolExpanded, poolScheduleLayout, poolFeatureFilters, practiceGroups, locationAwarenessEnabled, weatherRefreshMinutes };
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
     * Keep selected practice-group keys ordered and preserve First Splash for age-only saved settings.
     * @param {Array|undefined} practiceGroups - Raw selected practice-group keys
     * @param {Array|undefined} legacyAgeGroups - Previously stored age-only group keys
     * @returns {Array} Ordered valid practice-group keys
     */
    static normalizePracticeGroups(practiceGroups, legacyAgeGroups) {
      const allPracticeGroups = PreferencesService.PRACTICE_GROUPS.map(group => group.key);
      if (Array.isArray(practiceGroups)) {
        return allPracticeGroups.filter(group => practiceGroups.includes(group));
      }

      if (!Array.isArray(legacyAgeGroups)) return allPracticeGroups;

      return allPracticeGroups.filter(group => group === 'first-splash' || legacyAgeGroups.includes(group));
    }

    /**
     * Keep practice sessions that apply to at least one selected practice group.
     * Unmodelled sessions without a published age range remain visible.
     * @param {Array} sessions - Published practice sessions
     * @param {Array|undefined} selectedPracticeGroups - Selected practice-group keys
     * @returns {Array} Sessions relevant to the selection
     */
    static filterPracticeSessions(sessions, selectedPracticeGroups) {
      if (!Array.isArray(sessions)) return [];

      const selectedKeys = PreferencesService.normalizePracticeGroups(selectedPracticeGroups);
      const selectedRanges = PreferencesService.PRACTICE_GROUPS.filter(group => (
        selectedKeys.includes(group.key) && typeof group.minimumAge === 'number'
      ));

      return sessions.filter(session => {
        const normalizedLabel = typeof session?.group === 'string' ? session.group.trim().toLowerCase() : '';
        const namedGroup = PreferencesService.PRACTICE_GROUPS.find(group => (
          Array.isArray(group.publishedLabels) && group.publishedLabels.includes(normalizedLabel)
        ));
        if (namedGroup) return selectedKeys.includes(namedGroup.key);

        const sessionRange = PreferencesService.getPracticeSessionAgeRange(session && session.group);
        if (!sessionRange) return true;

        return selectedRanges.some(ageGroup => (
          ageGroup.minimumAge <= sessionRange.maximumAge && ageGroup.maximumAge >= sessionRange.minimumAge
        ));
      });
    }

    /**
     * Resolve an age-labelled published practice group to its inclusive swimmer ages.
     * @param {string} groupLabel - Published practice group label
     * @returns {{minimumAge: number, maximumAge: number}|null} Age span, if specified
     */
    static getPracticeSessionAgeRange(groupLabel) {
      if (typeof groupLabel !== 'string') return null;

      const normalizedLabel = groupLabel.toLowerCase();
      const youngerMatch = normalizedLabel.match(/\b(\d{1,2})\s*(?:&|and)\s*(?:under|younger)\b/);
      if (youngerMatch) return { minimumAge: 0, maximumAge: Number(youngerMatch[1]) };

      const olderMatch = normalizedLabel.match(/\b(\d{1,2})\s*(?:&|and)\s*(?:up|over|older)\b/);
      if (olderMatch) return { minimumAge: Number(olderMatch[1]), maximumAge: 18 };

      const rangeMatch = normalizedLabel.match(/\b(\d{1,2})\s*-\s*(\d{1,2})\b/);
      if (!rangeMatch) return null;

      const minimumAge = Number(rangeMatch[1]);
      const maximumAge = Number(rangeMatch[2]);
      return minimumAge <= maximumAge ? { minimumAge, maximumAge } : null;
    }

    /**
     * Get the published feature labels available across pool records.
     * @param {Array} pools - Available pool records
     * @returns {Array} Available normalized feature labels
     */
    static getPoolFeatures(pools) {
      if (!Array.isArray(pools)) return [];

      return PreferencesService.normalizeFeatureFilters(
        pools.flatMap(pool => PreferencesService.getFilterablePoolFeatures(pool))
      );
    }

    /**
     * Expose structured lane metadata alongside published amenities for pool filtering.
     * @param {Object} pool - Published pool record
     * @returns {Array} Filterable feature labels
     */
    static getFilterablePoolFeatures(pool) {
      const features = Array.isArray(pool?.features) ? pool.features : [];
      const laneFeature = Number.isInteger(pool?.laneCount) && pool.laneCount > 0 ? [`${pool.laneCount} lanes`] : [];
      const laneUnitsFeature = {
        meters: 'meter lanes',
        yards: 'yard lanes'
      }[pool?.laneLengthUnits];
      return [...features, ...laneFeature, ...(laneUnitsFeature ? [laneUnitsFeature] : [])];
    }

    /**
     * Arrange available feature filters into visitor-oriented categories.
     * @param {Array} features - Available feature labels
     * @returns {Array} Visible categories containing their available features
     */
    static groupPoolFeatures(features) {
      const availableFeatures = PreferencesService.normalizeFeatureFilters(features);
      return PreferencesService.POOL_FEATURE_GROUPS.map(group => {
        const visibleFeatures = group.features.filter(feature => availableFeatures.includes(feature));
        return { key: group.key, label: group.label, features: visibleFeatures };
      }).filter(group => group.features.length > 0);
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
        const availableFeatures = PreferencesService.normalizeFeatureFilters(PreferencesService.getFilterablePoolFeatures(pool));
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
