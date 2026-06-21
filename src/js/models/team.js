/**
 * Individual swim team record with reusable team-level behavior.
 */
if (typeof globalThis.Team === 'undefined') {
  /**
   * Represents a published swim team and its pools, staff, schedule, and contact details.
   */
  class Team {
    /**
     * Creates a team from a published annual record.
     * @param {TeamRecord} teamData - Published annual team record
     */
    constructor(teamData = {}) {
      this.id = teamData.id || '';
      this.name = teamData.name || '';
      this.shortName = teamData.shortName || '';
      this.keywords = Array.isArray(teamData.keywords) ? [...teamData.keywords] : [];
      this.url = teamData.url || '';
      this.resultsUrl = teamData.resultsUrl || '';
      this.calendarUrl = teamData.calendarUrl || '';
      this.eventsSubscriptionUrl = teamData.eventsSubscriptionUrl || '';
      this.merchandiseUrl = teamData.merchandiseUrl || '';
      this.booster = teamData.booster || null;
      this.homePools = Array.isArray(teamData.homePools) ? [...teamData.homePools] : [];
      this.timeTrialsPool = teamData.timeTrialsPool || '';
      this.practicePools = Array.isArray(teamData.practicePools) ? [...teamData.practicePools] : [];
      this.homeMeetGuides = Array.isArray(teamData.homeMeetGuides) ? [...teamData.homeMeetGuides] : [];
      this.practice = teamData.practice || null;
      this.meetTimeOverrides = Object.fromEntries(Object.entries(teamData.meetTimeOverrides || {})
        .map(([key, timingWindow]) => [key, { ...timingWindow }]));
      const staff = teamData.staff || {};
      this.staff = {
        ...staff,
        coaches: Array.isArray(staff.coaches) ? [...staff.coaches] : [],
        managers: Array.isArray(staff.managers) ? [...staff.managers] : [],
        contacts: Array.isArray(staff.contacts) ? [...staff.contacts] : []
      };
    }

    /**
     * Gets the team-specific timing window for a meet type.
     * @param {string} eventType - Published meet timing key
     * @returns {MeetTimingWindow|null} Copy of the timing window, or null when none is published
     */
    getMeetTimeOverride(eventType) {
      const timingWindow = this.meetTimeOverrides[eventType];
      return timingWindow ? { ...timingWindow } : null;
    }

  }

  globalThis.Team = Team;
}
