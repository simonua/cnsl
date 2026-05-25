(function initializeAnalytics() {
  'use strict';

  function getMeasuredPageParameters() {
    return {
      page_location: `${window.HOME_PAGE_URL}${window.location.pathname}`,
      page_referrer: ''
    };
  }

  function initializeShareTracking() {
    document.addEventListener('click', event => {
      const clickedElement = event.target instanceof Element ? event.target : null;
      const shareLink = clickedElement && clickedElement.closest('[data-analytics-share-method]');

      if (!shareLink || typeof window.gtag !== 'function') return;

      window.gtag('event', 'ca_share', {
        method: shareLink.dataset.analyticsShareMethod,
        content_type: 'website',
        item_id: 'home_page'
      });
    });
  }

  function isProductionSite() {
    return window.location.protocol === 'https:'
      && window.location.hostname === window.HOME_PAGE_HOSTNAME;
  }

  initializeShareTracking();

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
