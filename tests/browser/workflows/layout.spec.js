const { test, expect } = require('../browser-test');
const {
  MOBILE_VIEWPORT,
  prepareStableWeatherResponses
} = require('../browser-test-helpers');

test.beforeEach(async ({ page }) => {
  await prepareStableWeatherResponses(page);
});

test('[WF-LAYOUT-001] mobile pages retain the shared viewport gutter', async ({ page }) => {
  await page.setViewportSize(MOBILE_VIEWPORT);
  await page.goto('/swim-meet-resources.html');

  await expect(page.locator('#mainContent')).toHaveCSS('padding-left', '12px');
  await expect(page.locator('#mainContent')).toHaveCSS('padding-right', '12px');
});

test('[WF-LAYOUT-002] shared attention notice appears directly below the header', async ({ page }) => {
  await page.setViewportSize(MOBILE_VIEWPORT);
  await page.goto('/pools.html');

  const notice = page.getByRole('alert', { name: 'Pool status notice' });
  const timestamp = notice.locator('time');

  await expect(notice).toBeVisible();
  await expect(notice).not.toContainText('Attention');
  await expect(notice).toContainText('Some pools may be shown as "Closed for the season" on the official CA website at this time. This may be due to pre-season schedules until the main schedule starts June 20.');
  await expect(timestamp).toHaveAttribute('datetime', '2026-06-15T12:31:18-04:00');
  await expect(timestamp).toHaveText('June 15, 2026 at 12:31 PM');

  const positions = await page.locator('.header, #attentionBanner').evaluateAll(elements => elements.map(element => element.getBoundingClientRect()));
  expect(Math.round(positions[1].top)).toBe(Math.round(positions[0].bottom));

  const closeButton = page.getByRole('button', { name: 'Dismiss attention notice' });
  await expect(closeButton).toBeVisible();
  await closeButton.focus();
  await expect(closeButton).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(notice).toBeHidden();
  await expect.poll(() => page.evaluate(() => localStorage.getItem(globalThis.APP_ATTENTION_NOTICE_DISMISSED_STORAGE_KEY)))
    .toBe('2026-06-15T12:31:18-04:00');

  await page.reload();
  await expect(notice).toBeHidden();
});

test('[WF-LAYOUT-003] non-dismissible attention notice remains visible without a close control', async ({ page }) => {
  await page.route('**/js/config/app-config.js*', async route => {
    const response = await route.fetch();
    const body = (await response.text()).replace('DISMISSIBLE: true', 'DISMISSIBLE: false');
    await route.fulfill({ response, body });
  });
  await page.addInitScript(() => localStorage.setItem('cnsl_attention_notice_dismissed', '2026-06-15T12:31:18-04:00'));
  await page.goto('/pools.html');

  await expect(page.locator('#attentionBanner')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Dismiss attention notice' })).toBeHidden();
});

test('[WF-LAYOUT-004] attention notice expires at the configured Eastern deadline', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-06-19T23:59:58-04:00') });
  await page.goto('/pools.html');

  const notice = page.locator('#attentionBanner');
  await expect(notice).toBeVisible();

  await page.clock.fastForward(1001);
  await expect(notice).toBeHidden();

  await page.reload();
  await expect(notice).toBeHidden();
});
