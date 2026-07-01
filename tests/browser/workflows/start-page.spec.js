const { test, expect } = require('../browser-test');
const { prepareStableWeatherResponses, seedPreferences } = require('../browser-test-helpers');

test.beforeEach(async ({ page }) => {
  await prepareStableWeatherResponses(page);
});

test('[WF-START-PAGE-001] clean root launches use the saved page while explicit Home remains available', async ({ page }) => {
  await page.addInitScript(() => {
    const HOME_PAINT_STORAGE_KEY = 'test_home_painted_before_start_page';
    const recordVisibleHomeView = () => {
      const storedPreferences = JSON.parse(
        globalThis.localStorage.getItem('cnsl_preferences') || '{}'
      );
      const isRedirectingRoot = globalThis.location.pathname === '/'
        && storedPreferences.startPage === 'pools';
      const mainContent = globalThis.document.getElementById('mainContent');
      if (isRedirectingRoot
        && mainContent
        && globalThis.getComputedStyle(globalThis.document.body).visibility !== 'hidden') {
        globalThis.sessionStorage.setItem(HOME_PAINT_STORAGE_KEY, 'true');
      }
    };

    new globalThis.MutationObserver(recordVisibleHomeView).observe(globalThis.document, {
      attributes: true,
      childList: true,
      subtree: true
    });
  });
  await seedPreferences(page, { startPage: 'pools' });

  await page.goto('/');
  await expect(page).toHaveURL(/\/pools\.html$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Pools' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => (
    globalThis.sessionStorage.getItem('test_home_painted_before_start_page')
  ))).toBeNull();
  await expect(page.locator('html')).not.toHaveAttribute('data-start-page-pending');

  await page.goto('/index.html');
  await expect(page).toHaveURL(/\/index\.html$/);
  await expect(page.getByRole('heading', { level: 1, name: 'CA Outdoor Pools & CNSL Swim Teams' })).toBeVisible();
});

test('[WF-START-PAGE-002] invalid stored preferences leave a clean root launch on Home', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('cnsl_preferences', '{invalid'));

  await page.goto('/');

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { level: 1, name: 'CA Outdoor Pools & CNSL Swim Teams' })).toBeVisible();
  await expect(page.locator('html')).not.toHaveAttribute('data-start-page-pending');
});
