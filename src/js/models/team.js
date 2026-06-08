/**
 * Individual swim team record with reusable team-level behavior.
 */
if (typeof window === 'undefined' || !window.Team) {
  class Team {
    /**
     * @param {TeamRecord} teamData - Published annual team record
     */
    constructor(teamData = {}) {
      Object.assign(this, teamData);
      this.id = teamData.id || '';
      this.name = teamData.name || '';
      this.homePools = Array.isArray(teamData.homePools) ? [...teamData.homePools] : [];
      this.practicePools = Array.isArray(teamData.practicePools) ? [...teamData.practicePools] : [];
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

    getHomePools() {
      return [...this.homePools];
    }

    getPracticePools() {
      return [...this.practicePools];
    }

    getMeetTimeOverride(eventType) {
      const timingWindow = this.meetTimeOverrides[eventType];
      return timingWindow ? { ...timingWindow } : null;
    }

    getCoaches() {
      return [...this.staff.coaches];
    }

    getManagers() {
      return [...this.staff.managers];
    }

    getContacts() {
      return [...this.staff.contacts];
    }

    getPrimaryPoolName() {
      return this.homePools[0] || this.poolName || '';
    }

    includesPool(poolName) {
      return [...this.homePools, ...this.practicePools, this.poolName].filter(Boolean).includes(poolName);
    }

    includesCoach(coachName) {
      const term = String(coachName || '').toLowerCase();
      return this.staff.coaches.some(coach => coach.name.toLowerCase().includes(term))
        || Boolean(this.coach && this.coach.toLowerCase().includes(term));
    }

    matchesSearchTerm(searchTerm) {
      const term = String(searchTerm || '').toLowerCase();
      const staff = [...this.staff.coaches, ...this.staff.managers];
      return this.name.toLowerCase().includes(term)
        || [...this.homePools, ...this.practicePools].some(pool => pool.toLowerCase().includes(term))
        || staff.some(member => member.name.toLowerCase().includes(term) || Boolean(member.email && member.email.toLowerCase().includes(term)))
        || this.staff.contacts.some(contact => contact.email.toLowerCase().includes(term))
        || Boolean(this.poolName && this.poolName.toLowerCase().includes(term))
        || Boolean(this.coach && this.coach.toLowerCase().includes(term))
        || Boolean(this.division && this.division.toLowerCase().includes(term));
    }

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
        coach: (coaches[0] && coaches[0].name) || this.coach || 'Not specified',
        email: (staffWithEmail && staffWithEmail.email) || (sharedContact && sharedContact.email) || this.email || 'Not available',
        phone: this.phone || 'Not available',
        poolName: this.getPrimaryPoolName() || 'Not specified'
      };
    }

    getSummary() {
      const coaches = this.getCoaches();
      const managers = this.getManagers();
      const contacts = this.getContacts();
      return {
        name: this.name,
        poolName: this.getPrimaryPoolName() || 'Not specified',
        division: this.division || 'Not specified',
        coaches,
        managers,
        contacts,
        coach: (coaches[0] && coaches[0].name) || this.coach || 'Not specified',
        memberCount: this.roster ? this.roster.length : 0,
        hasSchedule: Boolean(this.schedule && this.schedule.length > 0),
        contact: {
          hasEmail: Boolean(this.email) || [...coaches, ...managers].some(member => Boolean(member.email)) || contacts.length > 0,
          hasPhone: Boolean(this.phone)
        }
      };
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Team;
  }

  if (typeof window !== 'undefined') {
    window.Team = Team;
  }
}
