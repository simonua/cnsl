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