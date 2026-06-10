/**
 * Classifies supported mobile platforms and installed display mode.
 * Accepts browser capability values explicitly so detection remains testable.
 */

if (typeof globalThis.DevicePlatformService === 'undefined') {
  class DevicePlatformService {
    static getPlatform(navigatorLike = {}) {
      const userAgent = String(navigatorLike.userAgent || '');
      if (/Android/i.test(userAgent)) return 'android';
      if (/iPhone|iPad|iPod/i.test(userAgent)
        || (navigatorLike.platform === 'MacIntel' && navigatorLike.maxTouchPoints > 1)) {
        return 'ios';
      }
      return 'other';
    }

    static isMobilePlatform(platform) {
      return platform === 'android' || platform === 'ios';
    }

    static isStandalone(displayModeStandalone, navigatorStandalone) {
      return displayModeStandalone === true || navigatorStandalone === true;
    }
  }

  globalThis.DevicePlatformService = DevicePlatformService;
}
