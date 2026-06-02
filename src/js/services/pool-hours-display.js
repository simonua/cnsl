/**
 * Renders the pool-hours presentation from a display-ready view model.
 */
if (typeof window === 'undefined') {
  if (typeof HtmlSafety === 'undefined') { var HtmlSafety = require('./html-safety.js'); } // eslint-disable-line no-var
  if (typeof IconCatalog === 'undefined') { var IconCatalog = require('./icon-catalog.js'); } // eslint-disable-line no-var
  if (typeof PoolScheduleDisplay === 'undefined') { var PoolScheduleDisplay = require('./pool-schedule-display.js'); } // eslint-disable-line no-var
}

if (typeof window === 'undefined' || !window.PoolHoursDisplay) {
  class PoolHoursDisplay {
    /**
     * Render a simple hours-state message.
     * @param {string} message - User-facing message
     * @returns {string} Message HTML
     */
    static renderAvailabilityMessage(message) {
      return `<div class="pool-hours"><strong>${IconCatalog.render('clock')} Hours:</strong> ${HtmlSafety.escapeHtml(message)}</div>`;
    }

    /**
     * Render the schedule-missing state retained by the pool directory.
     * @returns {string} Schedule-missing HTML
     */
    static renderScheduleMissing() {
      return `<div class="pool-hours">
      <strong>${IconCatalog.render('clock')} Hours:</strong>
      <span class="status-gray status-tooltip">
        Schedule TBD
        <span class="tooltip-text">Schedule not available</span>
      </span>
    </div>`;
    }

    /**
     * Render a non-schedule error state.
     * @param {string} message - User-facing message
     * @returns {string} Message HTML
     */
    static renderTimeUtilityMessage(message) {
      return `<div class="pool-week-display">${HtmlSafety.escapeHtml(message)}</div>`;
    }

    /**
     * Render the full pool-hours panel.
     * @param {Object} viewModel - Display-ready pool hours state and schedule options
     * @returns {string} Pool hours HTML
     */
    static render(viewModel) {
      const model = viewModel || {};
      const poolStatus = model.poolStatus || {};
      const safePoolId = HtmlSafety.escapeHtml(model.poolId || '');
      const safePoolName = HtmlSafety.escapeHtml(model.poolName || 'this pool');
      const safeWeekPickerId = HtmlSafety.escapeHtml(model.weekPickerId || '');
      const safeWeekStartText = HtmlSafety.escapeHtml(model.weekStartText || '');
      const safeWeekEndText = HtmlSafety.escapeHtml(model.weekEndText || '');
      const statusClass = ['green', 'red', 'yellow', 'gray'].includes(poolStatus.color) ? poolStatus.color : 'gray';
      const safeStatusIcon = HtmlSafety.escapeHtml(IconCatalog.getPoolStatusGlyph(poolStatus.kind));
      const safeStatusText = HtmlSafety.escapeHtml(poolStatus.status || '');
      const safeStatusTooltip = HtmlSafety.escapeHtml(model.statusTooltip || 'Status unknown');
      const statusTransition = model.statusTransition;
      const statusCountdown = PoolScheduleDisplay.formatPublicStatusTransition(statusTransition);
      const statusCountdownLabel = PoolScheduleDisplay.formatPublicStatusTransition(statusTransition, { useLongUnits: true });
      const statusCountdownClass = PoolScheduleDisplay.getPublicStatusTransitionClass(statusTransition);
      const statusCountdownHtml = statusCountdown
        ? `<span class="${statusCountdownClass}" aria-label="${HtmlSafety.escapeHtml(statusCountdownLabel)}">${HtmlSafety.escapeHtml(statusCountdown)}</span>`
        : '';
      const scheduleHtml = PoolScheduleDisplay.render(model.weekSchedule || [], model.scheduleOptions || {});
      const dateRangeAttributes = model.hasDateRange
        ? `min="${HtmlSafety.escapeHtml(model.minDateInputValue || '')}" max="${HtmlSafety.escapeHtml(model.maxDateInputValue || '')}"`
        : '';

      return `
    <div class="pool-hours">
      <strong>${IconCatalog.render('clock')} Hours:</strong> 
      <span class="open-status status-${statusClass} status-tooltip">
        ${safeStatusIcon} ${safeStatusText}
        <span class="tooltip-text">${safeStatusTooltip}</span>
      </span>${statusCountdownHtml}<br>
      <div class="pool-week-navigation" data-pool-id="${safePoolId}">
        <div class="week-controls-row">
          <div class="week-display">
            <span class="week-text">Week of ${safeWeekStartText} - ${safeWeekEndText}</span>
          </div>
          <div class="nav-buttons">
            <button class="nav-btn calendar-btn" data-pool-id="${safePoolId}" aria-label="Choose a week for ${safePoolName}" aria-controls="${safeWeekPickerId}" aria-expanded="false" ${!model.hasDateRange ? 'disabled' : ''}>
              ${IconCatalog.render('calendar')}
            </button>
            <button class="nav-btn today-btn" data-pool-id="${safePoolId}" ${model.isTodayDisabled ? 'disabled' : ''}>
              Today
            </button>
            <button class="nav-btn prev-week" ${model.isPreviousWeekDisabled ? 'disabled' : ''}>
              ◀ Prev
            </button>
            <button class="nav-btn next-week" ${model.isNextWeekDisabled ? 'disabled' : ''}>
              Next ▶
            </button>
          </div>
        </div>
        <input type="date" class="week-picker" id="${safeWeekPickerId}" aria-label="Week to display for ${safePoolName}" hidden
               value="${HtmlSafety.escapeHtml(model.weekStartInputValue || '')}"
               ${dateRangeAttributes}>
      </div>
      ${scheduleHtml}
    </div>
  `;
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = PoolHoursDisplay;
  }
  if (typeof window !== 'undefined') {
    window.PoolHoursDisplay = PoolHoursDisplay;
  }
}
