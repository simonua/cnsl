/**
 * Represents an individual pool and exposes schedule, status, and directory-facing helpers.
 * Delegates published period calculations to PoolPeriodScheduleService while retaining compatibility methods for existing callers.
 */

// Prevent multiple declarations
if (typeof globalThis.Pool === 'undefined') {

  /**
   * Represents a pool and exposes directory, schedule, status, and event helpers.
   */
  class Pool {
  /**
   * Creates a pool from published annual data or the supported day-hours format.
   * @param {PoolRecord} poolData - Published pool record or a supported day-hours equivalent
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

    // The published pool model uses dated schedule periods. Keep the day-hours shape
    // as a compatibility branch for older callers that have not been migrated yet.
    if (poolData.schedules && Array.isArray(poolData.schedules)) {
      this.schedulePeriods = poolData.schedules;
      this.periodSchedule = new PoolPeriodScheduleService({
        schedulePeriods: this.schedulePeriods,
        scheduleOverrides: this.scheduleOverrides,
        poolName: this.name,
        getTimeUtils: () => this._getTimeUtils(),
        getPoolStatus: () => this._getPoolStatus()
      });
      this.schedule = new PoolSchedule(this.periodSchedule.normalizeActiveSchedule());
    } else {
      // Supported day-hours compatibility format
      this.schedule = new PoolSchedule(poolData.hours || {});
      this.schedulePeriods = null;
      this.periodSchedule = null;
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
    if (globalThis.TimeUtils) return globalThis.TimeUtils;
    if (typeof TimeUtils !== 'undefined') return TimeUtils;
    console.error('TimeUtils is not available');
    return null;
  }

  /**
   * Get PoolStatus reference safely
   * @private
   * @returns {Object|null} - PoolStatus object or null if not available
   */
  _getPoolStatus() {
    if (globalThis.PoolStatus) return globalThis.PoolStatus;
    if (typeof PoolStatus !== 'undefined') {
      return PoolStatus;
    }
    console.error('PoolStatus is not available');
    return null;
  }

  /**
   * Normalize the active published schedule period into the day-hours collaborator.
   * @private
    * @returns {Object|null} Period schedule collaborator, or null for day-hours schedules
   */
  _getPeriodSchedule() {
    if (!this.periodSchedule) return null;
    this.periodSchedule.schedulePeriods = this.schedulePeriods;
    this.periodSchedule.scheduleOverrides = this.scheduleOverrides;
    return this.periodSchedule;
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
   * Get current pool status from published schedule periods or day-hours compatibility data.
   * @returns {PoolStatus} - Current pool status
   */
  getCurrentStatus() {
    const PoolStatusRef = this._getPoolStatus();
    if (!PoolStatusRef) {
      return { kind: 'unavailable', isOpen: false, status: 'Error', color: 'gray' };
    }

    if (this.schedulePeriods) {
      return this._getPeriodStatus();
    }

    // Check if day-hours compatibility data has no schedule data
    if (!this.schedule || !this.schedule.hasScheduleData()) {
      return PoolStatusRef.SCHEDULE_NOT_FOUND;
    }

    return this.schedule.getCurrentStatus();
  }

  /**
   * Get status using the published period-based schedule model.
   * @private
   * @returns {PoolStatus} - Pool status from published period data
   */
  _getPeriodStatus() {
    const periodSchedule = this._getPeriodSchedule();
    return periodSchedule ? periodSchedule.getCurrentStatus() : this._getPoolStatus().SCHEDULE_NOT_FOUND;
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

    if (!this.schedulePeriods) {
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

    const timeSlots = this._getPeriodTimeSlotsForDate(easternTimeInfo.date, easternTimeInfo.day.substring(0, 3));
    let coveredUntil = easternTimeInfo.minutes;
    for (const slot of timeSlots) {
      if (this._getPeriodSlotStatus(slot) !== PoolStatusRef.OPEN) continue;
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
   * Check whether this closed pool next opens to public use within a time window today.
   * @param {number} durationMinutes - Maximum minutes until opening
   * @returns {boolean} Whether a public opening occurs within the requested window
   */
  opensWithinNextMinutes(durationMinutes = 60) {
    if (!Number.isFinite(durationMinutes) || durationMinutes < 0) return false;

    const transition = this.getPublicStatusTransitionToday();
    return transition !== null && transition.action === PoolTransitionAction.OPENS && transition.minutes <= durationMinutes;
  }

  /**
   * Return the next same-day transition in public-use availability.
    * @returns {{ action: PoolTransitionActionValue, minutes: number }|null} Next public opening or closing transition
   */
  getPublicStatusTransitionToday() {
    const TimeUtilsRef = this._getTimeUtils();
    const PoolStatusRef = this._getPoolStatus();
    if (!TimeUtilsRef || !PoolStatusRef) return null;

    const currentStatus = this.getCurrentStatus();
    const action = currentStatus === PoolStatusRef.CLOSED
      ? PoolTransitionAction.OPENS
      : currentStatus === PoolStatusRef.OPEN ? PoolTransitionAction.CLOSES : null;
    if (!action) return null;

    if (this.schedulePeriods) {
      const easternTimeInfo = TimeUtilsRef.getCurrentEasternTimeInfo();
      if (!easternTimeInfo.isValid) return null;

      const timeSlots = this._getPeriodTimeSlotsForDate(easternTimeInfo.date, easternTimeInfo.day.substring(0, 3));
      if (action === PoolTransitionAction.OPENS) {
        for (const slot of timeSlots) {
          if (this._getPeriodSlotStatus(slot) !== PoolStatusRef.OPEN || typeof slot.startTime !== 'string') continue;
          const startMinutes = TimeUtilsRef.timeStringToMinutes(slot.startTime);
          if (startMinutes > easternTimeInfo.minutes) return { action, minutes: startMinutes - easternTimeInfo.minutes };
        }
        return null;
      }

      let coveredUntil = easternTimeInfo.minutes;
      for (const slot of timeSlots) {
        if (this._getPeriodSlotStatus(slot) !== PoolStatusRef.OPEN) continue;
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

    if (action === PoolTransitionAction.OPENS) {
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
   * Check whether the pool has no public-use period today.
   * @returns {boolean} Whether a valid schedule keeps the pool closed to the public all day
   */
  isClosedToPublicAllDayToday() {
    const TimeUtilsRef = this._getTimeUtils();
    const PoolStatusRef = this._getPoolStatus();
    if (!TimeUtilsRef || !PoolStatusRef) return false;

    if (this.schedulePeriods) {
      const easternTimeInfo = TimeUtilsRef.getCurrentEasternTimeInfo();
      if (!easternTimeInfo.isValid) return false;

      const shortDay = easternTimeInfo.day.substring(0, 3);
      const periodSchedule = this._getPeriodSchedule();
      const hasActiveSchedule = this.schedulePeriods.some(schedule => (
        easternTimeInfo.date >= schedule.startDate && easternTimeInfo.date <= schedule.endDate
      ));
      const hasOverride = Boolean(periodSchedule && periodSchedule.getOverrideForDate(easternTimeInfo.date, shortDay));
      if (!hasActiveSchedule && !hasOverride) return false;

      return this._getPeriodTimeSlotsForDate(easternTimeInfo.date, shortDay)
        .every(slot => this._getPeriodSlotStatus(slot) !== PoolStatusRef.OPEN);
    }

    const easternTime = TimeUtilsRef.getEasternTime();
    const dayHours = this.schedule.getDayHours(TimeUtilsRef.getDayName(easternTime));
    return Boolean(dayHours && dayHours.closed === true);
  }

  /**
   * Check whether any published public-use period exists today.
   * @returns {boolean} Whether the pool is open to the public at any time today
   */
  hasPublicUseToday() {
    return this.hasPublicUseOnDayOffset(0);
  }

  /**
   * Check whether any published public-use period exists tomorrow.
   * @returns {boolean} Whether the pool is open to the public at any time tomorrow
   */
  hasPublicUseTomorrow() {
    return this.hasPublicUseOnDayOffset(1);
  }

  /**
   * Check whether any published public-use period exists on a future Eastern calendar day.
   * @param {number} dayOffset - Non-negative number of days after today
   * @returns {boolean} Whether the pool is open to the public at any time on that day
   */
  hasPublicUseOnDayOffset(dayOffset) {
    return this.getGeneralUseScheduleOnDayOffset(dayOffset) !== null;
  }

  /**
   * Get effective general-use hours for an Eastern calendar day.
   * @param {number} dayOffset - Non-negative number of days after today
   * @returns {{ date: string, dayName: string, shortDay: string, timeSlots: Array<{ startTime: string, endTime: string }> }|null} General-use schedule, or null when unavailable
   */
  getGeneralUseScheduleOnDayOffset(dayOffset) {
    if (!Number.isInteger(dayOffset) || dayOffset < 0) return null;

    const TimeUtilsRef = this._getTimeUtils();
    const PoolStatusRef = this._getPoolStatus();
    if (!TimeUtilsRef || !PoolStatusRef) return null;

    const easternTimeInfo = TimeUtilsRef.getCurrentEasternTimeInfo();
    if (!easternTimeInfo.isValid) return null;

    const dateParts = easternTimeInfo.date.match(TimeUtilsRef.DATE_ONLY_REGEX);
    if (!dateParts) return null;
    const easternDate = new Date(Date.UTC(Number(dateParts[1]), Number(dateParts[2]) - 1, Number(dateParts[3])));
    if (easternDate.toISOString().slice(0, 10) !== easternTimeInfo.date) return null;
    easternDate.setUTCDate(easternDate.getUTCDate() + dayOffset);
    const requestedDate = easternDate.toISOString().slice(0, 10);
    const requestedDay = easternDate.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
    const shortDay = requestedDay.substring(0, 3);

    if (this.schedulePeriods) {
      const timeSlots = this._getPeriodTimeSlotsForDate(requestedDate, shortDay)
        .filter(slot => this._getPeriodSlotStatus(slot) === PoolStatusRef.OPEN
          && slot.isSpecialEvent !== true
          && typeof slot.startTime === 'string'
          && typeof slot.endTime === 'string')
        .map(slot => ({ startTime: slot.startTime, endTime: slot.endTime }));
      return timeSlots.length > 0 ? { date: requestedDate, dayName: requestedDay, shortDay, timeSlots } : null;
    }

    const dayHours = this.schedule.getDayHours(requestedDay);
    if (!dayHours || dayHours.closed || dayHours.isSpecialEvent === true
      || typeof dayHours.open !== 'string' || typeof dayHours.close !== 'string') return null;
    return {
      date: requestedDate,
      dayName: requestedDay,
      shortDay,
      timeSlots: [{ startTime: dayHours.open, endTime: dayHours.close }]
    };
  }

  /**
   * Check whether today's last public-use period has ended.
   * @returns {boolean} Whether the pool was open today but will not reopen today
   */
  isClosedToPublicForDay() {
    const PoolStatusRef = this._getPoolStatus();
    if (!PoolStatusRef || this.getCurrentStatus() !== PoolStatusRef.CLOSED) return false;

    if (this.schedulePeriods) {
      const TimeUtilsRef = this._getTimeUtils();
      const easternTimeInfo = TimeUtilsRef && TimeUtilsRef.getCurrentEasternTimeInfo();
      if (!easternTimeInfo || !easternTimeInfo.isValid) return false;
      const timeSlots = this._getPeriodTimeSlotsForDate(easternTimeInfo.date, easternTimeInfo.day.substring(0, 3));
      const hadPublicUseToday = timeSlots.some(slot => this._getPeriodSlotStatus(slot) === PoolStatusRef.OPEN);
      return hadPublicUseToday && this.getPublicStatusTransitionToday() === null;
    }

    const TimeUtilsRef = this._getTimeUtils();
    const easternTime = TimeUtilsRef && TimeUtilsRef.getEasternTime();
    if (!easternTime) return false;
    const dayHours = this.schedule.getDayHours(TimeUtilsRef.getDayName(easternTime));
    const hadPublicUseToday = Boolean(dayHours && !dayHours.closed
      && typeof dayHours.open === 'string' && typeof dayHours.close === 'string');
    return hadPublicUseToday && this.getPublicStatusTransitionToday() === null;
  }

  /**
   * Find published or overriding slots for a calendar day.
   * @private
   * @param {string} dateString - Date in YYYY-MM-DD format
   * @param {string} shortDay - Day abbreviation
   * @returns {Array} Ordered time slots
   */
  _getPeriodTimeSlotsForDate(dateString, shortDay) {
    const periodSchedule = this._getPeriodSchedule();
    return periodSchedule ? periodSchedule.getTimeSlotsForDate(dateString, shortDay) : [];
  }

  /**
   * Resolve public access for a published period schedule slot.
   * @private
   * @param {Object} slot - Published schedule slot
   * @returns {PoolStatus} Access status represented by the slot
   */
  _getPeriodSlotStatus(slot) {
    const periodSchedule = this._getPeriodSchedule();
    return periodSchedule ? periodSchedule.getSlotStatus(slot) : { isOpen: false, color: 'gray' };
  }

  /**
   * Resolve status for a point within published period schedule slots.
   * @private
   * @param {Array} timeSlots - Applicable slots for the date
   * @param {number} currentTime - Minute of day to inspect
   * @returns {PoolStatus} Current access status
   */
  _getPeriodStatusAtMinutes(timeSlots, currentTime) {
    const periodSchedule = this._getPeriodSchedule();
    return periodSchedule ? periodSchedule.getStatusAtMinutes(timeSlots, currentTime) : { isOpen: false, color: 'gray' };
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
   * Get all week schedule with status.
   * @returns {Array} - Array of day objects with status
   */
  getWeekSchedule() {
    if (this.schedulePeriods) {
      const weekStartDate = new Date();
      const daysSinceMonday = (weekStartDate.getDay() + 6) % 7;
      weekStartDate.setDate(weekStartDate.getDate() - daysSinceMonday);
      return this._getPeriodWeekScheduleForDate(weekStartDate);
    }
    return this.schedule.getAllDaysStatus();
  }

  /**
   * Get all week schedule with status for a specific week.
   * @param {Date} weekStartDate - The Monday of the week to get the schedule for
   * @returns {Array} - Array of day objects with time slots
   */
  getWeekScheduleForDate(weekStartDate) {
    if (this.schedulePeriods) {
      return this._getPeriodWeekScheduleForDate(weekStartDate);
    }
    return this.schedule.getAllDaysStatus();
  }

  /**
  * Get week schedule from published periods for a specific week.
   * @private
   * @param {Date} weekStartDate - The Monday of the week to get the schedule for
   * @returns {Array} - Array of day objects with time slots
   */
  _getPeriodWeekScheduleForDate(weekStartDate) {
    const periodSchedule = this._getPeriodSchedule();
    return periodSchedule ? periodSchedule.getWeekScheduleForDate(weekStartDate) : [];
  }

  /**
   * Get schedule override for a specific date and day
   * @private
   * @param {string} dateString - Date in YYYY-MM-DD format
   * @param {string} shortDay - Day abbreviation (Mon, Tue, etc.)
   * @returns {Object|null} - Override object or null if none found
   */
  _getScheduleOverrideForDate(dateString, shortDay) {
    const periodSchedule = this._getPeriodSchedule();
    return periodSchedule ? periodSchedule.getOverrideForDate(dateString, shortDay) : null;
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
    const periodSchedule = this._getPeriodSchedule();
    return periodSchedule ? periodSchedule.mergeScheduleWithOverride(activeSchedule, shortDay, override) : [];
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

    if (this.schedulePeriods) {
      result.schedules = this.schedulePeriods;
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
    const periodSchedule = this._getPeriodSchedule();
    return periodSchedule ? periodSchedule.getCurrentSchedulePeriod() : null;
  }

  /**
   * Get the valid date range for this pool (first and last dates with schedules)
   * @returns {Object|null} - Object with {startDate, endDate} or null if no schedules
   */
  getValidDateRange() {
    const periodSchedule = this._getPeriodSchedule();
    return periodSchedule ? periodSchedule.getValidDateRange() : null;
  }
}

globalThis.Pool = Pool;

}
