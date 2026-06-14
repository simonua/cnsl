// Publishes privacy-reviewed analytics events and exposes a minimal tracking API.
// Event validation, page measurement, and DOM instrumentation remain closure-private.

(function initializeAnalytics() {
  'use strict';

  // Published event contract

  const ANALYTICS_EVENT_NAMES = Object.freeze({
    BANNER_INTERACTION: 'ca_banner_interaction',
    DIRECTORY_DETAIL_OPEN: 'ca_directory_detail_open',
    EXPERIMENTAL_FEATURE_CHANGE: 'ca_experimental_feature_change',
    EXTERNAL_LINK: 'ca_external_link',
    FLYER_VISIT: 'ca_flyer_visit',
    INSTALL_INTERACTION: 'ca_install_interaction',
    PAGE_VIEW: 'page_view',
    RESOURCE_DOWNLOAD: 'ca_resource_download',
    RESOURCE_VIEW: 'ca_resource_view',
    SETTING_CHANGE: 'ca_setting_change',
    SHARE: 'ca_share',
    UPGRADE: 'ca_upgrade',
    VERSION: 'ca_version'
  });
  const ALLOWED_ANALYTICS_EVENT_NAMES = new Set(Object.values(ANALYTICS_EVENT_NAMES));
  const RESOURCE_EVENT_NAMES_BY_ACTION = Object.freeze({
    download: ANALYTICS_EVENT_NAMES.RESOURCE_DOWNLOAD,
    view: ANALYTICS_EVENT_NAMES.RESOURCE_VIEW
  });

  // Campaign attribution

  const PUBLISHED_CAMPAIGNS = Object.freeze([
    Object.freeze({ medium: 'qr', name: '2026_pool_season', source: 'app' }),
    Object.freeze({ medium: 'qr', name: '2026_pool_season', source: 'flyer' })
  ]);

  // Interaction validation

  const BANNER_NAMES = Object.freeze({
    RELEASE_NOTICE: 'release_notice',
    SETTINGS_NOTICE: 'settings_notice'
  });
  const ALLOWED_BANNER_NAMES = new Set(Object.values(BANNER_NAMES));
  const ALLOWED_BANNER_ACTIONS = new Set(['dismiss', 'open', 'view']);

  const ALLOWED_DIRECTORY_NAMES = new Set(['meets', 'pools', 'teams']);

  const ALLOWED_EXPERIMENTAL_FEATURE_ACTIONS = new Set(['disabled', 'enabled']);
  const ALLOWED_EXPERIMENTAL_FEATURE_IDS = new Set(Object.values(globalThis.EXPERIMENTAL_FEATURE_IDS));

  const ALLOWED_INSTALL_ACTIONS = new Set([
    'installed', 'instructions_open', 'prompt_accepted', 'prompt_dismissed', 'prompt_open'
  ]);

  const ALLOWED_RESOURCE_NAMES = new Set([
    'judge', 'line_up_aid', 'timer', 'timesheet_runner', 'web_app_flyer'
  ]);

  const ALLOWED_SHARE_METHODS = new Set(['email', 'facebook', 'qr_code', 'text', 'x']);

  // External-link classification

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
    'project_information', 'team_details', 'weather_status'
  ]);
  const ALLOWED_EXTERNAL_LINK_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'sms:', 'tel:']);
  const EXTERNAL_LINK_DESTINATIONS = Object.freeze({
    APPLE_MAPS: 'apple_maps',
    COLUMBIA_ASSOCIATION: 'columbia_association',
    COLUMBIA_ASSOCIATION_REGISTRATION: 'columbia_association_registration',
    EMAIL: 'email',
    FACEBOOK: 'facebook',
    GITHUB: 'github',
    GO_MOTION: 'go_motion',
    GOOGLE_ANALYTICS_HELP: 'google_analytics_help',
    GOOGLE_MAPS: 'google_maps',
    LINKEDIN: 'linkedin',
    LONG_REACH_MARLINS: 'long_reach_marlins',
    NATIONAL_WEATHER_SERVICE: 'national_weather_service',
    OTHER: 'other',
    PHONE_CALL: 'phone_call',
    SPIRIT_SALE: 'spirit_sale',
    TEAM_UNIFY: 'team_unify',
    TEXT_MESSAGE: 'text_message',
    USA_SWIMMING: 'usa_swimming',
    X: 'x'
  });
  const ALLOWED_EXTERNAL_LINK_DESTINATIONS = new Set(Object.values(EXTERNAL_LINK_DESTINATIONS));
  const EXTERNAL_LINK_HOST_DESTINATIONS = Object.freeze({
    'api.weather.gov': EXTERNAL_LINK_DESTINATIONS.NATIONAL_WEATHER_SERVICE,
    'columbiaassn.clubautomation.com': EXTERNAL_LINK_DESTINATIONS.COLUMBIA_ASSOCIATION_REGISTRATION,
    'columbiaassociation.org': EXTERNAL_LINK_DESTINATIONS.COLUMBIA_ASSOCIATION,
    'experience.arcgis.com': EXTERNAL_LINK_DESTINATIONS.COLUMBIA_ASSOCIATION,
    'forecast.weather.gov': EXTERNAL_LINK_DESTINATIONS.NATIONAL_WEATHER_SERVICE,
    'github.com': EXTERNAL_LINK_DESTINATIONS.GITHUB,
    'maps.app.goo.gl': EXTERNAL_LINK_DESTINATIONS.GOOGLE_MAPS,
    'maps.apple.com': EXTERNAL_LINK_DESTINATIONS.APPLE_MAPS,
    'support.google.com': EXTERNAL_LINK_DESTINATIONS.GOOGLE_ANALYTICS_HELP,
    'www.columbiaassociation.org': EXTERNAL_LINK_DESTINATIONS.COLUMBIA_ASSOCIATION,
    'www.facebook.com': EXTERNAL_LINK_DESTINATIONS.FACEBOOK,
    'www.gomotionapp.com': EXTERNAL_LINK_DESTINATIONS.GO_MOTION,
    'www.google.com': EXTERNAL_LINK_DESTINATIONS.GOOGLE_MAPS,
    'www.linkedin.com': EXTERNAL_LINK_DESTINATIONS.LINKEDIN,
    'www.longreachmarlins.org': EXTERNAL_LINK_DESTINATIONS.LONG_REACH_MARLINS,
    'www.teamunify.com': EXTERNAL_LINK_DESTINATIONS.TEAM_UNIFY,
    'www.usaswimming.org': EXTERNAL_LINK_DESTINATIONS.USA_SWIMMING,
    'x.com': EXTERNAL_LINK_DESTINATIONS.X
  });
  const EXTERNAL_LINK_HOST_SUFFIX_DESTINATIONS = Object.freeze([
    Object.freeze({ destination: EXTERNAL_LINK_DESTINATIONS.SPIRIT_SALE, suffix: '.spiritsale.com' })
  ]);
  const EXTERNAL_LINK_PROTOCOL_DESTINATIONS = Object.freeze({
    'mailto:': EXTERNAL_LINK_DESTINATIONS.EMAIL,
    'sms:': EXTERNAL_LINK_DESTINATIONS.TEXT_MESSAGE,
    'tel:': EXTERNAL_LINK_DESTINATIONS.PHONE_CALL
  });

  // Setting validation

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

  // Upgrade tracking

  const APP_VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
  const UNKNOWN_PREVIOUS_VERSION = '0';

  // Private measurement and publishing helpers

  /**
   * Resolves an extensionless app route to its reviewed published page path.
   * @returns {string} Current path or its validated same-origin HTML counterpart
   * @private
   */
  function getMeasuredPagePath() {
    const currentPagePath = window.location.pathname;
    if (currentPagePath === '/' || currentPagePath.endsWith('.html')) return currentPagePath;

    const publishedPageMetadata = document.querySelector('meta[property="og:url"]');
    if (!publishedPageMetadata) return currentPagePath;

    try {
      const publishedPageUrl = new URL(publishedPageMetadata.content);
      const expectedPagePath = `${currentPagePath}.html`;
      const isPublishedPage = publishedPageUrl.origin === window.HOME_PAGE_URL
        && publishedPageUrl.pathname === expectedPagePath
        && publishedPageUrl.search === ''
        && publishedPageUrl.hash === '';
      return isPublishedPage ? expectedPagePath : currentPagePath;
    } catch (_error) {
      return currentPagePath;
    }
  }

  /**
   * Builds privacy-limited page location and referrer parameters.
   * @returns {Object} Approved page measurement parameters
   * @private
   */
  function getMeasuredPageParameters() {
    return {
      page_location: `${window.HOME_PAGE_URL}${getMeasuredPagePath()}`,
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
  function publishEvent(eventName, eventParameters) {
    if (!ALLOWED_ANALYTICS_EVENT_NAMES.has(eventName) || typeof window.gtag !== 'function') return;

    if (eventParameters) {
      window.gtag('event', eventName, eventParameters);
    } else {
      window.gtag('event', eventName);
    }
  }

  /**
   * Reads a browser-storage value without exposing storage access failures.
   * @param {Storage|null} storage - Browser storage implementation
   * @param {string} key - Storage key to read
   * @returns {string|null} Stored value, or null when unavailable
   * @private
   */
  function readStorageValue(storage, key) {
    if (!storage || !key) return null;
    try {
      return storage.getItem(key);
    } catch (_error) {
      return null;
    }
  }

  /**
   * Parses an application semantic version into numeric parts.
   * @param {string|null} version - Candidate application version
   * @returns {number[]|null} Numeric version parts, or null when invalid
   * @private
   */
  function getVersionParts(version) {
    const match = typeof version === 'string' ? version.match(APP_VERSION_PATTERN) : null;
    if (!match) return null;

    const parts = match.slice(1).map(part => Number(part));
    return parts.every(part => Number.isSafeInteger(part)) ? parts : null;
  }

  /**
   * Compares two validated application versions.
   * @param {string} firstVersion - First application version
   * @param {string} secondVersion - Second application version
   * @returns {number|null} Comparison result, or null when either version is invalid
   * @private
   */
  function compareVersions(firstVersion, secondVersion) {
    const firstParts = getVersionParts(firstVersion);
    const secondParts = getVersionParts(secondVersion);
    if (!firstParts || !secondParts) return null;

    for (let index = 0; index < firstParts.length; index += 1) {
      if (firstParts[index] !== secondParts[index]) {
        return firstParts[index] > secondParts[index] ? 1 : -1;
      }
    }
    return 0;
  }

  /**
   * Finds a validated previous version from durable, session, or legacy state.
   * @param {Storage|null} localStorageImplementation - Device-local storage
   * @param {Storage|null} sessionStorageImplementation - Current-tab storage
   * @returns {string|null} Best available previous version
   * @private
   */
  function getPreviousAppVersion(localStorageImplementation, sessionStorageImplementation) {
    const candidates = [
      readStorageValue(localStorageImplementation, window.ANALYTICS_APP_VERSION_STORAGE_KEY),
      readStorageValue(sessionStorageImplementation, window.SERVICE_WORKER_UPGRADE_FROM_VERSION_STORAGE_KEY),
      readStorageValue(sessionStorageImplementation, window.ANALYTICS_VERSION_REPORTED_STORAGE_KEY),
      readStorageValue(localStorageImplementation, window.APP_VERSION_STORAGE_KEY)
    ];
    return candidates.find(version => getVersionParts(version)) || null;
  }

  /**
   * Determines whether browser state proves that the application was used before this load.
   * @param {Storage|null} localStorageImplementation - Device-local storage
   * @param {Storage|null} sessionStorageImplementation - Current-tab storage
   * @returns {boolean} Whether prior application use is evident
   * @private
   */
  function hasPriorAppUse(localStorageImplementation, sessionStorageImplementation) {
    const hasStoredAppState = window.APP_LOCAL_STORAGE_KEYS.some(key => (
      key !== window.ANALYTICS_APP_VERSION_STORAGE_KEY
      && key !== window.ANALYTICS_UPGRADE_PATH_STORAGE_KEY
      && readStorageValue(localStorageImplementation, key) !== null
    ));
    const hasSessionVersion = readStorageValue(
      sessionStorageImplementation,
      window.ANALYTICS_VERSION_REPORTED_STORAGE_KEY
    ) !== null;
    const hasServiceWorkerUpgrade = readStorageValue(
      sessionStorageImplementation,
      window.SERVICE_WORKER_UPGRADE_FROM_VERSION_STORAGE_KEY
    ) !== null;
    return hasStoredAppState || hasSessionVersion || hasServiceWorkerUpgrade;
  }

  /**
   * Validates a pending upgrade path before it reaches analytics.
   * @param {string|null} upgradePath - Candidate stored upgrade path
   * @returns {string|null} Validated path for the current version, or null
   * @private
   */
  function getValidUpgradePath(upgradePath) {
    if (typeof upgradePath !== 'string') return null;
    const [previousVersion, currentVersion, extraPart] = upgradePath.split(' -> ');
    if (extraPart !== undefined || currentVersion !== window.APP_VERSION || !getVersionParts(currentVersion)) return null;
    if (previousVersion === UNKNOWN_PREVIOUS_VERSION) return upgradePath;
    return compareVersions(previousVersion, currentVersion) === -1 ? upgradePath : null;
  }

  /**
   * Records the current app version and prepares one validated upgrade path for publication.
   * @returns {string|null} Pending upgrade path, or null for first use and non-upgrades
   * @private
   */
  function prepareUpgradeTracking() {
    let localStorageImplementation;
    let sessionStorageImplementation;
    try {
      localStorageImplementation = window.localStorage;
      sessionStorageImplementation = window.sessionStorage;
    } catch (_error) {
      return null;
    }

    const storedVersion = readStorageValue(localStorageImplementation, window.ANALYTICS_APP_VERSION_STORAGE_KEY);
    const pendingPath = getValidUpgradePath(readStorageValue(
      localStorageImplementation,
      window.ANALYTICS_UPGRADE_PATH_STORAGE_KEY
    ));
    if (storedVersion === window.APP_VERSION) return pendingPath;

    const previousVersion = getPreviousAppVersion(localStorageImplementation, sessionStorageImplementation);
    const upgradePath = compareVersions(previousVersion, window.APP_VERSION) === -1
      ? `${previousVersion} -> ${window.APP_VERSION}`
      : !previousVersion && (storedVersion !== null
        || hasPriorAppUse(localStorageImplementation, sessionStorageImplementation))
        ? `${UNKNOWN_PREVIOUS_VERSION} -> ${window.APP_VERSION}`
        : null;

    try {
      localStorageImplementation.setItem(window.ANALYTICS_APP_VERSION_STORAGE_KEY, window.APP_VERSION);
      if (upgradePath) {
        localStorageImplementation.setItem(window.ANALYTICS_UPGRADE_PATH_STORAGE_KEY, upgradePath);
      } else {
        localStorageImplementation.removeItem(window.ANALYTICS_UPGRADE_PATH_STORAGE_KEY);
      }
      sessionStorageImplementation.removeItem(window.SERVICE_WORKER_UPGRADE_FROM_VERSION_STORAGE_KEY);
    } catch (_error) {
      return null;
    }
    return upgradePath;
  }

  /**
   * Publishes and clears a prepared application upgrade path.
   * @param {string|null} upgradePath - Validated path prepared during initialization
   * @private
   */
  function publishUpgrade(upgradePath) {
    const validUpgradePath = getValidUpgradePath(upgradePath);
    if (!validUpgradePath) return;

    publishEvent(ANALYTICS_EVENT_NAMES.UPGRADE, { upgrade_path: validUpgradePath });
    try {
      if (window.localStorage.getItem(window.ANALYTICS_UPGRADE_PATH_STORAGE_KEY) === validUpgradePath) {
        window.localStorage.removeItem(window.ANALYTICS_UPGRADE_PATH_STORAGE_KEY);
      }
    } catch (_error) {
      return;
    }
  }

  /**
   * Publishes each application version once for the current browser session.
   * @private
   */
  function publishVersionWhenChanged() {
    if (typeof window.gtag !== 'function') return;

    try {
      if (window.sessionStorage.getItem(window.ANALYTICS_VERSION_REPORTED_STORAGE_KEY) === window.APP_VERSION) return;

      window.sessionStorage.setItem(window.ANALYTICS_VERSION_REPORTED_STORAGE_KEY, window.APP_VERSION);
    } catch (_error) {
      return;
    }

    publishEvent(ANALYTICS_EVENT_NAMES.VERSION, {
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

    publishEvent(ANALYTICS_EVENT_NAMES.BANNER_INTERACTION, {
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

    publishEvent(ANALYTICS_EVENT_NAMES.DIRECTORY_DETAIL_OPEN, {
      directory_name: directoryName
    });
  }

  /**
   * Publishes a reviewed experimental feature state change.
   * @param {string} featureId - Application-owned experimental feature identifier
   * @param {string} action - Enabled or disabled action
   * @private
   */
  function trackExperimentalFeatureChange(featureId, action) {
    if (!ALLOWED_EXPERIMENTAL_FEATURE_IDS.has(featureId) || !ALLOWED_EXPERIMENTAL_FEATURE_ACTIONS.has(action)) return;

    publishEvent(ANALYTICS_EVENT_NAMES.EXPERIMENTAL_FEATURE_CHANGE, {
      feature_action: action,
      feature_name: featureId
    });
  }

  /**
   * Publishes a validated external-link interaction.
   * @param {string} context - Approved link context
   * @param {string} purpose - Approved link purpose
   * @param {string} destination - Approved destination label
   * @private
   */
  function trackExternalLinkInteraction(context, purpose, destination) {
    if (!ALLOWED_EXTERNAL_LINK_CONTEXTS.has(context)
      || !ALLOWED_EXTERNAL_LINK_PURPOSES.has(purpose)
      || !ALLOWED_EXTERNAL_LINK_DESTINATIONS.has(destination)) return;

    publishEvent(ANALYTICS_EVENT_NAMES.EXTERNAL_LINK, {
      link_context: context,
      link_purpose: purpose,
      link_destination: destination
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

    publishEvent(ANALYTICS_EVENT_NAMES.SETTING_CHANGE, {
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

    publishEvent(ANALYTICS_EVENT_NAMES.INSTALL_INTERACTION, {
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

    publishEvent(ANALYTICS_EVENT_NAMES.SETTING_CHANGE, eventParameters);
  }

  /**
   * Publishes a validated resource view or download interaction.
   * @param {string} resourceName - Approved resource name
   * @param {string} action - Resource action mapped to an event name
   * @private
   */
  function trackResourceInteraction(resourceName, action) {
    const eventName = RESOURCE_EVENT_NAMES_BY_ACTION[action];
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

    publishEvent(ANALYTICS_EVENT_NAMES.SHARE, {
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
   * Resolves a privacy-safe destination label without reporting the link URL.
   * @param {Element} link - External link element
   * @returns {string} Approved destination label
   * @private
   */
  function getExternalLinkDestination(link) {
    try {
      const siteOrigin = new URL(window.HOME_PAGE_URL).origin;
      const destination = new URL(link.getAttribute('href'), `${siteOrigin}/`);
      const hostname = destination.hostname.toLowerCase();
      const suffixDestination = EXTERNAL_LINK_HOST_SUFFIX_DESTINATIONS.find(mapping => hostname.endsWith(mapping.suffix));
      return EXTERNAL_LINK_PROTOCOL_DESTINATIONS[destination.protocol]
        || EXTERNAL_LINK_HOST_DESTINATIONS[hostname]
        || suffixDestination?.destination
        || EXTERNAL_LINK_DESTINATIONS.OTHER;
    } catch (_error) {
      return EXTERNAL_LINK_DESTINATIONS.OTHER;
    }
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
      if (!shareLink && clickedLink && isExternalLink(clickedLink)) {
        trackInteraction(AnalyticsInteractionType.EXTERNAL_LINK, {
          context: getExternalLinkContext(clickedLink),
          destination: getExternalLinkDestination(clickedLink),
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
    return navigator.webdriver === true
      || window[`ga-disable-${window.GA4_MEASUREMENT_ID}`] === true;
  }

  // Initialization

  const publishedCampaign = isProductionSite() ? consumePublishedCampaign() : null;
  const pendingUpgradePath = prepareUpgradeTracking();

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
      case AnalyticsInteractionType.EXPERIMENTAL_FEATURE_CHANGE:
        trackExperimentalFeatureChange(parameters.featureId, parameters.action);
        break;
      case AnalyticsInteractionType.EXTERNAL_LINK:
        trackExternalLinkInteraction(parameters.context, parameters.purpose, parameters.destination);
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
    publishEvent(ANALYTICS_EVENT_NAMES.PAGE_VIEW, {
      page_title: getMeasuredPageTitle(),
      ...getMeasuredPageParameters()
    });
    publishVersionWhenChanged();
    publishUpgrade(pendingUpgradePath);
    if (publishedCampaign?.source === 'flyer') {
      publishEvent(ANALYTICS_EVENT_NAMES.FLYER_VISIT);
    }
  }, { once: true });
  document.head.appendChild(script);
}());
