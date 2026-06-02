/**
 * Provides date-only calendar calculations used by pool schedule navigation.
 */
if (typeof window === 'undefined' || !window.PoolCalendarService) {
  class PoolCalendarService {
    /**
     * Return the Monday for the week containing a date.
     * @param {Date} date - Date within the desired week
     * @returns {Date} Monday for that week
     */
    static getMondayOfWeek(date) {
      const weekDate = new Date(date);
      const day = weekDate.getDay();
      const offset = day === 0 ? -6 : 1 - day;
      weekDate.setDate(weekDate.getDate() + offset);
      return weekDate;
    }

    /**
     * Return a date offset by a whole number of days.
     * @param {Date} date - Base date
     * @param {number} dayOffset - Days to add or subtract
     * @returns {Date} Offset date
     */
    static addDays(date, dayOffset) {
      const offsetDate = new Date(date);
      offsetDate.setDate(offsetDate.getDate() + dayOffset);
      return offsetDate;
    }

    /**
     * Return the Sunday ending a Monday-based schedule week.
     * @param {Date} weekStart - Monday for the displayed week
     * @returns {Date} Sunday for the displayed week
     */
    static getWeekEnd(weekStart) {
      return PoolCalendarService.addDays(weekStart, 6);
    }

    /**
     * Check whether a day falls within a pool's published season range.
     * @param {Object|null} dateRange - Start and end dates for a published season
     * @param {Date} today - Date to check
     * @returns {boolean} True when the day is within the range
     */
    static isTodayInSeason(dateRange, today = new Date()) {
      if (!dateRange || !dateRange.startDate || !dateRange.endDate) return false;

      const currentDay = new Date(today);
      const startDate = new Date(dateRange.startDate);
      const endDate = new Date(dateRange.endDate);
      currentDay.setHours(0, 0, 0, 0);
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
      return currentDay >= startDate && currentDay <= endDate;
    }

    /**
     * Parse an HTML date input value as a local calendar day.
     * @param {string} dateValue - ISO date-only input value
     * @returns {Date|null} Parsed local date, or null when invalid
     */
    static parseDateInput(dateValue) {
      if (typeof dateValue !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) return null;

      const parsedDate = new Date(`${dateValue}T12:00:00`);
      if (Number.isNaN(parsedDate.getTime()) || PoolCalendarService.formatDateInputValue(parsedDate) !== dateValue) {
        return null;
      }

      return parsedDate;
    }

    /**
     * Format a date for an HTML date input without converting it to UTC.
     * @param {Date} date - Date to format
     * @returns {string} ISO date-only value, or an empty string when invalid
     */
    static formatDateInputValue(date) {
      const inputDate = new Date(date);
      if (Number.isNaN(inputDate.getTime())) return '';

      const year = inputDate.getFullYear();
      const month = String(inputDate.getMonth() + 1).padStart(2, '0');
      const day = String(inputDate.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = PoolCalendarService;
  }
  if (typeof window !== 'undefined') {
    window.PoolCalendarService = PoolCalendarService;
  }
}
