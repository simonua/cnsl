/**
 * Individual pool class with contextual methods
 */
class Pool {
  constructor(poolData) {
    this.name = poolData.name || '';
    this.address = poolData.address || '';
    this.phone = poolData.phone || '';
    this.website = poolData.website || '';
    this.features = poolData.features || [];
    this.amenities = poolData.amenities || [];
    this.divingBoard = poolData.divingBoard || false;
    this.babyPool = poolData.babyPool || false;
    this.schedule = new PoolSchedule(poolData.hours || {});
    this.restrictions = poolData.restrictions || [];
    this.specialEvents = poolData.specialEvents || [];
    this.lastUpdated = poolData.lastUpdated || null;
  }

  /**
   * Get pool name (enum-style access)
   * @returns {string} - Pool name
   */
  getName() {
    return this.name;
  }

  /**
   * Get pool features
   * @returns {Array} - Array of pool features
   */
  getFeatures() {
    return [...this.features];
  }

  /**
   * Check if pool has a specific feature
   * @param {string} feature - Feature to check for
   * @returns {boolean} - True if pool has feature
   */
  hasFeature(feature) {
    return this.features.includes(feature);
  }

  /**
   * Get pool amenities
   * @returns {Array} - Array of pool amenities
   */
  getAmenities() {
    return [...this.amenities];
  }

  /**
   * Check if pool has a specific amenity
   * @param {string} amenity - Amenity to check for
   * @returns {boolean} - True if pool has amenity
   */
  hasAmenity(amenity) {
    return this.amenities.includes(amenity);
  }

  /**
   * Get contact information
   * @returns {Object} - Contact information object
   */
  getContactInfo() {
    return {
      address: this.address,
      phone: this.phone,
      website: this.website
    };
  }

  /**
   * Get current pool status
   * @returns {PoolStatus} - Current pool status
   */
  getCurrentStatus() {
    return this.schedule.getCurrentStatus();
  }

  /**
   * Get status at specific time
   * @param {string} dayName - Day name
   * @param {Date} time - Time to check
   * @returns {PoolStatus} - Pool status at specified time
   */
  getStatusAtTime(dayName, time = new Date()) {
    return this.schedule.getStatusAtTime(dayName, time);
  }

  /**
   * Get hours for a specific day
   * @param {string} dayName - Day name
   * @returns {string} - Formatted hours string
   */
  getHoursForDay(dayName) {
    return this.schedule.getFormattedHours(dayName);
  }

  /**
   * Get all week schedule with status
   * @returns {Array} - Array of day objects with status
   */
  getWeekSchedule() {
    return this.schedule.getAllDaysStatus();
  }

  /**
   * Get time slots for a specific day
   * @param {string} dayName - Day name
   * @returns {Array} - Array of time slot objects
   */
  getTimeSlots(dayName) {
    return this.schedule.getTimeSlots(dayName);
  }

  /**
   * Check if pool is open now
   * @returns {boolean} - True if pool is currently open
   */
  isOpenNow() {
    const status = this.getCurrentStatus();
    return status.isOpen;
  }

  /**
   * Get current restrictions
   * @returns {Array} - Array of current restrictions
   */
  getCurrentRestrictions() {
    const now = new Date();
    const dayName = TimeUtils.getDayName(now);
    const dayHours = this.schedule.getDayHours(dayName);
    
    if (!dayHours || !dayHours.restrictions) {
      return [];
    }

    return dayHours.restrictions.filter(restriction => {
      return this.schedule._isTimeInRestriction(restriction, now);
    });
  }

  /**
   * Get special events for today
   * @returns {Array} - Array of today's special events
   */
  getTodaysEvents() {
    const today = TimeUtils.formatDate(new Date());
    return this.specialEvents.filter(event => event.date === today);
  }

  /**
   * Get upcoming events (next 7 days)
   * @returns {Array} - Array of upcoming events
   */
  getUpcomingEvents() {
    const now = new Date();
    const weekFromNow = new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000));
    
    return this.specialEvents.filter(event => {
      const eventDate = new Date(event.date);
      return eventDate >= now && eventDate <= weekFromNow;
    });
  }

  /**
   * Get pool summary for display
   * @returns {Object} - Pool summary object
   */
  getSummary() {
    const status = this.getCurrentStatus();
    const todaysEvents = this.getTodaysEvents();
    
    return {
      name: this.name,
      status: status.status,
      isOpen: status.isOpen,
      statusIcon: status.icon,
      todaysHours: this.getHoursForDay(TimeUtils.getDayName(new Date())),
      hasEvents: todaysEvents.length > 0,
      eventCount: todaysEvents.length,
      features: this.features.length,
      amenities: this.amenities.length,
      lastUpdated: this.lastUpdated
    };
  }

  /**
   * Get detailed pool information
   * @returns {Object} - Detailed pool information
   */
  getDetailedInfo() {
    return {
      name: this.name,
      contact: this.getContactInfo(),
      currentStatus: this.getCurrentStatus(),
      weekSchedule: this.getWeekSchedule(),
      features: this.getFeatures(),
      amenities: this.getAmenities(),
      divingBoard: this.divingBoard,
      babyPool: this.babyPool,
      restrictions: this.getCurrentRestrictions(),
      todaysEvents: this.getTodaysEvents(),
      upcomingEvents: this.getUpcomingEvents(),
      lastUpdated: this.lastUpdated
    };
  }

  /**
   * Search pool data for a term
   * @param {string} searchTerm - Term to search for
   * @returns {Object} - Search results with matches
   */
  search(searchTerm) {
    const term = searchTerm.toLowerCase();
    const matches = {
      name: this.name.toLowerCase().includes(term),
      address: this.address.toLowerCase().includes(term),
      features: this.features.some(feature => feature.toLowerCase().includes(term)),
      amenities: this.amenities.some(amenity => amenity.toLowerCase().includes(term))
    };

    const hasMatch = Object.values(matches).some(match => match);
    
    return {
      hasMatch,
      matches,
      pool: hasMatch ? this : null
    };
  }

  /**
   * Export pool data as JSON
   * @returns {Object} - Pool data as plain object
   */
  toJSON() {
    return {
      name: this.name,
      address: this.address,
      phone: this.phone,
      website: this.website,
      features: this.features,
      amenities: this.amenities,
      divingBoard: this.divingBoard,
      babyPool: this.babyPool,
      hours: this.schedule.scheduleData,
      restrictions: this.restrictions,
      specialEvents: this.specialEvents,
      lastUpdated: this.lastUpdated
    };
  }
}
