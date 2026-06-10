/**
 * Defines the annual off-season window from published pool-season metadata.
 * All comparisons use Eastern calendar dates rather than the visitor's timezone.
 */

/** Calculates annual off-season dates in the application timezone. */
class SeasonService {
  /**
   * Format an instant as an Eastern calendar date.
   * @param {Date} date - Instant to format
   * @returns {string} ISO date-only value in Eastern time
   */
  static getEasternDateString(date = new Date()) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      day: '2-digit',
      month: '2-digit',
      timeZone: 'America/New_York',
      year: 'numeric'
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  }

  /**
   * Calculate the off-season window following a published season end date.
   * @param {string} seasonEndDate - Published ISO season end date
   * @returns {Object|null} Frozen start and end dates, or null when invalid
   */
  static getOffSeasonWindow(seasonEndDate) {
    const endDate = this.parseDate(seasonEndDate);
    if (!endDate) return null;

    const offSeasonStart = new Date(endDate);
    offSeasonStart.setUTCDate(offSeasonStart.getUTCDate() + 1);
    const memorialDay = this.getMemorialDay(endDate.getUTCFullYear() + 1);
    const offSeasonEnd = new Date(memorialDay);
    offSeasonEnd.setUTCDate(offSeasonEnd.getUTCDate() - 3);

    return Object.freeze({
      endDate: this.formatDate(offSeasonEnd),
      startDate: this.formatDate(offSeasonStart)
    });
  }

  /**
   * Check whether an instant falls within the annual off-season window.
   * @param {string} seasonEndDate - Published ISO season end date
   * @param {Date} date - Instant to evaluate
   * @returns {boolean} Whether the date is in the off season
   */
  static isOffSeason(seasonEndDate, date = new Date()) {
    const window = this.getOffSeasonWindow(seasonEndDate);
    if (!window) return false;

    const currentDate = this.getEasternDateString(date);
    return currentDate >= window.startDate && currentDate <= window.endDate;
  }

  /**
   * Get Memorial Day for a calendar year.
   * @param {number} year - Four-digit calendar year
   * @returns {Date} Memorial Day at UTC midnight
   */
  static getMemorialDay(year) {
    const lastDayOfMay = new Date(Date.UTC(year, 4, 31));
    const daysSinceMonday = (lastDayOfMay.getUTCDay() + 6) % 7;
    lastDayOfMay.setUTCDate(lastDayOfMay.getUTCDate() - daysSinceMonday);
    return lastDayOfMay;
  }

  /**
   * Parse a valid ISO calendar date at UTC midnight.
   * @param {string} value - ISO date-only value
   * @returns {Date|null} Parsed date, or null when invalid
   */
  static parseDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return null;
    const date = new Date(`${value}T00:00:00Z`);
    return Number.isNaN(date.getTime()) || this.formatDate(date) !== value ? null : date;
  }

  /**
   * Format a date as an ISO calendar date.
   * @param {Date} date - Date to format
   * @returns {string} ISO date-only value
   */
  static formatDate(date) {
    return date.toISOString().slice(0, 10);
  }
}

globalThis.SeasonService = SeasonService;
