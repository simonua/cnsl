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
     * Gets the team's published home pools.
     * @returns {string[]} Copy of the home-pool names
     */
    getHomePools() {
      return [...this.homePools];
    }

    /**
     * Gets the team's published practice pools.
     * @returns {string[]} Copy of the practice-pool names
     */
    getPracticePools() {
      return [...this.practicePools];
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

    /**
     * Gets the team's published coaches.
     * @returns {StaffMemberRecord[]} Copy of the coach records
     */
    getCoaches() {
      return [...this.staff.coaches];
    }

    /**
     * Gets the team's published managers.
     * @returns {StaffMemberRecord[]} Copy of the manager records
     */
    getManagers() {
      return [...this.staff.managers];
    }

    /**
     * Gets the team's shared staff contacts.
     * @returns {StaffContactRecord[]} Copy of the contact records
     */
    getContacts() {
      return [...this.staff.contacts];
    }

    /**
    * Gets the team's primary home pool.
     * @returns {string} Primary pool name, or an empty string when unavailable
     */
    getPrimaryPoolName() {
      return this.homePools[0] || '';
    }

    /**
     * Checks whether the team is associated with a home or practice pool.
     * @param {string} poolName - Pool name to match
     * @returns {boolean} Whether the team includes the pool
     */
    includesPool(poolName) {
      return [...this.homePools, ...this.practicePools].includes(poolName);
    }

    /**
     * Checks whether a published coach name contains a search value.
     * @param {string} coachName - Coach name or partial name to match
     * @returns {boolean} Whether a coach matches the value
     */
    includesCoach(coachName) {
      const term = String(coachName || '').toLowerCase();
      return this.staff.coaches.some(coach => String(coach.name || '').toLowerCase().includes(term));
    }

    /**
    * Searches the team's identifying, pool, and staff fields.
     * @param {string} searchTerm - Case-insensitive term to match
     * @returns {boolean} Whether any searchable team field matches
     */
    matchesSearchTerm(searchTerm) {
      const term = String(searchTerm || '').toLowerCase();
      const staff = [...this.staff.coaches, ...this.staff.managers];
      return this.name.toLowerCase().includes(term)
        || [...this.homePools, ...this.practicePools].some(pool => pool.toLowerCase().includes(term))
        || staff.some(member => String(member.name || '').toLowerCase().includes(term) || Boolean(member.email && member.email.toLowerCase().includes(term)))
        || this.staff.contacts.some(contact => String(contact.email || '').toLowerCase().includes(term));
    }

    /**
     * Builds the team's normalized public contact information.
     * @returns {Object} Public team and staff contact details
     */
    getContactInfo() {
      const coaches = this.getCoaches();
      const managers = this.getManagers();
      const contacts = this.getContacts();
      const staffWithEmail = [...coaches, ...managers].find(member => member.email);
      const sharedContact = contacts[0];

      return {
        teamName: this.name,
        coaches,
        managers,
        contacts,
        coach: (coaches[0] && coaches[0].name) || 'Not specified',
        email: (staffWithEmail && staffWithEmail.email) || (sharedContact && sharedContact.email) || 'Not available',
        poolName: this.getPrimaryPoolName() || 'Not specified'
      };
    }

    /**
     * Builds a compact summary of the team and its available data.
     * @returns {Object} Team summary for manager and display consumers
     */
    getSummary() {
      const coaches = this.getCoaches();
      const managers = this.getManagers();
      const contacts = this.getContacts();
      return {
        name: this.name,
        poolName: this.getPrimaryPoolName() || 'Not specified',
        coaches,
        managers,
        contacts,
        coach: (coaches[0] && coaches[0].name) || 'Not specified',
        contact: {
          hasEmail: [...coaches, ...managers].some(member => Boolean(member.email)) || contacts.length > 0
        }
      };
    }
  }

  globalThis.Team = Team;
}
