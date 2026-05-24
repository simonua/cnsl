(function initializeInstallApp() {
  'use strict';

  const installApp = document.getElementById('installApp');
  const installAppContent = document.getElementById('installAppContent');
  const installAppButton = document.getElementById('installAppButton');
  const iosInstallInstructions = document.getElementById('iosInstallInstructions');

  if (!installApp || !installAppContent || !installAppButton || !iosInstallInstructions) {
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
    installApp.open = false;
    iosInstallInstructions.hidden = true;
  }

  installApp.addEventListener('toggle', () => {
    if (!installApp.open) {
      return;
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
    iosInstallInstructions.hidden = false;
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