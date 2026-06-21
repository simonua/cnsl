/**
 * Projects published pool schedule periods into semantic daily availability.
 * Keeps period selection, dated overrides, and access-status resolution outside the Pool model and display layer.
 */

if (typeof globalThis.PoolPeriodScheduleService === 'undefined') {
  const REPLACE_DAY_OVERRIDE_MODE = 'replace-day';

  /** Resolves published schedule periods and overrides into daily pool availability. */
  class PoolPeriodScheduleService {
    static DAY_NAMES = Object.freeze({
      Mon: 'Monday',
      Tue: 'Tuesday',
      Wed: 'Wednesday',
      Thu: 'Thursday',
      Fri: 'Friday',
      Sat: 'Saturday',
      Sun: 'Sunday'
    });

    /**
     * Format a local date without UTC conversion.
     * @param {Date} date - Local date
     * @returns {string} ISO date-only value
     */
    static getLocalDateString(date) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }

    /**
     * Create a period schedule resolver.
     * @param {Object} options - Schedule records and dependency callbacks
     */
    constructor(options = {}) {
      this.schedulePeriods = Array.isArray(options.schedulePeriods) ? options.schedulePeriods : [];
      this.scheduleOverrides = Array.isArray(options.scheduleOverrides) ? options.scheduleOverrides : [];
      this.poolName = options.poolName || '';
      this.getTimeUtils = typeof options.getTimeUtils === 'function' ? options.getTimeUtils : () => null;
      this.getPoolStatus = typeof options.getPoolStatus === 'function' ? options.getPoolStatus : () => null;
    }

    /** @returns {Object} Current semantic pool status */
    getCurrentStatus() {
      const poolStatus = this.getPoolStatus();
      if (!poolStatus) return { kind: 'unavailable', isOpen: false, status: 'Error', color: 'gray' };
      if (this.schedulePeriods.length === 0) return poolStatus.SCHEDULE_NOT_FOUND;

      const timeUtils = this.getTimeUtils();
      if (!timeUtils) return poolStatus.SCHEDULE_NOT_FOUND;
      const current = timeUtils.getCurrentEasternTimeInfo();
      return this.getStatusAtMinutes(this.getTimeSlotsForDate(current.date, current.day.substring(0, 3)), current.minutes);
    }

    /**
     * Get effective slots for one date and weekday.
     * @param {string} dateString - ISO calendar date
     * @param {string} shortDay - Short weekday name
     * @returns {Array} Effective time slots
     */
    getTimeSlotsForDate(dateString, shortDay) {
      const activeSchedule = this.schedulePeriods.find(schedule => dateString >= schedule.startDate && dateString <= schedule.endDate);
      if (!this.getTimeUtils()) return [];
      const override = this.getOverrideForDate(dateString, shortDay);
      if (override) return this.mergeScheduleWithOverride(activeSchedule, shortDay, override);
      if (!activeSchedule || !Array.isArray(activeSchedule.hours)) return [];

      return this.sortSlots(activeSchedule.hours.filter(hour => Array.isArray(hour.weekDays) && hour.weekDays.includes(shortDay)));
    }

    /**
     * Map a slot's access state to pool status.
     * @param {Object} slot - Schedule slot
     * @returns {Object} Semantic pool status
     */
    getSlotStatus(slot) {
      const poolStatus = this.getPoolStatus();
      if (!poolStatus) return { isOpen: false, color: 'gray' };
      switch (slot.accessStatus) {
        case 'public': return poolStatus.OPEN;
        case 'restricted': return poolStatus.RESTRICTED;
        case 'closed-to-public': return poolStatus.CLOSED_TO_PUBLIC;
        case 'practice-only': return poolStatus.PRACTICE_ONLY;
        case 'special-event': return poolStatus.SPECIAL_EVENT;
        case 'swim-meet': return poolStatus.SWIM_MEET;
        default: return poolStatus.RESTRICTED;
      }
    }

    /**
     * Resolve status at a minute within effective slots.
     * @param {Array} timeSlots - Effective schedule slots
     * @param {number} currentMinutes - Minutes after midnight
     * @returns {Object} Semantic pool status
     */
    getStatusAtMinutes(timeSlots, currentMinutes) {
      const poolStatus = this.getPoolStatus();
      const timeUtils = this.getTimeUtils();
      if (!poolStatus || !timeUtils) return { isOpen: false, color: 'gray' };

      const allDayClosure = timeSlots.find(slot => (
        slot.accessStatus === 'closed-to-public'
        && typeof slot.startTime !== 'string'
        && typeof slot.endTime !== 'string'
      ));
      for (const slot of timeSlots) {
        if (slot === allDayClosure) continue;
        if (typeof slot.startTime !== 'string' || typeof slot.endTime !== 'string') {
          console.warn(`[PoolPeriodScheduleService] Skipping invalid time slot for ${this.poolName}:`, slot);
          continue;
        }
        const startMinutes = timeUtils.timeStringToMinutes(slot.startTime);
        const endMinutes = timeUtils.timeStringToMinutes(slot.endTime);
        if (currentMinutes >= startMinutes && currentMinutes < endMinutes) return this.getSlotStatus(slot);
      }
      return allDayClosure ? poolStatus.CLOSED_TO_PUBLIC : poolStatus.CLOSED;
    }

    /**
     * Build a seven-day effective schedule.
     * @param {Date} weekStartDate - First displayed day
     * @returns {Array} Seven daily schedule records
     */
    getWeekScheduleForDate(weekStartDate) {
      return Object.keys(PoolPeriodScheduleService.DAY_NAMES).map((shortDay, index) => {
        const targetDate = new Date(weekStartDate);
        targetDate.setDate(weekStartDate.getDate() + index);
        const dateString = PoolPeriodScheduleService.getLocalDateString(targetDate);
        const activeSchedule = this.schedulePeriods.find(schedule => dateString >= schedule.startDate && dateString <= schedule.endDate);
        const override = this.getOverrideForDate(dateString, shortDay);
        const timeSlots = override
          ? this.mergeScheduleWithOverride(activeSchedule, shortDay, override)
          : this.getRegularSlots(activeSchedule, shortDay);
        return {
          day: shortDay,
          fullDay: PoolPeriodScheduleService.DAY_NAMES[shortDay],
          timeSlots,
          isOpen: timeSlots.length > 0,
          hasOverrides: Boolean(override),
          overrideReason: override ? override.reason : null
        };
      });
    }

    /**
     * Find an override covering a date and weekday.
     * @param {string} dateString - ISO calendar date
     * @param {string} shortDay - Short weekday name
     * @returns {Object|null} Matching override
     * @private
     */
    getOverrideForDate(dateString, shortDay) {
      if (!Array.isArray(this.scheduleOverrides)) return null;
      return this.scheduleOverrides.find(override => (
        dateString >= override.startDate
        && dateString <= override.endDate
        && Array.isArray(override.hours)
        && override.hours.some(hour => Array.isArray(hour.weekDays) && hour.weekDays.includes(shortDay))
      ));
    }

    /**
     * Overlay override slots on a regular daily schedule.
     * @param {Object|null} activeSchedule - Active schedule period
     * @param {string} shortDay - Short weekday name
     * @param {Object} override - Dated schedule override
     * @returns {Array} Merged effective slots
     * @private
     */
    mergeScheduleWithOverride(activeSchedule, shortDay, override) {
      const regularSlots = override.overrideMode === REPLACE_DAY_OVERRIDE_MODE
        ? []
        : this.getRegularSlots(activeSchedule, shortDay);
      const overrideSlots = this.getSlotsForDay(override.hours, shortDay, true).map(hour => ({
        startTime: hour.startTime,
        endTime: hour.endTime,
        activities: hour.types || [],
        notes: hour.notes || '',
        accessStatus: hour.accessStatus,
        sourceUrl: hour.sourceUrl || '',
        isSpecialEvent: hour.isSpecialEvent === true,
        isOverride: true,
        overrideReason: override.reason || null,
        meetDate: hour.meetDate || '',
        meetPoolId: hour.meetPoolId || ''
      }));
      const untimedOverrides = overrideSlots.filter(slot => typeof slot.startTime !== 'string');
      const convertedOverrides = overrideSlots.filter(slot => typeof slot.startTime === 'string')
        .map(slot => this.withMinutes(slot));
      const mergedSlots = [];

      regularSlots.map(slot => this.withMinutes(slot)).forEach(regularSlot => {
        let remainingSlots = [regularSlot];
        convertedOverrides.forEach(overrideSlot => {
          remainingSlots = remainingSlots.flatMap(remaining => this.subtractOverride(remaining, overrideSlot));
        });
        mergedSlots.push(...remainingSlots);
      });
      mergedSlots.push(...convertedOverrides);
      return [...untimedOverrides, ...mergedSlots.sort((first, second) => first.startMinutes - second.startMinutes)].map(slot => ({
        startTime: slot.startTime,
        endTime: slot.endTime,
        activities: slot.activities,
        notes: slot.notes,
        accessStatus: slot.accessStatus,
        isSpecialEvent: slot.isSpecialEvent,
        isOverride: slot.isOverride,
        overrideReason: slot.overrideReason,
        meetDate: slot.meetDate,
        meetPoolId: slot.meetPoolId,
        sourceUrl: slot.sourceUrl
      }));
    }

    /** @returns {Object|null} Earliest and latest schedule dates */
    getValidDateRange() {
      if (this.schedulePeriods.length === 0) return null;
      const dates = this.schedulePeriods.map(schedule => ({ start: new Date(schedule.startDate), end: new Date(schedule.endDate) }));
      return {
        startDate: new Date(Math.min(...dates.map(date => date.start.getTime()))),
        endDate: new Date(Math.max(...dates.map(date => date.end.getTime())))
      };
    }

    /**
     * Select hours applying to one weekday.
     * @param {Array} hours - Published hours
     * @param {string} shortDay - Short weekday
     * @param {boolean} includeUntimedClosures - Whether all-day closure records should be retained
     * @returns {Array} Matching hours
     * @private
     */
    getSlotsForDay(hours, shortDay, includeUntimedClosures = false) {
      return Array.isArray(hours) ? hours.filter(hour => (
        Array.isArray(hour.weekDays)
        && hour.weekDays.includes(shortDay)
        && ((hour.startTime && hour.endTime)
          || (includeUntimedClosures && hour.accessStatus === 'closed-to-public'
            && !hour.startTime && !hour.endTime))
      )) : [];
    }

    /**
     * Normalize regular slots for one weekday.
     * @param {Object|null} activeSchedule - Active period
     * @param {string} shortDay - Short weekday
     * @returns {Array} Regular slots
     * @private
     */
    getRegularSlots(activeSchedule, shortDay) {
      return this.sortSlots(this.getSlotsForDay(activeSchedule && activeSchedule.hours, shortDay).map(hour => ({
        startTime: hour.startTime,
        endTime: hour.endTime,
        activities: hour.types || [],
        notes: hour.notes || '',
        accessStatus: hour.accessStatus,
        sourceUrl: hour.sourceUrl || '',
        isSpecialEvent: hour.isSpecialEvent === true,
        isOverride: false
      })));
    }

    /**
     * Sort schedule slots by start time.
     * @param {Array} slots - Schedule slots
     * @returns {Array} Slots ordered by start time
     * @private
     */
    sortSlots(slots) {
      const timeUtils = this.getTimeUtils();
      if (!timeUtils) return slots;
      return slots.map((slot, index) => {
        let startMinutes = null;
        if (typeof slot.startTime === 'string') {
          try {
            startMinutes = timeUtils.timeStringToMinutes(slot.startTime);
          } catch (_error) {
            console.warn(`[PoolPeriodScheduleService] Preserving slot with invalid start time for ${this.poolName}:`, slot);
          }
        }
        return { index, slot, startMinutes };
      }).sort((first, second) => {
        if (first.startMinutes === null && second.startMinutes === null) return first.index - second.index;
        if (first.startMinutes === null) return 1;
        if (second.startMinutes === null) return -1;
        return first.startMinutes - second.startMinutes;
      }).map(entry => entry.slot);
    }

    /**
     * Add minute boundaries to a schedule slot.
     * @param {Object} slot - Schedule slot
     * @returns {Object} Slot with minute boundaries
     * @private
     */
    withMinutes(slot) {
      const timeUtils = this.getTimeUtils();
      if (!timeUtils || typeof slot.startTime !== 'string' || typeof slot.endTime !== 'string') {
        console.warn(`[PoolPeriodScheduleService] Skipping slot with invalid times for ${this.poolName}:`, slot);
        return { ...slot, startMinutes: 0, endMinutes: 0 };
      }
      try {
        return {
          ...slot,
          startMinutes: timeUtils.timeStringToMinutes(slot.startTime),
          endMinutes: timeUtils.timeStringToMinutes(slot.endTime)
        };
      } catch (_error) {
        console.warn(`[PoolPeriodScheduleService] Skipping slot with invalid times for ${this.poolName}:`, slot);
        return { ...slot, startMinutes: 0, endMinutes: 0 };
      }
    }

    /**
     * Remove an overlapping override interval from a regular slot.
     * @param {Object} regularSlot - Regular slot with minute boundaries
     * @param {Object} overrideSlot - Override slot with minute boundaries
     * @returns {Array} Remaining regular slot segments
     * @private
     */
    subtractOverride(regularSlot, overrideSlot) {
      if (overrideSlot.startMinutes <= regularSlot.startMinutes && overrideSlot.endMinutes >= regularSlot.endMinutes) return [];
      if (overrideSlot.endMinutes <= regularSlot.startMinutes || overrideSlot.startMinutes >= regularSlot.endMinutes) return [regularSlot];

      const timeUtils = this.getTimeUtils();
      if (!timeUtils) return [];
      const remainingSlots = [];
      if (regularSlot.startMinutes < overrideSlot.startMinutes) {
        remainingSlots.push({ ...regularSlot, endMinutes: overrideSlot.startMinutes, endTime: timeUtils.minutesToTimeString(overrideSlot.startMinutes) });
      }
      if (regularSlot.endMinutes > overrideSlot.endMinutes) {
        remainingSlots.push({ ...regularSlot, startMinutes: overrideSlot.endMinutes, startTime: timeUtils.minutesToTimeString(overrideSlot.endMinutes) });
      }
      return remainingSlots;
    }
  }

  globalThis.PoolPeriodScheduleService = PoolPeriodScheduleService;
}
