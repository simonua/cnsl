const { test, expect } = require('@playwright/test');

async function prepareStableWeatherResponses(page) {
  await page.route('https://api.weather.gov/**', async route => {
    const requestUrl = route.request().url();
    if (requestUrl.includes('/alerts/')) {
      await route.fulfill({ json: { features: [] } });
      return;
    }
    if (requestUrl.includes('/points/')) {
      await route.fulfill({ json: { properties: { forecast: 'https://api.weather.gov/gridpoints/test' } } });
      return;
    }
    await route.fulfill({ json: { properties: { periods: [] } } });
  });
}

test.beforeEach(async ({ page }) => {
  await prepareStableWeatherResponses(page);
});

test('navigation contains keyboard focus and restores it when dismissed', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/pools.html');
  await expect(page.locator('#poolListStatus')).toContainText('Pool directory loaded.');

  const toggle = page.getByRole('button', { name: 'Open navigation menu' });
  await toggle.focus();
  await page.keyboard.press('Enter');

  await expect(page.getByRole('button', { name: 'Close navigation menu' })).toBeFocused();
  await expect(page.locator('#navMenu')).toHaveAttribute('aria-hidden', 'false');
  await expect(page.locator('#mainContent')).toHaveJSProperty('inert', true);

  await page.keyboard.press('Tab');
  await expect(page.locator('#navMenu a').first()).toBeFocused();
  await page.locator('#navMenu a').last().focus();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Close navigation menu' })).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Open navigation menu' })).toBeFocused();
  await expect(page.locator('#mainContent')).toHaveJSProperty('inert', false);
});

for (const scenario of [
  { path: '/pools.html', list: '#poolList', status: '#poolListStatus', message: /Pool directory loaded\. 23 pools available\./ },
  { path: '/teams.html', list: '#teamList', status: '#teamListStatus', message: /Team directory loaded\./ },
  { path: '/meets.html', list: '#meetList', status: '#meetListStatus', message: /Meet schedule loaded\./ }
]) {
  test(`${scenario.path} announces completed directory loading`, async ({ page }) => {
    await page.goto(scenario.path);
    await expect(page.locator(scenario.status)).toHaveText(scenario.message);
    await expect(page.locator(scenario.list)).toHaveAttribute('aria-busy', 'false');
  });
}

test('pool load failures are announced and do not leave the directory busy', async ({ page }) => {
  await page.route('**/assets/data/2026/pools/pools.json*', route => route.fulfill({ status: 503, body: '{}' }));
  await page.goto('/pools.html');

  await expect(page.locator('#poolListStatus')).toHaveText('Pool information is currently unavailable. Please try again later.');
  await expect(page.locator('#poolList')).toHaveAttribute('aria-busy', 'false');
});

test('pool feature filters expose their state and resulting count', async ({ page }) => {
  await page.goto('/pools.html');
  await expect(page.locator('#poolListStatus')).toContainText('Pool directory loaded.');

  const filters = page.locator('#togglePoolFeatureFilters');
  await filters.click();
  await expect(filters).toHaveAttribute('aria-expanded', 'true');
  await page.locator('input[name="poolFeature"]').first().check();

  await expect(page.locator('#poolFilterSummary')).toHaveText(/Showing \d+ of 23 pools/);
  await expect(page.locator('#poolFeatureFilterCount')).toHaveText('1 selected');
});

test('directory disclosures work without rendered inline event handlers', async ({ page }) => {
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

test('pool directory encodes text and rejects unsafe published destinations', async ({ page }) => {
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

test('settings persist choices locally and announce clearing saved settings', async ({ page }) => {
  await page.goto('/settings.html');
  await expect(page.locator('#favoritePool')).toBeEnabled();

  await page.getByLabel('Dark').check();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('cnsl_preferences')).theme)).toBe('dark');
  await expect(page.getByLabel('Share anonymous page usage through Google Analytics')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => Object.hasOwn(JSON.parse(localStorage.getItem('cnsl_preferences')), 'analyticsEnabled'))).toBe(false);
  await expect(page.locator('#cnslAnalyticsScript')).toHaveCount(0);

  await page.getByRole('button', { name: 'Clear saved settings' }).click();
  await expect(page.locator('#settingsStatus')).toHaveText('Saved settings removed from this device.');
});