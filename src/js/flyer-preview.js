// Controls the local flyer preview dialog and restores focus after dismissal.

document.addEventListener('DOMContentLoaded', () => {
  const previewButton = document.getElementById('flyerPreviewButton');
  const dialog = document.getElementById('flyerDialog');
  const closeButton = document.getElementById('flyerDialogClose');
  const documentFrame = dialog?.querySelector('.flyer-dialog__document');

  if (!previewButton || !dialog || !closeButton || !documentFrame) return;

  previewButton.addEventListener('click', () => {
    if (!documentFrame.hasAttribute('src') && documentFrame.dataset.documentSrc) {
      documentFrame.src = documentFrame.dataset.documentSrc;
    }
    if (!dialog.open) dialog.showModal();
  });

  closeButton.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener('close', () => previewButton.focus());
});
