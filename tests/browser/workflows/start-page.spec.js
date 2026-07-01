const { test, expect } = require('../browser-test');
const { prepareStableWeatherResponses, seedPreferences } = require('../browser-test-helpers');

test.beforeEach(async ({ page }) => {
  await prepareStableWeatherResponses(page);
});

test('[WF-START-PAGE-001] clean root launches use the saved page while explicit Home remains available', async ({ page }) => {
  await seedPreferences(page, { startPage: 'pools' });

  await page.goto('/');
  await expect(page).toHaveURL(/\/pools\.html$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Pools' })).toBeVisible();

  await page.goto('/index.html');
  await expect(page).toHaveURL(/\/index\.html$/);
  await expect(page.getByRole('heading', { level: 1, name: 'CA Outdoor Pools & CNSL Swim Teams' })).toBeVisible();
});

test('[WF-START-PAGE-002] invalid stored preferences leave a clean root launch on Home', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('cnsl_preferences', '{invalid'));

  await page.goto('/');

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { level: 1, name: 'CA Outdoor Pools & CNSL Swim Teams' })).toBeVisible();
});
