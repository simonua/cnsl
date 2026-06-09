/**
 * Defines the annual off-season window from published pool-season metadata.
 * All comparisons use Eastern calendar dates rather than the visitor's timezone.
 */

class SeasonService {
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

  static isOffSeason(seasonEndDate, date = new Date()) {
    const window = this.getOffSeasonWindow(seasonEndDate);
    if (!window) return false;

    const currentDate = this.getEasternDateString(date);
    return currentDate >= window.startDate && currentDate <= window.endDate;
  }

  static getMemorialDay(year) {
    const lastDayOfMay = new Date(Date.UTC(year, 4, 31));
    const daysSinceMonday = (lastDayOfMay.getUTCDay() + 6) % 7;
    lastDayOfMay.setUTCDate(lastDayOfMay.getUTCDate() - daysSinceMonday);
    return lastDayOfMay;
  }

  static parseDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return null;
    const date = new Date(`${value}T00:00:00Z`);
    return Number.isNaN(date.getTime()) || this.formatDate(date) !== value ? null : date;
  }

  static formatDate(date) {
    return date.toISOString().slice(0, 10);
  }
}

if (typeof window !== 'undefined') window.SeasonService = SeasonService;
if (typeof module !== 'undefined') module.exports = { SeasonService };
