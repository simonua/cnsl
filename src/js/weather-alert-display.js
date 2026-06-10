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
      const guidance = WeatherAlertDisplay.createGuidance(status.guidance || '');
      const guidanceContent = status.guidance ? [' ', guidance] : [];

      if (status.source === WeatherAlertSource.ALERT && typeof status.alertLabel === 'string') {
        const alertIndex = status.message.indexOf(status.alertLabel);
        if (alertIndex !== -1) {
          const alertType = WeatherAlertDisplay.createWeatherType(status.alertLabel, 'warning');
          message.replaceChildren(
            status.message.slice(0, alertIndex),
            alertType,
            status.message.slice(alertIndex + status.alertLabel.length),
            ...guidanceContent
          );
          return;
        }
      }

      const hazardLabel = status.source === WeatherAlertSource.FORECAST && typeof status.hazardLabel === 'string'
        ? status.hazardLabel
        : '';
      const hazards = Array.isArray(status.hazards) ? status.hazards.filter(WeatherHazard.isValid) : [];
      const hazardIndex = hazardLabel ? status.message.indexOf(hazardLabel) : -1;
      if (hazardIndex === -1 || hazards.length === 0) {
        message.replaceChildren(status.message, ...guidanceContent);
        return;
      }

      const hazardList = document.createElement('span');
      hazards.forEach((hazard, index) => {
        if (index > 0) hazardList.append(index === hazards.length - 1 ? ' and ' : ', ');
        hazardList.append(WeatherAlertDisplay.createWeatherType(hazard, WeatherAlertDisplay.getHazardGlyphName(hazard)));
      });
      message.replaceChildren(
        status.message.slice(0, hazardIndex),
        hazardList,
        status.message.slice(hazardIndex + hazardLabel.length),
        ...guidanceContent
      );
    }

    /**
     * Creates guidance with the official pool status phrase linked to the CA directory.
     * @param {string} guidanceText - Visitor-facing weather guidance
     * @returns {HTMLElement} Weather guidance element
     * @private
     */
    static createGuidance(guidanceText) {
      const guidance = document.createElement('span');
      guidance.className = 'weather-alert__guidance';
      const linkText = 'official pool status';
      const linkIndex = guidanceText.indexOf(linkText);
      const directoryLink = document.getElementById('weatherAlertPoolDirectoryLink');
      if (linkIndex === -1 || !directoryLink) {
        guidance.textContent = guidanceText;
        return guidance;
      }

      const statusLink = document.createElement('a');
      statusLink.href = directoryLink.href;
      statusLink.target = directoryLink.target;
      statusLink.rel = directoryLink.rel;
      statusLink.textContent = linkText;
      guidance.append(
        guidanceText.slice(0, linkIndex),
        statusLink,
        guidanceText.slice(linkIndex + linkText.length)
      );
      return guidance;
    }

    /**
     * Creates a bold weather type with a decorative icon.
     * @param {string} label - Controlled weather type label
     * @param {string} glyphName - Project-owned glyph name
     * @returns {HTMLElement} Weather type element
     * @private
     */
    static createWeatherType(label, glyphName) {
      const weatherType = document.createElement('strong');
      weatherType.className = 'weather-alert__type';
      const icon = document.createElement('span');
      icon.className = 'weather-alert__type-icon';
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = IconCatalog.getTextGlyph(glyphName);
      weatherType.append(icon, label);
      return weatherType;
    }

    /**
     * Gets the project-owned glyph name for a forecast hazard.
     * @param {WeatherHazardValue} hazard - Semantic forecast hazard
     * @returns {string} Icon catalog glyph name
     * @private
     */
    static getHazardGlyphName(hazard) {
      const glyphNames = {
        [WeatherHazard.HAIL]: 'weatherHail',
        [WeatherHazard.LIGHTNING]: 'weatherLightning',
        [WeatherHazard.THUNDERSTORMS]: 'weatherStorm',
        [WeatherHazard.TORNADOES]: 'weatherTornado'
      };
      return glyphNames[hazard] || 'warning';
    }
  }

  Object.freeze(WeatherAlertDisplay);
  globalThis.WeatherAlertDisplay = WeatherAlertDisplay;
}
