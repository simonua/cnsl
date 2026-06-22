const { test, expect } = require('./browser-test');
const AxeBuilder = require('@axe-core/playwright').default;
const {
  ACTIVE_SEASON_YEAR,
  AUDIENCE_VIEWPORTS,
  MOBILE_VIEWPORT,
  getOffSeasonReferenceTime,
  prepareStableWeatherResponses,
  prepareVisibleWeatherAlert,
  readAnnualData,
  routeAnnualData,
  seedPreferences,
  setAgendaReferenceTime
} = require('./browser-test-helpers');

const ACCESSIBILITY_TEST_TIMEOUT_MS = 90000;
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const ANNUAL_POOLS = readAnnualData('pools').pools;
const ANNUAL_TEAMS = readAnnualData('teams').teams;
const AGENDA_TEAM = ANNUAL_TEAMS.find(team => team.practice?.preseason?.length && team.practice?.regular);
const CALENDAR_TEAM = ANNUAL_TEAMS.find(team => team.calendarUrl);
const SUBSCRIPTION_TEAM = ANNUAL_TEAMS.find(team => team.eventsSubscriptionUrl);
const MEET_DAY_TEAM = ANNUAL_TEAMS.find(team => team.homeMeetGuides?.some(guide => {
  const paymentMethods = guide.general?.concessions?.paymentMethods || [];
  return paymentMethods.includes('paypal') && paymentMethods.includes('venmo');
}));
const MEET_DAY_MEET = readAnnualData('meets').regular_meets.find(meet => (
  MEET_DAY_TEAM.keywords.some(keyword => [meet.home_team, meet.visiting_team]
    .some(name => name.toLowerCase() === keyword.toLowerCase()))
));

function getMeetDayReferenceTime() {
  const referenceTime = new Date(`${MEET_DAY_MEET.date}T12:00:00-04:00`);
  referenceTime.setDate(referenceTime.getDate() - 1);
  return referenceTime;
}

test.describe.configure({ mode: 'default' });
test.setTimeout(ACCESSIBILITY_TEST_TIMEOUT_MS);

async function expectNoAccessibilityViolations(page) {
  const results = await new AxeBuilder({ page })
    .withTags(WCAG_TAGS)
    .analyze();
  const violations = results.violations.map(violation => ({
    id: violation.id,
    impact: violation.impact,
    targets: violation.nodes.map(node => node.target)
  }));

  expect(violations).toEqual([]);
}

const pageScenarios = [
  { reference: 'HOME', name: 'home', path: '/index.html' },
  { reference: 'POOLS', name: 'pools', path: '/pools.html', readySelector: '#poolList', readyItem: '.pool-card' },
  { reference: 'TEAMS', name: 'teams', path: '/teams.html', readySelector: '#teamList', readyItem: '.team-card' },
  { reference: 'MEETS', name: 'meets', path: '/meets.html', readySelector: '#meetList', readyItem: '.meet-date-card' },
  { reference: 'MY-MEET-DAY', name: 'my meet day', path: '/my-meet-day.html', readySelector: '#myMeetDayDisabled' },
  { reference: 'SETTINGS', name: 'settings', path: '/settings.html', readySelector: '#favoritePool:not([disabled])' },
  { reference: 'RESOURCES', name: 'resources', path: '/swim-meet-resources.html' },
  { reference: 'LESSONS', name: 'lessons', path: '/lessons.html' },
  { reference: 'INSTALL', name: 'install', path: '/install.html' },
  { reference: 'WHATS-NEW', name: 'whats new', path: '/whats-new.html' },
  { reference: 'ABOUT', name: 'about', path: '/about.html' },
  { reference: 'FAQ', name: 'faq', path: '/faq.html' },
  { reference: 'OFFLINE', name: 'offline', path: '/offline.html' }
];

