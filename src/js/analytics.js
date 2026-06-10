// Publishes privacy-reviewed analytics events and exposes a minimal tracking API.
// Event validation, page measurement, and DOM instrumentation remain closure-private.

(function initializeAnalytics() {
  'use strict';

  // Configuration and allowlists

  const PUBLISHED_CAMPAIGNS = Object.freeze([
    Object.freeze({ medium: 'qr', name: '2026_pool_season', source: 'app' }),
    Object.freeze({ medium: 'qr', name: '2026_pool_season', source: 'flyer' })
  ]);

  const BANNER_NAMES = Object.freeze({
    RELEASE_NOTICE: 'release_notice',
    SETTINGS_NOTICE: 'settings_notice'
  });
  const ALLOWED_BANNER_NAMES = new Set(Object.values(BANNER_NAMES));
  const ALLOWED_BANNER_ACTIONS = new Set(['dismiss', 'open', 'view']);

  const EXTERNAL_LINK_PURPOSES = Object.freeze({
    GENERAL: 'general',
    MERCHANDISE: 'merchandise',
    PROVIDER_CONTACT: 'provider_contact',
    PROVIDER_RECOMMENDATION: 'provider_recommendation',
    PROVIDER_WEBSITE: 'provider_website',
    RELATED_PROGRAM: 'related_program'
  });
  const ALLOWED_EXTERNAL_LINK_PURPOSES = new Set(Object.values(EXTERNAL_LINK_PURPOSES));
  const ALLOWED_EXTERNAL_LINK_CONTEXTS = new Set([
    'feedback', 'lesson_resources', 'meet_details', 'official_information', 'other', 'pool_details',
    'project_information', 'share', 'team_details', 'weather_status'
  ]);
  const ALLOWED_EXTERNAL_LINK_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'sms:', 'tel:']);

  const ALLOWED_DIRECTORY_NAMES = new Set(['meets', 'pools', 'teams']);
  const ALLOWED_INSTALL_ACTIONS = new Set([
    'installed', 'instructions_open', 'prompt_accepted', 'prompt_dismissed', 'prompt_open'
  ]);

  const RESOURCE_EVENT_NAMES = Object.freeze({
    download: 'ca_resource_download',
    view: 'ca_resource_view'
  });
  const ALLOWED_RESOURCE_NAMES = new Set([
    'judge', 'line_up_aid', 'timer', 'timesheet_runner', 'web_app_flyer'
  ]);

  const ALLOWED_SHARE_METHODS = new Set(['email', 'facebook', 'qr_code', 'text', 'x']);

  const FIXED_SETTING_VALUES = Object.freeze({
    contrast: new Set(['high', 'system']),
    favorite_pool_expanded: new Set(['collapsed', 'expanded']),
    favorite_team_expanded: new Set(['collapsed', 'expanded']),
    location_awareness: new Set(['disabled', 'enabled']),
    motion: new Set(['reduced', 'system']),
    pool_schedule_layout: new Set(['calendar', 'list']),
    practice_groups: new Set(['changed']),
    text_size: new Set(['default', 'extra-large', 'large']),
    theme: new Set(['dark', 'light', 'system']),
    underline_links: new Set(['disabled', 'enabled']),
    weather_refresh_minutes: new Set(['0', '5', '10'])
  });
  const ALLOWED_PUBLISHED_SETTING_NAMES = new Set([
    'favorite_pool', 'favorite_team', 'pool_feature_filters'
  ]);
  const FAVORITE_SETTING_NAMES = new Set(['favorite_pool', 'favorite_team']);
  const EMPTY_FAVORITE_SELECTION = 'none';

  // Private measurement and publishing helpers

  /**
   * Builds privacy-limited page location and referrer parameters.
   * @returns {Object} Approved page measurement parameters
   * @private
   */
  function getMeasuredPageParameters() {
    return {
      page_location: `${window.HOME_PAGE_URL}${window.location.pathname}`,
      page_referrer: ''
    };
  }

  /**
   * Gets the reviewed analytics page title or falls back to the document title.
   * @returns {string} Page title used for analytics measurement
   * @private
   */
  function getMeasuredPageTitle() {
    const analyticsPageTitle = document.querySelector('meta[name="analytics-page-title"]');
    return analyticsPageTitle ? analyticsPageTitle.content : document.title;
  }

  /**
   * Validates and removes an approved campaign tuple from the landing URL.
   * @returns {Object|null} Matched published campaign, or null when none is valid
   * @private
   */
  function consumePublishedCampaign() {
    const landingUrl = new URL(window.location.href);
    if (landingUrl.pathname !== '/') return null;

    const campaign = PUBLISHED_CAMPAIGNS.find(publishedCampaign => (
      landingUrl.searchParams.get('utm_source') === publishedCampaign.source
      && landingUrl.searchParams.get('utm_medium') === publishedCampaign.medium
      && landingUrl.searchParams.get('utm_campaign') === publishedCampaign.name
    ));
    if (!campaign) return null;

    landingUrl.searchParams.delete('utm_source');
    landingUrl.searchParams.delete('utm_medium');
    landingUrl.searchParams.delete('utm_campaign');
    window.history.replaceState(window.history.state, '', `${landingUrl.pathname}${landingUrl.search}${landingUrl.hash}`);
    return campaign;
  }

  /**
   * Maps an approved campaign to Google Analytics campaign fields.
   * @param {Object|null} publishedCampaign - Validated published campaign
   * @returns {Object} Approved campaign measurement parameters
   * @private
   */
  function getMeasuredCampaignParameters(publishedCampaign) {
    if (!publishedCampaign) return {};

    return {
      campaign_source: publishedCampaign.source,
      campaign_medium: publishedCampaign.medium,
      campaign_name: publishedCampaign.name
    };
  }

  /**
   * Publishes an event through the configured Google tag function.
   * @param {string} eventName - Approved analytics event name
   * @param {Object} [eventParameters] - Privacy-reviewed event parameters
   * @private
   */
  function publishEvent(eventName, eventParameters = {}) {
    if (typeof window.gtag !== 'function') return;

    window.gtag('event', eventName, eventParameters);
  }

  /**
   * Publishes the application version once for the current browser session.
   * @private
   */
  function publishVersionOncePerSession() {
    try {
      if (window.sessionStorage.getItem(window.ANALYTICS_VERSION_REPORTED_STORAGE_KEY)) return;

      window.sessionStorage.setItem(window.ANALYTICS_VERSION_REPORTED_STORAGE_KEY, 'true');
    } catch (_error) {
      return;
    }

    publishEvent('ca_version', {
      app_version: window.APP_VERSION
    });
  }

  // Private interaction trackers

  /**
   * Publishes a validated banner interaction.
   * @param {string} bannerName - Approved banner name
   * @param {string} action - Approved banner action
   * @private
   */
  function trackBannerInteraction(bannerName, action) {
    if (!ALLOWED_BANNER_NAMES.has(bannerName) || !ALLOWED_BANNER_ACTIONS.has(action)) return;

    publishEvent('ca_banner_interaction', {
      banner_name: bannerName,
      banner_action: action
    });
  }

  /**
   * Publishes a validated directory detail-open interaction.
   * @param {string} directoryName - Approved directory name
   * @private
   */
  function trackDirectoryDetailOpen(directoryName) {
    if (!ALLOWED_DIRECTORY_NAMES.has(directoryName)) return;

    publishEvent('ca_directory_detail_open', {
      directory_name: directoryName
    });
  }

  /**
   * Publishes a validated external-link interaction.
   * @param {string} context - Approved link context
   * @param {string} purpose - Approved link purpose
   * @private
   */
  function trackExternalLinkInteraction(context, purpose) {
    if (!ALLOWED_EXTERNAL_LINK_CONTEXTS.has(context) || !ALLOWED_EXTERNAL_LINK_PURPOSES.has(purpose)) return;

    publishEvent('ca_external_link', {
      link_context: context,
      link_purpose: purpose
    });
  }

  /**
   * Publishes a setting change after validating its fixed value.
   * @param {string} settingName - Approved fixed setting name
   * @param {*} settingValue - Candidate fixed setting value
   * @private
   */
  function trackFixedSettingChange(settingName, settingValue) {
    const allowedValues = FIXED_SETTING_VALUES[settingName];
    const normalizedValue = String(settingValue);
    if (!allowedValues || !allowedValues.has(normalizedValue)) return;

    publishEvent('ca_setting_change', {
      setting_name: settingName
    });
  }

  /**
   * Publishes a validated install interaction.
   * @param {string} action - Approved install action
   * @private
   */
  function trackInstallInteraction(action) {
    if (!ALLOWED_INSTALL_ACTIONS.has(action)) return;

    publishEvent('ca_install_interaction', {
      install_action: action
    });
  }

  /**
   * Publishes a setting change after validating values against annual data.
   * @param {string} settingName - Approved published setting name
   * @param {Array} selectedValues - Selected annual-data values
   * @param {Set<string>} publishedValues - Allowed annual-data values
   * @private
   */
  function trackPublishedSettingChange(settingName, selectedValues, publishedValues) {
    if (!ALLOWED_PUBLISHED_SETTING_NAMES.has(settingName) || !Array.isArray(selectedValues) || !(publishedValues instanceof Set)) return;
    if (selectedValues.some(value => typeof value !== 'string')) return;

    const normalizedValues = [...new Set(selectedValues)].sort((first, second) => first.localeCompare(second));
    if (normalizedValues.some(value => !publishedValues.has(value))) return;

    const eventParameters = { setting_name: settingName };
    if (FAVORITE_SETTING_NAMES.has(settingName)) {
      if (normalizedValues.length > 1) return;
      eventParameters.selection = normalizedValues[0] || EMPTY_FAVORITE_SELECTION;
    }

    publishEvent('ca_setting_change', eventParameters);
  }

  /**
   * Publishes a validated resource view or download interaction.
   * @param {string} resourceName - Approved resource name
   * @param {string} action - Resource action mapped to an event name
   * @private
   */
  function trackResourceInteraction(resourceName, action) {
    const eventName = RESOURCE_EVENT_NAMES[action];
    if (!ALLOWED_RESOURCE_NAMES.has(resourceName) || !eventName) return;

    publishEvent(eventName, {
      resource_name: resourceName
    });
  }

  /**
   * Publishes a validated site-sharing interaction.
   * @param {string} method - Approved sharing method
   * @private
   */
  function trackShareInteraction(method) {
    if (!ALLOWED_SHARE_METHODS.has(method)) return;

    publishEvent('ca_share', {
      content_type: 'website',
      item_id: 'home_page',
      method
    });
  }

  // Private DOM instrumentation

  /**
   * Resolves an approved analytics context for an external link.
   * @param {Element} link - External link element
   * @returns {string} Approved link context
   * @private
   */
  function getExternalLinkContext(link) {
    const contextElement = link.closest('[data-analytics-context]');
    const context = contextElement && contextElement.dataset.analyticsContext;
    return ALLOWED_EXTERNAL_LINK_CONTEXTS.has(context) ? context : 'other';
  }

  /**
   * Resolves an approved analytics purpose for an external link.
   * @param {Element} link - External link element
   * @returns {string} Approved link purpose
   * @private
   */
  function getExternalLinkPurpose(link) {
    const purpose = link.dataset.analyticsLinkPurpose || EXTERNAL_LINK_PURPOSES.GENERAL;
    return ALLOWED_EXTERNAL_LINK_PURPOSES.has(purpose) ? purpose : EXTERNAL_LINK_PURPOSES.GENERAL;
  }

  /**
   * Determines whether a link targets an approved external destination.
   * @param {Element} link - Candidate link element
   * @returns {boolean} Whether the link is external to the application
   * @private
   */
  function isExternalLink(link) {
    const href = link.getAttribute('href');
    if (!href) return false;

    try {
      const siteOrigin = new URL(window.HOME_PAGE_URL).origin;
      const destination = new URL(href, `${siteOrigin}/`);
      return ALLOWED_EXTERNAL_LINK_PROTOCOLS.has(destination.protocol)
        && (destination.protocol !== 'http:' && destination.protocol !== 'https:' || destination.origin !== siteOrigin);
    } catch (_error) {
      return false;
    }
  }

  /**
   * Binds delegated analytics tracking for approved link interactions.
   * @private
   */
  function initializeClickTracking() {
    document.addEventListener('click', event => {
      const clickedElement = event.target instanceof Element ? event.target : null;
      const shareLink = clickedElement && clickedElement.closest('[data-analytics-share-method]');
      const resourceLink = clickedElement && clickedElement.closest('[data-analytics-resource-name][data-analytics-resource-action]');
      const clickedLink = clickedElement && clickedElement.closest('a[href]');

      if (shareLink) {
        trackInteraction(AnalyticsInteractionType.SHARE, {
          method: shareLink.dataset.analyticsShareMethod
        });
      }
      if (resourceLink) {
        trackInteraction(AnalyticsInteractionType.RESOURCE, {
          action: resourceLink.dataset.analyticsResourceAction,
          resourceName: resourceLink.dataset.analyticsResourceName
        });
      }
      if (clickedLink && isExternalLink(clickedLink)) {
        trackInteraction(AnalyticsInteractionType.EXTERNAL_LINK, {
          context: getExternalLinkContext(clickedLink),
          purpose: getExternalLinkPurpose(clickedLink)
        });
      }
    });
  }

  /**
   * Determines whether the page is running on the production HTTPS host.
   * @returns {boolean} Whether analytics may run on this host
   * @private
   */
  function isProductionSite() {
    return window.location.protocol === 'https:'
      && window.location.hostname === window.HOME_PAGE_HOSTNAME;
  }

  /**
   * Determines whether Google Analytics is disabled for this property.
   * @returns {boolean} Whether analytics has been disabled
   * @private
   */
  function isAnalyticsDisabled() {
    return window[`ga-disable-${window.GA4_MEASUREMENT_ID}`] === true;
  }

  // Initialization

  const publishedCampaign = isProductionSite() ? consumePublishedCampaign() : null;

  // Public API

  /**
   * Routes an interaction through its event-specific validation boundary.
   * @param {string} interactionType - Semantic analytics interaction type
   * @param {Object} [parameters] - Interaction-specific candidate parameters
   */
  function trackInteraction(interactionType, parameters = {}) {
    switch (interactionType) {
      case AnalyticsInteractionType.BANNER:
        trackBannerInteraction(parameters.bannerName, parameters.action);
        break;
      case AnalyticsInteractionType.DIRECTORY_DETAIL_OPEN:
        trackDirectoryDetailOpen(parameters.directoryName);
        break;
      case AnalyticsInteractionType.EXTERNAL_LINK:
        trackExternalLinkInteraction(parameters.context, parameters.purpose);
        break;
      case AnalyticsInteractionType.FIXED_SETTING_CHANGE:
        trackFixedSettingChange(parameters.settingName, parameters.settingValue);
        break;
      case AnalyticsInteractionType.INSTALL:
        trackInstallInteraction(parameters.action);
        break;
      case AnalyticsInteractionType.PUBLISHED_SETTING_CHANGE:
        trackPublishedSettingChange(parameters.settingName, parameters.selectedValues, parameters.publishedValues);
        break;
      case AnalyticsInteractionType.RESOURCE:
        trackResourceInteraction(parameters.resourceName, parameters.action);
        break;
      case AnalyticsInteractionType.SHARE:
        trackShareInteraction(parameters.method);
        break;
    }
  }

  window.cnslAnalytics = Object.freeze({
    bannerNames: BANNER_NAMES,
    trackInteraction
  });

  initializeClickTracking();

  if (isAnalyticsDisabled() || !isProductionSite() || document.getElementById('cnslAnalyticsScript')) return;

  window.dataLayer = window.dataLayer || [];
  /**
   * Queues Google tag commands until the analytics library is available.
   * @private
   */
  window.gtag = window.gtag || function gtag() {
    window.dataLayer.push(arguments);
  };
  window.gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'granted'
  });
  window.gtag('set', 'ads_data_redaction', true);
  window.gtag('set', {
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
    ...getMeasuredPageParameters()
  });

  const script = document.createElement('script');
  script.id = 'cnslAnalyticsScript';
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(window.GA4_MEASUREMENT_ID)}`;
  script.addEventListener('load', () => {
    window.gtag('js', new Date());
    window.gtag('config', window.GA4_MEASUREMENT_ID, {
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      ignore_referrer: true,
      send_page_view: false,
      ...getMeasuredCampaignParameters(publishedCampaign)
    });
    publishVersionOncePerSession();
    window.gtag('event', 'page_view', {
      page_title: getMeasuredPageTitle(),
      ...getMeasuredPageParameters()
    });
    if (publishedCampaign?.source === 'flyer') {
      window.gtag('event', 'ca_flyer_visit');
    }
  }, { once: true });
  document.head.appendChild(script);
}());
