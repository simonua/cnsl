const { test, expect } = require('../browser-test');
const {
  prepareStableWeatherResponses,
  routeAnnualData,
  routeAnnualDataFixture,
  seedPreferences
} = require('../browser-test-helpers');
const { createTestDataScenario } = require('../fixtures/test-data.js');

const { teams } = createTestDataScenario();
const URL_ACTION_TEAM = teams.externalActionTeam;

test.beforeEach(async ({ page }) => {
  await prepareStableWeatherResponses(page);
  await routeAnnualDataFixture(page, ['meets', 'pools', 'teams']);
});

test('[WF-SECURITY-001] pool directory encodes text and rejects unsafe published destinations', async ({ page }) => {
  await routeAnnualData(page, 'pools', poolData => {
    poolData.pools[0].name = '<img data-injected="true">Unsafe Pool';
    poolData.pools[0].caUrl = 'javascript:alert(1)';
    poolData.pools[0].phone = '410-555-0100 onclick=alert(1)';
  });

  await page.goto('/pools.html');
  await expect(page.locator('#poolList')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('.pool-header__toggle').filter({ hasText: '<img data-injected="true">Unsafe Pool' })).toBeVisible();
  await expect(page.locator('[data-injected="true"]')).toHaveCount(0);
  await expect(page.locator('a[href^="javascript:"]')).toHaveCount(0);
  await expect(page.locator('.phone-link').filter({ hasText: 'onclick=alert' })).toHaveCount(0);
});

test('[WF-SECURITY-002] team directory rejects unsafe published action destinations', async ({ page }) => {
  await seedPreferences(page, { favoriteTeamId: URL_ACTION_TEAM.id });
  await routeAnnualData(page, 'teams', teamData => {
    const targetTeam = teamData.teams.find(team => team.id === URL_ACTION_TEAM.id);
    targetTeam.calendarUrl = 'data:text/html,unsafe';
    targetTeam.merchandiseUrl = 'javascript:alert(1)';
    targetTeam.eventsSubscriptionUrl = 'javascript:alert(1)';
    targetTeam.booster.url = 'javascript:alert(1)';
  });

  await page.goto('/teams.html');
  await expect(page.locator('#teamList')).toHaveAttribute('aria-busy', 'false');
  const targetTeam = page.locator(`.team-card[data-team-id="${URL_ACTION_TEAM.id}"]`);
  await expect(targetTeam.locator('.team-merchandise')).toHaveCount(0);
  await expect(targetTeam.getByRole('link', { name: 'Subscribe to team events calendar' })).toHaveCount(0);
  await expect(targetTeam.getByRole('link', { name: 'Team Calendar' })).toHaveCount(0);
  await expect(targetTeam.getByRole('link', { name: /Booster Club/ })).toHaveCount(0);
  await expect(page.locator('a[href^="javascript:"]')).toHaveCount(0);

  await page.goto('/index.html');
  await expect(page.locator('#favoriteWeek')).toBeVisible();
  await expect(page.locator('#favoriteTeamCalendarActions')).toBeHidden();
  await expect(page.locator('#favoriteWeek').getByRole('link', { name: 'Team Calendar' })).toHaveCount(0);
  await expect(page.locator('#favoriteWeek').getByRole('link', { name: 'Subscribe to team events calendar' })).toHaveCount(0);
});
