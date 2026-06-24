/**
 * Formats weekly pool schedules for list and calendar presentations.
 * Consumes display-ready schedule state and emits escaped markup without owning pool business rules.
 */

if (typeof globalThis.PoolScheduleDisplay === 'undefined') {
  /** Formats display-ready weekly pool schedules as escaped HTML. */
  class PoolScheduleDisplay {
    static DAY_NAMES = Object.freeze({
      Mon: 'Monday',
      Tue: 'Tuesday',
      Wed: 'Wednesday',
      Thu: 'Thursday',
      Fri: 'Friday',
      Sat: 'Saturday',
      Sun: 'Sunday'
    });

    static LAYOUTS = ['list', 'calendar'];

    static SOURCE_NAME_ABBREVIATIONS = Object.freeze({
      'Columbia Association': 'CA',
      'Columbia Neighborhood Swim League': 'CNSL'
    });

    /**
     * Render a weekly schedule in the requested presentation.
     * @param {Array} weekSchedule - Normalized days with time slots
     * @param {Object} options - Render date, layout, status, and formatting dependencies
     * @returns {string} Schedule HTML
     */
    static render(weekSchedule, options = {}) {
      const layout = PoolScheduleDisplay.LAYOUTS.includes(options.layout) ? options.layout : 'list';
      const days = PoolScheduleDisplay.createDays(weekSchedule, options.weekStart, options.today);
      const sourceUpdateFootnotes = PoolScheduleDisplay.getSourceUpdateFootnotes(days);

      if (layout === 'calendar') {
        return PoolScheduleDisplay.renderCalendar(days, options, sourceUpdateFootnotes);
      }

      return PoolScheduleDisplay.renderList(days, options, sourceUpdateFootnotes);
    }

    /**
     * Attach calendar dates and current-day state to schedule days.
     * @param {Array} weekSchedule - Schedule data for the week
     * @param {Date} weekStart - Monday shown in the display
     * @param {Date} today - Current day
     * @returns {Array} Display-ready day records
     */
    static createDays(weekSchedule = [], weekStart = new Date(), today = new Date()) {
      const dayOrder = Object.keys(PoolScheduleDisplay.DAY_NAMES);

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
     * @param {Array} sourceUpdateFootnotes - Week-level source-update notes
     * @returns {string} Schedule HTML
     */
    static renderList(days, options, sourceUpdateFootnotes = []) {
      const daysHtml = days.map(day => {
        const className = day.isCurrentDay ? 'day-schedule is-today' : 'day-schedule';
        const heading = PoolScheduleDisplay.renderHeading(day);
        const content = PoolScheduleDisplay.renderDayContent(day, options, false, sourceUpdateFootnotes);
        return `<div class="${className}"><strong class="day-schedule__heading">${heading}:</strong></div>${content}`;
      }).join('');

      return `<div class="hours-details pool-schedule-list">${daysHtml}</div>${PoolScheduleDisplay.renderSourceUpdates(sourceUpdateFootnotes)}`;
    }

    /**
     * Render the calendar presentation with independent daily columns.
     * @param {Array} days - Display-ready day records
     * @param {Object} options - Formatting dependencies
    * @param {Array} sourceUpdateFootnotes - Week-level source-update notes
     * @returns {string} Schedule HTML
     */
      static renderCalendar(days, options, sourceUpdateFootnotes = []) {
      const daysHtml = days.map(day => {
        const className = day.isCurrentDay ? 'schedule-calendar__day is-today' : 'schedule-calendar__day';
        const todayLabel = day.isCurrentDay ? '<span class="schedule-calendar__today">Today</span>' : '';
        const hasSwimMeet = PoolScheduleDisplay.hasSwimMeet(day.schedule);
        const swimMeetClass = hasSwimMeet ? ' has-swim-meet' : '';
        const swimMeetLabel = hasSwimMeet ? '<span class="schedule-calendar__meet">Swim League</span>' : '';
        const overrideClass = day.schedule && day.schedule.hasOverrides ? ' has-override' : '';
        const content = PoolScheduleDisplay.renderDayContent(day, options, true, sourceUpdateFootnotes);

        return `<section class="${className}${swimMeetClass}${overrideClass}" aria-label="${day.day} ${day.monthDay}">`
          + `<header class="schedule-calendar__header"><strong>${day.day}</strong><span>${day.monthDay}</span>${swimMeetLabel}${todayLabel}</header>`
          + `${content}</section>`;
      }).join('');

      return `<div class="hours-details schedule-calendar" aria-label="Weekly pool calendar">${daysHtml}</div>${PoolScheduleDisplay.renderSourceUpdates(sourceUpdateFootnotes)}`;
    }

    /**
     * Check whether a daily schedule contains a swim meet.
     * @param {Object|null} schedule - Daily schedule
     * @returns {boolean} Whether it contains a meet
     */
    static hasSwimMeet(schedule) {
      return Boolean(schedule && Array.isArray(schedule.timeSlots)
        && schedule.timeSlots.some(slot => slot.accessStatus === 'swim-meet'));
    }

    /**
     * Render time slots or a closed state for one day.
     * @param {Object} day - Display-ready day record
     * @param {Object} options - Formatting dependencies
     * @param {boolean} useActivityColors - Whether activity tint classes should be included
    * @param {Array} sourceUpdateFootnotes - Week-level source-update notes
     * @returns {string} Day content HTML
     */
      static renderDayContent(day, options, useActivityColors, sourceUpdateFootnotes = []) {
      const schedule = day.schedule;
      if (!schedule || !Array.isArray(schedule.timeSlots) || schedule.timeSlots.length === 0) {
        const closedClass = useActivityColors ? ' time-slot schedule-activity schedule-activity--restricted' : ' time-slot';
        return `<div class="${closedClass.trim()}"><span class="closed-day">Closed</span></div>`;
      }

      const overrideNotice = schedule.hasOverrides && schedule.overrideReason
        ? `<div class="override-notice">${PoolScheduleDisplay.escapeHtml(schedule.overrideReason)}</div>`
        : '';
      const slots = schedule.timeSlots.map(slot => {
        const sourceUpdateHtml = PoolScheduleDisplay.formatSourceUpdateHtml(slot.sourceUpdate);
        const sourceUpdateFootnoteNumber = sourceUpdateHtml
          ? sourceUpdateFootnotes.findIndex(footnote => footnote.html === sourceUpdateHtml) + 1
          : 0;
        return PoolScheduleDisplay.renderSlot(slot, day, options, useActivityColors, sourceUpdateFootnoteNumber);
      }).join('');
      return `${overrideNotice}${slots}`;
    }

    /**
     * Collect distinct validated source updates and their affected weekdays in display order.
     * @param {Array} days - Display-ready week records
     * @returns {Array<Object>} Escaped footnote contents and applicable weekday names
     */
    static getSourceUpdateFootnotes(days) {
      const footnotesByHtml = new Map();

      for (const day of Array.isArray(days) ? days : []) {
        const slots = day.schedule && Array.isArray(day.schedule.timeSlots)
          ? day.schedule.timeSlots
          : [];
        for (const slot of slots) {
          const html = PoolScheduleDisplay.formatSourceUpdateHtml(slot.sourceUpdate);
          if (!html) continue;

          const footnote = footnotesByHtml.get(html) || { dayNames: [], html };
          const dayName = PoolScheduleDisplay.DAY_NAMES[day.day];
          if (dayName && !footnote.dayNames.includes(dayName)) footnote.dayNames.push(dayName);
          footnotesByHtml.set(html, footnote);
        }
      }

      return [...footnotesByHtml.values()];
    }

    /**
     * Render each distinct accepted source update once as a schedule footnote.
     * @param {Array} footnotes - Week-level source-update notes
     * @returns {string} Escaped source-update markup
     */
    static renderSourceUpdates(footnotes) {
      const validFootnotes = Array.isArray(footnotes) ? footnotes : [];
      if (validFootnotes.length === 0) return '';

      const footnotesHtml = validFootnotes
        .map(footnote => {
          const dayNames = new Intl.ListFormat('en-US', { style: 'long', type: 'conjunction' }).format(footnote.dayNames);
          return `<li class="schedule-activity__source-update"><strong>${dayNames}:</strong> ${footnote.html}</li>`;
        })
        .join('');
      return `<ol class="schedule-activity__footnotes" aria-label="Schedule notes">${footnotesHtml}</ol>`;
    }

    /**
     * Format validated source-update metadata as muted visitor context.
     * @param {Object|null} sourceUpdate - Candidate source-update metadata
     * @returns {string} Escaped source-update markup, or an empty string when invalid
     */
    static formatSourceUpdateHtml(sourceUpdate) {
      if (!sourceUpdate
        || typeof sourceUpdate.sourceName !== 'string'
        || typeof sourceUpdate.note !== 'string'
        || !sourceUpdate.sourceName.trim()
        || !sourceUpdate.note.trim()) return '';

      const dateMatch = typeof sourceUpdate.updatedOn === 'string'
        ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(sourceUpdate.updatedOn)
        : null;
      if (!dateMatch) return '';

      const year = Number(dateMatch[1]);
      const monthIndex = Number(dateMatch[2]) - 1;
      const day = Number(dateMatch[3]);
      const updateDate = new Date(Date.UTC(year, monthIndex, day));
      if (updateDate.getUTCFullYear() !== year
        || updateDate.getUTCMonth() !== monthIndex
        || updateDate.getUTCDate() !== day) return '';

      const formattedDate = updateDate.toLocaleDateString('en-US', {
        day: 'numeric',
        month: 'short',
        timeZone: 'UTC',
        year: 'numeric'
      });
      const sourceName = sourceUpdate.sourceName.trim();
      const displaySourceName = Object.hasOwn(PoolScheduleDisplay.SOURCE_NAME_ABBREVIATIONS, sourceName)
        ? PoolScheduleDisplay.SOURCE_NAME_ABBREVIATIONS[sourceName]
        : sourceName;
      return `${PoolScheduleDisplay.escapeHtml(sourceUpdate.note.trim())} ${PoolScheduleDisplay.escapeHtml(displaySourceName)} data updated ${PoolScheduleDisplay.escapeHtml(formattedDate)}.`;
    }

    /**
     * Render an individual operating period.
     * @param {Object} slot - Operating period
     * @param {Object} day - Parent day state
     * @param {Object} options - Formatting dependencies
     * @param {boolean} useActivityColors - Whether activity tint classes should be included
    * @param {number} sourceUpdateFootnoteNumber - One-based source-update footnote number, or zero
     * @returns {string} Time slot HTML
     */
      static renderSlot(slot, day, options, useActivityColors, sourceUpdateFootnoteNumber = 0) {
      const timeUtils = options.timeUtils;
      const activityText = PoolScheduleDisplay.formatActivityText(slot.activities, timeUtils);
      const practiceTeamHtml = PoolScheduleDisplay.formatPracticeTeamHtml(
        slot.accessStatus,
        slot.practiceTeamNames,
        slot.favoritePracticeTeamNames
      );
      const category = PoolScheduleDisplay.getActivityCategory(slot);
      const activityClass = useActivityColors ? ` schedule-activity schedule-activity--${category}` : '';
      const overrideClass = slot.isOverride && (slot.accessStatus !== 'public' || slot.isSpecialEvent) ? ' override-slot' : '';
      const hasTimeRange = typeof slot.startTime === 'string' && typeof slot.endTime === 'string';
      const timeHtml = hasTimeRange
        ? PoolScheduleDisplay.formatTimeRange(`${slot.startTime}-${slot.endTime}`, {
          timeUtils,
          isCurrentDay: day.isCurrentDay,
          statusKind: options.poolStatus && options.poolStatus.kind
        })
        : '';
      const safeActivityText = PoolScheduleDisplay.escapeHtml(activityText);
      const restrictedClass = category === 'restricted' ? ' closed-to-public' : '';
      const meetHref = PoolScheduleDisplay.getMeetHref(slot);
      const sourceHref = globalThis.HtmlSafety.safeHttpUrl(slot.sourceUrl);
      let activityLabelHtml = safeActivityText;
      if (meetHref) {
        activityLabelHtml = `<a class="schedule-activity__link" href="${PoolScheduleDisplay.escapeHtml(meetHref)}">${safeActivityText}</a>`;
      } else if (sourceHref) {
        const safeAccessibleLabel = PoolScheduleDisplay.escapeHtml(`${activityText} official details (opens in new tab)`);
        activityLabelHtml = `<a class="schedule-activity__link schedule-activity__source-link" href="${sourceHref}" target="_blank" rel="noopener" aria-label="${safeAccessibleLabel}" data-analytics-context="official_information">${safeActivityText}</a>`;
      }
      const sourceUpdateMarkerHtml = sourceUpdateFootnoteNumber > 0
        ? `<sup class="schedule-activity__footnote-marker"><span aria-hidden="true">${sourceUpdateFootnoteNumber}</span><span class="visually-hidden"> (schedule note ${sourceUpdateFootnoteNumber})</span></sup>`
        : '';
      const activityHtml = safeActivityText
        ? `<span class="schedule-activity__label${restrictedClass}">${activityLabelHtml}${sourceUpdateMarkerHtml}</span>${practiceTeamHtml}`
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
     * Format and optionally highlight a schedule time range.
     * @param {string} timeRange - Start and end time separated by a hyphen
     * @param {Object} options - Time and highlighting dependencies
     * @returns {string} Time-range HTML
     */
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

    /**
     * Map status to its active-time highlight class.
     * @param {string} statusKind - Semantic pool status
     * @returns {string} Highlight CSS class
     */
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
     * Render resolved practice-team names and mark the selected favorite.
     * @param {string} accessStatus - Semantic public-access state for a schedule slot
     * @param {string[]} practiceTeamNames - Team names resolved from published schedule details
     * @param {string[]} favoritePracticeTeamNames - Resolved names that match the favorite team
     * @returns {string} Escaped practice-team markup
     */
    static formatPracticeTeamHtml(accessStatus, practiceTeamNames = [], favoritePracticeTeamNames = []) {
      if (accessStatus !== 'practice-only') return '';
      const names = Array.isArray(practiceTeamNames)
        ? practiceTeamNames.filter(name => typeof name === 'string' && name.trim())
        : [];
      if (names.length === 0) return '';

      const favoriteNames = new Set(Array.isArray(favoritePracticeTeamNames) ? favoritePracticeTeamNames : []);
      const items = names.map(name => {
        const marker = favoriteNames.has(name)
          ? '<span class="favorite-marker" role="img" aria-label="Favorite team" title="Favorite team">&#9733;</span>'
          : '';
        return `<span class="schedule-activity__team-name">${PoolScheduleDisplay.escapeHtml(name)}${marker}</span>`;
      });
      return `<span class="schedule-activity__team-names">${items.join(', ')}</span>`;
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

    /**
     * Build a meet details URL from validated slot metadata.
     * @param {Object} slot - Schedule slot
     * @returns {string} Validated meet details URL
     */
    static getMeetHref(slot = {}) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(slot.meetDate || '')) return '';
      if (!/^[a-zA-Z0-9_-]+$/.test(slot.meetPoolId || '')) return '';
      return `meets.html?date=${encodeURIComponent(slot.meetDate)}&pool=${encodeURIComponent(slot.meetPoolId)}`;
    }

    /**
     * Format a schedule day heading.
     * @param {Object} day - Display-ready day
     * @returns {string} Day heading text
     */
    static renderHeading(day) {
      const overrideMark = day.schedule && day.schedule.hasOverrides ? ' Special schedule' : '';
      return `${day.day} (${day.monthDay})${overrideMark}`;
    }

    /**
     * Check whether two dates share a local calendar day.
     * @param {Date} first - First date
     * @param {Date} second - Second date
     * @returns {boolean} Whether dates share a calendar day
     */
    static isSameDate(first, second) {
      return first.getFullYear() === second.getFullYear()
        && first.getMonth() === second.getMonth()
        && first.getDate() === second.getDate();
    }

    /**
     * Escape text for generated schedule markup.
     * @param {*} value - Value to escape
     * @returns {string} HTML-escaped text
     * @private
     */
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

  globalThis.PoolScheduleDisplay = PoolScheduleDisplay;
}
