(function initializeAnalytics() {
  'use strict';

  const measurementId = 'G-ZMBPYQKLQP';

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
  window.gtag('js', new Date());
  window.gtag('config', measurementId);

  const script = document.createElement('script');
  script.id = 'cnslAnalyticsScript';
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
  document.head.appendChild(script);
}());