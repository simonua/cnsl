/**
 * Redirects a clean application launch before the home page can paint.
 */
(function redirectToPreferredStartPage() {
  'use strict';

  const redirectScript = globalThis.document.currentScript;
  const storageKey = redirectScript && redirectScript.dataset.preferencesStorageKey;
  const currentUrl = new URL(globalThis.location.href);
  let redirectStarted = false;

  try {
    if (!storageKey
      || currentUrl.pathname !== globalThis.StartPage.getRoute(globalThis.StartPage.VALUES.HOME)
      || currentUrl.search
      || currentUrl.hash) return;

    const storedPreferences = JSON.parse(globalThis.localStorage.getItem(storageKey) || '{}');
    const destination = new URL(globalThis.StartPage.getRoute(storedPreferences.startPage), currentUrl.origin);
    if (destination.origin === currentUrl.origin && destination.pathname !== currentUrl.pathname) {
      globalThis.location.replace(destination.href);
      redirectStarted = true;
    }
  } catch (_error) {
    // Home remains available when stored preferences cannot be read.
  } finally {
    if (!redirectStarted) {
      delete globalThis.document.documentElement.dataset.startPagePending;
    }
  }
}());
