/**
 * Meets management and scheduling operations
 */

// Prevent multiple declarations
if (typeof window === 'undefined' || !window.MeetsManager) {

if (typeof window === 'undefined') {
  if (typeof Meet === 'undefined') { var Meet = require('./models/meet.js'); } // eslint-disable-line no-var
}

  class MeetsManager {
  constructor() {
    /** @type {Map<string, Meet>} */
    this.meets = new Map();
    this.meetTimes = {};
    this.lastUpdated = null;
    this.dataLoaded = false;
  }

  /**
   * Load meets data from JSON
    * @param {MeetsDocument} meetsData - Published annual meets document
   */
  loadData(meetsData) {
    this.meets.clear();
    this.meetTimes = meetsData && meetsData.meetTimes
      ? Object.fromEntries(Object.entries(meetsData.meetTimes).map(([key, timingWindow]) => [key, { ...timingWindow }]))
      : {};
    this.lastUpdated = null;
    this.dataLoaded = false;
    const meetsList = [
      ...(meetsData && Array.isArray(meetsData.regular_meets) ? meetsData.regular_meets.map(meetData => ({ meetData, defaultTimeWindowKey: 'dualMeets' })) : []),
      ...(meetsData && Array.isArray(meetsData.special_meets) ? meetsData.special_meets.map(meetData => ({ meetData, defaultTimeWindowKey: '' })) : [])
    ];

    if (meetsList.length > 0) {
      meetsList.forEach(({ meetData, defaultTimeWindowKey }, index) => {
        const meet = new Meet(meetData, this.meetTimes, defaultTimeWindowKey);
        const meetKey = `${meet.date}_${meet.home_team || 'special'}_${meet.visiting_team || meet.name || 'meet'}_${index}`;
        this.meets.set(meetKey, meet);
      });

      this.lastUpdated = meetsData.lastUpdated || new Date().toISOString();
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
   * Get meets count
   * @returns {number} - Number of meets
   */
  getMeetCount() {
    return this.meets.size;
  }

  getMeetTimes() {
    return Object.fromEntries(Object.entries(this.meetTimes).map(([key, timingWindow]) => [key, { ...timingWindow }]));
  }

  /**
   * Get meets by date
   * @param {string} date - Date in YYYY-MM-DD format
    * @returns {Meet[]} - Array of meets on specified date
   */
  getMeetsByDate(date) {
    return this.getAllMeets().filter(meet => meet.date === date);
  }

  /**
   * Get meets by pool
   * @param {string} poolName - Pool name
    * @returns {Meet[]} - Array of meets at specified pool
   */
  getMeetsByPool(poolName) {
    return this.getAllMeets().filter(meet => meet.occursAtPool(poolName));
  }

  /**
   * Get home meets for a pool
   * @param {string} poolName - Pool name
    * @returns {Meet[]} - Array of home meets for pool
   */
  getHomeMeetsByPool(poolName) {
    return this.getMeetsByPool(poolName);
  }

  /**
   * Get meets by team
   * @param {string} teamName - Team name
    * @returns {Meet[]} - Array of meets involving specified team
   */
  getMeetsByTeam(teamName) {
    return this.getAllMeets().filter(meet => meet.includesTeam(teamName));
  }

  /**
   * Get upcoming meets
   * @param {number} days - Number of days ahead to look (default 30)
    * @returns {MeetRecord[]} - Array of upcoming meets
   */
  getUpcomingMeets(days = 30) {
    const today = new Date();
    const futureDate = new Date(today.getTime() + (days * 24 * 60 * 60 * 1000));

    return this.getAllMeets().filter(meet => {
      const meetDate = new Date(meet.date);
      return meetDate >= today && meetDate <= futureDate;
    }).sort((a, b) => new Date(a.date) - new Date(b.date));
  }

  /**
   * Get past meets
   * @param {number} days - Number of days back to look (default 30)
    * @returns {MeetRecord[]} - Array of past meets
   */
  getPastMeets(days = 30) {
    const today = new Date();
    const pastDate = new Date(today.getTime() - (days * 24 * 60 * 60 * 1000));

    return this.getAllMeets().filter(meet => {
      const meetDate = new Date(meet.date);
      return meetDate < today && meetDate >= pastDate;
    }).sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  /**
   * Get today's meets
    * @returns {MeetRecord[]} - Array of today's meets
   */
  getTodaysMeets() {
    const TimeUtilsRef = this._getTimeUtils();
    if (!TimeUtilsRef) {
      return [];
    }

    const today = TimeUtilsRef.formatDate(new Date());
    return this.getMeetsByDate(today);
  }

  /**
   * Get this week's meets
    * @returns {MeetRecord[]} - Array of this week's meets
   */
  getThisWeeksMeets() {
    const today = new Date();
    const weekStart = new Date(today.getTime() - (today.getDay() * 24 * 60 * 60 * 1000));
    const weekEnd = new Date(weekStart.getTime() + (7 * 24 * 60 * 60 * 1000));

    return this.getAllMeets().filter(meet => {
      const meetDate = new Date(meet.date);
      return meetDate >= weekStart && meetDate < weekEnd;
    }).sort((a, b) => new Date(a.date) - new Date(b.date));
  }

  /**
   * Search meets by term
   * @param {string} searchTerm - Term to search for
    * @returns {Meet[]} - Array of meets matching search term
   */
  searchMeets(searchTerm) {
    if (!searchTerm || searchTerm.trim() === '') {
      return this.getAllMeets();
    }

    return this.getAllMeets().filter(meet => meet.matchesSearchTerm(searchTerm));
  }

  /**
   * Get meet statistics
   * @returns {Object} - Statistics about meets
   */
  getStatistics() {
    const allMeets = this.getAllMeets();
    const upcomingMeets = this.getUpcomingMeets();
    const pastMeets = this.getPastMeets();
    const todaysMeets = this.getTodaysMeets();

    // Pool usage statistics
    const poolUsage = {};
    allMeets.forEach(meet => {
      if (meet.getLocation()) {
        poolUsage[meet.getLocation()] = (poolUsage[meet.getLocation()] || 0) + 1;
      }
    });

    // Team participation statistics
    const teamParticipation = {};
    allMeets.forEach(meet => {
      meet.getParticipatingTeams().forEach(team => { teamParticipation[team] = (teamParticipation[team] || 0) + 1; });
    });

    // Monthly distribution
    const monthlyDistribution = {};
    allMeets.forEach(meet => {
      const meetDate = new Date(meet.date);
      const monthKey = `${meetDate.getFullYear()}-${String(meetDate.getMonth() + 1).padStart(2, '0')}`;
      monthlyDistribution[monthKey] = (monthlyDistribution[monthKey] || 0) + 1;
    });

    return {
      totalMeets: allMeets.length,
      upcomingMeets: upcomingMeets.length,
      pastMeets: pastMeets.length,
      todaysMeets: todaysMeets.length,
      poolUsage,
      teamParticipation,
      monthlyDistribution,
      lastUpdated: this.lastUpdated
    };
  }

  /**
   * Check if pool has meet on specific date
   * @param {string} poolName - Pool name
   * @param {string} date - Date to check
   * @returns {boolean} - True if pool has meet on date
   */
  poolHasMeetOnDate(poolName, date) {
    const meets = this.getMeetsByDate(date);
    return meets.some(meet => meet.occursAtPool(poolName));
  }

  /**
   * Get conflicts for a pool on a date
   * @param {string} poolName - Pool name
   * @param {string} date - Date to check
    * @returns {Meet[]} - Array of conflicting meets
   */
  getPoolConflicts(poolName, date) {
    return this.getMeetsByDate(date).filter(meet => meet.occursAtPool(poolName));
  }

  /**
   * Export meets data
   * @returns {Object} - All meets data as plain object
   */
  exportData() {
    return {
      meetTimes: this.getMeetTimes(),
      meets: this.getAllMeets(),
      statistics: this.getStatistics(),
      lastUpdated: this.lastUpdated
    };
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
    this.meetTimes = {};
    this.lastUpdated = null;
    this.dataLoaded = false;
  }

  /**
   * Get meets summary for display
   * @returns {Array} - Array of meet summaries
   */
  getMeetsSummary() {
    const TimeUtilsRef = this._getTimeUtils();
    if (!TimeUtilsRef) {
      return [];
    }

    return this.getAllMeets().map(meet => ({
      date: meet.date,
      formattedDate: TimeUtilsRef.formatDateForDisplay(new Date(meet.date)),
      time: meet.getDisplayTime() === 'Time not published' ? 'TBD' : meet.getDisplayTime(),
      homeTeam: meet.getHomeTeam() || 'TBD',
      awayTeam: meet.getVisitingTeam() || 'TBD',
      location: meet.getLocation() || 'TBD',
      isUpcoming: new Date(meet.date) >= new Date(),
      isPast: new Date(meet.date) < new Date(),
      isToday: meet.date === TimeUtilsRef.formatDate(new Date())
    }));
  }

  /**
   * Get TimeUtils reference safely
   * @private
   * @returns {Object|null} - TimeUtils object or null if not available
   */
  _getTimeUtils() {
    if (typeof window !== 'undefined' && window.TimeUtils) {
      return window.TimeUtils;
    }
    if (typeof TimeUtils !== 'undefined') {
      return TimeUtils;
    }
    console.error('TimeUtils is not available in MeetsManager');
    return null;
  }
}

// Export for Node.js compatibility
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MeetsManager;
}

// Make sure it's available globally
if (typeof window !== 'undefined') {
  window.MeetsManager = MeetsManager;
}

}
