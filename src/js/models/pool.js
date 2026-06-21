/**
 * Represents an individual pool and exposes schedule, status, and directory-facing helpers.
 * Delegates published period calculations to PoolPeriodScheduleService.
 */

// Prevent multiple declarations
if (typeof globalThis.Pool === 'undefined') {

  /**
   * Represents a pool and exposes directory, schedule, status, and event helpers.
   */
  class Pool {
  /**
  * Creates a pool from published annual data.
  * @param {PoolRecord} poolData - Published pool record
   */
  constructor(poolData = {}) {
    this.id = poolData.id || '';
    this.name = poolData.name || '';
    this.caUrl = poolData.caUrl || '';
    this.scheduleUrl = poolData.scheduleUrl || '';

    this.location = poolData.location ? { ...poolData.location } : null;
    const addressParts = [];
    if (this.location?.street) addressParts.push(this.location.street);
    if (this.location?.city || this.location?.state || this.location?.zip) {
      const locality = [this.location.city, this.location.state].filter(Boolean).join(', ');
      addressParts.push([locality, this.location.zip].filter(Boolean).join(' '));
    }
    this.address = addressParts.join(', ');
    this.lat = this.location?.lat;
    this.lng = this.location?.lng;
    this.mapsQuery = this.location?.mapsQuery || '';
    this.googleMapsUrl = this.location?.googleMapsUrl || '';

    this.phone = poolData.phone || '';
    this.laneCount = Number.isInteger(poolData.laneCount) && poolData.laneCount > 0 ? poolData.laneCount : null;
    this.laneLengthUnits = ['meters', 'yards'].includes(poolData.laneLengthUnits) ? poolData.laneLengthUnits : null;
    this.laneLength = Number.isFinite(poolData.laneLength) && poolData.laneLength > 0 ? poolData.laneLength : null;
    this.features = Array.isArray(poolData.features) ? [...poolData.features] : [];
    this.scheduleOverrides = Array.isArray(poolData.scheduleOverrides) ? [...poolData.scheduleOverrides] : [];
    this.schedulePeriods = Array.isArray(poolData.schedules) ? [...poolData.schedules] : [];
    this.periodSchedule = new PoolPeriodScheduleService({
      schedulePeriods: this.schedulePeriods,
      scheduleOverrides: this.scheduleOverrides,
      poolName: this.name,
      getTimeUtils: () => this._getTimeUtils(),
      getPoolStatus: () => this._getPoolStatus()
    });
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
  * Synchronize and return the published period schedule collaborator.
   * @private
    * @returns {Object|null} Period schedule collaborator, or null when unavailable
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
   * Get contact information
   * @returns {Object} - Contact information object
   */
  getContactInfo() {
    return {
      address: this.address,
      phone: this.phone,
      website: this.caUrl
    };
  }

  /**
  * Get current pool status from published schedule periods.
   * @returns {PoolStatus} - Current pool status
   */
  getCurrentStatus() {
    const PoolStatusRef = this._getPoolStatus();
    if (!PoolStatusRef) {
      return { kind: 'unavailable', isOpen: false, status: 'Error', color: 'gray' };
    }

    return this._getPeriodStatus();
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
    const action = currentStatus === PoolStatusRef.OPEN
      ? PoolTransitionAction.CLOSES
      : PoolTransitionAction.OPENS;

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

  /**
   * Check whether the pool has no public-use period today.
   * @returns {boolean} Whether a valid schedule keeps the pool closed to the public all day
   */
  isClosedToPublicAllDayToday() {
    const TimeUtilsRef = this._getTimeUtils();
    const PoolStatusRef = this._getPoolStatus();
    if (!TimeUtilsRef || !PoolStatusRef) return false;

    const easternTimeInfo = TimeUtilsRef.getCurrentEasternTimeInfo();
    if (!easternTimeInfo.isValid) return false;
    const shortDay = easternTimeInfo.day.substring(0, 3);
    const periodSchedule = this._getPeriodSchedule();
    const hasActiveSchedule = this.schedulePeriods.some(schedule => (
      easternTimeInfo.date >= schedule.startDate && easternTimeInfo.date <= schedule.endDate
    ));
    const hasOverride = Boolean(periodSchedule.getOverrideForDate(easternTimeInfo.date, shortDay));
    if (!hasActiveSchedule && !hasOverride) return false;
    return this._getPeriodTimeSlotsForDate(easternTimeInfo.date, shortDay)
      .every(slot => this._getPeriodSlotStatus(slot) !== PoolStatusRef.OPEN);
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

    const timeSlots = this._getPeriodTimeSlotsForDate(requestedDate, shortDay)
      .filter(slot => this._getPeriodSlotStatus(slot) === PoolStatusRef.OPEN
        && slot.isSpecialEvent !== true
        && typeof slot.startTime === 'string'
        && typeof slot.endTime === 'string')
      .map(slot => ({ startTime: slot.startTime, endTime: slot.endTime }));
    return timeSlots.length > 0 ? { date: requestedDate, dayName: requestedDay, shortDay, timeSlots } : null;
  }

  /**
   * Check whether today's last public-use period has ended.
   * @returns {boolean} Whether the pool was open today but will not reopen today
   */
  isClosedToPublicForDay() {
    const PoolStatusRef = this._getPoolStatus();
    if (!PoolStatusRef || this.getCurrentStatus() !== PoolStatusRef.CLOSED) return false;

    const TimeUtilsRef = this._getTimeUtils();
    const easternTimeInfo = TimeUtilsRef && TimeUtilsRef.getCurrentEasternTimeInfo();
    if (!easternTimeInfo || !easternTimeInfo.isValid) return false;
    const timeSlots = this._getPeriodTimeSlotsForDate(easternTimeInfo.date, easternTimeInfo.day.substring(0, 3));
    const hadPublicUseToday = timeSlots.some(slot => this._getPeriodSlotStatus(slot) === PoolStatusRef.OPEN);
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
   * Get all week schedule with status.
   * @returns {Array} - Array of day objects with status
   */
  getWeekSchedule() {
    const weekStartDate = new Date();
    const daysSinceMonday = (weekStartDate.getDay() + 6) % 7;
    weekStartDate.setDate(weekStartDate.getDate() - daysSinceMonday);
    return this._getPeriodWeekScheduleForDate(weekStartDate);
  }

  /**
   * Get all week schedule with status for a specific week.
   * @param {Date} weekStartDate - The Monday of the week to get the schedule for
   * @returns {Array} - Array of day objects with time slots
   */
  getWeekScheduleForDate(weekStartDate) {
    return this._getPeriodWeekScheduleForDate(weekStartDate);
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
   * Check if pool is open now
   * @returns {boolean} - True if pool is currently open
   */
  isOpenNow() {
    const status = this.getCurrentStatus();
    return status.isOpen;
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
      features: this.features.some(feature => feature.toLowerCase().includes(term))
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
      phone: this.phone,
      location: this.location,
      laneCount: this.laneCount,
      laneLengthUnits: this.laneLengthUnits,
      laneLength: this.laneLength,
      features: this.features,
      schedules: this.schedulePeriods,
      scheduleOverrides: this.scheduleOverrides
    };
    if (!this.phone) delete result.phone;
    if (this.scheduleOverrides.length === 0) delete result.scheduleOverrides;
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
