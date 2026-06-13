/**
 * Classifies browser platforms and installed display mode.
 * Accepts browser capability values explicitly so detection remains testable.
 */

if (typeof globalThis.DevicePlatformService === 'undefined') {
  /** Classifies platform and installed-display browser capability values. */
  class DevicePlatformService {
    /**
     * Classify a navigator-like object into a supported platform.
     * @param {Object} navigatorLike - Navigator capability values
     * @returns {string} Android, iOS, or other platform key
     */
    static getPlatform(navigatorLike = {}) {
      const userAgent = String(navigatorLike.userAgent || '');
      if (/Android/i.test(userAgent)) return 'android';
      if (/iPhone|iPad|iPod/i.test(userAgent)
        || (navigatorLike.platform === 'MacIntel' && navigatorLike.maxTouchPoints > 1)) {
        return 'ios';
      }
      return 'other';
    }

    /**
     * Check whether a platform key represents a supported mobile platform.
     * @param {string} platform - Platform key to inspect
     * @returns {boolean} Whether the platform is Android or iOS
     */
    static isMobilePlatform(platform) {
      return platform === 'android' || platform === 'ios';
    }

    /**
     * Check whether browser capabilities identify an Apple device.
     * @param {Object} navigatorLike - Navigator capability values
     * @returns {boolean} Whether the browser is running on iOS, iPadOS, or macOS
     */
    static isApplePlatform(navigatorLike = {}) {
      const userAgentPlatform = navigatorLike.userAgentData?.platform;
      const platform = String(userAgentPlatform || navigatorLike.platform || '');
      const userAgent = String(navigatorLike.userAgent || '');
      return /Mac|iPhone|iPad|iPod/i.test(`${platform} ${userAgent}`);
    }

    /**
     * Check whether either browser signal indicates standalone display mode.
     * @param {boolean} displayModeStandalone - Result of the standalone media query
     * @param {boolean} navigatorStandalone - Navigator standalone flag
     * @returns {boolean} Whether the application is running standalone
     */
    static isStandalone(displayModeStandalone, navigatorStandalone) {
      return displayModeStandalone === true || navigatorStandalone === true;
    }
  }

  globalThis.DevicePlatformService = DevicePlatformService;
}
