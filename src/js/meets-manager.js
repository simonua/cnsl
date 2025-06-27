/**
 * Meets management and scheduling operations
 */
class MeetsManager {
  constructor() {
    this.meets = new Map();
    this.lastUpdated = null;
    this.dataLoaded = false;
  }

  /**
   * Load meets data from JSON
   * @param {Object} meetsData - Raw meets data from JSON
   */
  loadData(meetsData) {
    this.meets.clear();
    
    let meetsList = [];
    
    // Handle both old format (meets) and new format (regular_meets + special_meets)
    if (meetsData && meetsData.meets) {
      meetsList = meetsData.meets;
    } else {
      // Combine regular and special meets
      if (meetsData && meetsData.regular_meets) {
        meetsList = [...meetsData.regular_meets];
      }
      if (meetsData && meetsData.special_meets) {
        meetsList = [...meetsList, ...meetsData.special_meets];
      }
    }
    
    if (meetsList.length > 0) {
      meetsList.forEach((meetData, index) => {
        // Create unique key from date, teams, and location
        const meetKey = `${meetData.date}_${meetData.home_team || meetData.homeTeam || 'special'}_${meetData.visiting_team || meetData.awayTeam || 'meet'}_${index}`;
        this.meets.set(meetKey, meetData);
      });
      
      this.lastUpdated = meetsData.lastUpdated || new Date().toISOString();
      this.dataLoaded = true;
      
      console.log(`📅 MEETS: Loaded ${meetsList.length} meets (regular + special)`);
    }
  }

  /**
   * Get all meets
   * @returns {Array} - Array of all meet objects
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

  /**
   * Get meets by date
   * @param {string} date - Date in YYYY-MM-DD format
   * @returns {Array} - Array of meets on specified date
   */
  getMeetsByDate(date) {
    return this.getAllMeets().filter(meet => meet.date === date);
  }

  /**
   * Get meets by pool
   * @param {string} poolName - Pool name
   * @returns {Array} - Array of meets at specified pool
   */
  getMeetsByPool(poolName) {
    return this.getAllMeets().filter(meet => 
      meet.homePool === poolName || meet.awayPool === poolName
    );
  }

  /**
   * Get home meets for a pool
   * @param {string} poolName - Pool name
   * @returns {Array} - Array of home meets for pool
   */
  getHomeMeetsByPool(poolName) {
    return this.getAllMeets().filter(meet => meet.homePool === poolName);
  }

  /**
   * Get away meets for a pool
   * @param {string} poolName - Pool name
   * @returns {Array} - Array of away meets for pool
   */
  getAwayMeetsByPool(poolName) {
    return this.getAllMeets().filter(meet => meet.awayPool === poolName);
  }

  /**
   * Get meets by team
   * @param {string} teamName - Team name
   * @returns {Array} - Array of meets involving specified team
   */
  getMeetsByTeam(teamName) {
    return this.getAllMeets().filter(meet => 
      meet.homeTeam === teamName || meet.awayTeam === teamName
    );
  }

  /**
   * Get upcoming meets
   * @param {number} days - Number of days ahead to look (default 30)
   * @returns {Array} - Array of upcoming meets
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
   * @returns {Array} - Array of past meets
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
   * @returns {Array} - Array of today's meets
   */
  getTodaysMeets() {
    const today = TimeUtils.formatDate(new Date());
    return this.getMeetsByDate(today);
  }

