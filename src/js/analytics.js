(function initializeAnalytics() {
  'use strict';

  const FIXED_SETTING_VALUES = Object.freeze({
    theme: new Set(['system', 'light', 'dark']),
    pool_schedule_layout: new Set(['list', 'calendar']),
    location_awareness: new Set(['enabled', 'disabled']),
    weather_refresh_minutes: new Set(['0', '5', '10']),
    practice_groups: new Set(['changed']),
    favorite_pool_expanded: new Set(['expanded', 'collapsed']),
    favorite_team_expanded: new Set(['expanded', 'collapsed'])
  });
  const PUBLISHED_SETTING_NAMES = new Set(['favorite_pool', 'favorite_team', 'pool_feature_filters']);
  const BANNER_NAMES = Object.freeze({
    RELEASE_NOTICE: 'release_notice',
    SETTINGS_NOTICE: 'settings_notice'
  });
  const ALLOWED_BANNER_NAMES = new Set(Object.values(BANNER_NAMES));
  const BANNER_ACTIONS = new Set(['view', 'open', 'dismiss']);
  const EXTERNAL_LINK_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'sms:', 'tel:']);
  const EXTERNAL_LINK_PURPOSES = Object.freeze({
    GENERAL: 'general',
    MERCHANDISE: 'merchandise'
  });
  const EXTERNAL_LINK_CONTEXTS = Object.freeze([
    { selector: '.share-site__links', context: 'share' },
    { selector: '.share-site__feedback', context: 'feedback' },
    { selector: '.weather-alert__link', context: 'weather_status' },
    { selector: '.pool-card', context: 'pool_details' },
    { selector: '.team-card', context: 'team_details' },
    { selector: '.meet-date-card', context: 'meet_details' },
    { selector: '.directory-link, .cnsl-link-btn, .faq-list', context: 'official_information' },
    { selector: '.footer', context: 'project_information' }
  ]);

  function getMeasuredPageParameters() {
    return {
      page_location: `${window.HOME_PAGE_URL}${window.location.pathname}`,
      page_referrer: ''
    };
  }

  function publishEvent(eventName, eventParameters = {}) {
    if (typeof window.gtag !== 'function') return;

    window.gtag('event', eventName, eventParameters);
  }

  function trackFixedSettingChange(settingName, settingValue) {
    const allowedValues = FIXED_SETTING_VALUES[settingName];
    const normalizedValue = String(settingValue);
    if (!allowedValues || !allowedValues.has(normalizedValue)) return;

    publishEvent('ca_setting_change', {
      setting_name: settingName
    });
  }

  function trackPublishedSettingChange(settingName, selectedValues, publishedValues) {
    if (!PUBLISHED_SETTING_NAMES.has(settingName) || !Array.isArray(selectedValues) || !(publishedValues instanceof Set)) return;
    if (selectedValues.some(value => typeof value !== 'string')) return;

    const normalizedValues = [...new Set(selectedValues)].sort((first, second) => first.localeCompare(second));
    if (normalizedValues.some(value => !publishedValues.has(value))) return;

    publishEvent('ca_setting_change', {
      setting_name: settingName
    });
  }

  function trackBannerInteraction(bannerName, action) {
    if (!ALLOWED_BANNER_NAMES.has(bannerName) || !BANNER_ACTIONS.has(action)) return;

    publishEvent('ca_banner_interaction', {
      banner_name: bannerName,
      banner_action: action
    });
  }

  function getExternalLinkContext(link) {
    const matchedContext = EXTERNAL_LINK_CONTEXTS.find(entry => link.closest(entry.selector));
    return matchedContext ? matchedContext.context : 'other';
  }

  function getExternalLinkPurpose(link) {
    return link.classList.contains('team-merchandise')
      ? EXTERNAL_LINK_PURPOSES.MERCHANDISE
      : EXTERNAL_LINK_PURPOSES.GENERAL;
  }

  function isExternalLink(link) {
    const href = link.getAttribute('href');
    if (!href) return false;

    try {
      const siteOrigin = new URL(window.HOME_PAGE_URL).origin;
      const destination = new URL(href, `${siteOrigin}/`);
      return EXTERNAL_LINK_PROTOCOLS.has(destination.protocol)
        && (destination.protocol !== 'http:' && destination.protocol !== 'https:' || destination.origin !== siteOrigin);
    } catch (_error) {
      return false;
    }
  }

  function initializeClickTracking() {
    document.addEventListener('click', event => {
      const clickedElement = event.target instanceof Element ? event.target : null;
      const shareLink = clickedElement && clickedElement.closest('[data-analytics-share-method]');
      const clickedLink = clickedElement && clickedElement.closest('a[href]');

      if (shareLink) {
        publishEvent('ca_share', {
          method: shareLink.dataset.analyticsShareMethod,
          content_type: 'website',
          item_id: 'home_page'
        });
      }
      if (clickedLink && isExternalLink(clickedLink)) {
        publishEvent('ca_external_link', {
          link_context: getExternalLinkContext(clickedLink),
          link_purpose: getExternalLinkPurpose(clickedLink)
        });
      }
    });
  }

  function isProductionSite() {
    return window.location.protocol === 'https:'
      && window.location.hostname === window.HOME_PAGE_HOSTNAME;
  }

  window.cnslAnalytics = Object.freeze({
    bannerNames: BANNER_NAMES,
    trackFixedSettingChange,
    trackPublishedSettingChange,
    trackBannerInteraction
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
      send_page_view: false
    });
    window.gtag('event', 'page_view', {
      page_title: document.title,
      ...getMeasuredPageParameters()
    });
    window.gtag('event', 'ca_version', {
      app_version: window.APP_VERSION
    });
  }, { once: true });
  document.head.appendChild(script);
}());
