/**
 * Remembers whether the first-visit Settings reminder was dismissed on this device.
 */
if (typeof window === 'undefined' || !window.SettingsNoticeService) {
  class SettingsNoticeService {
    static shouldShow(storage, storageKey) {
      if (!storage || !storageKey) return true;
      try {
        return storage.getItem(storageKey) !== 'true';
      } catch (_error) {
        return true;
      }
    }

    static dismiss(storage, storageKey) {
      if (!storage || !storageKey) return false;
      try {
        storage.setItem(storageKey, 'true');
        return true;
      } catch (_error) {
        return false;
      }
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = SettingsNoticeService;
  }

  if (typeof window !== 'undefined') {
    window.SettingsNoticeService = SettingsNoticeService;
  }
}
