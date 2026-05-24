(function initializeInstallApp() {
  'use strict';

  const installApp = document.getElementById('installApp');
  const installAppButton = document.getElementById('installAppButton');
  const iosInstallInstructions = document.getElementById('iosInstallInstructions');

  if (!installApp || !installAppButton || !iosInstallInstructions) {
    return;
  }

  const userAgent = navigator.userAgent;
  const isAndroid = /Android/i.test(userAgent);
  const isIos = /iPhone|iPad|iPod/i.test(userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches
    || navigator.standalone === true;

  if (isStandalone || (!isAndroid && !isIos)) {
    return;
  }

  function showInstallApp() {
    installApp.hidden = false;
  }

  function hideInstallApp() {
    installApp.hidden = true;
    iosInstallInstructions.hidden = true;
  }

  if (isIos) {
    installAppButton.textContent = 'Add to Home Screen';
    installAppButton.setAttribute('aria-controls', 'iosInstallInstructions');
    installAppButton.setAttribute('aria-expanded', 'false');
    installAppButton.addEventListener('click', () => {
      iosInstallInstructions.hidden = false;
      installAppButton.setAttribute('aria-expanded', 'true');
      iosInstallInstructions.focus();
    });
    showInstallApp();
    return;
  }

  let deferredInstallPrompt;

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredInstallPrompt = event;
    showInstallApp();
  });

  installAppButton.addEventListener('click', async () => {
    if (!deferredInstallPrompt) {
      return;
    }

    const installPrompt = deferredInstallPrompt;
    deferredInstallPrompt = null;
    installPrompt.prompt();
    await installPrompt.userChoice;
    hideInstallApp();
  });

  window.addEventListener('appinstalled', hideInstallApp);
}());