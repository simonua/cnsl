(function initializePreferenceTheme() {
  'use strict';

  function applyPreferenceTheme(preferences) {
    const selectedTheme = preferences && preferences.theme ? preferences.theme : 'system';
    document.documentElement.setAttribute('data-theme', selectedTheme);
  }

  window.applyPreferenceTheme = applyPreferenceTheme;
  applyPreferenceTheme(PreferencesService.get());

  window.addEventListener('storage', event => {
    if (event.key === PreferencesService.STORAGE_KEY) {
      applyPreferenceTheme(PreferencesService.get());
    }
  });
}());