const { test, expect } = require('../browser-test');
const {
  MOBILE_VIEWPORT,
  initializeAnalyticsRecorder,
  prepareStableWeatherResponses
} = require('../browser-test-helpers');

test.beforeEach(async ({ page }) => {
  await prepareStableWeatherResponses(page);
});

test('[WF-RESOURCES-001] flyer preview can be closed and restores thumbnail focus', async ({ page }) => {
  await page.setViewportSize(MOBILE_VIEWPORT);
  await page.goto('/swim-meet-resources.html');

  const previewButton = page.getByRole('button', { name: 'Preview the CA Pool and CNSL Assistant flyer (PDF)' });
  await previewButton.click();

  const dialog = page.getByRole('dialog', { name: 'Web App Flyer' });
  await expect(dialog).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(dialog).not.toBeVisible();
  await expect(previewButton).toBeFocused();
});

test('[WF-RESOURCES-002] resource views and downloads publish only reviewed document names', async ({ page }) => {
  await initializeAnalyticsRecorder(page);
  await page.goto('/swim-meet-resources.html');

  const clickWithoutNavigation = locator => locator.evaluate(element => {
    element.addEventListener('click', event => event.preventDefault(), { once: true });
    element.click();
  });

  await clickWithoutNavigation(page.getByRole('link', { name: 'View PDF' }).first());
  await clickWithoutNavigation(page.getByRole('link', { name: 'Download' }).nth(3));
  await page.getByRole('button', { name: 'Preview the CA Pool and CNSL Assistant flyer (PDF)' }).click();
  await clickWithoutNavigation(page.getByRole('dialog', { name: 'Web App Flyer' }).getByRole('link', { name: 'download the flyer PDF' }));

  await expect.poll(() => page.evaluate(() => globalThis.recordedAnalyticsEvents.filter(eventArguments => (
    eventArguments[1] === 'ca_resource_view' || eventArguments[1] === 'ca_resource_download'
  )))).toEqual([
    ['event', 'ca_resource_view', { resource_name: 'judge' }],
    ['event', 'ca_resource_download', { resource_name: 'line_up_aid' }],
    ['event', 'ca_resource_view', { resource_name: 'web_app_flyer' }],
    ['event', 'ca_resource_download', { resource_name: 'web_app_flyer' }]
  ]);

  const judgeView = page.getByRole('link', { name: 'View PDF' }).first();
  await judgeView.evaluate(link => {
    link.dataset.analyticsResourceName = 'injected_document';
    link.dataset.analyticsResourceAction = 'injected_action';
    link.addEventListener('click', event => event.preventDefault(), { once: true });
    link.click();
  });
  await expect.poll(() => page.evaluate(() => globalThis.recordedAnalyticsEvents.filter(eventArguments => (
    eventArguments[1] === 'ca_resource_view' || eventArguments[1] === 'ca_resource_download'
  )).length)).toBe(4);
});
