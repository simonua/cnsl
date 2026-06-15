const { test, expect } = require('../browser-test');
const {
  MOBILE_VIEWPORT,
  prepareStableWeatherResponses
} = require('../browser-test-helpers');

test.beforeEach(async ({ page }) => {
  await prepareStableWeatherResponses(page);
});

test('[WF-NAV-001] navigation contains keyboard focus and restores it when dismissed', async ({ page }) => {
  await page.setViewportSize(MOBILE_VIEWPORT);
  await page.goto('/about.html');

  const toggle = page.getByRole('button', { name: 'Open navigation menu' });
  await toggle.focus();
  await page.keyboard.press('Enter');

  await expect(page.getByRole('button', { name: 'Close navigation menu' })).toBeFocused();
  const navigation = page.locator('#navMenu');
  await expect(navigation).toHaveAttribute('aria-hidden', 'false');
  await expect(navigation).toHaveCSS('transition-property', 'transform, visibility');
  await expect(navigation).toHaveCSS('transition-duration', '0.15s, 0s');
  await expect(navigation).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)');
  await expect(page.getByRole('link', { name: 'Lessons' })).toHaveAttribute('href', 'lessons.html');
  await expect(page.locator('#mainContent')).toHaveJSProperty('inert', true);

  await page.keyboard.press('Tab');
  await expect(page.locator('#navMenu a').first()).toBeFocused();
  await page.locator('#navMenu a').last().focus();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Close navigation menu' })).toBeFocused();

  await page.locator('#navMenu').evaluate(nav => nav.classList.remove('active'));
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Open navigation menu' })).toBeFocused();
  await expect(navigation).toHaveAttribute('aria-hidden', 'true');
  await expect(navigation).toHaveCSS('visibility', 'hidden');
  await expect(page.locator('#mainContent')).toHaveJSProperty('inert', false);
});
