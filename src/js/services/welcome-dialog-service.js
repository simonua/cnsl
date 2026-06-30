/**
 * Remembers whether the first-visit welcome dialog was dismissed on this device.
 */
if (typeof globalThis.WelcomeDialogService === 'undefined') {
  /** Reads and persists the first-visit welcome state. */
  class WelcomeDialogService {
    /**
     * Determine whether the welcome dialog should be shown.
     * @param {Storage|null} storage - Browser storage or a compatible substitute
     * @param {string} storageKey - Welcome dismissal key
     * @returns {boolean} Whether the dialog should be shown
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
     * Persist dismissal of the welcome dialog.
     * @param {Storage|null} storage - Browser storage or a compatible substitute
     * @param {string} storageKey - Welcome dismissal key
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

  globalThis.WelcomeDialogService = WelcomeDialogService;
}
