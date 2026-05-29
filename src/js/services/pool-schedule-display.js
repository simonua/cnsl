/**
 * Formats weekly pool schedules for list and calendar presentations.
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

    static formatStatusCountdown(action, minutesUntilChange, useLongUnits = false) {
      if (!Number.isInteger(minutesUntilChange) || minutesUntilChange <= 0) return '';

      if (minutesUntilChange < 60) {
        const unit = useLongUnits ? (minutesUntilChange === 1 ? 'minute' : 'minutes') : 'min';
        return `${action} in ${minutesUntilChange} ${unit}`;
      }

      const hours = Math.floor(minutesUntilChange / 60);
      const minutes = minutesUntilChange % 60;
      const hourUnit = useLongUnits ? (hours === 1 ? 'hour' : 'hours') : 'hr';
      const minuteUnit = useLongUnits ? (minutes === 1 ? 'minute' : 'minutes') : 'min';
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
        const overrideClass = day.schedule && day.schedule.hasOverrides ? ' has-override' : '';
        const content = PoolScheduleDisplay.renderDayContent(day, options, true);

        return `<section class="${className}${overrideClass}" aria-label="${day.day} ${day.monthDay}">`
          + `<header class="schedule-calendar__header"><strong>${day.day}</strong><span>${day.monthDay}</span>${todayLabel}</header>`
          + `${content}</section>`;
      }).join('');

      return `<div class="hours-details schedule-calendar" aria-label="Weekly pool calendar">${daysHtml}</div>`;
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
        ? `<div class="override-notice">Special Schedule: ${PoolScheduleDisplay.escapeHtml(schedule.overrideReason)}</div>`
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
      const practiceTeamText = PoolScheduleDisplay.formatPracticeTeamText(slot.activities, slot.practiceTeamNames);
      const category = PoolScheduleDisplay.getActivityCategory(activityText, slot);
      const activityClass = useActivityColors ? ` schedule-activity schedule-activity--${category}` : '';
      const overrideClass = slot.isOverride ? ' override-slot' : '';
      const timeRange = `${slot.startTime}-${slot.endTime}`;
      const timeHtml = timeUtils.formatTimeRangeWithHighlight(timeRange, day.isCurrentDay, null, options.poolStatus);
      const safeActivityText = PoolScheduleDisplay.escapeHtml(activityText);
      const restrictedClass = category === 'restricted' ? ' closed-to-public' : '';
      const practiceTeamHtml = practiceTeamText
        ? `<span class="schedule-activity__team-names">${PoolScheduleDisplay.escapeHtml(practiceTeamText)}</span>`
        : '';
      const activityHtml = safeActivityText
        ? `<span class="schedule-activity__label${restrictedClass}">${safeActivityText}</span>${practiceTeamHtml}`
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

    /**
     * Return teams resolved from detailed CNSL practice schedules for a secondary label.
     * @param {Array} activities - Published activity labels
     * @param {string[]} practiceTeamNames - Team names resolved from published schedule details
     * @returns {string} Formatted practicing team names
     */
    static formatPracticeTeamText(activities, practiceTeamNames = []) {
      if (!Array.isArray(activities) || !activities.includes('CNSL Practice Only')) return '';
      const names = Array.isArray(practiceTeamNames) ? practiceTeamNames.filter(name => typeof name === 'string' && name.trim()) : [];
      return names.join(', ');
    }

    /**
     * Map published activity labels to a small set of visual categories.
     * @param {string} activityText - Activity label text
     * @param {Object} slot - Time slot metadata
     * @returns {string} CSS category suffix
     */
    static getActivityCategory(activityText, slot = {}) {
      const normalized = activityText.toLowerCase();
      if (slot.isOverride || /meet|party|event|competition/.test(normalized)) return 'event';
      if (/closed|restricted|maintenance/.test(normalized)) return 'restricted';
      if (/practice|team/.test(normalized)) return 'team';
      if (/fitness|lesson|class|program/.test(normalized)) return 'program';
      return 'public';
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
