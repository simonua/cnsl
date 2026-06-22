(function initializeHomeBanners() {
  'use strict';

  const MAX_TIMER_DELAY_MS = 2147483647;

  /**
    * Controls the visibility, acknowledgement, and analytics for an application banner.
   * @private
   */
  class HomeBanner {
    /**
     * Creates a banner controller from element identifiers and banner callbacks.
     * @param {Object} options - Banner configuration
     * @param {string} options.noticeId - Banner container element identifier
     * @param {string} options.linkId - Banner link element identifier
     * @param {string} options.closeButtonId - Dismiss button element identifier
     * @param {string} options.bannerName - Analytics banner name
     * @param {Function} options.shouldShow - Determines whether the banner should be shown
     * @param {Function} options.acknowledge - Records acknowledgement of the banner
     * @param {Function} [options.prepare] - Prepares banner content before display
     */
    constructor({ noticeId, linkId, closeButtonId, bannerName, shouldShow, acknowledge, prepare }) {
      this.noticeId = noticeId;
      this.linkId = linkId;
      this.closeButtonId = closeButtonId;
      this.bannerName = bannerName;
      this.shouldShow = shouldShow;
      this.acknowledge = acknowledge;
      this.prepare = prepare;
    }

    /**
     * Publishes a banner interaction when analytics is available.
     * @param {string} action - Banner interaction action
     * @private
     */
    trackInteraction(action) {
      if (!window.cnslAnalytics) return;
      window.cnslAnalytics.trackInteraction(AnalyticsInteractionType.BANNER, {
        action,
        bannerName: this.bannerName
      });
    }

    /**
     * Displays the banner when eligible and binds its acknowledgement controls.
     */
    show() {
      const notice = document.getElementById(this.noticeId);
      const link = document.getElementById(this.linkId);
      const closeButton = document.getElementById(this.closeButtonId);
      if (!notice || !link || !closeButton || !this.shouldShow()) return;

      if (this.prepare) this.prepare();
      notice.hidden = false;
      this.trackInteraction('view');

      /**
       * Records acknowledgement and hides this banner instance.
       * @private
       */
      const acknowledgeAndHide = () => {
        this.acknowledge();
        notice.hidden = true;
      };

      link.addEventListener('click', () => {
        this.trackInteraction('open');
        acknowledgeAndHide();
      });
      closeButton.addEventListener('click', () => {
        this.trackInteraction('dismiss');
        acknowledgeAndHide();
      });
    }
  }

  /**
   * Gets browser local storage without propagating storage-access errors.
   * @returns {Storage|null} Available local storage, or null when access is blocked
   * @private
   */
  function getLocalStorage() {
    try {
      return window.localStorage;
    } catch (_error) {
      return null;
    }
  }

  /**
   * Hides an attention notice at its deadline without overflowing browser timers.
   * @param {HTMLElement} notice - Attention notice element
   * @param {number} expiresAt - Expiration time in milliseconds since the Unix epoch
   * @private
   */
  function scheduleAttentionExpiry(notice, expiresAt) {
    const remainingTime = expiresAt - Date.now();
    if (remainingTime <= 0) {
      notice.hidden = true;
      return;
    }
    window.setTimeout(
      () => scheduleAttentionExpiry(notice, expiresAt),
      Math.min(remainingTime, MAX_TIMER_DELAY_MS)
    );
  }

  /**
   * Displays a configured attention notice until it is dismissed or expires.
   * @param {Storage|null} storage - Available browser local storage
   * @param {Object|null} bannerNames - Analytics banner-name constants
   * @private
   */
  function showAttentionBanner(storage, bannerNames) {
    const notice = document.getElementById('attentionBanner');
    const message = document.getElementById('attentionBannerMessage');
    const updated = document.getElementById('attentionBannerUpdated');
    const updatedTime = document.getElementById('attentionBannerUpdatedTime');
    const closeButton = document.getElementById('closeAttentionBanner');
    const config = window.APP_ATTENTION_NOTICE;
    if (!notice || !message || !updated || !updatedTime || !closeButton || !config) return;

    const expiresAt = Date.parse(config.EXPIRES_AT);
    const updatedAt = Date.parse(config.UPDATED_AT);
    const hasValidContent = typeof config.MESSAGE === 'string'
      && config.MESSAGE.trim().length > 0
      && typeof config.UPDATED_LABEL === 'string'
      && config.UPDATED_LABEL.trim().length > 0;
    if (!hasValidContent || !Number.isFinite(expiresAt) || !Number.isFinite(updatedAt) || Date.now() >= expiresAt) return;

    let dismissedRevision = null;
    try {
      dismissedRevision = storage && storage.getItem(window.APP_ATTENTION_NOTICE_DISMISSED_STORAGE_KEY);
    } catch (_error) {} // eslint-disable-line no-empty
    if (config.DISMISSIBLE === true && dismissedRevision === config.UPDATED_AT) return;

    message.textContent = config.MESSAGE;
    updatedTime.dateTime = config.UPDATED_AT;
    updatedTime.textContent = config.UPDATED_LABEL;
    updated.hidden = false;
    notice.hidden = false;
    scheduleAttentionExpiry(notice, expiresAt);
    closeButton.hidden = config.DISMISSIBLE !== true;
    if (config.DISMISSIBLE !== true) return;

    closeButton.addEventListener('click', () => {
      try {
        if (storage) storage.setItem(window.APP_ATTENTION_NOTICE_DISMISSED_STORAGE_KEY, config.UPDATED_AT);
      } catch (_error) {
        // Visual dismissal remains available when storage access is blocked.
      }
      notice.hidden = true;
      if (window.cnslAnalytics) {
        window.cnslAnalytics.trackInteraction(AnalyticsInteractionType.BANNER, {
          action: 'dismiss',
          bannerName: bannerNames && bannerNames.ATTENTION_NOTICE
        });
      }
    });
  }

  /**
    * Builds and displays the eligible application banners on the current view.
   * @private
   */
  function showApplicationBanners() {
    const storage = getLocalStorage();
    const releaseVersion = document.getElementById('releaseNoticeVersion');
    const bannerNames = window.cnslAnalytics && window.cnslAnalytics.bannerNames;
    const acknowledgedVersion = window.ReleaseNoticeService
      ? window.ReleaseNoticeService.readAcknowledgedVersion(storage, window.APP_VERSION_STORAGE_KEY)
      : null;
    const platform = window.DevicePlatformService
      ? window.DevicePlatformService.getPlatform(window.navigator)
      : 'other';
    const isFirstMobileUse = window.DevicePlatformService
      && window.DevicePlatformService.isMobilePlatform(platform)
      && !window.ReleaseNoticeService.getStableVersionParts(acknowledgedVersion);

    showAttentionBanner(storage, bannerNames);

    if (isFirstMobileUse) {
      window.ReleaseNoticeService.acknowledge(storage, window.APP_VERSION_STORAGE_KEY, window.APP_VERSION);
    }
    const banners = [
      new HomeBanner({
        noticeId: 'releaseNotice',
        linkId: 'releaseNoticeLink',
        closeButtonId: 'closeReleaseNotice',
        bannerName: bannerNames && bannerNames.RELEASE_NOTICE,
        shouldShow: () => Boolean(releaseVersion && window.ReleaseNoticeService)
          && window.ReleaseNoticeService.shouldShow(
            window.APP_VERSION,
            isFirstMobileUse ? window.APP_VERSION : acknowledgedVersion
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
        bannerName: bannerNames && bannerNames.SETTINGS_NOTICE,
        shouldShow: () => Boolean(window.SettingsNoticeService)
          && window.SettingsNoticeService.shouldShow(storage, window.SETTINGS_NOTICE_DISMISSED_STORAGE_KEY),
        acknowledge: () => window.SettingsNoticeService.dismiss(storage, window.SETTINGS_NOTICE_DISMISSED_STORAGE_KEY)
      })
    ];

    banners.forEach(banner => banner.show());
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', showApplicationBanners);
  } else {
    showApplicationBanners();
  }
}());
