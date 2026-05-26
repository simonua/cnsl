/**
 * Determines whether a stable release announcement needs to be shown on this device.
 */
if (typeof window === 'undefined' || !window.ReleaseNoticeService) {
  class ReleaseNoticeService {
    static getStableVersionParts(version) {
      const match = typeof version === 'string'
        ? version.match(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/)
        : null;
      if (!match) return null;

      const parts = match.slice(1).map(part => Number(part));
      return parts.every(part => Number.isSafeInteger(part)) ? parts : null;
    }

    static compareStableVersions(firstVersion, secondVersion) {
      const firstParts = ReleaseNoticeService.getStableVersionParts(firstVersion);
      const secondParts = ReleaseNoticeService.getStableVersionParts(secondVersion);
      if (!firstParts || !secondParts) return null;

      for (let index = 0; index < firstParts.length; index += 1) {
        if (firstParts[index] !== secondParts[index]) {
          return firstParts[index] > secondParts[index] ? 1 : -1;
        }
      }
      return 0;
    }

    static shouldShow(currentVersion, acknowledgedVersion) {
      if (!ReleaseNoticeService.getStableVersionParts(currentVersion)) return false;
      if (!ReleaseNoticeService.getStableVersionParts(acknowledgedVersion)) return true;
      return ReleaseNoticeService.compareStableVersions(currentVersion, acknowledgedVersion) > 0;
    }

    static readAcknowledgedVersion(storage, storageKey) {
      if (!storage || !storageKey) return null;
      try {
        return storage.getItem(storageKey);
      } catch (_error) {
        return null;
      }
    }

    static acknowledge(storage, storageKey, currentVersion) {
      if (!storage || !storageKey || !ReleaseNoticeService.getStableVersionParts(currentVersion)) return false;
      try {
        storage.setItem(storageKey, currentVersion);
        return true;
      } catch (_error) {
        return false;
      }
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ReleaseNoticeService;
  }

  if (typeof window !== 'undefined') {
    window.ReleaseNoticeService = ReleaseNoticeService;
  }
}
