/**
 * Individual swim meet record with published-schema interpretation.
 */
if (typeof window === 'undefined' || !window.Meet) {
  class Meet {
    /**
     * @param {MeetRecord} meetData - Published annual meet record
     */
    constructor(meetData = {}) {
      Object.assign(this, meetData);
      this.date = meetData.date || '';
      this.name = meetData.name || '';
      this.home_team = meetData.home_team || '';
      this.visiting_team = meetData.visiting_team || '';
      this.location = meetData.location || '';

      this.homeTeam = this.home_team;
      this.awayTeam = this.visiting_team;
      this.homePool = this.location;
    }

    getHomeTeam() {
      return this.home_team;
    }

    getVisitingTeam() {
      return this.visiting_team;
    }

    getLocation() {
      return this.location;
    }

    getParticipatingTeams() {
      return [this.home_team, this.visiting_team].flatMap(label => String(label || '').split(','))
        .map(team => team.trim())
        .filter(Boolean);
    }

    includesTeam(teamName) {
      return this.getParticipatingTeams().includes(teamName);
    }

    occursAtPool(poolName) {
      const normalize = pool => String(pool || '').trim().replace(/\s+pool$/i, '').toLowerCase();
      return normalize(this.location) !== '' && normalize(this.location) === normalize(poolName);
    }

    isSpecialMeet() {
      return !this.home_team && !this.visiting_team;
    }

    matchesSearchTerm(searchTerm) {
      const term = String(searchTerm || '').toLowerCase();
      return [this.home_team, this.visiting_team, this.location, this.date, this.time, this.name]
        .some(value => Boolean(value && value.toLowerCase().includes(term)));
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Meet;
  }

  if (typeof window !== 'undefined') {
    window.Meet = Meet;
  }
}