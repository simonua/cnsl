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
  const flyerRequests = [];
  page.on('request', request => {
    if (new URL(request.url()).pathname.endsWith('/ca-pool-cnsl-assistant-flyer.pdf')) {
      flyerRequests.push(request.url());
    }
  });
  await page.goto('/swim-meet-resources.html');

  const previewButton = page.getByRole('button', { name: 'Preview the CA Pool and CNSL Assistant flyer (PDF)' });
  const documentFrame = page.getByTitle('CA Pool and CNSL Assistant flyer PDF');
  expect(flyerRequests).toHaveLength(0);
  await expect(documentFrame).not.toHaveAttribute('src');
  await previewButton.click();

  const dialog = page.getByRole('dialog', { name: 'Web App Flyer' });
  await expect(dialog).toBeVisible();
  await expect(documentFrame).toHaveAttribute('src', 'assets/swim-meet-resources/ca-pool-cnsl-assistant-flyer.pdf');
  await expect.poll(() => flyerRequests.length).toBe(1);
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

test('[WF-RESOURCES-003] arm-marking guidance uses the mobile image without overflowing', async ({ page }) => {
  await page.setViewportSize(MOBILE_VIEWPORT);
  await page.goto('/swim-meet-resources.html#arm-markings');

  const guide = page.locator('#arm-markings');
  const introduction = page.locator('.resources-introduction');
  const image = guide.getByRole('img', { name: /Event, Heat, and Lane columns/ });

  await expect(guide).toHaveClass(/resource-card--arm-marking/);
  await expect(guide.getByRole('heading', { name: 'Mark Swimmer Arms' })).toBeVisible();
  await expect(guide).toContainText('at home before leaving for the meet');
  await expect(guide).toContainText("arm must be completely dry");
  await expect(guide.locator('ol > li').nth(1)).toContainText("relay position in parentheses");
  await expect.poll(() => introduction.evaluate(element => {
    const guideElement = document.getElementById('arm-markings');
    const introductionBounds = element.getBoundingClientRect();
    const guideBounds = guideElement.getBoundingClientRect();
    const styles = getComputedStyle(element);
    return {
      leftInset: Math.round(introductionBounds.left - guideBounds.left),
      rightInset: Math.round(guideBounds.right - introductionBounds.right),
      paddingLeft: Math.round(Number.parseFloat(styles.paddingLeft)),
      paddingRight: Math.round(Number.parseFloat(styles.paddingRight))
    };
  })).toEqual({
    leftInset: 0,
    rightInset: 0,
    paddingLeft: 24,
    paddingRight: 24
  });
  await expect(image).toBeVisible();
  await expect.poll(() => image.evaluate(element => ({
    complete: element.complete,
    currentSourcePath: element.currentSrc ? new URL(element.currentSrc).pathname : '',
    naturalWidth: element.naturalWidth
  }))).toEqual({
    complete: true,
    currentSourcePath: '/assets/images/event-heat-lane-arm-markings-mobile.jpg',
    naturalWidth: 640
  });
  await expect.poll(() => guide.evaluate(element => {
    const bounds = element.getBoundingClientRect();
    return bounds.left >= 0 && bounds.right <= globalThis.innerWidth;
  })).toBe(true);
});
