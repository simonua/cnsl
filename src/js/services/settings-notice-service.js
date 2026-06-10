/**
 * Remembers whether the first-visit Settings reminder was dismissed on this device.
 */
if (typeof globalThis.SettingsNoticeService === 'undefined') {
  /** Reads and persists the first-visit settings reminder state. */
  class SettingsNoticeService {
    /**
     * Determine whether the settings reminder should be shown.
     * @param {Storage|null} storage - Browser storage or a compatible substitute
     * @param {string} storageKey - Reminder dismissal key
     * @returns {boolean} Whether the reminder should be shown
     */
    static shouldShow(storage, storageKey) {
      if (!storage || !storageKey) return true;
      try {
        return storage.getItem(storageKey) !== 'true';
      } catch (_error) {
        return true;
      }
    }

    /**
     * Persist dismissal of the settings reminder.
     * @param {Storage|null} storage - Browser storage or a compatible substitute
     * @param {string} storageKey - Reminder dismissal key
     * @returns {boolean} Whether dismissal was stored
     */
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

  globalThis.SettingsNoticeService = SettingsNoticeService;
}
