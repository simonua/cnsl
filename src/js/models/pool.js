/**
 * Individual pool class with contextual methods
 */
class Pool {
  constructor(poolData) {
    this.id = poolData.id || '';
    this.name = poolData.name || '';
    this.caUrl = poolData.caUrl || '';
    this.scheduleUrl = poolData.scheduleUrl || '';
    
    // Handle both location formats (new location object vs legacy flat properties)
    if (poolData.location) {
      // New location format
      this.location = poolData.location;
      const addressParts = [];
      if (poolData.location.street) addressParts.push(poolData.location.street);
      if (poolData.location.city || poolData.location.state || poolData.location.zip) {
        const city = poolData.location.city || '';
        const state = poolData.location.state || '';
        const zip = poolData.location.zip || '';
        const cityStateZip = (city + ', ' + state + ' ' + zip).trim();
        addressParts.push(cityStateZip);
      }
      this.address = addressParts.join(', ');
      this.lat = poolData.location.lat;
      this.lng = poolData.location.lng;
      this.mapsQuery = poolData.location.mapsQuery;
      this.googleMapsUrl = poolData.location.googleMapsUrl;
    } else {
      // Legacy format
      this.address = poolData.address || '';
      this.lat = poolData.lat;
      this.lng = poolData.lng;
      this.mapsQuery = poolData.mapsQuery;
    }
    
    this.phone = poolData.phone || '';
    this.website = poolData.website || '';
    this.features = poolData.features || [];
    this.amenities = poolData.amenities || [];
    this.divingBoard = poolData.divingBoard || false;
    this.babyPool = poolData.babyPool || false;
    
    // Handle both legacy and new data formats
    if (poolData.schedules && Array.isArray(poolData.schedules)) {
      // Legacy format - convert to new format
      console.log('poolData.schedules', poolData.schedules);
      this.schedule = new PoolSchedule(this._normalizeCurrentSchedule(poolData.schedules));
      console.log('loaded schedule', this.schedule);
      this.legacySchedules = poolData.schedules; // Keep for compatibility
    } else {
      // New format
      this.schedule = new PoolSchedule(poolData.hours || {});
      this.legacySchedules = null;
    }
    
    this.restrictions = poolData.restrictions || [];
    this.specialEvents = poolData.specialEvents || [];
    this.lastUpdated = poolData.lastUpdated || null;
  }

