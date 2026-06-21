/**
 * Coordinates the published team collection and practice-pool index.
 */

// Prevent multiple declarations
if (typeof globalThis.TeamsManager === 'undefined') {

  /** Coordinates the published team collection and team-level queries. */
  class TeamsManager {
  /** Creates an empty team collection manager. */
  constructor() {
    /** @type {Map<string, Team>} */
    this.teams = new Map();
    /** @type {Map<string, Team[]>} */
    this.practiceTeamsByPool = new Map();
    this.dataLoaded = false;
  }

  /**
   * Load teams data from JSON
    * @param {TeamsDocument} teamsData - Published annual teams document
   */
  loadData(teamsData) {
    this.teams.clear();
    this.practiceTeamsByPool.clear();
    this.dataLoaded = false;

    if (teamsData && Array.isArray(teamsData.teams)) {
      teamsData.teams.forEach(teamData => {
        const team = new Team(teamData);
        this.teams.set(team.name, team);
      });
      this._rebuildPracticePoolIndex();

      this.dataLoaded = true;
    }
  }

  /**
   * Get all teams
    * @returns {Team[]} - Array of all team objects
   */
  getAllTeams() {
    return Array.from(this.teams.values());
  }


  /**
   * Get teams that explicitly publish a pool as a practice location.
   * @param {string} poolName - Pool name
   * @returns {Team[]} - Teams practicing at the pool
   */
  getPracticeTeamsByPool(poolName) {
    return [...(this.practiceTeamsByPool.get(poolName) || [])];
  }

  /**
   * Rebuilds the practice-pool lookup from the current team collection.
   * @private
   */
  _rebuildPracticePoolIndex() {
    this.practiceTeamsByPool.clear();
    this.getAllTeams().forEach(team => {
      team.practicePools.forEach(poolName => {
        const teams = this.practiceTeamsByPool.get(poolName) || [];
        teams.push(team);
        this.practiceTeamsByPool.set(poolName, teams);
      });
    });
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
    this.dataLoaded = false;
  }
}

globalThis.TeamsManager = TeamsManager;

}
