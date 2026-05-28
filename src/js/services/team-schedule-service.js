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
      if (dates[0] > dates[1]) return null;
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

    static getValidationErrors(practice, year = globalThis.YEAR) {
      if (!practice) return [];

      const errors = [];
      const validateRange = (value, label) => {
        if (!TeamScheduleService.parseSeasonRange(value, year)) {
          errors.push(`${label} date range cannot be rendered: ${value}.`);
        }
      };
      const validateDays = (value, label) => {
        if (TeamScheduleService.parseWeekdays(value).length === 0) {
          errors.push(`${label} weekdays cannot be rendered: ${value}.`);
        }
      };

      (practice.preseason || []).forEach((period, index) => {
        validateRange(period.period, `preseason entry ${index + 1}`);
        validateDays(period.days, `preseason entry ${index + 1}`);
      });

      if (practice.regular) {
        validateRange(practice.regular.season, 'regular season');
        (practice.regular.morning || []).forEach((entry, index) => {
          validateDays(entry.days, `regular morning entry ${index + 1}`);
        });
        (practice.regular.evening || []).forEach((entry, index) => {
          validateDays(entry.day, `regular evening entry ${index + 1}`);
        });
      }

      return errors;
    }

    static isCurrentPracticeRange(range, referenceDate = new Date()) {
      const practiceRange = TeamScheduleService.parseSeasonRange(range);
      if (!practiceRange) return false;

      const today = new Date(referenceDate);
      today.setHours(0, 0, 0, 0);
      return today >= practiceRange.startDate && today <= practiceRange.endDate;
    }

    static getCurrentPracticePhase(practice, referenceDate = new Date()) {
      if (!practice) return null;

      if ((practice.preseason || []).some(period => TeamScheduleService.isCurrentPracticeRange(period.period, referenceDate))) return 'preseason';
      if (practice.regular && TeamScheduleService.isCurrentPracticeRange(practice.regular.season, referenceDate)) return 'regular';

      return null;
    }

    static getPracticePatterns(practice, year = globalThis.YEAR) {
      if (!practice) return [];

      const patterns = [];
      (practice.preseason || []).forEach(period => {
        const dateRange = TeamScheduleService.parseSeasonRange(period.period, year);
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
      const regularRange = TeamScheduleService.parseSeasonRange(practice.regular.season, year);
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

    static getDetailedPracticeTeamNames(teams, poolName, date, slot, timeUtils) {
      if (!Array.isArray(teams) || typeof poolName !== 'string' || !(date instanceof Date) || !slot || !timeUtils) return [];

      const slotRange = TeamScheduleService.getTimeRange(`${slot.startTime} - ${slot.endTime}`, timeUtils);
      if (!slotRange) return [];
      const normalizedPoolName = TeamScheduleService.normalizePoolName(poolName);

      return teams.filter(team => TeamScheduleService.getUpcomingPractices(team.practice, date, 1).some(practice => {
        if (TeamScheduleService.normalizePoolName(practice.location) !== normalizedPoolName) return false;
        return practice.sessions.some(session => {
          const sessionRange = TeamScheduleService.getTimeRange(session.time, timeUtils);
          return sessionRange && sessionRange.start < slotRange.end && sessionRange.end > slotRange.start;
        });
      })).map(team => team.name);
    }

    static normalizePoolName(poolName) {
      return String(poolName || '').replace(/\s+Pool\s*$/i, '').trim();
    }

    static getTimeRange(timeRange, timeUtils) {
      if (typeof timeRange !== 'string' || !timeUtils || typeof timeUtils.timeStringToMinutes !== 'function') return null;

      const parts = timeRange.split(/\s+-\s+/);
      if (parts.length !== 2) return null;
      const endingPeriod = parts[1].match(/(am|pm)$/i);
      if (!endingPeriod) return null;
      const startTime = /(am|pm)$/i.test(parts[0]) ? parts[0] : `${parts[0]}${endingPeriod[1]}`;
      try {
        const start = timeUtils.timeStringToMinutes(startTime);
        const end = timeUtils.timeStringToMinutes(parts[1]);
        return start < end ? { start, end } : null;
      } catch {
        return null;
      }
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { TeamScheduleService };
  }

  if (typeof window !== 'undefined') {
    window.TeamScheduleService = TeamScheduleService;
  }
}