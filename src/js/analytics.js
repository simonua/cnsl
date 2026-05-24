(function initializeAnalytics() {
  'use strict';

  const tagManagerId = 'GTM-WZQ5925F';

  function isLocalDevelopment() {
    return window.location.hostname === 'localhost'
      || window.location.hostname === '127.0.0.1'
      || window.location.port === '9090';
  }

  if (isLocalDevelopment() || document.getElementById('cnslAnalyticsScript')) return;

  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });

  const script = document.createElement('script');
  script.id = 'cnslAnalyticsScript';
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(tagManagerId)}`;
  document.head.appendChild(script);
}());