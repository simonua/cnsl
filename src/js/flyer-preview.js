// Controls the local flyer preview dialog and restores focus after dismissal.

document.addEventListener('DOMContentLoaded', () => {
  const previewButton = document.getElementById('flyerPreviewButton');
  const dialog = document.getElementById('flyerDialog');
  const closeButton = document.getElementById('flyerDialogClose');

  if (!previewButton || !dialog || !closeButton) return;

  previewButton.addEventListener('click', () => {
    if (!dialog.open) dialog.showModal();
  });

  closeButton.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener('close', () => previewButton.focus());
});
