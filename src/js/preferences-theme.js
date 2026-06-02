(function initializePreferenceTheme() {
  'use strict';

  const darkColorScheme = window.matchMedia('(prefers-color-scheme: dark)');

  function applyPreferenceTheme(preferences) {
    const selectedTheme = preferences && preferences.theme ? preferences.theme : 'system';
    const selectedColorScheme = selectedTheme === 'system'
      ? (darkColorScheme.matches ? 'dark' : 'light')
      : selectedTheme;
    document.documentElement.setAttribute('data-theme', selectedTheme);
    document.documentElement.setAttribute('data-color-scheme', selectedColorScheme);
    document.documentElement.classList.toggle('has-saved-favorite-team', Boolean(preferences && preferences.favoriteTeamId));
  }

  window.applyPreferenceTheme = applyPreferenceTheme;
  applyPreferenceTheme(PreferencesService.get());

  window.addEventListener('storage', event => {
    if (event.key === PreferencesService.STORAGE_KEY) {
      applyPreferenceTheme(PreferencesService.get());
    }
  });

  darkColorScheme.addEventListener('change', () => {
    if (document.documentElement.getAttribute('data-theme') === 'system') {
      applyPreferenceTheme(PreferencesService.get());
    }
  });
}());