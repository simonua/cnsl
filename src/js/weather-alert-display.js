/**
 * Renders weather safety status in the shared page banner.
 */

if (typeof globalThis.WeatherAlertDisplay === 'undefined') {
  /** Maps normalized weather status and disclosure state to banner DOM. */
  class WeatherAlertDisplay {
    /**
     * Renders the current inclement weather status.
     * @param {Object} status - Normalized weather alert status
     * @param {boolean} isExpanded - Whether alert details should be expanded
     * @param {string} timeZone - IANA timezone used for the update time
     * @returns {boolean} Whether all required banner elements were available
     */
    static render(status, isExpanded, timeZone) {
      const banner = document.getElementById('weatherAlert');
      const message = document.getElementById('weatherAlertMessage');
      const updated = document.getElementById('weatherAlertUpdated');
      const sourceLink = document.getElementById('weatherAlertSourceLink');
      if (!banner || !message || !updated || !sourceLink) return false;

      WeatherAlertDisplay.renderMessage(message, status);
      sourceLink.hidden = status.source !== WeatherAlertSource.ALERT;
  const updatedAt = new Date(status.updatedAt);
      updated.dateTime = status.updatedAt;
      updated.textContent = new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        timeZone
      }).format(updatedAt);
      WeatherAlertDisplay.setExpanded(isExpanded);
      banner.hidden = false;
      return true;
    }

    /**
     * Applies disclosure state and accessible control labels.
     * @param {boolean} isExpanded - Whether alert details should be expanded
     * @returns {boolean} Whether the required banner elements were available
     */
    static setExpanded(isExpanded) {
      const banner = document.getElementById('weatherAlert');
      const toggle = document.getElementById('weatherAlertToggle');
      if (!banner || !toggle) return false;

      const actionLabel = `${isExpanded ? 'Collapse' : 'Expand'} weather safety alert`;
      banner.classList.toggle('weather-alert--collapsed', !isExpanded);
      toggle.hidden = false;
      toggle.setAttribute('aria-expanded', String(isExpanded));
      toggle.setAttribute('aria-label', actionLabel);
      toggle.title = actionLabel;
      return true;
    }

    /**
     * Renders a weather message with its controlled forecast hazard emphasized.
     * @param {HTMLElement} message - Weather message container
     * @param {Object} status - Normalized weather alert status
     * @returns {void}
     */
    static renderMessage(message, status) {
      const hazardLabel = status.source === WeatherAlertSource.FORECAST && typeof status.hazardLabel === 'string'
        ? status.hazardLabel
        : '';
      const hazardIndex = hazardLabel ? status.message.indexOf(hazardLabel) : -1;
      if (hazardIndex === -1) {
        message.textContent = status.message;
        return;
      }

      const hazard = document.createElement('strong');
      hazard.textContent = hazardLabel;
      message.replaceChildren(
        status.message.slice(0, hazardIndex),
        hazard,
        status.message.slice(hazardIndex + hazardLabel.length)
      );
    }
  }

  Object.freeze(WeatherAlertDisplay);
  globalThis.WeatherAlertDisplay = WeatherAlertDisplay;
}
