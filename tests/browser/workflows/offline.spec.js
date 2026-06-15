const { test, expect } = require('../browser-test');
const {
  prepareStableWeatherResponses
} = require('../browser-test-helpers');

test.beforeEach(async ({ page }) => {
  await prepareStableWeatherResponses(page);
});

test('[WF-OFFLINE-001] loaded directory features remain usable while offline status is announced', async ({ page, context }) => {
  await page.goto('/teams.html');
  await expect(page.locator('#teamListStatus')).toContainText('Team directory loaded.');
  await expect(page.locator('#connectivityStatus')).toBeHidden();

  await context.setOffline(true);
  await expect(page.locator('#connectivityStatus')).toBeVisible();
  await expect(page.locator('#connectivityStatus')).toContainText("You're offline");
  await expect(page.locator('#connectivityStatus')).toContainText('Schedules you opened earlier are still available.');
  await page.locator('.team-card').first().locator('.team-header__toggle').click();
  await expect(page.locator('.team-card').first().locator('.team-details')).toBeVisible();

  await context.setOffline(false);
  await expect(page.locator('#connectivityStatus')).toBeHidden();
});