async function loadScenario(page, scenario, theme) {
  await prepareStableWeatherResponses(page);
  await seedPreferences(page, { theme });
  await page.goto(scenario.path);
  if (scenario.readyItem) {
    await expect(page.locator(scenario.readySelector)).toHaveAttribute('aria-busy', 'false');
    await expect(page.locator(`${scenario.readySelector} ${scenario.readyItem}`).first()).toBeVisible();
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
          const calendarCard = page.locator(`.team-card[data-team-id="${CALENDAR_TEAM.id}"]`);
          const calendarToggle = calendarCard.locator('.team-header__toggle');
          if (await calendarToggle.getAttribute('aria-expanded') !== 'true') await calendarToggle.click();
          await expect(calendarCard.getByRole('link', { name: 'Team Calendar' })).toBeVisible();
          const subscriptionCard = page.locator(`.team-card[data-team-id="${SUBSCRIPTION_TEAM.id}"]`);
          const subscriptionToggle = subscriptionCard.locator('.team-header__toggle');
          if (await subscriptionToggle.getAttribute('aria-expanded') !== 'true') await subscriptionToggle.click();
          await expect(subscriptionCard.getByRole('link', { name: 'Subscribe to team events calendar' })).toBeVisible();
        }

        if (scenario.name === 'meets') {
          const meetCard = page.locator('.meet-date-card').first();
          const meetToggle = meetCard.locator('.meet-date-header__toggle');
          if (await meetToggle.getAttribute('aria-expanded') !== 'true') await meetToggle.click();
          await expect(meetCard.locator('.meet-date-details')).toHaveAttribute('data-meet-details-hydrated', 'true');
        }

        await expectNoAccessibilityViolations(page);
      });
    }
  });
}

for (const theme of ['light', 'dark']) {
  test(`[AX-MEETS-001-${theme.toUpperCase()}-HIGH-CONTRAST] meet disclosure focus and details pass WCAG in ${theme} high contrast`, async ({ page }) => {
    await prepareStableWeatherResponses(page);
    await seedPreferences(page, { theme, contrast: 'high' });
    await page.goto('/meets.html');
    await expect(page.locator('#meetList')).toHaveAttribute('aria-busy', 'false');

    const meetCard = page.locator('.meet-date-card').first();
    const meetToggle = meetCard.locator('.meet-date-header__toggle');
    await meetToggle.hover();
    await meetToggle.focus();
    if (await meetToggle.getAttribute('aria-expanded') !== 'true') await page.keyboard.press('Enter');
    await expect(meetCard.locator('.meet-date-details')).toHaveAttribute('data-meet-details-hydrated', 'true');
    await expectNoAccessibilityViolations(page);
  });
}

test('[AX-SETTINGS-002] accessibility preferences have no WCAG A or AA automated violations', async ({ page }) => {
  await page.setViewportSize(AUDIENCE_VIEWPORTS.COMPACT_PHONE);
  await prepareStableWeatherResponses(page);
  await seedPreferences(page, {
    contrast: 'high',
    motion: 'reduced',
    textSize: 'extra-large',
    underlineLinks: true
  });
  await page.goto('/settings.html');
  await page.locator('#favoritePool:not([disabled])').waitFor();
  await page.locator('#accessibilitySettings summary').click();
  await expectNoAccessibilityViolations(page);
  await page.locator('#experimentalFeatures summary').click();

  await expectNoAccessibilityViolations(page);
  await page.locator('#maintenanceSettings summary').click();

  await expectNoAccessibilityViolations(page);
});

test('[AX-SETTINGS-003] personalized page content has no WCAG A or AA automated violations', async ({ page }) => {
  await prepareStableWeatherResponses(page);
  await seedPreferences(page, {
    hideHomeIntro: true,
    hidePageHeadings: true
  });

  for (const path of ['/index.html', '/pools.html']) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expectNoAccessibilityViolations(page);
  }
});

test('[AX-SEASON-001] off-season views have no WCAG A or AA automated violations', async ({ page }) => {
  await page.clock.setFixedTime(getOffSeasonReferenceTime());

  for (const path of ['/index.html', '/pools.html', '/teams.html', '/meets.html', '/my-meet-day.html']) {
    await page.goto(path);
    await expect(page.locator('.off-season-message')).toBeVisible();
    await expectNoAccessibilityViolations(page);
  }
});

