/**
 * Individual swim meet record with published-schema interpretation.
 */
if (typeof window === 'undefined' || !window.Meet) {
  class Meet {
    /**
     * @param {MeetRecord} meetData - Published annual meet record
     * @param {Object<string, MeetTimingWindow>} meetTimes - Standard timing windows from annual meet data
     * @param {string} defaultTimeWindowKey - Default timing key assigned by the meet collection
     */
    constructor(meetData = {}, meetTimes = {}, defaultTimeWindowKey = '') {
      Object.assign(this, meetData);
      this.date = meetData.date || '';
      this.name = meetData.name || '';
      this.home_team = meetData.home_team || '';
      this.visiting_team = meetData.visiting_team || '';
      this.location = meetData.location || '';
      this.timeWindowKey = meetData.timeWindowKey || defaultTimeWindowKey;
      this.timingWindow = meetTimes[this.timeWindowKey] ? { ...meetTimes[this.timeWindowKey] } : null;

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

    getTimeWindowKey() {
      return this.timeWindowKey;
    }

    static getClockMinutes(value) {
      const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(value || ''));
      return match ? (Number(match[1]) * 60) + Number(match[2]) : null;
    }

    static formatClockTime(value) {
      const minutes = Meet.getClockMinutes(value);
      if (minutes === null) return '';

      const hour = Math.floor(minutes / 60);
      const minute = String(minutes % 60).padStart(2, '0');
      const period = hour < 12 ? 'AM' : 'PM';
      const displayHour = hour % 12 || 12;
      return `${displayHour}:${minute} ${period}`;
    }

    /**
     * Get the published standard or team-overridden schedule window.
     * @param {MeetTimingWindow|null} overrideTimingWindow - Optional team-specific published window
     * @returns {{ startMinutes: number, endMinutes: number, displayTime: string }|null} Known timing window
     */
    getKnownTimingWindow(overrideTimingWindow = null) {
      const timingWindow = overrideTimingWindow || this.timingWindow;
      const startMinutes = Meet.getClockMinutes(timingWindow?.start);
      const endMinutes = Meet.getClockMinutes(timingWindow?.end);
      if (startMinutes === null || endMinutes === null || startMinutes >= endMinutes) return null;

      return {
        startMinutes,
        endMinutes,
        displayTime: `${Meet.formatClockTime(timingWindow.start)} - ${Meet.formatClockTime(timingWindow.end)}`
      };
    }

    /**
     * Format the known schedule time without applying the dual-meet convention to special meets.
     * @returns {string} Displayable published or approved schedule time
     */
    getDisplayTime(overrideTimingWindow = null) {
      const knownTimingWindow = this.getKnownTimingWindow(overrideTimingWindow);
      if (overrideTimingWindow && knownTimingWindow) return knownTimingWindow.displayTime;
      return this.time || (knownTimingWindow ? knownTimingWindow.displayTime : 'Time not published');
    }

    /**
     * Classify a regular dual meet at the supplied Eastern date and time.
     * @param {{ date: string, minutes: number, isValid?: boolean }} easternTimeInfo - Current Eastern wall-clock value
     * @returns {'upcoming'|'ongoing'|'concluded'|null} Current live state, or null for special meets/invalid time
     */
    getLiveStatus(easternTimeInfo, overrideTimingWindow = null) {
      const timingWindow = this.getKnownTimingWindow(overrideTimingWindow);
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
