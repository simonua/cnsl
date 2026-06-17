const { test, expect } = require('../browser-test');
const {
  getOffSeasonReferenceTime,
  prepareStableWeatherResponses
} = require('../browser-test-helpers');

test.beforeEach(async ({ page }) => {
  await prepareStableWeatherResponses(page);
});

test('[WF-SEASON-001] off-season pages replace date-sensitive content with the shared season message', async ({ page }) => {
  await page.clock.setFixedTime(getOffSeasonReferenceTime());

  const routes = [
    { path: '/index.html', seasonalSelector: '.home-view' },
    { path: '/pools.html', seasonalSelector: '#poolList' },
    { path: '/teams.html', seasonalSelector: '#teamList' },
    { path: '/meets.html', seasonalSelector: '#meetList' }
  ];

  for (const route of routes) {
    await page.goto(route.path);
    const message = page.locator('.off-season-message');
    await expect(message).toBeVisible();
    await expect(message.getByRole('heading')).toBeVisible();
    await expect(message.locator('p').first()).toBeVisible();
    await expect(page.locator(route.seasonalSelector)).toBeHidden();
  }

  await expect(page.getByRole('heading', { name: 'Meet Schedule', exact: true })).toBeVisible();
  await expect(page.locator('#meetList')).toBeHidden();
});
