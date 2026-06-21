/**
 * Coordinates the published meet collection.
 */

// Prevent multiple declarations
if (typeof globalThis.MeetsManager === 'undefined') {

  /** Coordinates the published meet collection and meet-level queries. */
  class MeetsManager {
  /** Creates an empty meet collection manager. */
  constructor() {
    /** @type {Map<string, Meet>} */
    this.meets = new Map();
    this.dataLoaded = false;
  }

  /**
   * Load meets data from JSON
    * @param {MeetsDocument} meetsData - Published annual meets document
   */
  loadData(meetsData) {
    this.meets.clear();
    const meetTimes = meetsData && meetsData.meetTimes
      ? Object.fromEntries(Object.entries(meetsData.meetTimes).map(([key, timingWindow]) => [key, { ...timingWindow }]))
      : {};
    this.dataLoaded = false;
    const meetsList = [
      ...(meetsData && Array.isArray(meetsData.regular_meets) ? meetsData.regular_meets.map(meetData => ({ meetData, defaultTimeWindowKey: 'dualMeets' })) : []),
      ...(meetsData && Array.isArray(meetsData.special_meets) ? meetsData.special_meets.map(meetData => ({ meetData, defaultTimeWindowKey: '' })) : [])
    ];

    if (meetsList.length > 0) {
      meetsList.forEach(({ meetData, defaultTimeWindowKey }, index) => {
        const meet = new Meet(meetData, meetTimes, defaultTimeWindowKey);
        const meetKey = `${meet.date}_${meet.home_team || 'special'}_${meet.visiting_team || meet.name || 'meet'}_${index}`;
        this.meets.set(meetKey, meet);
      });

      this.dataLoaded = true;
    }
  }

  /**
   * Get all meets
    * @returns {Meet[]} - Array of all meet objects
   */
  getAllMeets() {
    return Array.from(this.meets.values());
  }


  /**
   * Check if data is loaded
   * @returns {boolean} - True if data is loaded
   */
  isDataLoaded() {
    return this.dataLoaded;
  }

  /**
   * Clear all data
   */
  clearData() {
    this.meets.clear();
    this.dataLoaded = false;
  }
}

globalThis.MeetsManager = MeetsManager;

}
