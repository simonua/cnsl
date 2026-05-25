(function initializeAnalytics() {
  'use strict';

  const measurementId = 'G-ZMBPYQKLQP';

  function getAnonymousPageParameters() {
    return {
      page_location: `${window.location.origin}${window.location.pathname}`,
      page_referrer: ''
    };
  }

  function initializeShareTracking() {
    document.addEventListener('click', event => {
      const clickedElement = event.target instanceof Element ? event.target : null;
      const shareLink = clickedElement && clickedElement.closest('[data-analytics-share-method]');

      if (!shareLink || typeof window.gtag !== 'function') return;

      window.gtag('event', 'share', {
        method: shareLink.dataset.analyticsShareMethod,
        content_type: 'website',
        item_id: 'home_page'
      });
    });
  }

  function isLocalDevelopment() {
    return window.location.hostname === 'localhost'
      || window.location.hostname === '127.0.0.1'
      || window.location.port === '9090';
  }

  initializeShareTracking();

  if (isLocalDevelopment() || document.getElementById('cnslAnalyticsScript')) return;

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function gtag() {
    window.dataLayer.push(arguments);
  };
  window.gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied'
  });
  window.gtag('set', 'ads_data_redaction', true);
  window.gtag('set', {
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
    ...getAnonymousPageParameters()
  });
  window.gtag('js', new Date());
  window.gtag('config', measurementId, {
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
    ignore_referrer: true,
    send_page_view: false
  });
  window.gtag('event', 'page_view', {
    page_title: document.title,
    ...getAnonymousPageParameters()
  });

  const script = document.createElement('script');
  script.id = 'cnslAnalyticsScript';
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
  document.head.appendChild(script);
}());