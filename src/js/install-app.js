(function initializeInstallApp() {
  'use strict';

  const installApp = document.getElementById('installApp');
  const installAppContent = document.getElementById('installAppContent');
  const installAppButton = document.getElementById('installAppButton');
  const installAppShortcut = document.getElementById('installAppShortcut');
  const androidInstallInstructions = document.getElementById('androidInstallInstructions');
  const iosInstallInstructions = document.getElementById('iosInstallInstructions');

  if (!installApp || !installAppContent || !installAppButton || !installAppShortcut
    || !androidInstallInstructions || !iosInstallInstructions || !window.DevicePlatformService) {
    return;
  }

  const platform = window.DevicePlatformService.getPlatform(navigator);
  const isAndroid = platform === 'android';
  const isIos = platform === 'ios';
  const isStandalone = window.DevicePlatformService.isStandalone(
    window.matchMedia('(display-mode: standalone)').matches,
    navigator.standalone
  );

  if (isStandalone || (!isAndroid && !isIos)) {
    return;
  }

  /**
   * Reveals the platform-specific install guidance and quick link.
   * @private
   */
  function showInstallApp() {
    installApp.hidden = false;
    installAppShortcut.hidden = false;
    installAppShortcut.closest('.quick-links-grid')?.classList.add('quick-links-grid--with-install');
  }

  /**
   * Hides and resets the install guidance and quick link.
   * @private
   */
  function hideInstallApp() {
    installApp.hidden = true;
    installApp.open = false;
    installAppShortcut.hidden = true;
    installAppShortcut.closest('.quick-links-grid')?.classList.remove('quick-links-grid--with-install');
    androidInstallInstructions.hidden = true;
    iosInstallInstructions.hidden = true;
  }

  installAppShortcut.addEventListener('click', () => {
    installApp.open = true;
    installApp.scrollIntoView({ behavior: window.shouldReduceMotion() ? 'auto' : 'smooth', block: 'center' });
    installApp.querySelector('summary')?.focus({ preventScroll: true });
  });

  installApp.addEventListener('toggle', () => {
    if (!installApp.open) {
      return;
    }

    if (window.cnslAnalytics) {
      window.cnslAnalytics.trackInteraction(
        AnalyticsInteractionType.INSTALL,
        { action: 'instructions_open' }
      );
    }

    window.requestAnimationFrame(() => {
      const footer = document.querySelector('.footer');
      if (footer) {
        const obscuredHeight = installAppContent.getBoundingClientRect().bottom
          - footer.getBoundingClientRect().top + 16;
        if (obscuredHeight > 0) {
          window.scrollBy({ top: obscuredHeight, behavior: 'instant' });
        }
      }
    });
  });

  if (isIos) {
    installAppButton.hidden = true;
    androidInstallInstructions.hidden = true;
    iosInstallInstructions.hidden = false;
    showInstallApp();
    return;
  }

  let deferredInstallPrompt;

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredInstallPrompt = event;
    installAppButton.hidden = false;
    androidInstallInstructions.hidden = false;
    iosInstallInstructions.hidden = true;
    showInstallApp();
  });

  installAppButton.addEventListener('click', async () => {
    if (!deferredInstallPrompt) {
      return;
    }

    const installPrompt = deferredInstallPrompt;
    deferredInstallPrompt = null;
    if (window.cnslAnalytics) {
      window.cnslAnalytics.trackInteraction(
        AnalyticsInteractionType.INSTALL,
        { action: 'prompt_open' }
      );
    }
    installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (window.cnslAnalytics) {
      window.cnslAnalytics.trackInteraction(
        AnalyticsInteractionType.INSTALL,
        { action: choice.outcome === 'accepted' ? 'prompt_accepted' : 'prompt_dismissed' }
      );
    }
    hideInstallApp();
  });

  window.addEventListener('appinstalled', () => {
    if (window.cnslAnalytics) {
      window.cnslAnalytics.trackInteraction(
        AnalyticsInteractionType.INSTALL,
        { action: 'installed' }
      );
    }
    hideInstallApp();
  });
}());
