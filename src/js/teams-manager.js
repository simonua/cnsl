/**
 * Teams management and operations
 */

// Prevent multiple declarations
if (!window.TeamsManager) {
  class TeamsManager {
  constructor() {
    this.teams = new Map();
    this.lastUpdated = null;
    this.dataLoaded = false;
  }

  /**
   * Load teams data from JSON
   * @param {Object} teamsData - Raw teams data from JSON
   */
  loadData(teamsData) {
    this.teams.clear();
    
    if (teamsData && teamsData.teams) {
      teamsData.teams.forEach(teamData => {
        this.teams.set(teamData.name, teamData);
      });
      
      this.lastUpdated = teamsData.lastUpdated || new Date().toISOString();
      this.dataLoaded = true;
    }
  }

  /**
   * Get a specific team by name
   * @param {string} teamName - Team name
   * @returns {Object|null} - Team object or null if not found
   */
  getTeam(teamName) {
    return this.teams.get(teamName) || null;
  }

  /**
   * Get all teams
   * @returns {Array} - Array of all team objects
   */
  getAllTeams() {
    return Array.from(this.teams.values());
  }

  /**
   * Get team names
   * @returns {Array} - Array of team names
   */
  getTeamNames() {
    return Array.from(this.teams.keys());
  }

  /**
   * Get teams count
   * @returns {number} - Number of teams
   */
  getTeamCount() {
    return this.teams.size;
  }

  /**
   * Search teams by term
   * @param {string} searchTerm - Term to search for
   * @returns {Array} - Array of teams matching search term
   */
  searchTeams(searchTerm) {
    if (!searchTerm || searchTerm.trim() === '') {
      return this.getAllTeams();
    }

    const term = searchTerm.toLowerCase();
    return this.getAllTeams().filter(team => {
      return (
        team.name.toLowerCase().includes(term) ||
        (team.poolName && team.poolName.toLowerCase().includes(term)) ||
        (team.coach && team.coach.toLowerCase().includes(term)) ||
        (team.division && team.division.toLowerCase().includes(term))
      );
    });
  }

  /**
   * Get teams by pool
   * @param {string} poolName - Pool name
   * @returns {Array} - Array of teams associated with pool
   */
  getTeamsByPool(poolName) {
    return this.getAllTeams().filter(team => team.poolName === poolName);
  }

  /**
   * Get teams by division
   * @param {string} division - Division name
   * @returns {Array} - Array of teams in division
   */
  getTeamsByDivision(division) {
    return this.getAllTeams().filter(team => team.division === division);
  }

  /**
   * Get teams by coach
   * @param {string} coachName - Coach name
   * @returns {Array} - Array of teams coached by specified coach
   */
  getTeamsByCoach(coachName) {
    return this.getAllTeams().filter(team => 
      team.coach && team.coach.toLowerCase().includes(coachName.toLowerCase())
    );
  }

  /**
   * Get all divisions
   * @returns {Array} - Array of unique divisions
   */
  getAllDivisions() {
    const divisions = new Set();
    this.getAllTeams().forEach(team => {
      if (team.division) {
        divisions.add(team.division);
      }
    });
    return Array.from(divisions).sort();
  }

  /**
   * Get all coaches
   * @returns {Array} - Array of unique coaches
   */
  getAllCoaches() {
    const coaches = new Set();
    this.getAllTeams().forEach(team => {
      if (team.coach) {
        coaches.add(team.coach);
      }
    });
    return Array.from(coaches).sort();
  }

  /**
   * Get team statistics
   * @returns {Object} - Statistics about teams
   */
  getStatistics() {
    const allTeams = this.getAllTeams();
    const divisions = this.getAllDivisions();
    const coaches = this.getAllCoaches();
    
    // Pool distribution
    const poolDistribution = {};
    allTeams.forEach(team => {
      if (team.poolName) {
        poolDistribution[team.poolName] = (poolDistribution[team.poolName] || 0) + 1;
      }
    });

    // Division distribution
    const divisionDistribution = {};
    allTeams.forEach(team => {
      if (team.division) {
        divisionDistribution[team.division] = (divisionDistribution[team.division] || 0) + 1;
      }
    });

    return {
      totalTeams: allTeams.length,
      totalDivisions: divisions.length,
      totalCoaches: coaches.length,
      poolDistribution,
      divisionDistribution,
      lastUpdated: this.lastUpdated
    };
  }

  /**
   * Get team roster information (if available)
   * @param {string} teamName - Team name
   * @returns {Object|null} - Team roster or null
   */
  getTeamRoster(teamName) {
    const team = this.getTeam(teamName);
    return team && team.roster ? team.roster : null;
  }

  /**
   * Get team schedule (if available)
   * @param {string} teamName - Team name
   * @returns {Array} - Team schedule array
   */
  getTeamSchedule(teamName) {
    const team = this.getTeam(teamName);
    return team && team.schedule ? team.schedule : [];
  }

  /**
   * Get team contact information
   * @param {string} teamName - Team name
   * @returns {Object|null} - Team contact info or null
   */
  getTeamContact(teamName) {
    const team = this.getTeam(teamName);
    if (!team) return null;

    return {
      teamName: team.name,
      coach: team.coach || 'Not specified',
      email: team.email || 'Not available',
      phone: team.phone || 'Not available',
      poolName: team.poolName || 'Not specified'
    };
  }

  /**
   * Export teams data
   * @returns {Object} - All teams data as plain object
   */
  exportData() {
    return {
      teams: this.getAllTeams(),
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
    this.teams.clear();
    this.lastUpdated = null;
    this.dataLoaded = false;
  }

  /**
   * Add or update a team
   * @param {Object} teamData - Team data object
   */
  addOrUpdateTeam(teamData) {
    if (teamData && teamData.name) {
      this.teams.set(teamData.name, teamData);
    }
  }

  /**
   * Remove a team
   * @param {string} teamName - Team name to remove
   * @returns {boolean} - True if team was removed
   */
  removeTeam(teamName) {
    return this.teams.delete(teamName);
  }

  /**
   * Get teams summary for display
   * @returns {Array} - Array of team summaries
   */
  getTeamsSummary() {
    return this.getAllTeams().map(team => ({
      name: team.name,
      poolName: team.poolName || 'Not specified',
      division: team.division || 'Not specified',
      coach: team.coach || 'Not specified',
      memberCount: team.roster ? team.roster.length : 0,
      hasSchedule: !!(team.schedule && team.schedule.length > 0),
      contact: {
        hasEmail: !!team.email,
        hasPhone: !!team.phone
      }
    }));
  }
}

// Make sure it's available globally
window.TeamsManager = TeamsManager;

}