for (const theme of ['light', 'dark']) {
  test(`[AX-SHARE-001-${theme.toUpperCase()}] QR sharing dialog has no WCAG A or AA automated violations in ${theme} theme`, async ({ page }) => {
    await loadScenario(page, pageScenarios.find(scenario => scenario.name === 'home'), theme);
    await page.getByRole('button', { name: 'QR Code' }).click();
    await expect(page.getByRole('dialog', { name: 'Scan to open site' })).toBeVisible();

    await expectNoAccessibilityViolations(page);
  });

  test(`[AX-AGENDA-001-${theme.toUpperCase()}] favorite-team agenda has no WCAG A or AA automated violations in ${theme} theme`, async ({ page }) => {
    await setAgendaReferenceTime(page);
    await prepareStableWeatherResponses(page);
    await seedPreferences(page, { theme, favoriteTeamId: AGENDA_TEAM.id });
    await page.goto('/index.html');
    await expect(page.locator('#favoriteWeek')).toBeVisible();
    expect(await page.locator('#favoriteWeek .favorite-week__events li').count()).toBeGreaterThan(0);
    await expect(page.locator('#favoriteWeekStatus')).toBeHidden();

    await expectNoAccessibilityViolations(page);
  });

  test(`[AX-AGENDA-002-${theme.toUpperCase()}] My Meet Day has no WCAG A or AA automated violations in ${theme} theme`, async ({ page }) => {
    await page.clock.setFixedTime(getMeetDayReferenceTime());
    await prepareStableWeatherResponses(page);
    await seedPreferences(page, { experimentalFeatures: ['my-meet-day'], theme, favoriteTeamId: MEET_DAY_TEAM.id });
    await page.goto('/index.html');
    const meetDay = page.locator('#myMeetDay');
    await expect(meetDay).toBeVisible();
    expect(await meetDay.locator('.my-meet-day__fact').count()).toBeGreaterThan(0);

    await expectNoAccessibilityViolations(page);
  });

  test(`[AX-AGENDA-003-${theme.toUpperCase()}] dedicated My Meet Day route has no WCAG A or AA automated violations in ${theme} theme`, async ({ page }) => {
    await page.clock.setFixedTime(getMeetDayReferenceTime());
    await prepareStableWeatherResponses(page);
    await seedPreferences(page, { experimentalFeatures: ['my-meet-day'], theme, favoriteTeamId: MEET_DAY_TEAM.id });
    await page.goto('/my-meet-day.html');
    await expect(page.locator('#myMeetDay')).toBeVisible();

    await expectNoAccessibilityViolations(page);
  });

  test(`[AX-TEAMS-001-${theme.toUpperCase()}] expanded team schedules have no WCAG A or AA automated violations in ${theme} theme`, async ({ page }) => {
    await loadScenario(page, pageScenarios.find(scenario => scenario.name === 'teams'), theme);
    const teamCard = page.locator(`.team-card[data-team-id="${AGENDA_TEAM.id}"]`);
    const teamToggle = teamCard.locator('.team-header__toggle');
    if (await teamToggle.getAttribute('aria-expanded') !== 'true') await teamToggle.click();
    await expect(teamCard.locator('.favorite-week')).toBeVisible();
    await expect(teamCard.locator('.practice-schedule')).toBeVisible();
    const meetSchedule = teamCard.locator('.team-meets__phase');
    await meetSchedule.locator('summary').click();
    await expect(meetSchedule.locator('.team-meets__table')).toBeVisible();

    await expectNoAccessibilityViolations(page);
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

  await expectNoAccessibilityViolations(page);
});

for (const { contrast, reference, theme } of [
  { contrast: 'standard', reference: 'LIGHT', theme: 'light' },
  { contrast: 'standard', reference: 'DARK', theme: 'dark' },
  { contrast: 'high', reference: 'LIGHT-HIGH-CONTRAST', theme: 'light' },
  { contrast: 'high', reference: 'DARK-HIGH-CONTRAST', theme: 'dark' }
]) {
  test(`[AX-POOLS-002-${reference}] visible feature correction footnotes pass WCAG in ${reference.toLowerCase()}`, async ({ page }) => {
    const overriddenPool = ANNUAL_POOLS[0];
    await prepareStableWeatherResponses(page);
    await routeAnnualData(page, 'pools', poolData => {
      const overriddenRecord = poolData.pools.find(pool => pool.id === overriddenPool.id);
      overriddenRecord.features = ['lap'];
      overriddenRecord.featureOverrides = [{
        action: 'add',
        feature: 'yoga',
        evidence: {
          type: 'maintainer',
          observedOn: `${ACTIVE_SEASON_YEAR}-06-15`,
          officialSourceCheckedOn: `${ACTIVE_SEASON_YEAR}-06-16`,
          note: 'Deterministic accessibility fixture.'
        }
      }, {
        action: 'remove',
        feature: 'lap',
        evidence: {
          type: 'official-source',
          officialSourceCheckedOn: `${ACTIVE_SEASON_YEAR}-06-16`,
          sourceUrl: 'https://example.com/pool-source',
          note: 'Deterministic accessibility fixture.'
        }
      }];
    });
    await seedPreferences(page, { contrast, theme });
    await page.goto('/pools.html');
    await expect(page.locator('#poolList')).toHaveAttribute('aria-busy', 'false');

    const overriddenCard = page.locator(`[data-pool-id="${overriddenPool.id}"]`);
    await overriddenCard.locator('.pool-header__toggle').click();
    await expect(overriddenCard.locator('.feature-pill--add')).toBeVisible();
    await expect(overriddenCard.locator('.feature-pill--remove')).toBeVisible();
    await expect(overriddenCard.locator('.pool-features__footnotes')).toBeVisible();

    await expectNoAccessibilityViolations(page);
  });
}

for (const theme of ['light', 'dark']) {
  test(`[AX-WEATHER-001-${theme.toUpperCase()}] visible weather safety alert has no WCAG A or AA automated violations in ${theme} theme`, async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await prepareStableWeatherResponses(page);
    await prepareVisibleWeatherAlert(page);
    await seedPreferences(page, { theme });
    await page.goto('/index.html');
    await expect(page.locator('#weatherAlert')).toBeVisible();

    await expectNoAccessibilityViolations(page);

    await page.getByRole('button', { name: 'Collapse weather safety alert' }).click();
    await expect(page.getByRole('button', { name: 'Expand weather safety alert' })).toBeVisible();
    await expectNoAccessibilityViolations(page);
  });
}

