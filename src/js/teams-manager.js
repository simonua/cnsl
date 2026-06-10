/**
 * Teams management and operations
 */

// Prevent multiple declarations
if (typeof globalThis.TeamsManager === 'undefined') {

  class TeamsManager {
  constructor() {
    /** @type {Map<string, Team>} */
    this.teams = new Map();
    /** @type {Map<string, Team[]>} */
    this.practiceTeamsByPool = new Map();
    this.lastUpdated = null;
    this.dataLoaded = false;
  }

  /**
   * Load teams data from JSON
    * @param {TeamsDocument} teamsData - Published annual teams document
   */
  loadData(teamsData) {
    this.teams.clear();
    this.practiceTeamsByPool.clear();

    if (teamsData && teamsData.teams) {
      teamsData.teams.forEach(teamData => {
        const team = new Team(teamData);
        this.teams.set(team.name, team);
      });
      this.rebuildPracticePoolIndex();

      this.lastUpdated = teamsData.lastUpdated || new Date().toISOString();
      this.dataLoaded = true;
    }
  }

  /**
   * Get a specific team by name
   * @param {string} teamName - Team name
    * @returns {Team|null} - Team object or null if not found
   */
  getTeam(teamName) {
    return this.teams.get(teamName) || null;
  }

  /**
   * Get all teams
    * @returns {Team[]} - Array of all team objects
   */
  getAllTeams() {
    return Array.from(this.teams.values());
  }

  /**
   * Get team names
    * @returns {string[]} - Array of team names
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
    * @returns {Team[]} - Array of teams matching search term
   */
  searchTeams(searchTerm) {
    if (!searchTerm || searchTerm.trim() === '') {
      return this.getAllTeams();
    }

    return this.getAllTeams().filter(team => team.matchesSearchTerm(searchTerm));
  }

  /**
   * Get teams by pool
   * @param {string} poolName - Pool name
    * @returns {Team[]} - Array of teams associated with pool
   */
  getTeamsByPool(poolName) {
    return this.getAllTeams().filter(team => team.includesPool(poolName));
  }

  /**
   * Get teams that explicitly publish a pool as a practice location.
   * @param {string} poolName - Pool name
   * @returns {Team[]} - Teams practicing at the pool
   */
  getPracticeTeamsByPool(poolName) {
    return [...(this.practiceTeamsByPool.get(poolName) || [])];
  }

  rebuildPracticePoolIndex() {
    this.practiceTeamsByPool.clear();
    this.getAllTeams().forEach(team => {
      team.getPracticePools().forEach(poolName => {
        const teams = this.practiceTeamsByPool.get(poolName) || [];
        teams.push(team);
        this.practiceTeamsByPool.set(poolName, teams);
      });
    });
  }

  /**
   * Get teams by division
   * @param {string} division - Division name
    * @returns {Team[]} - Array of teams in division
   */
  getTeamsByDivision(division) {
    return this.getAllTeams().filter(team => team.division === division);
  }

  /**
   * Get teams by coach
   * @param {string} coachName - Coach name
    * @returns {Team[]} - Array of teams coached by specified coach
   */
  getTeamsByCoach(coachName) {
    return this.getAllTeams().filter(team => team.includesCoach(coachName));
  }

  /**
   * Get publicly published coaches for a team.
    * @param {Team} team - Team object
    * @returns {StaffMemberRecord[]} - Published coach records
   */
  getTeamCoaches(team) {
    return team.getCoaches();
  }

  /**
   * Get publicly published managers for a team.
    * @param {Team} team - Team object
    * @returns {StaffMemberRecord[]} - Published manager records
   */
  getTeamManagers(team) {
    return team.getManagers();
  }

  /**
   * Get publicly published shared staff contacts for a team.
    * @param {Team} team - Team object
    * @returns {StaffContactRecord[]} - Published contact records
   */
  getTeamContacts(team) {
    return team.getContacts();
  }

  /**
   * Get all divisions
    * @returns {string[]} - Array of unique divisions
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
    * @returns {string[]} - Array of unique coaches
   */
  getAllCoaches() {
    const coaches = new Set();
    this.getAllTeams().forEach(team => {
      this.getTeamCoaches(team).forEach(coach => coaches.add(coach.name));
      if (team.coach) {
        coaches.add(team.coach);
      }
    });
    return Array.from(coaches).sort();
  }

  /**
   * Get all publicly published managers.
    * @returns {string[]} - Array of unique manager names
   */
  getAllManagers() {
    const managers = new Set();
    this.getAllTeams().forEach(team => {
      this.getTeamManagers(team).forEach(manager => managers.add(manager.name));
    });
    return Array.from(managers).sort();
  }

  /**
   * Get team statistics
   * @returns {Object} - Statistics about teams
   */
  getStatistics() {
    const allTeams = this.getAllTeams();
    const divisions = this.getAllDivisions();
    const coaches = this.getAllCoaches();
    const managers = this.getAllManagers();

    // Pool distribution
    const poolDistribution = {};
    allTeams.forEach(team => {
      const poolName = team.getPrimaryPoolName();
      if (poolName) {
        poolDistribution[poolName] = (poolDistribution[poolName] || 0) + 1;
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
      totalManagers: managers.length,
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
    return team.getContactInfo();
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
    this.practiceTeamsByPool.clear();
    this.lastUpdated = null;
    this.dataLoaded = false;
  }

  /**
   * Add or update a team
    * @param {TeamRecord} teamData - Team data object
   */
  addOrUpdateTeam(teamData) {
    if (teamData && teamData.name) {
      const team = teamData instanceof Team ? teamData : new Team(teamData);
      this.teams.set(team.name, team);
      this.rebuildPracticePoolIndex();
    }
  }

  /**
   * Remove a team
   * @param {string} teamName - Team name to remove
   * @returns {boolean} - True if team was removed
   */
  removeTeam(teamName) {
    const removed = this.teams.delete(teamName);
    if (removed) this.rebuildPracticePoolIndex();
    return removed;
  }

  /**
   * Get teams summary for display
   * @returns {Array} - Array of team summaries
   */
  getTeamsSummary() {
    return this.getAllTeams().map(team => team.getSummary());
  }
}

globalThis.TeamsManager = TeamsManager;

}
