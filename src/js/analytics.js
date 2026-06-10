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

  // Private measurement and publishing helpers

  function getMeasuredPageParameters() {
    return {
      page_location: `${window.HOME_PAGE_URL}${window.location.pathname}`,
      page_referrer: ''
    };
  }

  function getMeasuredPageTitle() {
    const analyticsPageTitle = document.querySelector('meta[name="analytics-page-title"]');
    return analyticsPageTitle ? analyticsPageTitle.content : document.title;
  }

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

  function getMeasuredCampaignParameters(publishedCampaign) {
    if (!publishedCampaign) return {};

    return {
      campaign_source: publishedCampaign.source,
      campaign_medium: publishedCampaign.medium,
      campaign_name: publishedCampaign.name
    };
  }

  function publishEvent(eventName, eventParameters = {}) {
    if (typeof window.gtag !== 'function') return;

    window.gtag('event', eventName, eventParameters);
  }

  // Private interaction trackers

  function trackBannerInteraction(bannerName, action) {
    if (!ALLOWED_BANNER_NAMES.has(bannerName) || !ALLOWED_BANNER_ACTIONS.has(action)) return;

    publishEvent('ca_banner_interaction', {
      banner_name: bannerName,
      banner_action: action
    });
  }

  function trackDirectoryDetailOpen(directoryName) {
    if (!ALLOWED_DIRECTORY_NAMES.has(directoryName)) return;

    publishEvent('ca_directory_detail_open', {
      directory_name: directoryName
    });
  }

  function trackExternalLinkInteraction(context, purpose) {
    if (!ALLOWED_EXTERNAL_LINK_CONTEXTS.has(context) || !ALLOWED_EXTERNAL_LINK_PURPOSES.has(purpose)) return;

    publishEvent('ca_external_link', {
      link_context: context,
      link_purpose: purpose
    });
  }

  function trackFixedSettingChange(settingName, settingValue) {
    const allowedValues = FIXED_SETTING_VALUES[settingName];
    const normalizedValue = String(settingValue);
    if (!allowedValues || !allowedValues.has(normalizedValue)) return;

    publishEvent('ca_setting_change', {
      setting_name: settingName
    });
  }

  function trackInstallInteraction(action) {
    if (!ALLOWED_INSTALL_ACTIONS.has(action)) return;

    publishEvent('ca_install_interaction', {
      install_action: action
    });
  }

  function trackPublishedSettingChange(settingName, selectedValues, publishedValues) {
    if (!ALLOWED_PUBLISHED_SETTING_NAMES.has(settingName) || !Array.isArray(selectedValues) || !(publishedValues instanceof Set)) return;
    if (selectedValues.some(value => typeof value !== 'string')) return;

    const normalizedValues = [...new Set(selectedValues)].sort((first, second) => first.localeCompare(second));
    if (normalizedValues.some(value => !publishedValues.has(value))) return;

    publishEvent('ca_setting_change', {
      setting_name: settingName
    });
  }

  function trackResourceInteraction(resourceName, action) {
    const eventName = RESOURCE_EVENT_NAMES[action];
    if (!ALLOWED_RESOURCE_NAMES.has(resourceName) || !eventName) return;

    publishEvent(eventName, {
      resource_name: resourceName
    });
  }

  function trackShareInteraction(method) {
    if (!ALLOWED_SHARE_METHODS.has(method)) return;

    publishEvent('ca_share', {
      content_type: 'website',
      item_id: 'home_page',
      method
    });
  }

  // Private DOM instrumentation

  function getExternalLinkContext(link) {
    const contextElement = link.closest('[data-analytics-context]');
    const context = contextElement && contextElement.dataset.analyticsContext;
    return ALLOWED_EXTERNAL_LINK_CONTEXTS.has(context) ? context : 'other';
  }

  function getExternalLinkPurpose(link) {
    const purpose = link.dataset.analyticsLinkPurpose || EXTERNAL_LINK_PURPOSES.GENERAL;
    return ALLOWED_EXTERNAL_LINK_PURPOSES.has(purpose) ? purpose : EXTERNAL_LINK_PURPOSES.GENERAL;
  }

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

  function isProductionSite() {
    return window.location.protocol === 'https:'
      && window.location.hostname === window.HOME_PAGE_HOSTNAME;
  }

  // Initialization

  const publishedCampaign = isProductionSite() ? consumePublishedCampaign() : null;

  // Public API

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

  if (!isProductionSite() || document.getElementById('cnslAnalyticsScript')) return;

  window.dataLayer = window.dataLayer || [];
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
    window.gtag('event', 'page_view', {
      page_title: getMeasuredPageTitle(),
      app_version: window.APP_VERSION,
      ...getMeasuredPageParameters()
    });
    if (publishedCampaign?.source === 'flyer') {
      window.gtag('event', 'ca_flyer_visit');
    }
  }, { once: true });
  document.head.appendChild(script);
}());
