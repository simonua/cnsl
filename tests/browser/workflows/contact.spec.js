const { test, expect } = require('../browser-test');
const {
  prepareStableWeatherResponses
} = require('../browser-test-helpers');

test.beforeEach(async ({ page }) => {
  await prepareStableWeatherResponses(page);
});

test('[WF-CONTACT-001] author contact options are collected on the Contact page', async ({ page }) => {
  await page.goto('/contact.html');
  const appVersion = await page.evaluate(() => globalThis.APP_VERSION);
  const bugFeatureSubject = encodeURIComponent(`CA Pool & CNSL Assistant - Bug / Feature - Version ${appVersion}`);

  await expect(page.getByRole('heading', { level: 1, name: 'Contact' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'General feedback' })).toHaveAttribute('href', 'mailto:simonkurtz+pool-app@gmail.com?subject=CA%20Pool%20%26%20CNSL%20Assistant%20-%20Feedback');
  await expect(page.getByRole('link', { name: 'Report a bug or request a feature' })).toHaveAttribute('href', `mailto:simonkurtz+pool-app@gmail.com?subject=${bugFeatureSubject}`);
  await expect(page.getByRole('link', { name: 'Report a data issue' })).toHaveAttribute('href', 'mailto:simonkurtz+pool-app@gmail.com?subject=CA%20Pool%20%26%20CNSL%20Assistant%20-%20Data');
  await expect(page.getByRole('link', { name: 'Connect with Simon on LinkedIn (opens in new tab)' })).toHaveAttribute('href', 'https://www.linkedin.com/in/simonkurtz');
  await expect(page.getByRole('link', { name: 'Message Simon on Facebook (opens in new tab)' })).toHaveAttribute('href', 'https://www.facebook.com/simonkurtz82');
});
