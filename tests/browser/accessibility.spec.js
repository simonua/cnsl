const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;

const pageScenarios = [
  { name: 'home', path: '/index.html' },
  { name: 'pools', path: '/pools.html', readySelector: '#poolListStatus', readyText: /Pool directory loaded/ },
  { name: 'teams', path: '/teams.html', readySelector: '#teamListStatus', readyText: /Team directory loaded/ },
  { name: 'meets', path: '/meets.html', readySelector: '#meetListStatus', readyText: /Meet schedule loaded/ },
  { name: 'settings', path: '/settings.html', readySelector: '#favoritePool:not([disabled])' },
  { name: 'resources', path: '/swim-meet-resources.html' },
  { name: 'whats new', path: '/whats-new.html' },
  { name: 'about', path: '/about.html' },
  { name: 'faq', path: '/faq.html' },
  { name: 'offline', path: '/offline.html' }
];

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

async function prepareVisibleWeatherAlert(page) {
  await page.unroute('https://api.weather.gov/**');
  await page.route('https://api.weather.gov/**', route => route.fulfill({
    json: { features: [{ properties: { event: 'Severe Thunderstorm Warning' } }] }
  }));
  await page.route('**/assets/data/2026/pools/pools.json*', async route => {
    const response = await route.fetch();
    const data = await response.json();
    data.pools[0].schedules = [{
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      hours: [{
        weekDays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
        types: ['Rec Swim'],
        startTime: '12:00am',
        endTime: '11:59pm'
      }]
    }];
    await route.fulfill({ response, json: data });
  });
}

async function loadScenario(page, scenario, theme) {
  await prepareStableWeatherResponses(page);
  await page.addInitScript(selectedTheme => {
    localStorage.setItem('cnsl_preferences', JSON.stringify({ theme: selectedTheme }));
  }, theme);
  await page.goto(scenario.path);
  if (scenario.readySelector && scenario.readyText) {
    await expect(page.locator(scenario.readySelector)).toHaveText(scenario.readyText);
  } else if (scenario.readySelector) {
    await expect(page.locator(scenario.readySelector)).toBeVisible();
  }
}

for (const theme of ['light', 'dark']) {
  test.describe(`${theme} theme accessibility`, () => {
    for (const scenario of pageScenarios) {
      test(`${scenario.name} has no WCAG A or AA automated violations`, async ({ page }) => {
        await loadScenario(page, scenario, theme);

        const results = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
          .analyze();
        const violations = results.violations.map(violation => ({
          id: violation.id,
          impact: violation.impact,
          targets: violation.nodes.map(node => node.target)
        }));

        expect(violations).toEqual([]);
      });
    }
  });
}

test('location-aware pool sorting has no WCAG A or AA automated violations', async ({ page }) => {
  await prepareStableWeatherResponses(page);
  await page.context().grantPermissions(['geolocation']);
  await page.context().setGeolocation({ latitude: 39.2105, longitude: -76.8721 });
  await page.addInitScript(() => {
    localStorage.setItem('cnsl_preferences', JSON.stringify({ theme: 'dark', locationAwarenessEnabled: true }));
  });
  await page.goto('/pools.html');
  await page.locator('#togglePoolFeatureFilters').click();
  await expect(page.locator('#poolSortControls')).toBeVisible();
  await page.selectOption('#poolSortOrder', 'distance');

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const violations = results.violations.map(violation => ({
    id: violation.id,
    impact: violation.impact,
    targets: violation.nodes.map(node => node.target)
  }));

  expect(violations).toEqual([]);
});

for (const theme of ['light', 'dark']) {
  test(`visible weather safety alert has no WCAG A or AA automated violations in ${theme} theme`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await prepareStableWeatherResponses(page);
    await prepareVisibleWeatherAlert(page);
    await page.addInitScript(selectedTheme => {
      localStorage.setItem('cnsl_preferences', JSON.stringify({ theme: selectedTheme }));
    }, theme);
    await page.goto('/index.html');
    await expect(page.locator('#weatherAlert')).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    const violations = results.violations.map(violation => ({
      id: violation.id,
      impact: violation.impact,
      targets: violation.nodes.map(node => node.target)
    }));

    expect(violations).toEqual([]);

    await page.getByRole('button', { name: 'Collapse weather safety alert' }).click();
    await expect(page.getByRole('button', { name: 'Expand weather safety alert' })).toBeVisible();
    const collapsedResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    const collapsedViolations = collapsedResults.violations.map(violation => ({
      id: violation.id,
      impact: violation.impact,
      targets: violation.nodes.map(node => node.target)
    }));

    expect(collapsedViolations).toEqual([]);
  });
}