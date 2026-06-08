(function initializeHomeShare() {
  'use strict';

  const openButton = document.getElementById('shareQrButton');
  const dialog = document.getElementById('shareQrDialog');
  const closeButton = document.getElementById('closeShareQrDialog');
  if (!openButton || !dialog || !closeButton) return;

  openButton.addEventListener('click', () => {
    if (!dialog.open) dialog.showModal();
  });

  closeButton.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    if (event.target === dialog) dialog.close();
  });
}());
