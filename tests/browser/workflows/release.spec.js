const { test, expect } = require('../browser-test');
const {
  MOBILE_VIEWPORT,
  initializeAnalyticsRecorder,
  prepareStableWeatherResponses
} = require('../browser-test-helpers');

test.beforeEach(async ({ page }) => {
  await prepareStableWeatherResponses(page);
});

test('[WF-RELEASE-001] release updates are announced once after a stable version is acknowledged', async ({ page }) => {
  await initializeAnalyticsRecorder(page);
  await page.addInitScript(() => {
    if (!localStorage.getItem('cnsl_current_version')) {
      localStorage.setItem('cnsl_current_version', '2.16.1');
    }
  });
  await page.setViewportSize(MOBILE_VIEWPORT);
  await page.goto('/pools.html');
  const currentVersion = await page.evaluate(() => globalThis.APP_VERSION);
  const releaseSeries = currentVersion.split('.').slice(0, 2).join('.');

  const notice = page.locator('#releaseNotice');
  await expect(notice).toBeVisible();
  await expect(notice).toContainText(`App updated to V${releaseSeries}`);
  const closeBox = await page.getByRole('button', { name: 'Dismiss application update' }).boundingBox();
  const menuBox = await page.getByRole('button', { name: 'Open navigation menu' }).boundingBox();
  expect(closeBox.width).toBe(menuBox.width);
  expect(closeBox.x).toBe(menuBox.x);
  await page.getByRole('button', { name: 'Dismiss application update' }).focus();
  await page.keyboard.press('Enter');
  await expect(notice).toBeHidden();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('cnsl_current_version'))).toBe(currentVersion);
  await expect.poll(() => page.evaluate(() => globalThis.recordedAnalyticsEvents.filter(eventArguments => eventArguments[1] === 'ca_banner_interaction' && eventArguments[2].banner_name === 'release_notice'))).toEqual([
    ['event', 'ca_banner_interaction', { banner_name: 'release_notice', banner_action: 'view' }],
    ['event', 'ca_banner_interaction', { banner_name: 'release_notice', banner_action: 'dismiss' }]
  ]);

  await page.goto('/teams.html');
  await expect(page.locator('#releaseNotice')).toBeHidden();

  await page.evaluate(() => localStorage.setItem('cnsl_current_version', '2.0.0'));
  await page.goto('/about.html');
  await expect(page.locator('#releaseNotice')).toBeVisible();
  await page.locator('#releaseNoticeLink').click();
  await expect(page).toHaveURL(/\/whats-new\.html$/);
  await expect(page.getByRole('heading', { name: new RegExp(`^Version ${releaseSeries.replace('.', '\\.')}\\.\\d+ - `) }).first()).toBeVisible();
  await expect(page.locator('#releaseNotice')).toBeHidden();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('cnsl_current_version'))).toBe(currentVersion);
  await expect.poll(() => page.evaluate(() => globalThis.recordedAnalyticsEvents.filter(eventArguments => eventArguments[1] === 'ca_banner_interaction' && eventArguments[2].banner_name === 'release_notice'))).toEqual([
    ['event', 'ca_banner_interaction', { banner_name: 'release_notice', banner_action: 'view' }],
    ['event', 'ca_banner_interaction', { banner_name: 'release_notice', banner_action: 'dismiss' }],
    ['event', 'ca_banner_interaction', { banner_name: 'release_notice', banner_action: 'view' }],
    ['event', 'ca_banner_interaction', { banner_name: 'release_notice', banner_action: 'open' }]
  ]);
});
