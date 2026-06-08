/**
 * Tracks per-pool schedule week state for pool directory navigation.
 */
if (typeof window === 'undefined') {
  if (typeof PoolCalendarService === 'undefined') { var PoolCalendarService = require('./pool-calendar-service.js'); } // eslint-disable-line no-var
}

if (typeof window === 'undefined' || !window.PoolWeekStateService) {
  class PoolWeekStateService {
    static weekStarts = new Map();

    /**
     * Get or initialize the displayed week for one pool.
     * @param {string} poolId - Pool identifier
     * @param {Date} referenceDate - Date used when no week has been selected yet
     * @returns {Date} Monday for the displayed week
     */
    static getWeekStart(poolId, referenceDate = new Date()) {
      if (!PoolWeekStateService.weekStarts.has(poolId)) {
        PoolWeekStateService.weekStarts.set(poolId, PoolCalendarService.getMondayOfWeek(referenceDate));
      }
      return PoolWeekStateService.weekStarts.get(poolId);
    }

    /**
     * Store the displayed week for one pool.
     * @param {string} poolId - Pool identifier
     * @param {Date} weekStart - Monday for the displayed week
     * @returns {Date} Stored week start
     */
    static setWeekStart(poolId, weekStart) {
      PoolWeekStateService.weekStarts.set(poolId, weekStart);
      return weekStart;
    }

    /**
     * Move a pool's displayed week by a whole-week offset.
     * @param {string} poolId - Pool identifier
     * @param {number} dayOffset - Whole-day offset from the current week
     * @param {Date} referenceDate - Date used when no week has been selected yet
     * @returns {Date} Stored week start after movement
     */
    static moveWeekStart(poolId, dayOffset, referenceDate = new Date()) {
      const currentWeek = PoolWeekStateService.getWeekStart(poolId, referenceDate);
      const weekStart = PoolCalendarService.addDays(currentWeek, dayOffset);
      return PoolWeekStateService.setWeekStart(poolId, weekStart);
    }

    /**
     * Store the week containing an HTML date input value.
     * @param {string} poolId - Pool identifier
     * @param {string} dateValue - ISO date-only input value
     * @returns {Date|null} Stored week start, or null when the input is invalid
     */
    static setSelectedWeekStart(poolId, dateValue) {
      const selectedDate = PoolCalendarService.parseDateInput(dateValue);
      if (!selectedDate) return null;

      const weekStart = PoolCalendarService.getMondayOfWeek(selectedDate);
      return PoolWeekStateService.setWeekStart(poolId, weekStart);
    }

    /**
     * Store the week containing a supplied or current day.
     * @param {string} poolId - Pool identifier
     * @param {Date} today - Day to use for the current-week selection
     * @returns {Date} Stored week start
     */
    static setTodayWeekStart(poolId, today = new Date()) {
      const weekStart = PoolCalendarService.getMondayOfWeek(today);
      return PoolWeekStateService.setWeekStart(poolId, weekStart);
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = PoolWeekStateService;
  }
  if (typeof window !== 'undefined') {
    window.PoolWeekStateService = PoolWeekStateService;
  }
}
