const { test, expect } = require('../browser-test');
const AppConfig = require('../../../scripts/adapters/app-config.js');
const {
  prepareStableWeatherResponses
} = require('../browser-test-helpers');

test.beforeEach(async ({ page }) => {
  await prepareStableWeatherResponses(page);
});

test('[WF-CONTACT-001] author contact options are collected on the About & Contact page', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push({ name: error.name, message: error.message }));

  await page.goto('/');
  await page.getByRole('link', { name: 'Send Feedback' }).click();
  await expect(page).toHaveURL(/\/about\.html#contact$/);

  await expect(page.getByRole('heading', { level: 1, name: 'About & Contact' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'Contact Me' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'General feedback' })).toHaveAttribute('href', 'mailto:simonkurtz+pool-app@gmail.com?subject=CA%20Pool%20%26%20CNSL%20Assistant%20-%20Feedback');
  await expect(page.getByRole('link', { name: 'Report a bug or request a feature' })).toHaveAttribute('href', AppConfig.EXTERNAL_LINKS.AUTHOR_BUG_FEATURE_EMAIL_URL);
  await expect(page.getByRole('link', { name: 'Report a data issue' })).toHaveAttribute('href', 'mailto:simonkurtz+pool-app@gmail.com?subject=CA%20Pool%20%26%20CNSL%20Assistant%20-%20Data');
  await expect(page.getByRole('link', { name: 'connect with me on LinkedIn (opens in new tab)' })).toHaveAttribute('href', 'https://www.linkedin.com/in/simonkurtz');
  await expect(page.getByRole('link', { name: 'send me a direct message through Messenger (opens in new tab)' })).toHaveAttribute('href', 'https://www.facebook.com/simonkurtz82');
  expect(pageErrors).toEqual([]);
});

test('[WF-CONTACT-002] retired Contact page points bookmarks to the canonical contact section', async ({ page }) => {
  await page.goto('/contact.html');

  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `${AppConfig.HOME_PAGE_URL}/about.html`);
  await expect(page.getByRole('link', { name: 'Go to About & Contact' })).toHaveAttribute('href', 'about.html#contact');
});
