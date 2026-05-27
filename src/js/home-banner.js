(function initializeHomeBanners() {
  'use strict';

  class HomeBanner {
    constructor({ noticeId, linkId, closeButtonId, shouldShow, acknowledge, prepare }) {
      this.noticeId = noticeId;
      this.linkId = linkId;
      this.closeButtonId = closeButtonId;
      this.shouldShow = shouldShow;
      this.acknowledge = acknowledge;
      this.prepare = prepare;
    }

    show() {
      const notice = document.getElementById(this.noticeId);
      const link = document.getElementById(this.linkId);
      const closeButton = document.getElementById(this.closeButtonId);
      if (!notice || !link || !closeButton || !this.shouldShow()) return;

      if (this.prepare) this.prepare();
      notice.hidden = false;

      const acknowledgeAndHide = () => {
        this.acknowledge();
        notice.hidden = true;
      };

      link.addEventListener('click', acknowledgeAndHide);
      closeButton.addEventListener('click', acknowledgeAndHide);
    }
  }

  function getLocalStorage() {
    try {
      return window.localStorage;
    } catch (_error) {
      return null;
    }
  }

  function showHomeBanners() {
    const storage = getLocalStorage();
    const releaseVersion = document.getElementById('releaseNoticeVersion');
    const banners = [
      new HomeBanner({
        noticeId: 'releaseNotice',
        linkId: 'releaseNoticeLink',
        closeButtonId: 'closeReleaseNotice',
        shouldShow: () => Boolean(releaseVersion && window.ReleaseNoticeService)
          && window.ReleaseNoticeService.shouldShow(
            window.APP_VERSION,
            window.ReleaseNoticeService.readAcknowledgedVersion(storage, window.APP_VERSION_STORAGE_KEY)
          ),
        acknowledge: () => window.ReleaseNoticeService.acknowledge(storage, window.APP_VERSION_STORAGE_KEY, window.APP_VERSION),
        prepare: () => {
          if (releaseVersion) releaseVersion.textContent = window.ReleaseNoticeService.getAnnouncementVersion(window.APP_VERSION);
        }
      }),
      new HomeBanner({
        noticeId: 'settingsNotice',
        linkId: 'settingsNoticeLink',
        closeButtonId: 'closeSettingsNotice',
        shouldShow: () => Boolean(window.SettingsNoticeService)
          && window.SettingsNoticeService.shouldShow(storage, window.SETTINGS_NOTICE_DISMISSED_STORAGE_KEY),
        acknowledge: () => window.SettingsNoticeService.dismiss(storage, window.SETTINGS_NOTICE_DISMISSED_STORAGE_KEY)
      })
    ];

    banners.forEach(banner => banner.show());
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', showHomeBanners);
  } else {
    showHomeBanners();
  }
}());
