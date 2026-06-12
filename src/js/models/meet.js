/**
 * Individual swim meet record with published-schema interpretation.
 */
if (typeof globalThis.Meet === 'undefined') {
  /**
   * Represents a published swim meet and its participating teams and timing state.
   */
  class Meet {
    /**
     * Creates a meet from a published annual record and timing-window definitions.
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

    /**
     * Gets the published home-team label.
     * @returns {string} Home-team label, or an empty string when unavailable
     */
    getHomeTeam() {
      return this.home_team;
    }

    /**
     * Gets the published visiting-team label.
     * @returns {string} Visiting-team label, or an empty string when unavailable
     */
    getVisitingTeam() {
      return this.visiting_team;
    }

    /**
     * Gets the published meet location.
     * @returns {string} Meet location, or an empty string when unavailable
     */
    getLocation() {
      return this.location;
    }

    /**
     * Expands the published home and visiting labels into individual team names.
     * @returns {string[]} Participating team names
     */
    getParticipatingTeams() {
      return [this.home_team, this.visiting_team].flatMap(label => String(label || '').split(','))
        .map(team => team.trim())
        .filter(Boolean);
    }

    /**
     * Checks whether a team participates in the meet.
     * @param {string} teamName - Exact published team name to match
     * @returns {boolean} Whether the team participates
     */
    includesTeam(teamName) {
      return this.getParticipatingTeams().includes(teamName);
    }

    /**
     * Checks whether the normalized meet location matches a pool name.
     * @param {string} poolName - Pool name to compare
     * @returns {boolean} Whether the meet occurs at the pool
     */
    occursAtPool(poolName) {
      const normalize = pool => String(pool || '').trim().replace(/\s+pool$/i, '').toLowerCase();
      return normalize(this.location) !== '' && normalize(this.location) === normalize(poolName);
    }

    /**
     * Checks whether the meet omits regular dual-meet team assignments.
     * @returns {boolean} Whether this is a special meet
     */
    isSpecialMeet() {
      return !this.home_team && !this.visiting_team;
    }

    /**
     * Gets the timing-window key assigned to the meet.
     * @returns {string} Published or default timing-window key
     */
    getTimeWindowKey() {
      return this.timeWindowKey;
    }

    /**
     * Formats the published first-swim time for meet-day planning.
     * @returns {string} Twelve-hour first-swim time, or an empty string when unavailable
     */
    getFirstSwimDisplayTime() {
      return Meet.formatClockTime(this.timingWindow?.firstSwimTime);
    }

    /**
     * Formats the published relay check-in deadline for meet-day planning.
     * @returns {string} Twelve-hour relay check-in deadline, or an empty string when unavailable
     */
    getRelayCheckInDeadlineDisplayTime() {
      return Meet.formatClockTime(this.timingWindow?.relayCheckInDeadline);
    }

    /**
     * Converts a 24-hour clock value to minutes after midnight.
     * @param {string} value - Time in `HH:mm` format
     * @returns {number|null} Minute of day, or null for an invalid value
     */
    static getClockMinutes(value) {
      const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(value || ''));
      return match ? (Number(match[1]) * 60) + Number(match[2]) : null;
    }

    /**
     * Formats a 24-hour clock value for display.
     * @param {string} value - Time in `HH:mm` format
     * @returns {string} Twelve-hour display time, or an empty string for an invalid value
     */
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
      * @param {MeetTimingWindow|null} overrideTimingWindow - Optional team-specific published window
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
      * @param {MeetTimingWindow|null} overrideTimingWindow - Optional team-specific published window
      * @returns {MeetLiveStatusValue|null} Current live state, or null for special meets/invalid time
     */
    getLiveStatus(easternTimeInfo, overrideTimingWindow = null) {
      const timingWindow = this.getKnownTimingWindow(overrideTimingWindow);
      if (!timingWindow || !easternTimeInfo || easternTimeInfo.isValid === false) return null;
      if (typeof easternTimeInfo.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(easternTimeInfo.date) || !/^\d{4}-\d{2}-\d{2}$/.test(this.date)) return null;
      if (!Number.isFinite(easternTimeInfo.minutes)) return null;

      if (this.date < easternTimeInfo.date) return MeetLiveStatus.CONCLUDED;
      if (this.date > easternTimeInfo.date) return MeetLiveStatus.UPCOMING;
      if (easternTimeInfo.minutes < timingWindow.startMinutes) return MeetLiveStatus.UPCOMING;
      if (easternTimeInfo.minutes < timingWindow.endMinutes) return MeetLiveStatus.ONGOING;
      return MeetLiveStatus.CONCLUDED;
    }

    /**
     * Searches the meet's teams, location, date, time, and name.
     * @param {string} searchTerm - Case-insensitive term to match
     * @returns {boolean} Whether any searchable meet field matches
     */
    matchesSearchTerm(searchTerm) {
      const term = String(searchTerm || '').toLowerCase();
      return [this.home_team, this.visiting_team, this.location, this.date, this.time, this.name]
        .some(value => Boolean(value && value.toLowerCase().includes(term)));
    }
  }

  globalThis.Meet = Meet;
}