for (const theme of ['light', 'dark']) {
  test(`[AX-NAV-001-${theme.toUpperCase()}] open mobile navigation has no WCAG A or AA automated violations in ${theme} theme`, async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await loadScenario(page, pageScenarios.find(scenario => scenario.name === 'home'), theme);
    await page.getByRole('button', { name: 'Open navigation menu' }).click();
    await expect(page.locator('#navMenu')).toHaveAttribute('aria-hidden', 'false');

    await expectNoAccessibilityViolations(page);
  });

  test(`[AX-INSTALL-001-${theme.toUpperCase()}] expanded iOS install guidance has no WCAG A or AA automated violations in ${theme} theme`, async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.addInitScript(() => {
      Object.defineProperty(globalThis.navigator, 'userAgent', {
        configurable: true,
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1'
      });
    });
    await loadScenario(page, pageScenarios.find(scenario => scenario.name === 'install'), theme);
    await expect(page.locator('#appleInstallOption')).toHaveAttribute('open', '');
    await expect(page.locator('#androidInstallOption')).not.toHaveAttribute('open', '');

    await expectNoAccessibilityViolations(page);
  });

  test(`[AX-INSTALL-002-${theme.toUpperCase()}] expanded Android install action has no WCAG A or AA automated violations in ${theme} theme`, async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.addInitScript(() => {
      Object.defineProperty(globalThis.navigator, 'userAgent', {
        configurable: true,
        value: 'Mozilla/5.0 (Linux; Android 15; Mobile) AppleWebKit/537.36 Chrome/136.0 Mobile Safari/537.36'
      });
    });
    await loadScenario(page, pageScenarios.find(scenario => scenario.name === 'install'), theme);
    await page.evaluate(() => {
      const installPrompt = new Event('beforeinstallprompt', { cancelable: true });
      installPrompt.prompt = () => {};
      installPrompt.userChoice = Promise.resolve({ outcome: 'dismissed' });
      globalThis.dispatchEvent(installPrompt);
    });
    await expect(page.getByRole('button', { name: 'Install app' })).toBeVisible();
    await expect(page.locator('#androidInstallOption')).toHaveAttribute('open', '');
    await expect(page.locator('#appleInstallOption')).not.toHaveAttribute('open', '');

    await expectNoAccessibilityViolations(page);
  });
}
