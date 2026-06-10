/**
 * Formats weekly pool schedules for list and calendar presentations.
 * Consumes display-ready schedule state and emits escaped markup without owning pool business rules.
 */

if (typeof window === 'undefined' || !window.PoolScheduleDisplay) {
  class PoolScheduleDisplay {
    static LAYOUTS = ['list', 'calendar'];

    /**
     * Render a weekly schedule in the requested presentation.
     * @param {Array} weekSchedule - Normalized days with time slots
     * @param {Object} options - Render date, layout, status, and formatting dependencies
     * @returns {string} Schedule HTML
     */
    static render(weekSchedule, options = {}) {
      const layout = PoolScheduleDisplay.LAYOUTS.includes(options.layout) ? options.layout : 'list';
      const days = PoolScheduleDisplay.createDays(weekSchedule, options.weekStart, options.today);

      if (layout === 'calendar') {
        return PoolScheduleDisplay.renderCalendar(days, options);
      }

      return PoolScheduleDisplay.renderList(days, options);
    }

    /**
     * Format a same-day public opening or closing transition for a status row.
     * @param {Object|null} transition - Public status action and positive minutes until it occurs
      * @param {Object} options - Display formatting options
     * @returns {string} Display label, or an empty string without a supported transition
     */
    static formatPublicStatusTransition(transition, options = {}) {
      if (!transition || !['opens', 'closes'].includes(transition.action)) return '';
      const actionLabel = transition.action === 'opens' ? 'Opens' : 'Closes';
      return PoolScheduleDisplay.formatStatusCountdown(actionLabel, transition.minutes, options.useLongUnits === true);
    }

    /**
     * Format the pool-card summary for today's public availability.
     * @param {Object|null} transition - Next same-day public availability transition
     * @param {boolean} isClosedAllDay - Whether no public-use period exists today
    * @param {boolean} isClosedForDay - Whether today's last public-use period has ended
     * @param {Object} options - Display formatting options
     * @returns {string} Display summary
     */
    static formatPublicStatusSummary(transition, isClosedAllDay, isClosedForDay, options = {}) {
      const transitionText = PoolScheduleDisplay.formatPublicStatusTransition(transition, options);
      if (transitionText) return transitionText;

      // Closed-state inputs remain available for schedule logic, but collapsed card titles
      // intentionally show only actionable "Opens in" and "Closes in" countdowns.
      void isClosedAllDay;
      void isClosedForDay;
      return '';
    }

    /**
     * Map semantic public transition urgency to status-countdown presentation.
     * @param {Object|null} transition - Public status action and minutes until it occurs
     * @returns {string} CSS classes for the transition label
     */
    static getPublicStatusTransitionClass(transition) {
      const isImminentClosing = transition
        && transition.action === 'closes'
        && Number.isInteger(transition.minutes)
        && transition.minutes > 0
        && transition.minutes < 60;
      return isImminentClosing
        ? 'pool-status-countdown pool-status-countdown--caution'
        : 'pool-status-countdown';
    }

    /**
     * Map semantic current status to explanatory copy.
     * @param {string} statusKind - Current PoolStatus kind
     * @returns {string} User-facing status explanation
     */
    static getStatusTooltip(statusKind) {
      switch (statusKind) {
        case 'open':
          return 'Open for public use';
        case 'closed':
        case 'closed-to-public':
          return 'Currently closed';
        case 'restricted':
        case 'practice-only':
        case 'special-event':
        case 'swim-meet':
          return 'Special schedule or restrictions';
        case 'schedule-not-found':
        case 'unavailable':
          return 'Schedule not available';
        default:
          return 'Status unknown';
      }
    }

    static formatStatusCountdown(action, minutesUntilChange, useLongUnits = false) {
      if (!Number.isInteger(minutesUntilChange) || minutesUntilChange <= 0) return '';

      if (minutesUntilChange < 60) {
        const unit = minutesUntilChange === 1
          ? (useLongUnits ? 'minute' : 'min')
          : (useLongUnits ? 'minutes' : 'mins');
        return `${action} in ${minutesUntilChange} ${unit}`;
      }

      const hours = Math.floor(minutesUntilChange / 60);
      const minutes = minutesUntilChange % 60;
      const hourUnit = hours === 1
        ? (useLongUnits ? 'hour' : 'hr')
        : (useLongUnits ? 'hours' : 'hrs');
      const minuteUnit = minutes === 1
        ? (useLongUnits ? 'minute' : 'min')
        : (useLongUnits ? 'minutes' : 'mins');
      return `${action} in ${hours} ${hourUnit} ${minutes} ${minuteUnit}`;
    }

    /**
     * Attach calendar dates and current-day state to schedule days.
     * @param {Array} weekSchedule - Schedule data for the week
     * @param {Date} weekStart - Monday shown in the display
     * @param {Date} today - Current day
     * @returns {Array} Display-ready day records
     */
    static createDays(weekSchedule = [], weekStart = new Date(), today = new Date()) {
      const dayOrder = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

      return dayOrder.map((day, index) => {
        const date = new Date(weekStart);
        date.setDate(weekStart.getDate() + index);

        return {
          day,
          date,
          monthDay: date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' }),
          isCurrentDay: PoolScheduleDisplay.isSameDate(date, today),
          schedule: weekSchedule.find(scheduleDay => scheduleDay.day === day) || null
        };
      });
    }

    /**
     * Render the compact list presentation retained as the default.
     * @param {Array} days - Display-ready day records
     * @param {Object} options - Formatting dependencies
     * @returns {string} Schedule HTML
     */
    static renderList(days, options) {
      const daysHtml = days.map(day => {
        const className = day.isCurrentDay ? 'day-schedule is-today' : 'day-schedule';
        const heading = PoolScheduleDisplay.renderHeading(day);
        const content = PoolScheduleDisplay.renderDayContent(day, options, false);
        return `<div class="${className}"><strong class="day-schedule__heading">${heading}:</strong></div>${content}`;
      }).join('');

      return `<div class="hours-details pool-schedule-list">${daysHtml}</div>`;
    }

    /**
     * Render the calendar presentation with independent daily columns.
     * @param {Array} days - Display-ready day records
     * @param {Object} options - Formatting dependencies
     * @returns {string} Schedule HTML
     */
    static renderCalendar(days, options) {
      const daysHtml = days.map(day => {
        const className = day.isCurrentDay ? 'schedule-calendar__day is-today' : 'schedule-calendar__day';
        const todayLabel = day.isCurrentDay ? '<span class="schedule-calendar__today">Today</span>' : '';
        const hasSwimMeet = PoolScheduleDisplay.hasSwimMeet(day.schedule);
        const swimMeetClass = hasSwimMeet ? ' has-swim-meet' : '';
        const swimMeetLabel = hasSwimMeet ? '<span class="schedule-calendar__meet">Swim League</span>' : '';
        const overrideClass = day.schedule && day.schedule.hasOverrides ? ' has-override' : '';
        const content = PoolScheduleDisplay.renderDayContent(day, options, true);

        return `<section class="${className}${swimMeetClass}${overrideClass}" aria-label="${day.day} ${day.monthDay}">`
          + `<header class="schedule-calendar__header"><strong>${day.day}</strong><span>${day.monthDay}</span>${swimMeetLabel}${todayLabel}</header>`
          + `${content}</section>`;
      }).join('');

      return `<div class="hours-details schedule-calendar" aria-label="Weekly pool calendar">${daysHtml}</div>`;
    }

    static hasSwimMeet(schedule) {
      return Boolean(schedule && Array.isArray(schedule.timeSlots)
        && schedule.timeSlots.some(slot => slot.accessStatus === 'swim-meet'));
    }

    /**
     * Render time slots or a closed state for one day.
     * @param {Object} day - Display-ready day record
     * @param {Object} options - Formatting dependencies
     * @param {boolean} useActivityColors - Whether activity tint classes should be included
     * @returns {string} Day content HTML
     */
    static renderDayContent(day, options, useActivityColors) {
      const schedule = day.schedule;
      if (!schedule || !Array.isArray(schedule.timeSlots) || schedule.timeSlots.length === 0) {
        const closedClass = useActivityColors ? ' time-slot schedule-activity schedule-activity--restricted' : ' time-slot';
        return `<div class="${closedClass.trim()}"><span class="closed-day">Closed</span></div>`;
      }

      const overrideNotice = schedule.hasOverrides && schedule.overrideReason
        ? `<div class="override-notice">${PoolScheduleDisplay.escapeHtml(schedule.overrideReason)}</div>`
        : '';
      const slots = schedule.timeSlots.map(slot => PoolScheduleDisplay.renderSlot(slot, day, options, useActivityColors)).join('');
      return `${overrideNotice}${slots}`;
    }

    /**
     * Render an individual operating period.
     * @param {Object} slot - Operating period
     * @param {Object} day - Parent day state
     * @param {Object} options - Formatting dependencies
     * @param {boolean} useActivityColors - Whether activity tint classes should be included
     * @returns {string} Time slot HTML
     */
    static renderSlot(slot, day, options, useActivityColors) {
      const timeUtils = options.timeUtils;
      const activityText = PoolScheduleDisplay.formatActivityText(slot.activities, timeUtils);
      const practiceTeamText = PoolScheduleDisplay.formatPracticeTeamText(slot.accessStatus, slot.practiceTeamNames);
      const category = PoolScheduleDisplay.getActivityCategory(slot);
      const activityClass = useActivityColors ? ` schedule-activity schedule-activity--${category}` : '';
      const overrideClass = slot.isOverride && (slot.accessStatus !== 'public' || slot.isSpecialEvent) ? ' override-slot' : '';
      const timeRange = `${slot.startTime}-${slot.endTime}`;
      const timeHtml = PoolScheduleDisplay.formatTimeRange(timeRange, {
        timeUtils,
        isCurrentDay: day.isCurrentDay,
        statusKind: options.poolStatus && options.poolStatus.kind
      });
      const safeActivityText = PoolScheduleDisplay.escapeHtml(activityText);
      const restrictedClass = category === 'restricted' ? ' closed-to-public' : '';
      const practiceTeamHtml = practiceTeamText
        ? `<span class="schedule-activity__team-names">${PoolScheduleDisplay.escapeHtml(practiceTeamText)}</span>`
        : '';
      const meetHref = PoolScheduleDisplay.getMeetHref(slot);
      const activityLabelHtml = meetHref
        ? `<a class="schedule-activity__link" href="${PoolScheduleDisplay.escapeHtml(meetHref)}">${safeActivityText}</a>`
        : safeActivityText;
      const activityHtml = safeActivityText
        ? `<span class="schedule-activity__label${restrictedClass}">${activityLabelHtml}</span>${practiceTeamHtml}`
        : '';
      const notesHtml = slot.notes
        ? `<span class="schedule-activity__note">${PoolScheduleDisplay.escapeHtml(slot.notes)}</span>`
        : '';

      return `<div class="time-slot${activityClass}${overrideClass}">${timeHtml}${activityHtml}${notesHtml}</div>`;
    }

    /**
     * @param {Array} activities - Published activity labels
     * @param {Object} timeUtils - Existing published activity formatter
     * @returns {string} Formatted activity text
     */
    static formatActivityText(activities, timeUtils) {
      return timeUtils.formatActivityTypes(activities);
    }

    static formatTimeRange(timeRange, options = {}) {
      const fallback = value => `<span class="time-range-container error">${PoolScheduleDisplay.escapeHtml(value || 'Invalid Time Range')}</span>`;
      try {
        if (typeof timeRange !== 'string') return fallback(timeRange);
        const normalizedRange = timeRange.trim();
        if (!normalizedRange) return '';
        const parts = normalizedRange.split('-');
        if (parts.length !== 2) return `<span class="time-range-container invalid">${PoolScheduleDisplay.escapeHtml(timeRange)}</span>`;
        const startTime = parts[0].trim();
        const endTime = parts[1].trim();
        const timeUtils = options.timeUtils;
        if (!timeUtils) return fallback(timeRange);
        timeUtils.timeStringToMinutes(startTime);
        timeUtils.timeStringToMinutes(endTime);

        let currentMinutes = options.currentMinutes;
        if (currentMinutes !== undefined && currentMinutes !== null && (currentMinutes < 0 || currentMinutes >= timeUtils.MINUTES_PER_DAY)) return fallback(timeRange);
        let isHighlighted = options.forceHighlight === true;
        if (!isHighlighted && options.isCurrentDay) {
          if (currentMinutes === undefined || currentMinutes === null) {
            const current = timeUtils.getCurrentEasternTimeInfo();
            if (!current.isValid) currentMinutes = null; else currentMinutes = current.minutes;
          }
          if (currentMinutes !== null) isHighlighted = timeUtils.isCurrentTimeSlot(startTime, endTime, currentMinutes, true);
        }
        const highlightClass = isHighlighted ? PoolScheduleDisplay.getTimeRangeHighlightClass(options.statusKind) : '';
        return `<span class="time-range-container${highlightClass}"><span class="time-start">${PoolScheduleDisplay.escapeHtml(startTime)}</span><span class="time-dash">-</span><span class="time-end">${PoolScheduleDisplay.escapeHtml(endTime)}</span></span>`;
      } catch (_error) {
        return fallback(timeRange);
      }
    }

    static getTimeRangeHighlightClass(statusKind) {
      const classes = {
        open: ' highlighted-time-slot-green',
        restricted: ' highlighted-time-slot-yellow',
        'practice-only': ' highlighted-time-slot-yellow',
        'special-event': ' highlighted-time-slot-yellow',
        'swim-meet': ' highlighted-time-slot-yellow',
        closed: ' highlighted-time-slot-red',
        'closed-to-public': ' highlighted-time-slot-red'
      };
      return classes[statusKind] || '';
    }

    /**
     * Return teams resolved from detailed CNSL practice schedules for a secondary label.
     * @param {string} accessStatus - Semantic public-access state for a schedule slot
     * @param {string[]} practiceTeamNames - Team names resolved from published schedule details
     * @returns {string} Formatted practicing team names
     */
    static formatPracticeTeamText(accessStatus, practiceTeamNames = []) {
      if (accessStatus !== 'practice-only') return '';
      const names = Array.isArray(practiceTeamNames) ? practiceTeamNames.filter(name => typeof name === 'string' && name.trim()) : [];
      return names.join(', ');
    }

    /**
     * Map semantic schedule state to a small set of visual categories.
     * @param {Object} slot - Time slot metadata
     * @returns {string} CSS category suffix
     */
    static getActivityCategory(slot = {}) {
      if (slot.isSpecialEvent) return 'event';
      if (slot.accessStatus === 'swim-meet') return 'event';
      if (slot.accessStatus === 'practice-only' || slot.accessStatus === 'special-event') return 'event';
      if (slot.accessStatus === 'public') return 'public';
      return 'restricted';
    }

    static getMeetHref(slot = {}) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(slot.meetDate || '')) return '';
      if (!/^[a-zA-Z0-9_-]+$/.test(slot.meetPoolId || '')) return '';
      return `meets.html?date=${encodeURIComponent(slot.meetDate)}&pool=${encodeURIComponent(slot.meetPoolId)}`;
    }

    static renderHeading(day) {
      const overrideMark = day.schedule && day.schedule.hasOverrides ? ' Special schedule' : '';
      return `${day.day} (${day.monthDay})${overrideMark}`;
    }

    static isSameDate(first, second) {
      return first.getFullYear() === second.getFullYear()
        && first.getMonth() === second.getMonth()
        && first.getDate() === second.getDate();
    }

    static escapeHtml(value) {
      return String(value).replace(/[&<>'"]/g, character => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
      }[character]));
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = PoolScheduleDisplay;
  }

  if (typeof window !== 'undefined') {
    window.PoolScheduleDisplay = PoolScheduleDisplay;
  }
}
