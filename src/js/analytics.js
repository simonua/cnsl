(function initializeAnalytics() {
  'use strict';

  const measurementId = 'G-ZMBPYQKLQP';

  function isLocalDevelopment() {
    return window.location.hostname === 'localhost'
      || window.location.hostname === '127.0.0.1'
      || window.location.port === '9090';
  }

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