/**
 * Manages device-local application preferences and favorite matching.
 */
if (typeof window === 'undefined' || !window.PreferencesService) {
  class PreferencesService {
    static STORAGE_KEY = 'cnsl_preferences';

    static THEMES = ['system', 'light', 'dark'];

    static DEFAULT_PREFERENCES = Object.freeze({
      theme: 'system',
      favoriteTeamId: '',
      favoritePoolName: ''
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

      return { theme, favoriteTeamId, favoritePoolName };
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