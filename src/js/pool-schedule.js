/**
 * Pool schedule management and time slot logic
 */
class PoolSchedule {
  constructor(scheduleData) {
    this.scheduleData = scheduleData || {};
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

    return `${TimeUtils.formatTime(open)} - ${TimeUtils.formatTime(close)}`;
  }

  /**
   * Check if pool is open at a specific time
   * @param {string} dayName - Day name
   * @param {Date} time - Time to check (defaults to now)
   * @returns {PoolStatus} - Pool status object
   */
  getStatusAtTime(dayName, time = new Date()) {
    const dayHours = this.getDayHours(dayName);
    if (!dayHours) {
      return PoolStatus.CLOSED;
    }

    if (dayHours.closed) {
      return PoolStatus.CLOSED;
    }

    const { open, close } = dayHours;
    if (!open || !close) {
      return PoolStatus.CLOSED;
    }

    const currentTime = TimeUtils.formatTimeForComparison(time);
    const openTime = TimeUtils.parseTimeString(open);
    const closeTime = TimeUtils.parseTimeString(close);

    if (currentTime >= openTime && currentTime <= closeTime) {
      // Check for restrictions during this time
      if (dayHours.restrictions) {
        return this._getRestrictionStatus(dayHours.restrictions, time);
      }
      return PoolStatus.OPEN;
    }

    return PoolStatus.CLOSED;
  }

  /**
   * Get current pool status
   * @returns {PoolStatus} - Current pool status
   */
  getCurrentStatus() {
    const now = new Date();
    const dayName = TimeUtils.getDayName(now);
    return this.getStatusAtTime(dayName, now);
  }

  /**
   * Check if pool is currently open
   * @returns {boolean} - True if pool is open, false otherwise
   */
  isPoolOpen() {
    // Get current time in Eastern timezone
    const now = new Date();
    const easternTime = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
    const dayName = TimeUtils.getDayName(easternTime);
    const status = this.getStatusAtTime(dayName, easternTime);
    
    return status.status === 'open';
  }

  /**
   * Get time slots for display with current time highlighting
   * @param {string} dayName - Day name
   * @returns {Array} - Array of time slot objects
   */
  getTimeSlots(dayName) {
    const dayHours = this.getDayHours(dayName);
    if (!dayHours || dayHours.closed) {
      return [];
    }

    const now = new Date();
    const currentDayName = TimeUtils.getDayName(now);
    const isToday = dayName === currentDayName;

    const slots = [];
    const { open, close } = dayHours;

    if (open && close) {
      const openTime = TimeUtils.parseTimeString(open);
      const closeTime = TimeUtils.parseTimeString(close);
      
      // Generate hourly slots between open and close
      for (let hour = openTime; hour < closeTime; hour++) {
        const startTime = `${hour}:00`;
        const endTime = `${hour + 1}:00`;
        
        let isCurrentSlot = false;
        let status = PoolStatus.OPEN;

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
          timeRange: `${TimeUtils.formatTime(startTime)} - ${TimeUtils.formatTime(endTime)}`
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
    // Check if current time falls within any restriction period
    for (const restriction of restrictions) {
      if (this._isTimeInRestriction(restriction, time)) {
        switch (restriction.type) {
          case 'practice':
            return PoolStatus.PRACTICE_ONLY;
          case 'meet':
            return PoolStatus.SWIM_MEET;
          case 'closed':
            return PoolStatus.CLOSED_TO_PUBLIC;
          default:
            return PoolStatus.RESTRICTED;
        }
      }
    }
    return PoolStatus.OPEN;
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

    const currentTime = TimeUtils.formatTimeForComparison(time);
    const restrictionStart = TimeUtils.parseTimeString(restriction.start);
    const restrictionEnd = TimeUtils.parseTimeString(restriction.end);

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
}
