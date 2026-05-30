(function initializeConnectivityStatus() {
  'use strict';

  function renderConnectionStatus() {
    const status = document.getElementById('connectivityStatus');
    if (!status) return;

    status.hidden = navigator.onLine !== false;
  }

  function startConnectionStatusUpdates() {
    renderConnectionStatus();
    window.addEventListener('online', renderConnectionStatus);
    window.addEventListener('offline', renderConnectionStatus);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startConnectionStatusUpdates);
  } else {
    startConnectionStatusUpdates();
  }
}());
