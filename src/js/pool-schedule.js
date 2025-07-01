/**
 * Pool schedule management and time slot logic
 */

// Prevent multiple declarations
if (!window.PoolSchedule) {
  class PoolSchedule {
  constructor(scheduleData) {
    this.scheduleData = scheduleData || {};
  }

  /**
   * Get PoolStatus reference safely
   * @private
   * @returns {Object|null} - PoolStatus object or null if not available
   */
  _getPoolStatus() {
    if (typeof window !== 'undefined' && window.PoolStatus) {
      return window.PoolStatus;
    }
    if (typeof PoolStatus !== 'undefined') {
      return PoolStatus;
    }
    console.error('PoolStatus is not available');
    return null;
  }

  /**
   * Get hours for a specific day
   * @param {string} dayName - Day name (e.g., 'Monday')
   * @returns {Object|null} - Day hours object or null
   */
  getDayHours(dayName) {
    return this.scheduleData[dayName] || null;
  }

  /**
   * Get formatted hours display for a day
   * @param {string} dayName - Day name
   * @returns {string} - Formatted hours string
   */
  getFormattedHours(dayName) {
    const dayHours = this.getDayHours(dayName);
    if (!dayHours) return 'No hours available';

    if (dayHours.closed) {
      return 'Closed';
    }

    const { open, close } = dayHours;
    if (!open || !close) return 'Hours unavailable';

    const TimeUtilsRef = this._getTimeUtils();
    if (!TimeUtilsRef) {
      return 'Error loading times';
    }

    return `${TimeUtilsRef.formatTime(open)} - ${TimeUtilsRef.formatTime(close)}`;
  }

  /**
   * Check if pool is open at a specific time
   * @param {string} dayName - Day name
   * @param {Date} time - Time to check (defaults to now)
   * @returns {PoolStatus} - Pool status object
   */
  getStatusAtTime(dayName, time = new Date()) {
    const PoolStatusRef = this._getPoolStatus();
    if (!PoolStatusRef) {
      return { isOpen: false, status: 'Error', color: 'gray', icon: '⚫' };
    }
    
    const dayHours = this.getDayHours(dayName);
    if (!dayHours) {
      return PoolStatusRef.CLOSED;
    }

    if (dayHours.closed) {
      return PoolStatusRef.CLOSED;
    }

    const { open, close } = dayHours;
    if (!open || !close) {
      return PoolStatusRef.CLOSED;
    }

    const TimeUtilsRef = this._getTimeUtils();
    if (!TimeUtilsRef) {
      return PoolStatusRef.CLOSED;
    }

    const currentTime = TimeUtilsRef.formatTimeForComparison(time);
    const openTime = TimeUtilsRef.parseTimeString(open);
    const closeTime = TimeUtilsRef.parseTimeString(close);

    if (currentTime >= openTime && currentTime <= closeTime) {
      // Check for restrictions during this time
      if (dayHours.restrictions) {
        return this._getRestrictionStatus(dayHours.restrictions, time);
      }
      return PoolStatusRef.OPEN;
    }

    return PoolStatusRef.CLOSED;
  }

  /**
   * Get current pool status
   * @returns {PoolStatus} - Current pool status
   */
  getCurrentStatus() {
    const TimeUtilsRef = this._getTimeUtils();
    if (!TimeUtilsRef) {
      return { isOpen: false, status: 'Error', color: 'gray', icon: '⚫' };
    }
    
    const now = new Date();
    const dayName = TimeUtilsRef.getDayName(now);
    return this.getStatusAtTime(dayName, now);
  }

  /**
   * Check if pool is currently open
   * @returns {boolean} - True if pool is open, false otherwise
   */
  isPoolOpen() {
    const TimeUtilsRef = this._getTimeUtils();
    if (!TimeUtilsRef) {
      return false;
    }
    
    // Get current time in Eastern timezone
    const now = new Date();
    const easternTime = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
    const dayName = TimeUtilsRef.getDayName(easternTime);
    const status = this.getStatusAtTime(dayName, easternTime);
    
    return status.status === 'open';
  }

  /**
   * Get time slots for display with current time highlighting
   * @param {string} dayName - Day name
   * @returns {Array} - Array of time slot objects
   */
  getTimeSlots(dayName) {
    const TimeUtilsRef = this._getTimeUtils();
    if (!TimeUtilsRef) {
      return [];
    }
    
    const dayHours = this.getDayHours(dayName);
    if (!dayHours || dayHours.closed) {
      return [];
    }

    const now = new Date();
    const currentDayName = TimeUtilsRef.getDayName(now);
    const isToday = dayName === currentDayName;

    const slots = [];
    const { open, close } = dayHours;

    if (open && close) {
      const openTime = TimeUtilsRef.parseTimeString(open);
      const closeTime = TimeUtilsRef.parseTimeString(close);
      
      // Generate hourly slots between open and close
      for (let hour = openTime; hour < closeTime; hour++) {
        const startTime = `${hour}:00`;
        const endTime = `${hour + 1}:00`;
        
        const PoolStatusRef = this._getPoolStatus();
        let isCurrentSlot = false;
        let status = PoolStatusRef ? PoolStatusRef.OPEN : { isOpen: true, status: 'Open', color: 'green', icon: '🟢' };

        if (isToday) {
          const currentHour = now.getHours();
          isCurrentSlot = (hour === currentHour);
          
          if (isCurrentSlot) {
            status = this.getStatusAtTime(dayName, now);
          }
        }

        slots.push({
          startTime,
          endTime,
          isCurrentSlot,
          status: status.status,
          color: status.color,
          timeRange: `${TimeUtilsRef.formatTime(startTime)} - ${TimeUtilsRef.formatTime(endTime)}`
        });
      }
    }

    return slots;
  }

  /**
   * Get restriction status based on time and restriction rules
   * @private
   * @param {Array} restrictions - Array of restriction objects
   * @param {Date} time - Time to check
   * @returns {PoolStatus} - Appropriate status based on restrictions
   */
  _getRestrictionStatus(restrictions, time) {
    const PoolStatusRef = this._getPoolStatus();
    if (!PoolStatusRef) {
      return { isOpen: false, status: 'Error', color: 'gray', icon: '⚫' };
    }
    
    // Check if current time falls within any restriction period
    for (const restriction of restrictions) {
      if (this._isTimeInRestriction(restriction, time)) {
        switch (restriction.type) {
          case 'practice':
            return PoolStatusRef.PRACTICE_ONLY;
          case 'meet':
            return PoolStatusRef.SWIM_MEET;
          case 'closed':
            return PoolStatusRef.CLOSED_TO_PUBLIC;
          default:
            return PoolStatusRef.RESTRICTED;
        }
      }
    }
    return PoolStatusRef.OPEN;
  }

  /**
   * Check if time falls within a restriction period
   * @private
   * @param {Object} restriction - Restriction object
   * @param {Date} time - Time to check
   * @returns {boolean} - True if time is within restriction
   */
  _isTimeInRestriction(restriction, time) {
    if (!restriction.start || !restriction.end) return false;

    const TimeUtilsRef = this._getTimeUtils();
    if (!TimeUtilsRef) {
      return false;
    }

    const currentTime = TimeUtilsRef.formatTimeForComparison(time);
    const restrictionStart = TimeUtilsRef.parseTimeString(restriction.start);
    const restrictionEnd = TimeUtilsRef.parseTimeString(restriction.end);

    return currentTime >= restrictionStart && currentTime <= restrictionEnd;
  }

  /**
   * Get all days with their status
   * @returns {Array} - Array of day objects with status
   */
  getAllDaysStatus() {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    
    return days.map(dayName => ({
      day: dayName,
      hours: this.getFormattedHours(dayName),
      status: this.getStatusAtTime(dayName),
      timeSlots: this.getTimeSlots(dayName)
    }));
  }

  /**
   * Check if this schedule has any data
   * @returns {boolean} - True if schedule has data, false otherwise
   */
  hasScheduleData() {
    return this.scheduleData && 
           Object.keys(this.scheduleData).length > 0 && 
           Object.values(this.scheduleData).some(dayData => dayData && (dayData.open || dayData.timeSlots));
  }
}

// Make sure it's available globally
window.PoolSchedule = PoolSchedule;

}
