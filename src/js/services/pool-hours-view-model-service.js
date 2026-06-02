/**
 * Builds display-ready pool hours state without touching browser DOM APIs.
 */
if (typeof window === 'undefined') {
  if (typeof PoolCalendarService === 'undefined') { var PoolCalendarService = require('./pool-calendar-service.js'); } // eslint-disable-line no-var
  if (typeof TeamScheduleService === 'undefined') { var TeamScheduleService = require('./team-schedule-service.js').TeamScheduleService; } // eslint-disable-line no-var
}

if (typeof window === 'undefined' || !window.PoolHoursViewModelService) {
  class PoolHoursViewModelService {
    /**
     * Build the display model for one pool's selected schedule week.
     * @param {Object} pool - Published pool record
     * @param {Pool} poolModel - Loaded pool model
     * @param {Object} options - Explicit calendar, formatting, and schedule dependencies
     * @returns {Object} Display-ready pool hours view model
     */
    static build(pool, poolModel, options = {}) {
      const record = pool || {};
      const poolId = record.id || record.name;
      const poolName = record.name || 'this pool';
      const weekStart = options.weekStart;
      const weekEnd = PoolCalendarService.getWeekEnd(weekStart);
      const controlId = String(poolId).replace(/[^a-zA-Z0-9_-]/g, '-');
      const weekPickerId = `week-picker-${controlId}`;
      const timeUtils = options.timeUtils;
      const easternTimeInfo = timeUtils.getCurrentEasternTimeInfo();
      const poolStatus = PoolHoursViewModelService.getCurrentStatus(poolModel, options.onError);
      const weekSchedule = PoolHoursViewModelService.getWeekSchedule(poolModel, weekStart, options);
      const dateRange = poolModel.getValidDateRange();
      const statusTransition = poolModel.getPublicStatusTransitionToday();
      const today = new Date(`${easternTimeInfo.date}T12:00:00`);
      const getStatusTooltip = typeof options.getStatusTooltip === 'function'
        ? options.getStatusTooltip
        : () => 'Status unknown';

      return {
        poolId,
        poolName,
        weekPickerId,
        weekStartText: weekStart.toLocaleDateString('en-US', { month: 'long', day: 'numeric' }),
        weekEndText: weekEnd.toLocaleDateString('en-US', { month: 'long', day: 'numeric' }),
        hasDateRange: Boolean(dateRange),
        isTodayDisabled: !dateRange || !PoolCalendarService.isTodayInSeason(dateRange),
        isPreviousWeekDisabled: !dateRange || weekStart <= dateRange.startDate,
        isNextWeekDisabled: !dateRange || weekEnd >= dateRange.endDate,
        weekStartInputValue: PoolCalendarService.formatDateInputValue(weekStart),
        minDateInputValue: dateRange ? PoolCalendarService.formatDateInputValue(dateRange.startDate) : '',
        maxDateInputValue: dateRange ? PoolCalendarService.formatDateInputValue(dateRange.endDate) : '',
        poolStatus,
        statusTransition,
        statusTooltip: getStatusTooltip(poolStatus.kind),
        weekSchedule,
        scheduleOptions: {
          layout: options.layout,
          weekStart,
          today,
          timeUtils,
          poolStatus
        }
      };
    }

    /**
     * Resolve current pool status with the existing directory fallback behavior.
     * @param {Pool} poolModel - Loaded pool model
     * @param {Function} onError - Optional error reporter
     * @returns {Object} Current status or unavailable fallback
     */
    static getCurrentStatus(poolModel, onError) {
      try {
        return poolModel.getCurrentStatus();
      } catch (error) {
        PoolHoursViewModelService.reportError('status', poolModel, error, onError);
        return {
          kind: 'unavailable',
          isOpen: false,
          status: 'Error',
          color: 'gray'
        };
      }
    }

    /**
     * Resolve and enrich one week's schedule with detailed practice-team names.
     * @param {Pool} poolModel - Loaded pool model
     * @param {Date} weekStart - Monday for the displayed week
     * @param {Object} options - Practice and formatting dependencies
     * @returns {Array} Enriched weekly schedule records
     */
    static getWeekSchedule(poolModel, weekStart, options = {}) {
      let weekSchedule;
      try {
        weekSchedule = poolModel.getWeekScheduleForDate(weekStart);
      } catch (error) {
        PoolHoursViewModelService.reportError('week schedule', poolModel, error, options.onError);
        return [];
      }

      if (!Array.isArray(weekSchedule)) return [];
      return PoolHoursViewModelService.enrichPracticeTeamNames(
        weekSchedule,
        poolModel.name,
        weekStart,
        options.practiceTeams,
        options.timeUtils,
        options.teamScheduleService || TeamScheduleService
      );
    }

    /**
     * Attach detailed team names only to semantic practice-only slots.
     * @param {Array} weekSchedule - Schedule days returned by the pool model
     * @param {string} poolName - Pool name used for detailed practice matching
     * @param {Date} weekStart - Monday for the displayed week
     * @param {Array} practiceTeams - Teams associated with the pool
     * @param {Object} timeUtils - Time formatting and parsing dependency
     * @param {Object} teamScheduleService - Detailed practice matching dependency
     * @returns {Array} Weekly schedule with practice team names attached where available
     */
    static enrichPracticeTeamNames(weekSchedule, poolName, weekStart, practiceTeams, timeUtils, teamScheduleService) {
      return weekSchedule.map((scheduleDay, index) => {
        const scheduleDate = PoolCalendarService.addDays(weekStart, index);
        return {
          ...scheduleDay,
          timeSlots: (scheduleDay.timeSlots || []).map(slot => {
            if (slot.accessStatus !== 'practice-only' || !teamScheduleService) return slot;
            const detailedNames = teamScheduleService.getDetailedPracticeTeamNames(practiceTeams, poolName, scheduleDate, slot, timeUtils);
            return { ...slot, practiceTeamNames: detailedNames };
          })
        };
      });
    }

    static reportError(operation, poolModel, error, onError) {
      if (typeof onError === 'function') onError(operation, poolModel.name, error);
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = PoolHoursViewModelService;
  }
  if (typeof window !== 'undefined') {
    window.PoolHoursViewModelService = PoolHoursViewModelService;
  }
}