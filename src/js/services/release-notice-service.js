/**
 * Determines whether a stable release announcement needs to be shown on this device.
 */
if (typeof globalThis.ReleaseNoticeService === 'undefined') {
  /** Compares stable versions and persists release-announcement acknowledgement. */
  class ReleaseNoticeService {
    /**
     * Parse a stable semantic version into numeric parts.
     * @param {string} version - Candidate major.minor.patch version
     * @returns {number[]|null} Numeric version parts, or null when invalid
     */
    static getStableVersionParts(version) {
      const match = typeof version === 'string'
        ? version.match(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/)
        : null;
      if (!match) return null;

      const parts = match.slice(1).map(part => Number(part));
      return parts.every(part => Number.isSafeInteger(part)) ? parts : null;
    }

    /**
     * Get the major-minor announcement version for a stable release.
     * @param {string} version - Stable application version
     * @returns {string|null} Major-minor version, or null when invalid
     */
    static getAnnouncementVersion(version) {
      const parts = ReleaseNoticeService.getStableVersionParts(version);
      return parts ? parts.slice(0, 2).join('.') : null;
    }

    /**
     * Compare a requested number of stable semantic-version parts.
     * @param {string} firstVersion - First stable version
     * @param {string} secondVersion - Second stable version
     * @param {number} partCount - Number of leading parts to compare
     * @returns {number|null} Comparison result, or null when either version is invalid
     */
    static compareStableVersions(firstVersion, secondVersion, partCount = 3) {
      const firstParts = ReleaseNoticeService.getStableVersionParts(firstVersion);
      const secondParts = ReleaseNoticeService.getStableVersionParts(secondVersion);
      if (!firstParts || !secondParts) return null;

      for (let index = 0; index < partCount; index += 1) {
        if (firstParts[index] !== secondParts[index]) {
          return firstParts[index] > secondParts[index] ? 1 : -1;
        }
      }
      return 0;
    }

    /**
     * Determine whether the current release announcement is newer than the acknowledgement.
     * @param {string} currentVersion - Current application version
     * @param {string|null} acknowledgedVersion - Last acknowledged application version
     * @returns {boolean} Whether the announcement should be shown
     */
    static shouldShow(currentVersion, acknowledgedVersion) {
      if (!ReleaseNoticeService.getStableVersionParts(currentVersion)) return false;
      if (!ReleaseNoticeService.getStableVersionParts(acknowledgedVersion)) return true;
      return ReleaseNoticeService.compareStableVersions(currentVersion, acknowledgedVersion, 2) > 0;
    }

    /**
     * Read the acknowledged version from storage.
     * @param {Storage|null} storage - Browser storage or a compatible substitute
     * @param {string} storageKey - Acknowledgement key
     * @returns {string|null} Stored version, or null when unavailable
     */
    static readAcknowledgedVersion(storage, storageKey) {
      if (!storage || !storageKey) return null;
      try {
        return storage.getItem(storageKey);
      } catch (_error) {
        return null;
      }
    }

    /**
     * Persist acknowledgement of the current stable version.
     * @param {Storage|null} storage - Browser storage or a compatible substitute
     * @param {string} storageKey - Acknowledgement key
     * @param {string} currentVersion - Current stable version
     * @returns {boolean} Whether acknowledgement was stored
     */
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

  globalThis.ReleaseNoticeService = ReleaseNoticeService;
}