  /**
   * Normalize current active schedule from date-based schedule data
   * @private
   * @param {Array} schedules - Array of schedule objects with date ranges
   * @returns {Object} - Normalized schedule format for current date
   */
  _normalizeCurrentSchedule(schedules) {
    // Find the current active schedule based on today's date
    const easternTimeInfo = TimeUtils.getCurrentEasternTimeInfo();
    const currentDate = easternTimeInfo.date;
    
    const activeSchedule = schedules.find(schedule => {
      return currentDate >= schedule.startDate && currentDate <= schedule.endDate;
    });
    
    if (!activeSchedule || !activeSchedule.hours) {
      return {}; // No active schedule found for current date
    }
    
    // Normalize to simple day-based format
    const normalizedSchedule = {};
    const dayMapping = {
      'Mon': 'Monday',
      'Tue': 'Tuesday', 
      'Wed': 'Wednesday',
      'Thu': 'Thursday',
      'Fri': 'Friday',
      'Sat': 'Saturday',
      'Sun': 'Sunday'
    };
    
    // Initialize all days as closed
    Object.values(dayMapping).forEach(day => {
      normalizedSchedule[day] = { closed: true };
    });
    
    // Process hours and populate days from active schedule
    activeSchedule.hours.forEach(hour => {
      if (hour.weekDays && hour.startTime && hour.endTime) {
        hour.weekDays.forEach(shortDay => {
          const fullDay = dayMapping[shortDay];
          if (fullDay) {
            if (!normalizedSchedule[fullDay] || normalizedSchedule[fullDay].closed) {
              normalizedSchedule[fullDay] = {
                closed: false,
                open: hour.startTime,
                close: hour.endTime,
                activities: hour.types || [],
                notes: hour.notes || '',
                access: hour.access || 'Public'
              };
            }
            // If multiple time slots for same day, we'll use the first one for now
            // More complex logic could merge them
          }
        });
      }
    });
    
    return normalizedSchedule;
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
   * Get current pool status (enhanced for legacy format)
   * @returns {PoolStatus} - Current pool status
   */
  getCurrentStatus() {
    if (this.legacySchedules) {
      return this._getLegacyStatus();
    }
    return this.schedule.getCurrentStatus();
  }

  /**
   * Get status using legacy schedule format
   * @private
   * @returns {PoolStatus} - Pool status from legacy data
   */
  _getLegacyStatus() {
    const easternTimeInfo = TimeUtils.getCurrentEasternTimeInfo();
    const currentDate = easternTimeInfo.date;
    const currentDay = easternTimeInfo.day.substring(0, 3); // Get short day name (Mon, Tue, etc.)
    const currentTime = easternTimeInfo.minutes;

    // Find the current active schedule
    const activeSchedule = this.legacySchedules.find(schedule => {
      return currentDate >= schedule.startDate && currentDate <= schedule.endDate;
    });

    if (!activeSchedule || !activeSchedule.hours) {
      return PoolStatus.CLOSED;
    }

    // Find today's hours
    const todayHours = activeSchedule.hours.filter(h => 
      h.weekDays && h.weekDays.includes(currentDay)
    );
    
    if (!todayHours.length) {
      return PoolStatus.CLOSED;
    }

    // Check current time against all time slots
    for (const hour of todayHours) {
      const startMinutes = TimeUtils.timeStringToMinutes(hour.startTime);
      const endMinutes = TimeUtils.timeStringToMinutes(hour.endTime);
      
      if (currentTime >= startMinutes && currentTime < endMinutes) {
        // Check activity types to determine access level
        const activityTypes = TimeUtils.formatActivityTypes(hour.types).toLowerCase();
        
        if (activityTypes.includes('closed to public')) {
          return PoolStatus.CLOSED_TO_PUBLIC;
        } else if (activityTypes.includes('cnsl practice only')) {
          return PoolStatus.PRACTICE_ONLY;
        } else if (activityTypes.includes('swim meet')) {
          return PoolStatus.SWIM_MEET;
        } else {
          return PoolStatus.OPEN;
        }
      }
    }

    return PoolStatus.CLOSED;
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
   * Get all week schedule with status (enhanced for legacy format)
   * @returns {Array} - Array of day objects with status
   */
  getWeekSchedule() {
    if (this.legacySchedules) {
      return this._getLegacyWeekSchedule();
    }
    return this.schedule.getAllDaysStatus();
  }

  /**
   * Get week schedule from legacy format
   * @private
   * @returns {Array} - Array of day objects with time slots
   */
  _getLegacyWeekSchedule() {
    const easternTimeInfo = TimeUtils.getCurrentEasternTimeInfo();
    const currentDate = easternTimeInfo.date;
    
    // Find active schedule
    const activeSchedule = this.legacySchedules.find(schedule => {
      return currentDate >= schedule.startDate && currentDate <= schedule.endDate;
    });
    
    const dayOrder = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const fullDayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    
    return dayOrder.map((shortDay, index) => {
      const dayData = {
        day: shortDay,
        fullDay: fullDayNames[index],
        timeSlots: [],
        isOpen: false
      };
      
      if (activeSchedule && activeSchedule.hours) {
        // Find all hours for this day
        const dayHours = activeSchedule.hours.filter(h => 
          h.weekDays && h.weekDays.includes(shortDay)
        );
        
        dayHours.forEach(hour => {
          if (hour.startTime && hour.endTime) {
            dayData.timeSlots.push({
              startTime: hour.startTime,
              endTime: hour.endTime,
              activities: hour.types || [],
              notes: hour.notes || '',
              access: hour.access || 'Public'
            });
            dayData.isOpen = true;
          }
        });
        
        // Sort time slots by start time
        dayData.timeSlots.sort((a, b) => {
          return TimeUtils.timeStringToMinutes(a.startTime) - TimeUtils.timeStringToMinutes(b.startTime);
        });
      }
      
      return dayData;
    });
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
    const result = {
      id: this.id,
      name: this.name,
      caUrl: this.caUrl,
      scheduleUrl: this.scheduleUrl,
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
    
    // Include location properties for both formats
    if (this.location) {
      // New location format
      result.location = this.location;
    } else {
      // Legacy format properties
      if (this.lat !== undefined) result.lat = this.lat;
      if (this.lng !== undefined) result.lng = this.lng;
      if (this.mapsQuery) result.mapsQuery = this.mapsQuery;
    }
    
    return result;
  }

  /**
   * Get current active schedule period information
   * @returns {Object|null} - Schedule period with startDate and endDate, or null if no active schedule
   */
  getCurrentSchedulePeriod() {
    if (!this.legacySchedules || !Array.isArray(this.legacySchedules)) {
      return null;
    }
    
    const easternTimeInfo = TimeUtils.getCurrentEasternTimeInfo();
    const currentDate = easternTimeInfo.date;
    
    const activeSchedule = this.legacySchedules.find(schedule => {
      return currentDate >= schedule.startDate && currentDate <= schedule.endDate;
    });
    
    if (activeSchedule) {
      return {
        startDate: activeSchedule.startDate,
        endDate: activeSchedule.endDate,
        name: activeSchedule.name || 'Current Schedule'
      };
    }
    
    return null;
  }
}
