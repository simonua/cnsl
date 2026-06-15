const { test, expect } = require('../browser-test');
const {
  prepareStableWeatherResponses
} = require('../browser-test-helpers');

test.beforeEach(async ({ page }) => {
  await prepareStableWeatherResponses(page);
});

test('[WF-SECURITY-001] pool directory encodes text and rejects unsafe published destinations', async ({ page }) => {
  await page.route('**/assets/data/2026/pools/pools.json*', async route => {
    const response = await route.fetch();
    const poolData = await response.json();
    poolData.pools[0].name = '<img data-injected="true">Unsafe Pool';
    poolData.pools[0].caUrl = 'javascript:alert(1)';
    poolData.pools[0].phone = '410-555-0100 onclick=alert(1)';
    await route.fulfill({ response, json: poolData });
  });

  await page.goto('/pools.html');
  await expect(page.locator('#poolListStatus')).toContainText('Pool directory loaded.');
  await expect(page.locator('.pool-header__toggle').filter({ hasText: '<img data-injected="true">Unsafe Pool' })).toBeVisible();
  await expect(page.locator('[data-injected="true"]')).toHaveCount(0);
  await expect(page.locator('a[href^="javascript:"]')).toHaveCount(0);
  await expect(page.locator('.phone-link').filter({ hasText: 'onclick=alert' })).toHaveCount(0);
});

test('[WF-SECURITY-002] team directory rejects unsafe published action destinations', async ({ page }) => {
  await page.route('**/assets/data/2026/teams/teams.json*', async route => {
    const response = await route.fetch();
    const teamData = await response.json();
    const marlins = teamData.teams.find(team => team.id === 'lrm');
    marlins.merchandiseUrl = 'javascript:alert(1)';
    marlins.eventsSubscriptionUrl = 'javascript:alert(1)';
    marlins.booster.url = 'javascript:alert(1)';
    await route.fulfill({ response, json: teamData });
  });

  await page.goto('/teams.html');
  await expect(page.locator('#teamListStatus')).toContainText('Team directory loaded.');
  const marlins = page.locator('.team-card[data-team-id="lrm"]');
  await expect(marlins.locator('.team-merchandise')).toHaveCount(0);
  await expect(marlins.getByRole('link', { name: 'Subscribe to team events calendar' })).toHaveCount(0);
  await expect(marlins.getByRole('link', { name: /Booster Club/ })).toHaveCount(0);
  await expect(page.locator('a[href^="javascript:"]')).toHaveCount(0);
});
