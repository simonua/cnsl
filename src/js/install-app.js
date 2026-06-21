(function initializeInstallApp() {
  'use strict';

  const androidInstallOption = document.getElementById('androidInstallOption');
  const appleInstallOption = document.getElementById('appleInstallOption');
  const installAppButton = document.getElementById('installAppButton');
  const installAppStatus = document.getElementById('installAppStatus');

  if (!androidInstallOption || !appleInstallOption || !installAppButton || !installAppStatus
    || !window.DevicePlatformService) {
    return;
  }

  const platform = window.DevicePlatformService.getPlatform(navigator);
  const isAndroid = platform === 'android';
  const isStandalone = window.DevicePlatformService.isStandalone(
    window.matchMedia('(display-mode: standalone)').matches,
    navigator.standalone
  );

  androidInstallOption.open = isAndroid;
  appleInstallOption.open = platform === 'ios';

  /**
   * Closes the alternate platform when one instruction tile opens.
   * @param {HTMLDetailsElement} openedOption - Platform tile that may have opened
   * @param {HTMLDetailsElement} alternateOption - Platform tile to collapse
   * @private
   */
  function keepOnlyOptionOpen(openedOption, alternateOption) {
    if (openedOption.open) alternateOption.open = false;
  }

  androidInstallOption.addEventListener('toggle', () => {
    keepOnlyOptionOpen(androidInstallOption, appleInstallOption);
  });
  appleInstallOption.addEventListener('toggle', () => {
    keepOnlyOptionOpen(appleInstallOption, androidInstallOption);
  });

  /**
   * Publishes an approved coarse install stage when analytics is available.
   * @param {string} action - Approved install action
   * @private
   */
  function trackInstallAction(action) {
    if (window.cnslAnalytics) {
      window.cnslAnalytics.trackInteraction(
        AnalyticsInteractionType.INSTALL,
        { action }
      );
    }
  }

  /**
   * Announces the current installation result without moving focus.
   * @param {string} message - Visitor-facing installation result
   * @private
   */
  function showInstallStatus(message) {
    installAppStatus.textContent = message;
    installAppStatus.hidden = false;
  }

  if (isStandalone) {
    showInstallStatus('The web app is already open as an installed app on this device.');
    return;
  }

  let deferredInstallPrompt;

  window.addEventListener('beforeinstallprompt', event => {
    if (!isAndroid) return;

    event.preventDefault();
    deferredInstallPrompt = event;
    installAppButton.hidden = false;
  });

  installAppButton.addEventListener('click', async () => {
    if (!deferredInstallPrompt) {
      return;
    }

    const installPrompt = deferredInstallPrompt;
    deferredInstallPrompt = null;
    installAppButton.hidden = true;
    trackInstallAction('prompt_open');
    let choice;
    try {
      await installPrompt.prompt();
      choice = await installPrompt.userChoice;
    } catch {
      showInstallStatus('The browser prompt is unavailable. You can use the browser menu steps below instead.');
      return;
    }
    if (choice.outcome === 'accepted') {
      trackInstallAction('prompt_accepted');
      showInstallStatus('Thanks. Your browser is finishing the installation.');
    } else {
      trackInstallAction('prompt_dismissed');
      showInstallStatus('Installation was not completed. You can use the browser menu steps below to try again.');
    }
  });

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    installAppButton.hidden = true;
    trackInstallAction('installed');
    showInstallStatus('The web app is installed and ready to open from your Home Screen.');
  });
}());