  /**
   * Get this week's meets
   * @returns {Array} - Array of this week's meets
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
   * @returns {Array} - Array of meets matching search term
   */
  searchMeets(searchTerm) {
    if (!searchTerm || searchTerm.trim() === '') {
      return this.getAllMeets();
    }

    const term = searchTerm.toLowerCase();
    return this.getAllMeets().filter(meet => {
      return (
        (meet.home_team && meet.home_team.toLowerCase().includes(term)) ||
        (meet.visiting_team && meet.visiting_team.toLowerCase().includes(term)) ||
        (meet.homeTeam && meet.homeTeam.toLowerCase().includes(term)) ||
        (meet.awayTeam && meet.awayTeam.toLowerCase().includes(term)) ||
        (meet.homePool && meet.homePool.toLowerCase().includes(term)) ||
        (meet.awayPool && meet.awayPool.toLowerCase().includes(term)) ||
        (meet.location && meet.location.toLowerCase().includes(term)) ||
        (meet.date && meet.date.includes(term)) ||
        (meet.time && meet.time.toLowerCase().includes(term)) ||
        (meet.name && meet.name.toLowerCase().includes(term))
      );
    });
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
      if (meet.homePool) {
        poolUsage[meet.homePool] = (poolUsage[meet.homePool] || 0) + 1;
      }
    });

    // Team participation statistics
    const teamParticipation = {};
    allMeets.forEach(meet => {
      if (meet.homeTeam) {
        teamParticipation[meet.homeTeam] = (teamParticipation[meet.homeTeam] || 0) + 1;
      }
      if (meet.awayTeam) {
        teamParticipation[meet.awayTeam] = (teamParticipation[meet.awayTeam] || 0) + 1;
      }
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
   * Get meet details
   * @param {string} meetKey - Meet key (date_homePool_awayPool)
   * @returns {Object|null} - Meet details or null
   */
  getMeetDetails(meetKey) {
    return this.meets.get(meetKey) || null;
  }

  /**
   * Get meet by details
   * @param {string} date - Date
   * @param {string} homePool - Home pool name
   * @param {string} awayPool - Away pool name
   * @returns {Object|null} - Meet details or null
   */
  getMeetByDetails(date, homePool, awayPool) {
    const meetKey = `${date}_${homePool}_${awayPool}`;
    return this.getMeetDetails(meetKey);
  }

  /**
   * Check if pool has meet on specific date
   * @param {string} poolName - Pool name
   * @param {string} date - Date to check
   * @returns {boolean} - True if pool has meet on date
   */
  poolHasMeetOnDate(poolName, date) {
    const meets = this.getMeetsByDate(date);
    return meets.some(meet => meet.homePool === poolName || meet.awayPool === poolName);
  }

  /**
   * Get conflicts for a pool on a date
   * @param {string} poolName - Pool name
   * @param {string} date - Date to check
   * @returns {Array} - Array of conflicting meets
   */
  getPoolConflicts(poolName, date) {
    return this.getMeetsByDate(date).filter(meet => 
      meet.homePool === poolName || meet.awayPool === poolName
    );
  }

  /**
   * Export meets data
   * @returns {Object} - All meets data as plain object
   */
  exportData() {
    return {
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
    this.lastUpdated = null;
    this.dataLoaded = false;
  }

  /**
   * Add or update a meet
   * @param {Object} meetData - Meet data object
   */
  addOrUpdateMeet(meetData) {
    if (meetData && meetData.date && meetData.homePool && meetData.awayPool) {
      const meetKey = `${meetData.date}_${meetData.homePool}_${meetData.awayPool}`;
      this.meets.set(meetKey, meetData);
    }
  }

  /**
   * Remove a meet
   * @param {string} date - Date
   * @param {string} homePool - Home pool
   * @param {string} awayPool - Away pool
   * @returns {boolean} - True if meet was removed
   */
  removeMeet(date, homePool, awayPool) {
    const meetKey = `${date}_${homePool}_${awayPool}`;
    return this.meets.delete(meetKey);
  }

  /**
   * Get meets summary for display
   * @returns {Array} - Array of meet summaries
   */
  getMeetsSummary() {
    return this.getAllMeets().map(meet => ({
      date: meet.date,
      formattedDate: TimeUtils.formatDateForDisplay(new Date(meet.date)),
      time: meet.time || 'TBD',
      homeTeam: meet.homeTeam || 'TBD',
      awayTeam: meet.awayTeam || 'TBD',
      homePool: meet.homePool || 'TBD',
      awayPool: meet.awayPool || 'TBD',
      isUpcoming: new Date(meet.date) >= new Date(),
      isPast: new Date(meet.date) < new Date(),
      isToday: meet.date === TimeUtils.formatDate(new Date())
    }));
  }
}
