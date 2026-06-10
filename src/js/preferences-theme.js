(function initializePreferenceTheme() {
  'use strict';

  const darkColorScheme = window.matchMedia('(prefers-color-scheme: dark)');
  const forcedColors = window.matchMedia('(forced-colors: active)');
  const increasedContrast = window.matchMedia('(prefers-contrast: more)');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  /**
   * Applies saved visual preferences and relevant system media settings.
   * @param {Object} preferences - Saved application preferences
   * @private
   */
  function applyPreferenceTheme(preferences) {
    const selectedTheme = preferences && preferences.theme ? preferences.theme : 'system';
    const selectedContrast = preferences && preferences.contrast ? preferences.contrast : 'system';
    const selectedMotion = preferences && preferences.motion ? preferences.motion : 'system';
    const selectedColorScheme = selectedTheme === 'system'
      ? (darkColorScheme.matches ? 'dark' : 'light')
      : selectedTheme;
    document.documentElement.setAttribute('data-theme', selectedTheme);
    document.documentElement.setAttribute('data-color-scheme', selectedColorScheme);
    document.documentElement.setAttribute('data-text-size', preferences && preferences.textSize ? preferences.textSize : 'default');
    document.documentElement.setAttribute('data-contrast', selectedContrast);
    document.documentElement.setAttribute('data-contrast-mode', selectedContrast === 'high' || increasedContrast.matches || forcedColors.matches ? 'high' : 'default');
    document.documentElement.setAttribute('data-motion', selectedMotion);
    document.documentElement.setAttribute('data-motion-mode', selectedMotion === 'reduced' || reducedMotion.matches ? 'reduced' : 'default');
    document.documentElement.setAttribute('data-underline-links', preferences && preferences.underlineLinks === true ? 'true' : 'false');
    document.documentElement.classList.toggle('has-saved-favorite-team', Boolean(preferences && preferences.favoriteTeamId));
  }

  window.applyPreferenceTheme = applyPreferenceTheme;
  window.shouldReduceMotion = () => document.documentElement.getAttribute('data-motion-mode') === 'reduced';
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

  [forcedColors, increasedContrast, reducedMotion].forEach(mediaQuery => {
    mediaQuery.addEventListener('change', () => applyPreferenceTheme(PreferencesService.get()));
  });
}());
