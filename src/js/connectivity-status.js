(function initializeConnectivityStatus() {
  'use strict';

  /**
   * Shows the offline status when the browser reports a lost connection.
   * @private
   */
  function renderConnectionStatus() {
    const status = document.getElementById('connectivityStatus');
    if (!status) return;

    status.hidden = navigator.onLine !== false;
  }

  /**
   * Renders the initial connection state and subscribes to connection changes.
   * @private
   */
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
