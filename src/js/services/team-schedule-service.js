/**
 * Expands published recurring team practices into calendar-day schedule blocks.
 */
if (typeof window === 'undefined' || !window.TeamScheduleService) {
  class TeamScheduleService {
    static WEEKDAYS = Object.freeze(['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']);

    static parseSeasonRange(range, year = globalThis.YEAR) {
      if (typeof range !== 'string' || !year) return null;

      const parts = range.split(/\s+-\s+/);
      if (parts.length !== 2) return null;

      const dates = parts.map(part => new Date(`${part}, ${year} 12:00:00`));
      if (!dates.every(date => !Number.isNaN(date.getTime()))) return null;

      dates[0].setHours(0, 0, 0, 0);
      dates[1].setHours(23, 59, 59, 999);
      return { startDate: dates[0], endDate: dates[1] };
    }

    static parseWeekdays(description) {
      if (typeof description !== 'string') return [];

      const normalized = description.replace(/\bthru\b|\bthrough\b|\bto\b/gi, '-');
      const foundDays = TeamScheduleService.WEEKDAYS.filter(day => new RegExp(`\\b${day}\\b`, 'i').test(normalized));
      if (foundDays.length === 2 && /-/.test(normalized)) {
        const firstIndex = TeamScheduleService.WEEKDAYS.indexOf(foundDays[0]);
        const lastIndex = TeamScheduleService.WEEKDAYS.indexOf(foundDays[1]);
        if (firstIndex <= lastIndex) return TeamScheduleService.WEEKDAYS.slice(firstIndex, lastIndex + 1);
      }

      return foundDays;
    }

    static getPracticePatterns(practice) {
      if (!practice) return [];

      const patterns = [];
      (practice.preseason || []).forEach(period => {
        const dateRange = TeamScheduleService.parseSeasonRange(period.period);
        if (!dateRange) return;
        patterns.push({
          ...dateRange,
          label: 'Pre-season Practice',
          location: period.location,
          sessions: period.sessions || [],
          weekdays: TeamScheduleService.parseWeekdays(period.days)
        });
      });

      if (!practice.regular) return patterns;
      const regularRange = TeamScheduleService.parseSeasonRange(practice.regular.season);
      if (!regularRange) return patterns;
      (practice.regular.morning || []).forEach(morning => patterns.push({
        ...regularRange,
        label: 'Morning Practice',
        location: morning.location,
        sessions: morning.sessions || [],
        weekdays: TeamScheduleService.parseWeekdays(morning.days)
      }));
      (practice.regular.evening || []).forEach(evening => patterns.push({
        ...regularRange,
        label: 'Evening Practice',
        location: evening.location,
        sessions: evening.sessions || [],
        weekdays: TeamScheduleService.parseWeekdays(evening.day)
      }));

      return patterns;
    }

    static getUpcomingPractices(practice, startDate = new Date(), dayCount = 7) {
      const rangeStart = new Date(startDate);
      rangeStart.setHours(0, 0, 0, 0);
      const patterns = TeamScheduleService.getPracticePatterns(practice);
      const results = [];

      for (let offset = 0; offset < dayCount; offset += 1) {
        const date = new Date(rangeStart);
        date.setDate(rangeStart.getDate() + offset);
        const weekday = TeamScheduleService.WEEKDAYS[date.getDay()];
        patterns.forEach(pattern => {
          if (date < pattern.startDate || date > pattern.endDate || !pattern.weekdays.includes(weekday)) return;
          results.push({
            date,
            label: pattern.label,
            location: pattern.location,
            sessions: pattern.sessions
          });
        });
      }

      return results;
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { TeamScheduleService };
  }

  if (typeof window !== 'undefined') {
    window.TeamScheduleService = TeamScheduleService;
  }
}