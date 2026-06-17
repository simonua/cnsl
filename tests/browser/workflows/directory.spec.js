const { test, expect } = require('../browser-test');
const {
  prepareStableWeatherResponses
} = require('../browser-test-helpers');
const { directoryScenarios } = require('./workflow-scenarios');

test.beforeEach(async ({ page }) => {
  await prepareStableWeatherResponses(page);
});

test('[WF-DIR-001] directory disclosures work without rendered inline event handlers', async ({ page }) => {
  await page.goto('/pools.html');
  await expect(page.locator('#poolListStatus')).toContainText('Pool directory loaded.');
  const poolToggle = page.locator('.pool-header__toggle').first();
  await expect(poolToggle).toHaveAttribute('aria-expanded', 'false');
  await poolToggle.click();
  await expect(poolToggle).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#poolList [onclick], #poolList [onerror]')).toHaveCount(0);

  await page.goto('/teams.html');
  await expect(page.locator('#teamListStatus')).toContainText('Team directory loaded.');
  const teamToggle = page.locator('.team-header__toggle').first();
  await expect(teamToggle).toHaveAttribute('aria-expanded', 'false');
  await teamToggle.click();
  await expect(teamToggle).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#teamList [onclick], #teamList [onerror]')).toHaveCount(0);

  await page.goto('/meets.html');
  await expect(page.locator('#meetListStatus')).toContainText('Meet schedule loaded.');
  const meetToggle = page.locator('.meet-date-header__toggle').first();
  const initiallyExpanded = await meetToggle.getAttribute('aria-expanded');
  await meetToggle.click();
  await expect(meetToggle).toHaveAttribute('aria-expanded', String(initiallyExpanded !== 'true'));
  await expect(page.locator('#meetList [onclick], #meetList [onerror]')).toHaveCount(0);
});

for (const scenario of directoryScenarios) {
  test(`[WF-DIR-002-${scenario.reference}] ${scenario.path} directory tiles point, stay still, and expand from their surface`, async ({ page }) => {
    await page.goto(scenario.path);
    await expect(page.locator(scenario.list)).toHaveAttribute('aria-busy', 'false');
    await expect(page.locator(`${scenario.list} ${scenario.item}`).first()).toBeVisible();

    const surface = page.locator(scenario.surface).first();
    const toggle = surface.locator(scenario.toggle);
    await expect(surface).toBeVisible();
    const detailsId = await toggle.getAttribute('aria-controls');
    const stableToggle = page.locator(`${scenario.toggle}[aria-controls="${detailsId}"]`);
    expect(await surface.evaluate(element => element.ownerDocument.defaultView.getComputedStyle(element).cursor)).toBe('pointer');

    await surface.hover();
    expect(await surface.evaluate(element => element.ownerDocument.defaultView.getComputedStyle(element).transform)).toBe('none');

    await expect(stableToggle).toHaveAttribute('aria-expanded', 'false');
    await surface.evaluate(element => {
      element.classList.remove('collapsed');
      element.click();
    });
    await expect(stableToggle).toHaveAttribute('aria-expanded', 'true');
  });
}
