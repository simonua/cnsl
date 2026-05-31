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
  { reference: 'HOME', name: 'home', path: '/index.html' },
  { reference: 'POOLS', name: 'pools', path: '/pools.html', readySelector: '#poolListStatus', readyText: /Pool directory loaded/ },
  { reference: 'TEAMS', name: 'teams', path: '/teams.html', readySelector: '#teamListStatus', readyText: /Team directory loaded/ },
  { reference: 'MEETS', name: 'meets', path: '/meets.html', readySelector: '#meetListStatus', readyText: /Meet schedule loaded/ },
  { reference: 'SETTINGS', name: 'settings', path: '/settings.html', readySelector: '#favoritePool:not([disabled])' },
  { reference: 'RESOURCES', name: 'resources', path: '/swim-meet-resources.html' },
  { reference: 'WHATS-NEW', name: 'whats new', path: '/whats-new.html' },
  { reference: 'ABOUT', name: 'about', path: '/about.html' },
  { reference: 'FAQ', name: 'faq', path: '/faq.html' },
  { reference: 'OFFLINE', name: 'offline', path: '/offline.html' }
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
      test(`[AX-PAGE-001-${scenario.reference}-${theme.toUpperCase()}] ${scenario.name} has no WCAG A or AA automated violations`, async ({ page }) => {
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
  test(`[AX-SHARE-001-${theme.toUpperCase()}] QR sharing dialog has no WCAG A or AA automated violations in ${theme} theme`, async ({ page }) => {
    await loadScenario(page, pageScenarios.find(scenario => scenario.name === 'home'), theme);
    await page.getByRole('button', { name: 'QR Code' }).click();
    await expect(page.getByRole('dialog', { name: 'Scan to open site' })).toBeVisible();

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

  test(`[AX-AGENDA-001-${theme.toUpperCase()}] favorite-team agenda has no WCAG A or AA automated violations in ${theme} theme`, async ({ page }) => {
    await setAgendaReferenceTime(page);
    await prepareStableWeatherResponses(page);
    await seedPreferences(page, { theme, favoriteTeamId: 'pls' });
    await page.goto('/index.html');
    await expect(page.locator('#favoriteWeek')).toBeVisible();
    await expect(page.locator('#favoriteWeek .favorite-week__events li')).toHaveCount(3);
    await expect(page.locator('#favoriteWeekStatus')).toBeHidden();

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

  test(`[AX-TEAMS-001-${theme.toUpperCase()}] expanded team schedules have no WCAG A or AA automated violations in ${theme} theme`, async ({ page }) => {
    await loadScenario(page, pageScenarios.find(scenario => scenario.name === 'teams'), theme);
    const teamToggle = page.locator('.team-card[data-team-id="cfhss"] .team-header__toggle');
    if (await teamToggle.getAttribute('aria-expanded') !== 'true') await teamToggle.click();
    await expect(page.locator('.team-card[data-team-id="cfhss"] .favorite-week')).toBeVisible();
    await expect(page.locator('.team-card[data-team-id="cfhss"] .practice-schedule')).toBeVisible();
    const meetSchedule = page.locator('.team-card[data-team-id="cfhss"] .team-meets__phase');
    await meetSchedule.locator('summary').click();
    await expect(meetSchedule.locator('.team-meets__table')).toBeVisible();

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

test('[AX-POOLS-001] location-aware pool sorting has no WCAG A or AA automated violations', async ({ page }) => {
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
  test(`[AX-WEATHER-001-${theme.toUpperCase()}] visible weather safety alert has no WCAG A or AA automated violations in ${theme} theme`, async ({ page }) => {
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
  test(`[AX-NAV-001-${theme.toUpperCase()}] open mobile navigation has no WCAG A or AA automated violations in ${theme} theme`, async ({ page }) => {
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

  test(`[AX-INSTALL-001-${theme.toUpperCase()}] expanded iOS install guidance has no WCAG A or AA automated violations in ${theme} theme`, async ({ page }) => {
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

  test(`[AX-INSTALL-002-${theme.toUpperCase()}] expanded Android install action has no WCAG A or AA automated violations in ${theme} theme`, async ({ page }) => {
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