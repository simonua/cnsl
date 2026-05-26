const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const {
  MOBILE_VIEWPORT,
  prepareStableWeatherResponses,
  prepareVisibleWeatherAlert,
  seedPreferences,
  setAgendaReferenceTime
} = require('./browser-test-helpers');

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

async function loadScenario(page, scenario, theme) {
  await prepareStableWeatherResponses(page);
  await seedPreferences(page, { theme });
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

        if (scenario.name === 'pools') {
          await page.locator('#togglePoolFeatureFilters').click();
          const poolToggle = page.locator('.pool-header__toggle').first();
          if (await poolToggle.getAttribute('aria-expanded') !== 'true') await poolToggle.click();
          await page.locator('input[name="poolFeature"]').evaluateAll(inputs => inputs.forEach(input => {
            input.checked = true;
          }));
        }

        if (scenario.name === 'teams') {
          const sundevilsToggle = page.locator('.team-card[data-team-id="cfhss"] .team-header__toggle');
          if (await sundevilsToggle.getAttribute('aria-expanded') !== 'true') await sundevilsToggle.click();
          await expect(page.getByRole('link', { name: 'Team Calendar' })).toBeVisible();
        }

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

for (const theme of ['light', 'dark']) {
  test(`favorite-team agenda has no WCAG A or AA automated violations in ${theme} theme`, async ({ page }) => {
    await setAgendaReferenceTime(page);
    await prepareStableWeatherResponses(page);
    await seedPreferences(page, { theme, favoriteTeamId: 'pls' });
    await page.goto('/index.html');
    await expect(page.locator('#favoriteWeek')).toBeVisible();
    await expect(page.locator('#favoriteWeekStatus')).toContainText('next published practice or swim event entries');

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

  test(`expanded detailed-practice schedule has no WCAG A or AA automated violations in ${theme} theme`, async ({ page }) => {
    await loadScenario(page, pageScenarios.find(scenario => scenario.name === 'teams'), theme);
    const teamToggle = page.locator('.team-card[data-team-id="cfhss"] .team-header__toggle');
    if (await teamToggle.getAttribute('aria-expanded') !== 'true') await teamToggle.click();
    await expect(page.locator('.team-card[data-team-id="cfhss"] .favorite-week')).toBeVisible();
    await expect(page.locator('.team-card[data-team-id="cfhss"] .practice-schedule')).toBeVisible();

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

test('location-aware pool sorting has no WCAG A or AA automated violations', async ({ page }) => {
  await prepareStableWeatherResponses(page);
  await page.context().grantPermissions(['geolocation']);
  await page.context().setGeolocation({ latitude: 39.2105, longitude: -76.8721 });
  await seedPreferences(page, { theme: 'dark', locationAwarenessEnabled: true });
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
    await page.setViewportSize(MOBILE_VIEWPORT);
    await prepareStableWeatherResponses(page);
    await prepareVisibleWeatherAlert(page);
    await seedPreferences(page, { theme });
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

for (const theme of ['light', 'dark']) {
  test(`open mobile navigation has no WCAG A or AA automated violations in ${theme} theme`, async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await loadScenario(page, pageScenarios.find(scenario => scenario.name === 'home'), theme);
    await page.getByRole('button', { name: 'Open navigation menu' }).click();
    await expect(page.locator('#navMenu')).toHaveAttribute('aria-hidden', 'false');

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

  test(`expanded iOS install guidance has no WCAG A or AA automated violations in ${theme} theme`, async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.addInitScript(() => {
      Object.defineProperty(globalThis.navigator, 'userAgent', {
        configurable: true,
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1'
      });
    });
    await loadScenario(page, pageScenarios.find(scenario => scenario.name === 'home'), theme);
    await page.getByText('Phone Install').click();
    await expect(page.locator('#iosInstallInstructions')).toBeVisible();

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

  test(`expanded Android install action has no WCAG A or AA automated violations in ${theme} theme`, async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.addInitScript(() => {
      Object.defineProperty(globalThis.navigator, 'userAgent', {
        configurable: true,
        value: 'Mozilla/5.0 (Linux; Android 15; Mobile) AppleWebKit/537.36 Chrome/136.0 Mobile Safari/537.36'
      });
    });
    await loadScenario(page, pageScenarios.find(scenario => scenario.name === 'home'), theme);
    await page.evaluate(() => {
      const installPrompt = new Event('beforeinstallprompt', { cancelable: true });
      installPrompt.prompt = () => {};
      installPrompt.userChoice = Promise.resolve({ outcome: 'dismissed' });
      globalThis.dispatchEvent(installPrompt);
    });
    await page.getByText('Phone Install').click();
    await expect(page.getByRole('button', { name: 'Install app' })).toBeVisible();

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