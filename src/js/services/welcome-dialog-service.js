/**
 * Owns permanent dismissal and one-use navigation suppression for the first-visit welcome dialog.
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

    /**
     * Suppress the welcome dialog on the next page loaded in this tab.
     * @param {Storage|null} storage - Current-tab storage or a compatible substitute
     * @param {string} storageKey - One-use navigation suppression key
     * @returns {boolean} Whether suppression was stored
     */
    static suppressNextNavigation(storage, storageKey) {
      if (!storage || !storageKey) return false;
      try {
        storage.setItem(storageKey, 'true');
        return true;
      } catch (_error) {
        return false;
      }
    }

    /**
     * Consume any pending one-use navigation suppression.
     * @param {Storage|null} storage - Current-tab storage or a compatible substitute
     * @param {string} storageKey - One-use navigation suppression key
     * @returns {boolean} Whether this page load should suppress the welcome dialog
     */
    static consumeNavigationSuppression(storage, storageKey) {
      if (!storage || !storageKey) return false;
      try {
        if (storage.getItem(storageKey) !== 'true') return false;
        storage.removeItem(storageKey);
        return true;
      } catch (_error) {
        return false;
      }
    }
  }

  globalThis.WelcomeDialogService = WelcomeDialogService;
}
