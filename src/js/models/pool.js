/**
 * Individual pool class with contextual methods
 */

// Prevent multiple declarations
if (typeof window === 'undefined' || !window.Pool) {

// Node.js: load dependencies
if (typeof window === 'undefined') {
  if (typeof PoolSchedule === 'undefined') { var PoolSchedule = require('../pool-schedule.js'); } // eslint-disable-line no-var
  if (typeof TimeUtils === 'undefined') { var TimeUtils = require('../services/time-utils.js'); } // eslint-disable-line no-var
}

  class Pool {
  /**
   * @param {PoolRecord} poolData - Published pool record or a supported legacy equivalent
   */
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
    this.laneCount = Number.isInteger(poolData.laneCount) && poolData.laneCount > 0 ? poolData.laneCount : null;
    this.laneLengthUnits = ['meters', 'yards'].includes(poolData.laneLengthUnits) ? poolData.laneLengthUnits : null;
    this.laneLength = Number.isFinite(poolData.laneLength) && poolData.laneLength > 0 ? poolData.laneLength : null;
    this.features = poolData.features || [];
    this.amenities = poolData.amenities || [];
    this.divingBoard = poolData.divingBoard || false;
    this.babyPool = poolData.babyPool || false;
    
    // Store schedule overrides
    this.scheduleOverrides = poolData.scheduleOverrides || [];
    
    // Handle both legacy and new data formats
    if (poolData.schedules && Array.isArray(poolData.schedules)) {
      // Legacy format - convert to new format
      this.schedule = new PoolSchedule(this._normalizeCurrentSchedule(poolData.schedules));
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
   * Get TimeUtils reference safely
   * @private
   * @returns {Object|null} - TimeUtils object or null if not available
   */
  _getTimeUtils() {
    if (typeof window !== 'undefined' && window.TimeUtils) {
      return window.TimeUtils;
    }
    if (typeof TimeUtils !== 'undefined') {
      return TimeUtils;
    }
    console.error('TimeUtils is not available');
    return null;
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
   * Normalize current active schedule from date-based schedule data
   * @private
    * @param {PoolScheduleRecord[]} schedules - Schedule records with date ranges
   * @returns {Object} - Normalized schedule format for current date
   */
  _normalizeCurrentSchedule(schedules) {
    // Ensure TimeUtils is available
    const TimeUtilsRef = this._getTimeUtils();
    if (!TimeUtilsRef) {
      console.error('TimeUtils is not available in Pool._normalizeCurrentSchedule');
      return {}; // Return empty schedule as fallback
    }
    
    // Find the current active schedule based on today's date
    const easternTimeInfo = TimeUtilsRef.getCurrentEasternTimeInfo();
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
                accessStatus: hour.accessStatus
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
    const PoolStatusRef = this._getPoolStatus();
    if (!PoolStatusRef) {
      return { isOpen: false, status: 'Error', color: 'gray', icon: '⚫' };
    }
    
    if (this.legacySchedules) {
      return this._getLegacyStatus();
    }
    
    // Check if new format pool has no schedule data
    if (!this.schedule || !this.schedule.hasScheduleData()) {
      return PoolStatusRef.SCHEDULE_NOT_FOUND;
    }
    
    return this.schedule.getCurrentStatus();
  }

  /**
   * Get status using legacy schedule format
   * @private
   * @returns {PoolStatus} - Pool status from legacy data
   */
  _getLegacyStatus() {
    const PoolStatusRef = this._getPoolStatus();
    if (!PoolStatusRef) {
      return { isOpen: false, status: 'Error', color: 'gray', icon: '⚫' };
    }
    
    // Check if pool has no schedule data at all
    if (!this.legacySchedules || !Array.isArray(this.legacySchedules) || this.legacySchedules.length === 0) {
      return PoolStatusRef.SCHEDULE_NOT_FOUND;
    }

    const TimeUtilsRef = this._getTimeUtils();
    if (!TimeUtilsRef) {
      return PoolStatusRef.SCHEDULE_NOT_FOUND;
    }

    const easternTimeInfo = TimeUtilsRef.getCurrentEasternTimeInfo();
    const currentDate = easternTimeInfo.date;
    const currentDay = easternTimeInfo.day.substring(0, 3); // Get short day name (Mon, Tue, etc.)
    const currentTime = easternTimeInfo.minutes;

    return this._getLegacyStatusAtMinutes(this._getLegacyTimeSlotsForDate(currentDate, currentDay), currentTime);
  }

  /**
   * Check whether public-use hours cover now through the requested duration.
   * @param {number} durationMinutes - Minutes of continuous availability required after now
   * @returns {boolean} Whether the pool remains open to the public for that duration
   */
  isOpenForNextMinutes(durationMinutes = 0) {
    if (!Number.isFinite(durationMinutes) || durationMinutes < 0) return false;

    const TimeUtilsRef = this._getTimeUtils();
    const PoolStatusRef = this._getPoolStatus();
    if (!TimeUtilsRef || !PoolStatusRef) return false;

    if (!this.legacySchedules) {
      const now = TimeUtilsRef.getEasternTime();
      const intervalMinutes = Math.max(1, durationMinutes);
      for (let offset = 0; offset < intervalMinutes; offset += 1) {
        const candidateTime = new Date(now.getTime() + (offset * TimeUtilsRef.MINUTES_PER_HOUR * 1000));
        const status = this.schedule.getStatusAtTime(TimeUtilsRef.getDayName(candidateTime), candidateTime);
        if (status !== PoolStatusRef.OPEN) return false;
      }
      return true;
    }

    const easternTimeInfo = TimeUtilsRef.getCurrentEasternTimeInfo();
    if (!easternTimeInfo.isValid) return false;
    const requiredUntil = easternTimeInfo.minutes + durationMinutes;
    if (requiredUntil > TimeUtilsRef.MINUTES_PER_DAY) return false;

    const timeSlots = this._getLegacyTimeSlotsForDate(easternTimeInfo.date, easternTimeInfo.day.substring(0, 3));
    let coveredUntil = easternTimeInfo.minutes;
    for (const slot of timeSlots) {
      if (this._getLegacySlotStatus(slot) !== PoolStatusRef.OPEN) continue;
      const startMinutes = TimeUtilsRef.timeStringToMinutes(slot.startTime);
      const endMinutes = TimeUtilsRef.timeStringToMinutes(slot.endTime);
      if (startMinutes > coveredUntil) break;
      if (startMinutes <= coveredUntil && endMinutes > coveredUntil) {
        coveredUntil = endMinutes;
        if (coveredUntil >= requiredUntil) return true;
      }
    }
    return false;
  }

  /**
   * Return the next same-day transition in public-use availability.
   * @returns {{ action: string, minutes: number }|null} Next public opening or closing transition
   */
  getPublicStatusTransitionToday() {
    const TimeUtilsRef = this._getTimeUtils();
    const PoolStatusRef = this._getPoolStatus();
    if (!TimeUtilsRef || !PoolStatusRef) return null;

    const currentStatus = this.getCurrentStatus();
    const action = currentStatus === PoolStatusRef.CLOSED
      ? 'opens'
      : currentStatus === PoolStatusRef.OPEN ? 'closes' : null;
    if (!action) return null;

    if (this.legacySchedules) {
      const easternTimeInfo = TimeUtilsRef.getCurrentEasternTimeInfo();
      if (!easternTimeInfo.isValid) return null;

      const timeSlots = this._getLegacyTimeSlotsForDate(easternTimeInfo.date, easternTimeInfo.day.substring(0, 3));
      if (action === 'opens') {
        for (const slot of timeSlots) {
          if (this._getLegacySlotStatus(slot) !== PoolStatusRef.OPEN || typeof slot.startTime !== 'string') continue;
          const startMinutes = TimeUtilsRef.timeStringToMinutes(slot.startTime);
          if (startMinutes > easternTimeInfo.minutes) return { action, minutes: startMinutes - easternTimeInfo.minutes };
        }
        return null;
      }

      let coveredUntil = easternTimeInfo.minutes;
      for (const slot of timeSlots) {
        if (this._getLegacySlotStatus(slot) !== PoolStatusRef.OPEN) continue;
        if (typeof slot.startTime !== 'string' || typeof slot.endTime !== 'string') continue;
        const startMinutes = TimeUtilsRef.timeStringToMinutes(slot.startTime);
        const endMinutes = TimeUtilsRef.timeStringToMinutes(slot.endTime);
        if (startMinutes > coveredUntil) break;
        if (startMinutes <= coveredUntil && endMinutes > coveredUntil) coveredUntil = endMinutes;
      }
      return coveredUntil > easternTimeInfo.minutes
        ? { action, minutes: coveredUntil - easternTimeInfo.minutes }
        : null;
    }

    const easternTime = TimeUtilsRef.getEasternTime();
    const dayName = TimeUtilsRef.getDayName(easternTime);
    const dayHours = this.schedule.getDayHours(dayName);
    const currentMinutes = TimeUtilsRef.formatTimeForComparison(easternTime);

    if (action === 'opens') {
      if (!dayHours || dayHours.closed || typeof dayHours.open !== 'string') return null;
      const openingMinutes = TimeUtilsRef.timeStringToMinutes(dayHours.open);
      return openingMinutes > currentMinutes ? { action, minutes: openingMinutes - currentMinutes } : null;
    }

    if (!dayHours || typeof dayHours.close !== 'string') return null;
    let closingMinutes = TimeUtilsRef.timeStringToMinutes(dayHours.close);
    (dayHours.restrictions || []).forEach(restriction => {
      if (typeof restriction.start !== 'string') return;
      const restrictionStart = TimeUtilsRef.timeStringToMinutes(restriction.start);
      if (restrictionStart > currentMinutes && restrictionStart < closingMinutes) closingMinutes = restrictionStart;
    });
    return closingMinutes > currentMinutes ? { action, minutes: closingMinutes - currentMinutes } : null;
  }

  /**
   * Find published or overriding slots for a calendar day.
   * @private
   * @param {string} dateString - Date in YYYY-MM-DD format
   * @param {string} shortDay - Day abbreviation
   * @returns {Array} Ordered time slots
   */
  _getLegacyTimeSlotsForDate(dateString, shortDay) {
    const activeSchedule = this.legacySchedules.find(schedule => (
      dateString >= schedule.startDate && dateString <= schedule.endDate
    ));
    const overrideForDate = this._getScheduleOverrideForDate(dateString, shortDay);
    if (overrideForDate) return this._mergeScheduleWithOverride(activeSchedule, shortDay, overrideForDate);
    if (!activeSchedule || !activeSchedule.hours) return [];

    const TimeUtilsRef = this._getTimeUtils();
    if (!TimeUtilsRef) return [];

    return activeSchedule.hours.filter(hour => (
      hour.weekDays && hour.weekDays.includes(shortDay)
    )).sort((first, second) => {
      if (typeof first.startTime !== 'string' || typeof second.startTime !== 'string') return 0;
      return TimeUtilsRef.timeStringToMinutes(first.startTime) - TimeUtilsRef.timeStringToMinutes(second.startTime);
    });
  }

  /**
   * Resolve public access for a legacy schedule slot.
   * @private
   * @param {Object} slot - Published schedule slot
   * @returns {PoolStatus} Access status represented by the slot
   */
  _getLegacySlotStatus(slot) {
    const PoolStatusRef = this._getPoolStatus();
    if (!PoolStatusRef) return { isOpen: false, color: 'gray' };

    switch (slot.accessStatus) {
      case 'public':
        return PoolStatusRef.OPEN;
      case 'closed-to-public':
        return PoolStatusRef.CLOSED_TO_PUBLIC;
      case 'practice-only':
        return PoolStatusRef.PRACTICE_ONLY;
      case 'swim-meet':
        return PoolStatusRef.SWIM_MEET;
      default:
        return PoolStatusRef.RESTRICTED;
    }
  }

  /**
   * Resolve status for a point within legacy schedule slots.
   * @private
   * @param {Array} timeSlots - Applicable slots for the date
   * @param {number} currentTime - Minute of day to inspect
   * @returns {PoolStatus} Current access status
   */
  _getLegacyStatusAtMinutes(timeSlots, currentTime) {
    const PoolStatusRef = this._getPoolStatus();
    const TimeUtilsRef = this._getTimeUtils();
    if (!PoolStatusRef || !TimeUtilsRef) return { isOpen: false, color: 'gray' };

    for (const slot of timeSlots) {
      if (!slot.startTime || !slot.endTime || typeof slot.startTime !== 'string' || typeof slot.endTime !== 'string') {
        console.warn(`[Pool] Skipping invalid time slot for ${this.name}:`, slot);
        continue;
      }
      const startMinutes = TimeUtilsRef.timeStringToMinutes(slot.startTime);
      const endMinutes = TimeUtilsRef.timeStringToMinutes(slot.endTime);
      if (currentTime >= startMinutes && currentTime < endMinutes) return this._getLegacySlotStatus(slot);
    }
    return PoolStatusRef.CLOSED;
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
      const weekStartDate = new Date();
      const daysSinceMonday = (weekStartDate.getDay() + 6) % 7;
      weekStartDate.setDate(weekStartDate.getDate() - daysSinceMonday);
      return this._getLegacyWeekScheduleForDate(weekStartDate);
    }
    return this.schedule.getAllDaysStatus();
  }

  /**
   * Get all week schedule with status for a specific week (enhanced for legacy format)
   * @param {Date} weekStartDate - The Monday of the week to get the schedule for
   * @returns {Array} - Array of day objects with time slots
   */
  getWeekScheduleForDate(weekStartDate) {
    if (this.legacySchedules) {
      return this._getLegacyWeekScheduleForDate(weekStartDate);
    }
    return this.schedule.getAllDaysStatus();
  }

  /**
   * Get week schedule from legacy format for a specific week
   * @private
   * @param {Date} weekStartDate - The Monday of the week to get the schedule for
   * @returns {Array} - Array of day objects with time slots
   */
  _getLegacyWeekScheduleForDate(weekStartDate) {
    const dayOrder = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const fullDayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    
    return dayOrder.map((shortDay, index) => {
      const dayData = {
        day: shortDay,
        fullDay: fullDayNames[index],
        timeSlots: [],
        isOpen: false,
        hasOverrides: false,
        overrideReason: null
      };
      
      // Calculate the specific date for this day of the week
      const targetDate = new Date(weekStartDate);
      targetDate.setDate(weekStartDate.getDate() + index);
      const targetDateString = targetDate.toISOString().split('T')[0];
      
      // Find active schedule for this specific date
      const activeSchedule = this.legacySchedules.find(schedule => {
        return targetDateString >= schedule.startDate && targetDateString <= schedule.endDate;
      });
      
      // Check for schedule overrides for this specific date
      const overrideForDate = this._getScheduleOverrideForDate(targetDateString, shortDay);
      
      if (overrideForDate) {
        // Apply schedule override logic - merge with regular schedule
        dayData.hasOverrides = true;
        dayData.overrideReason = overrideForDate.reason;
        dayData.timeSlots = this._mergeScheduleWithOverride(activeSchedule, shortDay, overrideForDate);
        dayData.isOpen = dayData.timeSlots.length > 0;
      } else {
        if (activeSchedule && activeSchedule.hours) {
          // Regular schedule - no overrides
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
                accessStatus: hour.accessStatus
              });
              dayData.isOpen = true;
            }
          });
          
          // Sort time slots by start time
          dayData.timeSlots.sort((a, b) => {
            const TimeUtilsRef = this._getTimeUtils();
            if (!TimeUtilsRef) return 0;
            
            // Skip invalid time slots in sorting
            if (!a.startTime || !b.startTime || 
                typeof a.startTime !== 'string' || 
                typeof b.startTime !== 'string') {
              return 0;
            }
            
            return TimeUtilsRef.timeStringToMinutes(a.startTime) - TimeUtilsRef.timeStringToMinutes(b.startTime);
          });
        }
      }
      
      return dayData;
    });
  }

  /**
   * Get schedule override for a specific date and day
   * @private
   * @param {string} dateString - Date in YYYY-MM-DD format
   * @param {string} shortDay - Day abbreviation (Mon, Tue, etc.)
   * @returns {Object|null} - Override object or null if none found
   */
  _getScheduleOverrideForDate(dateString, shortDay) {
    if (!this.scheduleOverrides || !Array.isArray(this.scheduleOverrides)) {
      return null;
    }
    
    return this.scheduleOverrides.find(override => {
      // Check if the date falls within the override range
      const isInDateRange = dateString >= override.startDate && dateString <= override.endDate;
      
      if (!isInDateRange) {
        return false;
      }
      
      // Check if any of the override hours apply to this day
      return override.hours && override.hours.some(hour => 
        hour.weekDays && hour.weekDays.includes(shortDay)
      );
    });
  }

  /**
   * Merge regular schedule with override for a specific day
   * @private
   * @param {Object} activeSchedule - The active regular schedule
   * @param {string} shortDay - Day abbreviation (Mon, Tue, etc.)
   * @param {Object} override - The schedule override object
   * @returns {Array} - Array of merged time slots
   */
  _mergeScheduleWithOverride(activeSchedule, shortDay, override) {
    const mergedSlots = [];
    
    // Get regular schedule slots for this day
    const regularSlots = [];
    if (activeSchedule && activeSchedule.hours) {
      const dayHours = activeSchedule.hours.filter(h => 
        h.weekDays && h.weekDays.includes(shortDay)
      );
      
      dayHours.forEach(hour => {
        if (hour.startTime && hour.endTime) {
          regularSlots.push({
            startTime: hour.startTime,
            endTime: hour.endTime,
            activities: hour.types || [],
            notes: hour.notes || '',
            accessStatus: hour.accessStatus,
            isOverride: false
          });
        }
      });
    }
    
    // Get override slots for this day
    const overrideSlots = [];
    if (override.hours) {
      const dayOverrides = override.hours.filter(h => 
        h.weekDays && h.weekDays.includes(shortDay)
      );
      
      dayOverrides.forEach(hour => {
        if (hour.startTime && hour.endTime) {
          // Determine if this override slot represents a special event
          const specialEventActivities = ['Swim Meet', 'Pool Party', 'Maintenance', 'Private Event', 'Competition', 'Closed'];
          const hasSpecialActivity = hour.types && hour.types.some(activity => 
            specialEventActivities.some(special => activity.toLowerCase().includes(special.toLowerCase()))
          );
          
          // Only mark as override if it contains special event activities
          // Regular activities like "Laps, Rec Swim" should not be marked as overrides
          const isSpecialEvent = hasSpecialActivity;
          
          overrideSlots.push({
            startTime: hour.startTime,
            endTime: hour.endTime,
            activities: hour.types || [],
            notes: isSpecialEvent ? (hour.notes || override.reason) : (hour.notes || ''),
            accessStatus: hour.accessStatus,
            isOverride: isSpecialEvent,
            overrideReason: isSpecialEvent ? override.reason : null
          });
        }
      });
    }
    
    // Convert times to minutes for easier comparison
    const convertSlot = (slot) => {
      const TimeUtilsRef = this._getTimeUtils();
      if (!TimeUtilsRef) return { ...slot, startMinutes: 0, endMinutes: 0 };
      
      // Skip slots with invalid time strings
      if (!slot.startTime || !slot.endTime || 
          typeof slot.startTime !== 'string' || 
          typeof slot.endTime !== 'string') {
        console.warn(`[Pool] Skipping slot with invalid times for ${this.name}:`, slot);
        return { ...slot, startMinutes: 0, endMinutes: 0 };
      }
      
      return {
        ...slot,
        startMinutes: TimeUtilsRef.timeStringToMinutes(slot.startTime),
        endMinutes: TimeUtilsRef.timeStringToMinutes(slot.endTime)
      };
    };
    
    const regularSlotsWithMinutes = regularSlots.map(convertSlot);
    const overrideSlotsWithMinutes = overrideSlots.map(convertSlot);
    
    // Process overrides first - they take precedence and should maintain their boundaries
    const processedOverrides = [...overrideSlotsWithMinutes];
    
    // For each regular slot, check if it's completely covered by overrides
    regularSlotsWithMinutes.forEach(regularSlot => {
      let remainingSlots = [regularSlot];
      
      // Check each override against this regular slot
      processedOverrides.forEach(override => {
        const newRemainingSlots = [];
        
        remainingSlots.forEach(remaining => {
          // Check if override completely covers this remaining slot
          if (override.startMinutes <= remaining.startMinutes && override.endMinutes >= remaining.endMinutes) {
            // Regular slot is completely covered by override - don't add it
            return;
          }
          
          // Check if override partially overlaps
          if (override.endMinutes > remaining.startMinutes && override.startMinutes < remaining.endMinutes) {
            // Partial overlap - split the regular slot
            
            // Add part before override (if any)
            if (remaining.startMinutes < override.startMinutes) {
              const TimeUtilsRef = this._getTimeUtils();
              if (TimeUtilsRef) {
                newRemainingSlots.push({
                  ...remaining,
                  endMinutes: override.startMinutes,
                  endTime: TimeUtilsRef.minutesToTimeString(override.startMinutes)
                });
              }
            }
            
            // Add part after override (if any)
            if (remaining.endMinutes > override.endMinutes) {
              const TimeUtilsRef = this._getTimeUtils();
              if (TimeUtilsRef) {
                newRemainingSlots.push({
                  ...remaining,
                  startMinutes: override.endMinutes,
                  startTime: TimeUtilsRef.minutesToTimeString(override.endMinutes)
                });
              }
            }
          } else {
            // No overlap - keep the regular slot
            newRemainingSlots.push(remaining);
          }
        });
        
        remainingSlots = newRemainingSlots;
      });
      
      // Add any remaining parts of the regular slot
      mergedSlots.push(...remainingSlots);
    });
    
    // Add all override slots
    mergedSlots.push(...processedOverrides);
    
    // Sort by start time and convert back to time strings
    mergedSlots.sort((a, b) => a.startMinutes - b.startMinutes);
    
    return mergedSlots.map(slot => ({
      startTime: slot.startTime,
      endTime: slot.endTime,
      activities: slot.activities,
      notes: slot.notes,
      accessStatus: slot.accessStatus,
      isOverride: slot.isOverride,
      overrideReason: slot.overrideReason
    }));
  }

  /**
   * Group consecutive override slots with the same activities into single slots
   * @private
   * @param {Array} overrideSlots - Array of override slots with minutes
   * @returns {Array} - Array of grouped override slots
   */
  _groupConsecutiveOverrideSlots(overrideSlots) {
    if (overrideSlots.length === 0) return [];
    
    // Sort by start time
    const sortedSlots = [...overrideSlots].sort((a, b) => a.startMinutes - b.startMinutes);
    const groupedSlots = [];
    let currentGroup = { ...sortedSlots[0] };
    
    for (let i = 1; i < sortedSlots.length; i++) {
      const slot = sortedSlots[i];
      
      // Check if this slot is consecutive and has the same activities
      const isConsecutive = currentGroup.endMinutes === slot.startMinutes;
      const sameActivities = this._activitiesMatch(currentGroup.activities, slot.activities);
      const sameReason = currentGroup.overrideReason === slot.overrideReason;
      
      // Only group if consecutive AND same activities AND same reason
      // Different activities should NEVER be grouped, even with same reason
      // Example: 7am-12pm "Swim Meet" + 12pm-8pm "Laps, Rec Swim" should stay separate
      if (isConsecutive && sameActivities && sameReason) {
        // Extend the current group
        currentGroup.endMinutes = slot.endMinutes;
        currentGroup.endTime = slot.endTime;
      } else {
        // Start a new group - activities are different or not consecutive
        groupedSlots.push(currentGroup);
        currentGroup = { ...slot };
      }
    }
    
    // Add the final group
    groupedSlots.push(currentGroup);
    
    return groupedSlots;
  }

  /**
   * Create a merged slot from active regular and override slots
   * @private
   * @param {number} startMinutes - Start time in minutes
   * @param {number} endMinutes - End time in minutes
   * @param {Array} activeRegularSlots - Active regular schedule slots
   * @param {Array} activeOverrideSlots - Active override slots
   * @returns {Object|null} - Merged slot object or null
   */
  _createMergedSlot(startMinutes, endMinutes, activeRegularSlots, activeOverrideSlots) {
    if (startMinutes >= endMinutes) {
      return null;
    }
    
    // Override takes precedence over regular schedule
    if (activeOverrideSlots.length > 0) {
      const overrideSlot = activeOverrideSlots[0]; // Use first override if multiple
      
      // Determine if this is truly a special event override
      let shouldShowAsOverride;
      
      // Check if this is a special event based on reason and activities
      const specialEventReasons = ['Swim Meet', 'Pool Party', 'Maintenance', 'Private Event', 'Competition'];
      const specialEventActivities = ['Swim Meet', 'Pool Party', 'Maintenance', 'Private Event', 'Competition', 'Closed'];
      
      const hasSpecialReason = overrideSlot.overrideReason && specialEventReasons.some(special => 
        overrideSlot.overrideReason.toLowerCase().includes(special.toLowerCase())
      );
      const hasSpecialActivity = overrideSlot.activities && overrideSlot.activities.some(activity => 
        specialEventActivities.some(special => activity.toLowerCase().includes(special.toLowerCase()))
      );
      
      if (activeRegularSlots.length > 0) {
        const regularSlot = activeRegularSlots[0];
        
        // Compare activities to see if they're the same
        const activitiesMatch = this._activitiesMatch(overrideSlot.activities, regularSlot.activities);
        
        if (activitiesMatch && !hasSpecialReason && !hasSpecialActivity) {
          // Same activities and no special event indicators - this is likely a schedule modification
          shouldShowAsOverride = false;
        } else if (hasSpecialReason || hasSpecialActivity) {
          // Has special event indicators - this is a true override
          shouldShowAsOverride = true;
        } else {
          // Different activities but no clear special event - could be either
          // Default to showing as override to be safe
          shouldShowAsOverride = true;
        }
      } else {
        // Override with no regular slot - only mark as override if it's clearly a special event
        shouldShowAsOverride = hasSpecialReason || hasSpecialActivity;
      }
      
      const TimeUtilsRef = this._getTimeUtils();
      if (!TimeUtilsRef) {
        return {
          startTime: 'Error',
          endTime: 'Error', 
          activities: overrideSlot.activities,
          notes: shouldShowAsOverride ? overrideSlot.notes : (overrideSlot.notes || ''),
          accessStatus: overrideSlot.accessStatus,
          isOverride: shouldShowAsOverride,
          overrideReason: shouldShowAsOverride ? overrideSlot.overrideReason : null
        };
      }
      
      return {
        startTime: TimeUtilsRef.minutesToTimeString(startMinutes),
        endTime: TimeUtilsRef.minutesToTimeString(endMinutes),
        activities: overrideSlot.activities,
        notes: shouldShowAsOverride ? overrideSlot.notes : (overrideSlot.notes || ''),
        accessStatus: overrideSlot.accessStatus,
        isOverride: shouldShowAsOverride,
        overrideReason: shouldShowAsOverride ? overrideSlot.overrideReason : null
      };
    } else if (activeRegularSlots.length > 0) {
      const TimeUtilsRef = this._getTimeUtils();
      if (!TimeUtilsRef) {
        return {
          startTime: 'Error',
          endTime: 'Error',
          activities: [],
          notes: '',
          accessStatus: 'restricted',
          isOverride: false
        };
      }
      
      const regularSlot = activeRegularSlots[0]; // Use first regular if multiple
      return {
        startTime: TimeUtilsRef.minutesToTimeString(startMinutes),
        endTime: TimeUtilsRef.minutesToTimeString(endMinutes),
        activities: regularSlot.activities,
        notes: regularSlot.notes,
        accessStatus: regularSlot.accessStatus,
        isOverride: false
      };
    }
    
    return null;
  }

  /**
   * Compare two activity arrays to see if they represent the same activities
   * @private
   * @param {Array} activities1 - First activity array
   * @param {Array} activities2 - Second activity array
   * @returns {boolean} - True if activities match
   */
  _activitiesMatch(activities1, activities2) {
    if (!activities1 || !activities2) {
      return false;
    }
    
    // Handle empty arrays
    if (activities1.length === 0 && activities2.length === 0) {
      return true;
    }
    
    if (activities1.length !== activities2.length) {
      return false;
    }
    
    // Sort and compare arrays - ensure we create new arrays to avoid mutating originals
    const sorted1 = [...activities1].sort();
    const sorted2 = [...activities2].sort();
    
    return JSON.stringify(sorted1) === JSON.stringify(sorted2);
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
    const TimeUtilsRef = this._getTimeUtils();
    if (!TimeUtilsRef) {
      return [];
    }
    
    const now = new Date();
    const dayName = TimeUtilsRef.getDayName(now);
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
    const TimeUtilsRef = this._getTimeUtils();
    if (!TimeUtilsRef) {
      return [];
    }
    
    const today = TimeUtilsRef.formatDate(new Date());
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
    const TimeUtilsRef = this._getTimeUtils();
    const status = this.getCurrentStatus();
    const todaysEvents = this.getTodaysEvents();
    
    return {
      name: this.name,
      status: status.status,
      isOpen: status.isOpen,
      statusIcon: status.icon,
      todaysHours: this.getHoursForDay(TimeUtilsRef ? TimeUtilsRef.getDayName(new Date()) : 'Unknown'),
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
      laneCount: this.laneCount,
      laneLengthUnits: this.laneLengthUnits,
      laneLength: this.laneLength,
      features: this.features,
      amenities: this.amenities,
      divingBoard: this.divingBoard,
      babyPool: this.babyPool,
      hours: this.schedule.scheduleData,
      scheduleOverrides: this.scheduleOverrides,
      restrictions: this.restrictions,
      specialEvents: this.specialEvents,
      lastUpdated: this.lastUpdated
    };

    if (this.legacySchedules) {
      result.schedules = this.legacySchedules;
    }
    
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
    
    const TimeUtilsRef = this._getTimeUtils();
    if (!TimeUtilsRef) {
      return null;
    }
    
    const easternTimeInfo = TimeUtilsRef.getCurrentEasternTimeInfo();
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

  /**
   * Get the valid date range for this pool (first and last dates with schedules)
   * @returns {Object|null} - Object with {startDate, endDate} or null if no schedules
   */
  getValidDateRange() {
    if (!this.legacySchedules || !Array.isArray(this.legacySchedules) || this.legacySchedules.length === 0) {
      return null;
    }
    
    const allDates = this.legacySchedules.map(schedule => ({
      start: new Date(schedule.startDate),
      end: new Date(schedule.endDate)
    }));
    
    const minDate = new Date(Math.min(...allDates.map(d => d.start.getTime())));
    const maxDate = new Date(Math.max(...allDates.map(d => d.end.getTime())));
    
    return {
      startDate: minDate,
      endDate: maxDate
    };
  }
}

// Export for Node.js compatibility
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Pool;
}

// Make sure it's available globally
if (typeof window !== 'undefined') {
  window.Pool = Pool;
}

}
