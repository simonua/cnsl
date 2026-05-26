(function initializeReleaseNotice() {
  'use strict';

  function getLocalStorage() {
    try {
      return window.localStorage;
    } catch (_error) {
      return null;
    }
  }

  function showReleaseNotice() {
    const notice = document.getElementById('releaseNotice');
    const version = document.getElementById('releaseNoticeVersion');
    const link = document.getElementById('releaseNoticeLink');
    const closeButton = document.getElementById('closeReleaseNotice');
    if (!notice || !version || !link || !closeButton || !window.ReleaseNoticeService) return;

    const storage = getLocalStorage();
    const acknowledgedVersion = window.ReleaseNoticeService.readAcknowledgedVersion(storage, window.APP_VERSION_STORAGE_KEY);
    if (!window.ReleaseNoticeService.shouldShow(window.APP_VERSION, acknowledgedVersion)) return;

    version.textContent = window.APP_VERSION;
    notice.hidden = false;

    function acknowledgeRelease() {
      window.ReleaseNoticeService.acknowledge(storage, window.APP_VERSION_STORAGE_KEY, window.APP_VERSION);
      notice.hidden = true;
    }

    link.addEventListener('click', acknowledgeRelease);
    closeButton.addEventListener('click', acknowledgeRelease);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', showReleaseNotice);
  } else {
    showReleaseNotice();
  }
}());
