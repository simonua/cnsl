/**
 * Individual swim meet record with published-schema interpretation.
 */
if (typeof window === 'undefined' || !window.Meet) {
  class Meet {
    static REGULAR_DUAL_MEET_WINDOW = Object.freeze({
      startMinutes: 8 * 60,
      endMinutes: 12 * 60,
      displayTime: '8:00 AM - 12:00 PM'
    });

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

    /**
     * Get the approved public schedule window for standard dual meets.
     * @returns {{ startMinutes: number, endMinutes: number, displayTime: string }|null} Known timing window
     */
    getKnownTimingWindow() {
      return this.isSpecialMeet() ? null : Meet.REGULAR_DUAL_MEET_WINDOW;
    }

    /**
     * Format the known schedule time without applying the dual-meet convention to special meets.
     * @returns {string} Displayable published or approved schedule time
     */
    getDisplayTime() {
      const knownTimingWindow = this.getKnownTimingWindow();
      return this.time || (knownTimingWindow ? knownTimingWindow.displayTime : 'Time not published');
    }

    /**
     * Classify a regular dual meet at the supplied Eastern date and time.
     * @param {{ date: string, minutes: number, isValid?: boolean }} easternTimeInfo - Current Eastern wall-clock value
     * @returns {'upcoming'|'ongoing'|'concluded'|null} Current live state, or null for special meets/invalid time
     */
    getLiveStatus(easternTimeInfo) {
      const timingWindow = this.getKnownTimingWindow();
      if (!timingWindow || !easternTimeInfo || easternTimeInfo.isValid === false) return null;
      if (typeof easternTimeInfo.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(easternTimeInfo.date) || !/^\d{4}-\d{2}-\d{2}$/.test(this.date)) return null;
      if (!Number.isFinite(easternTimeInfo.minutes)) return null;

      if (this.date < easternTimeInfo.date) return 'concluded';
      if (this.date > easternTimeInfo.date) return 'upcoming';
      if (easternTimeInfo.minutes < timingWindow.startMinutes) return 'upcoming';
      if (easternTimeInfo.minutes < timingWindow.endMinutes) return 'ongoing';
      return 'concluded';
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