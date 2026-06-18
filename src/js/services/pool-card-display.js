/**
 * Renders pool directory cards from display-ready state.
 */
if (typeof globalThis.PoolCardDisplay === 'undefined') {
  /** Renders display-ready pool directory card state as escaped HTML. */
  class PoolCardDisplay {
    static FEATURE_CATEGORIES = Object.freeze([
      'accessibility',
      'young-swimmers',
      'water-play',
      'recreation',
      'amenities',
      'additional'
    ]);

    static STATUS_COLORS = Object.freeze(['green', 'red', 'yellow', 'gray']);

    /**
     * Render a pool directory card.
      * @param {Object} viewModel - Display-ready pool state and trusted nested fragments
     * @returns {string} Pool card HTML
     */
    static render(viewModel) {
      const model = viewModel || {};
      const poolName = model.poolName || 'Unknown Pool';
      const safePoolName = HtmlSafety.escapeHtml(poolName);
      const safePoolId = HtmlSafety.escapeHtml(model.poolId || '');
      const safeDetailsId = HtmlSafety.escapeHtml(model.detailsId || '');
      const isFavorite = model.isFavorite === true;
      const isExpanded = model.isExpanded === true;
      const distanceHtml = PoolCardDisplay.renderDistance(model.distanceMiles);
      const transitionHtml = PoolCardDisplay.renderTransition(model.transitionText, model.transitionLabel, model.transitionAction);
      const metadataHtml = transitionHtml || distanceHtml
        ? `<span class="pool-header__metadata">${transitionHtml}${distanceHtml}</span>`
        : '';
      const statusIndicatorHtml = PoolCardDisplay.renderStatusIndicator(model.poolStatus, model.statusTooltip);
      const isDetailsHydrated = model.isDetailsHydrated !== false;
      const detailsHtml = isDetailsHydrated ? PoolCardDisplay.renderDetails(model) : '';

      return `
      <div class="pool-card ${isFavorite ? 'favorite-card' : ''}${isExpanded ? '' : ' collapsed'}" data-pool-card data-pool-id="${safePoolId}" data-pool-name="${safePoolName}" data-analytics-context="pool_details">
        <div class="pool-header" data-pool-card-header>
          <h2><button type="button" class="pool-header__toggle" data-pool-card-action="toggle" aria-expanded="${String(isExpanded)}" aria-controls="${safeDetailsId}">${statusIndicatorHtml}${safePoolName}${isFavorite ? ' <span class="favorite-marker" role="img" aria-label="Favorite pool" title="Favorite pool">&#9733;</span>' : ''}</button></h2>
          ${metadataHtml}
        </div>
        <div class="pool-details" id="${safeDetailsId}" data-pool-details-hydrated="${String(isDetailsHydrated)}"${isExpanded ? '' : ' hidden'}>
          ${detailsHtml}
        </div>
      </div>
    `;
    }

    /**
     * Render detail content separately so collapsed cards can hydrate on demand.
      * @param {Object} viewModel - Display-ready pool state and trusted nested fragments
     * @returns {string} Pool detail HTML
     */
    static renderDetails(viewModel) {
      const model = viewModel || {};
      const poolName = model.poolName || 'Unknown Pool';
      const contactHtml = PoolCardDisplay.renderContact(model.pool, poolName, model.mapsSearchBaseUrl);
      const featuresHtml = PoolCardDisplay.renderFeatures(model.featureItems);
      const hoursHtml = typeof model.hoursHtml === 'string' ? model.hoursHtml : '';
      return `${contactHtml}${hoursHtml}${featuresHtml}`;
    }

    /**
     * Render the contact section and published pool actions.
      * @param {Object} pool - Published pool record
     * @param {string} poolName - Visible pool name
     * @param {string} mapsSearchBaseUrl - Approved Google Maps search base URL
     * @returns {string} Contact HTML
     */
    static renderContact(pool, poolName, mapsSearchBaseUrl) {
      const address = PoolCardDisplay.getAddressData(pool, mapsSearchBaseUrl);
      const safeMapsUrl = HtmlSafety.safeHttpUrl(address.mapsUrl);
      const safeStreetAddress = HtmlSafety.escapeHtml(address.streetAddress);
      const safeCityStateZip = HtmlSafety.escapeHtml(address.cityStateZip);
      const actionsHtml = PoolCardDisplay.renderActions(pool, poolName);
      const addressText = `${safeStreetAddress ? `${safeStreetAddress}${safeCityStateZip ? '<br>' : ''}` : ''}${safeCityStateZip || (safeStreetAddress ? '' : 'Address not available')}`;

      return `
          <div class="pool-contact">
            <div class="address-section">
              <div class="address-section__details">
                <strong>${IconCatalog.render('map-pin')} Address:</strong><br>
                <a href="${safeMapsUrl}"
                   target="_blank"
                   rel="noopener"
                   class="address-link">
                  ${addressText}
                </a>
              </div>
              ${actionsHtml ? `<div class="address-section__actions">${actionsHtml}</div>` : ''}
            </div>
          </div>`;
    }

    /**
     * Normalize supported location shapes into one address presentation record.
      * @param {Object} pool - Published pool record
     * @param {string} mapsSearchBaseUrl - Approved Google Maps search base URL
     * @returns {{streetAddress: string, cityStateZip: string, mapsUrl: string}} Normalized address data
     */
    static getAddressData(pool, mapsSearchBaseUrl) {
      const safePool = pool && typeof pool === 'object' ? pool : {};
      const baseUrl = typeof mapsSearchBaseUrl === 'string' ? mapsSearchBaseUrl : '';
      const location = safePool.location && typeof safePool.location === 'object' ? safePool.location : null;

      if (location) {
        const streetAddress = String(location.street || '');
        const city = String(location.city || '');
        const state = String(location.state || '');
        const zip = String(location.zip || '');
        const cityStateZip = `${city}, ${state} ${zip}`.trim();
        const mapsUrl = location.googleMapsUrl || `${baseUrl}${encodeURIComponent(location.mapsQuery || '')}`;
        return { streetAddress, cityStateZip, mapsUrl };
      }

      const fullAddress = String(safePool.address || '');
      const addressParts = fullAddress.split(',').map(part => part.trim());
      const streetAddress = addressParts.length >= 2 ? addressParts[0] : fullAddress;
      const cityStateZip = addressParts.length >= 2 ? addressParts.slice(1).join(', ') : '';
      const locationQuery = encodeURIComponent(safePool.mapsQuery || fullAddress || '');
      const mapsUrl = `${baseUrl}${locationQuery}`;
      return { streetAddress, cityStateZip, mapsUrl };
    }

    /**
     * Render public contact actions for a pool.
      * @param {Object} pool - Published pool record
     * @param {string} poolName - Visible pool name
     * @returns {string} Actions HTML
     */
    static renderActions(pool, poolName) {
      const safePool = pool && typeof pool === 'object' ? pool : {};
      const safePoolName = HtmlSafety.escapeHtml(poolName || 'pool');
      const caUrl = HtmlSafety.safeHttpUrl(safePool.caUrl);
      const scheduleUrl = HtmlSafety.safeHttpUrl(safePool.scheduleUrl);
      const phoneUrl = HtmlSafety.safeTelephoneUrl(safePool.phone);
      const directionsHtml = globalThis.generatePoolDirectionsLink(safePool, poolName);
      const caLinkHtml = caUrl
        ? `<div class="ca-website-section">
          <a href="${caUrl}"
             target="_blank"
             rel="noopener"
             class="ca-link"
             data-analytics-link-purpose="${globalThis.AnalyticsExternalLinkPurpose.POOL_PAGE}">
            Visit CA Pool Page
          </a>
        </div>`
        : '';
      const scheduleLinkHtml = scheduleUrl
        ? `<div class="ca-website-section">
          <a href="${scheduleUrl}"
             target="_blank"
             rel="noopener"
             class="ca-link"
             data-analytics-link-purpose="${globalThis.AnalyticsExternalLinkPurpose.POOL_SCHEDULE}">
            CA Pool Schedule
          </a>
        </div>`
        : '';
      const phoneHtml = phoneUrl
        ? `<div class="address-section__phone">
          <a href="${phoneUrl}" class="phone-link" aria-label="Call ${safePoolName} pool desk at ${HtmlSafety.escapeHtml(safePool.phone)}">
            ${IconCatalog.render('phone')}${HtmlSafety.escapeHtml(safePool.phone)}
          </a>
        </div>`
        : '';
      const secondaryActionsHtml = `${phoneHtml}${caLinkHtml}${scheduleLinkHtml}`;
      return `${directionsHtml ? `<div class="address-section__directions">${directionsHtml}</div>` : ''}${secondaryActionsHtml ? `<div class="address-section__secondary-actions">${secondaryActionsHtml}</div>` : ''}`;
    }

    /**
     * Render sorted feature pills or the retained TBD fallback.
      * @param {Array} featureItems - Sorted display feature records
     * @returns {string} Features HTML
     */
    static renderFeatures(featureItems) {
      const items = Array.isArray(featureItems) ? featureItems : [];
      if (items.length === 0) {
        return `
        <div class="pool-features">
          <h3>Features</h3>
          <span class="status-tbd">TBD</span>
        </div>`;
      }

      const pills = items.map(item => {
        const category = PoolCardDisplay.getFeatureCategory(item && item.category);
        const label = HtmlSafety.escapeHtml(item && item.label);
        return item && item.href === 'lessons.html'
          ? `<a class="feature-pill feature-pill--${category} feature-pill--link" href="lessons.html">${label}<svg class="feature-pill__link-icon icon" aria-hidden="true" focusable="false"><use href="#icon-link"></use></svg></a>`
          : `<span class="feature-pill feature-pill--${category}">${label}</span>`;
      }).join('');
      return `
        <div class="pool-features">
          <h3>Features</h3>
          <div class="feature-pills">
            ${pills}
          </div>
        </div>`;
    }

    /**
     * Render the decorative live-status indicator and its text equivalent.
      * @param {Object} poolStatus - Current pool status
     * @param {string} statusTooltip - Accessible status explanation
     * @returns {string} Status indicator HTML
     */
    static renderStatusIndicator(poolStatus, statusTooltip) {
      const color = PoolCardDisplay.getStatusColor(poolStatus && poolStatus.color);
      const safeTooltip = HtmlSafety.escapeHtml(statusTooltip || 'Status unknown');
      return `<span class="pool-status-indicator ${color} status-tooltip" aria-hidden="true">
      <span class="tooltip-text">${safeTooltip}</span>
    </span><span class="visually-hidden">${safeTooltip}: </span>`;
    }

    /**
     * Render a formatted distance badge.
     * @param {number} distanceMiles - Distance in miles
     * @returns {string} Distance badge HTML
     */
    static renderDistance(distanceMiles) {
      if (!Number.isFinite(distanceMiles)) return '';
      const formattedDistance = distanceMiles.toFixed(1);
      return `<span class="distance-badge" aria-label="${formattedDistance} miles away">${formattedDistance} mi</span>`;
    }

    /**
     * Render a pool availability transition summary.
     * @param {string} transitionText - Visible transition text
     * @param {string} transitionLabel - Accessible transition label
     * @param {string} transitionAction - Semantic transition action
     * @returns {string} Transition HTML
     */
    static renderTransition(transitionText, transitionLabel, transitionAction) {
      if (typeof transitionText !== 'string' || transitionText.length === 0) return '';
      const safeText = HtmlSafety.escapeHtml(transitionText);
      const safeLabel = HtmlSafety.escapeHtml(transitionLabel || transitionText);
      const actionClass = PoolTransitionAction.isValid(transitionAction)
        ? ` pool-transition-summary--${transitionAction}`
        : '';
      return `<span class="pool-transition-summary${actionClass}" aria-label="${safeLabel}">${safeText}</span>`;
    }

    /**
     * Validate a feature category.
     * @param {string} category - Candidate feature category
     * @returns {string} Supported category
     */
    static getFeatureCategory(category) {
      return PoolCardDisplay.FEATURE_CATEGORIES.includes(category) ? category : 'additional';
    }

    /**
     * Validate a status color.
     * @param {string} color - Candidate status color
     * @returns {string} Supported status color
     */
    static getStatusColor(color) {
      return PoolCardDisplay.STATUS_COLORS.includes(color) ? color : 'gray';
    }
  }

  globalThis.PoolCardDisplay = PoolCardDisplay;
}
