const { analyticsTest, test, expect } = require('./browser-test');
const AppConfig = require('../../scripts/adapters/app-config.js');
const {
  MOBILE_VIEWPORT,
  initializeAnalyticsRecorder,
  prepareStableWeatherResponses,
  prepareVisibleWeatherAlert,
  seedPreferences,
  setAgendaReferenceTime
} = require('./browser-test-helpers');

const publishedPagePaths = [
  '/index.html', '/pools.html', '/teams.html', '/meets.html', '/settings.html',
  '/my-meet-day.html', '/swim-meet-resources.html', '/lessons.html', '/whats-new.html', '/about.html', '/faq.html', '/offline.html'
];

const directoryScenarios = [
  {
    reference: 'POOLS',
    path: '/pools.html',
    list: '#poolList',
    status: '#poolListStatus',
    announcement: /Pool directory loaded\. 23 pools available\./,
    readyText: /Pool directory loaded\./,
    domains: ['meets', 'pools', 'teams'],
    surface: '.pool-card.collapsed',
    toggle: '.pool-header__toggle'
  },
  {
    reference: 'TEAMS',
    path: '/teams.html',
    list: '#teamList',
    status: '#teamListStatus',
    announcement: /Team directory loaded\./,
    readyText: /Team directory loaded\./,
    domains: ['meets', 'pools', 'teams'],
    surface: '.team-card.collapsed',
    toggle: '.team-header__toggle'
  },
  {
    reference: 'MEETS',
    path: '/meets.html',
    list: '#meetList',
    status: '#meetListStatus',
    announcement: /Meet schedule loaded\./,
    readyText: /Meet schedule loaded\./,
    domains: ['meets', 'pools', 'teams'],
    surface: '.meet-date-card.collapsed',
    toggle: '.meet-date-header__toggle'
  }
];

test.beforeEach(async ({ page }) => {
  await prepareStableWeatherResponses(page);
});

test('[WF-NAV-001] navigation contains keyboard focus and restores it when dismissed', async ({ page }) => {
  await page.setViewportSize(MOBILE_VIEWPORT);
  await page.goto('/about.html');

  const toggle = page.getByRole('button', { name: 'Open navigation menu' });
  await toggle.focus();
  await page.keyboard.press('Enter');

  await expect(page.getByRole('button', { name: 'Close navigation menu' })).toBeFocused();
  const navigation = page.locator('#navMenu');
  await expect(navigation).toHaveAttribute('aria-hidden', 'false');
  await expect(navigation).toHaveCSS('transition-property', 'transform, visibility');
  await expect(navigation).toHaveCSS('transition-duration', '0.15s, 0s');
  await expect(navigation).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)');
  await expect(page.getByRole('link', { name: 'Lessons' })).toHaveAttribute('href', 'lessons.html');
  await expect(page.locator('#mainContent')).toHaveJSProperty('inert', true);

  await page.keyboard.press('Tab');
  await expect(page.locator('#navMenu a').first()).toBeFocused();
  await page.locator('#navMenu a').last().focus();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Close navigation menu' })).toBeFocused();

  await page.locator('#navMenu').evaluate(nav => nav.classList.remove('active'));
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Open navigation menu' })).toBeFocused();
  await expect(navigation).toHaveAttribute('aria-hidden', 'true');
  await expect(navigation).toHaveCSS('visibility', 'hidden');
  await expect(page.locator('#mainContent')).toHaveJSProperty('inert', false);
});

test('[WF-RESOURCES-001] flyer preview can be closed and restores thumbnail focus', async ({ page }) => {
  await page.setViewportSize(MOBILE_VIEWPORT);
  await page.goto('/swim-meet-resources.html');

  const previewButton = page.getByRole('button', { name: 'Preview the CA Pool and CNSL Assistant flyer (PDF)' });
  await previewButton.click();

  const dialog = page.getByRole('dialog', { name: 'Web App Flyer' });
  await expect(dialog).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(dialog).not.toBeVisible();
  await expect(previewButton).toBeFocused();
});

test('[WF-RESOURCES-002] resource views and downloads publish only reviewed document names', async ({ page }) => {
  await initializeAnalyticsRecorder(page);
  await page.goto('/swim-meet-resources.html');

  const clickWithoutNavigation = locator => locator.evaluate(element => {
    element.addEventListener('click', event => event.preventDefault(), { once: true });
    element.click();
  });

  await clickWithoutNavigation(page.getByRole('link', { name: 'View PDF' }).first());
  await clickWithoutNavigation(page.getByRole('link', { name: 'Download' }).nth(3));
  await page.getByRole('button', { name: 'Preview the CA Pool and CNSL Assistant flyer (PDF)' }).click();
  await clickWithoutNavigation(page.getByRole('dialog', { name: 'Web App Flyer' }).getByRole('link', { name: 'download the flyer PDF' }));

  await expect.poll(() => page.evaluate(() => globalThis.recordedAnalyticsEvents.filter(eventArguments => (
    eventArguments[1] === 'ca_resource_view' || eventArguments[1] === 'ca_resource_download'
  )))).toEqual([
    ['event', 'ca_resource_view', { resource_name: 'judge' }],
    ['event', 'ca_resource_download', { resource_name: 'line_up_aid' }],
    ['event', 'ca_resource_view', { resource_name: 'web_app_flyer' }],
    ['event', 'ca_resource_download', { resource_name: 'web_app_flyer' }]
  ]);

  const judgeView = page.getByRole('link', { name: 'View PDF' }).first();
  await judgeView.evaluate(link => {
    link.dataset.analyticsResourceName = 'injected_document';
    link.dataset.analyticsResourceAction = 'injected_action';
    link.addEventListener('click', event => event.preventDefault(), { once: true });
    link.click();
  });
  await expect.poll(() => page.evaluate(() => globalThis.recordedAnalyticsEvents.filter(eventArguments => (
    eventArguments[1] === 'ca_resource_view' || eventArguments[1] === 'ca_resource_download'
  )).length)).toBe(4);
});

test('[WF-LESSONS-001] lesson provider actions publish only reviewed categories', async ({ page }) => {
  await initializeAnalyticsRecorder(page);
  await page.goto('/lessons.html');
  await expect(page.locator('#lessonProviderStatus')).toHaveText('1 lesson provider listed.');
  const caCard = page.locator('.lesson-provider-card--featured');
  await expect(caCard.getByRole('heading', { name: 'Columbia Association' })).toBeVisible();
  await expect(caCard.getByRole('heading', { name: 'Outdoor lessons at CA pools' })).toBeVisible();
  await expect(caCard.getByRole('heading', { name: 'Morning lesson camps' })).toBeVisible();
  await expect(caCard.getByText('Dorsey Hall: Monday - Friday')).toBeVisible();
  await expect(caCard.getByRole('heading', { name: 'Evening lesson series' })).toBeVisible();
  await expect(caCard.getByText('Talbott Springs: Tuesday or Thursday')).toBeVisible();
  await expect(caCard.getByText('Please bring: Sunscreen, Goggles, Towel')).toBeVisible();
  await expect(caCard.getByText('Lessons continue in light rain.', { exact: false })).toBeVisible();
  await expect(caCard.getByRole('link', { name: 'View current outdoor classes (opens in new tab)' })).toHaveAttribute('href', /clubautomation\.com/);
  await expect(caCard.getByRole('link', { name: 'Explore Personal Swim Training (opens in new tab)' })).toHaveAttribute('href', /personal-swim-training/);
  await expect(page.getByRole('heading', { name: 'Class types' })).toBeVisible();
  await expect(page.getByText('Program contact: Swim Lesson Program Supervisor')).toBeVisible();
  await expect(page.getByRole('link', { name: 'swim.lessons@columbiaassociation.org' })).toHaveAttribute('href', 'mailto:swim.lessons@columbiaassociation.org');
  await expect(page.locator('.lesson-provider-card__details').first().locator('p')).toHaveText([
    'Program contact: Swim Lesson Program Supervisor',
    'Email: swim.lessons@columbiaassociation.org',
    'Phone: 410-715-3000'
  ]);
  await expect(page.getByText('Swim team preparation')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Year-round swimming' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Columbia Clippers' })).toBeVisible();
  await expect(page.getByText('new-swimmer tryouts are limited to swimmers age 10 and under', { exact: false })).toBeVisible();
  await expect(page.getByText('indoor pools at Columbia Swim Center and Supreme Sports Club', { exact: false })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Program highlights' })).toBeVisible();
  await expect(page.getByText('can complement outdoor summer-league swimming', { exact: false })).toBeVisible();
  await expect(page.locator('.lesson-provider-card__logo img')).toHaveCount(2);
  await expect(page.getByText('Service area:', { exact: false })).toHaveCount(0);
  const cardLayout = await page.locator('.lesson-provider-card').evaluateAll(cards => cards.map(card => {
    const bounds = card.getBoundingClientRect();
    const logoBounds = card.querySelector('.lesson-provider-card__logo').getBoundingClientRect();
    return { width: bounds.width, height: bounds.height, logoHeight: logoBounds.height };
  }));
  expect(cardLayout[0].width).toBeLessThanOrEqual(832);
  expect(cardLayout.slice(1).every(card => card.width <= 448)).toBe(true);
  expect(cardLayout.every(card => card.height >= 512)).toBe(true);
  expect(new Set(cardLayout.map(card => Math.round(card.logoHeight))).size).toBe(1);

  const lessonInformationLink = page.getByRole('link', { name: 'View lesson information (opens in new tab)' });
  await lessonInformationLink.focus();
  await expect(lessonInformationLink).toHaveCSS('color', 'rgb(255, 255, 255)');

  const clickWithoutNavigation = locator => locator.evaluate(element => {
    element.addEventListener('click', event => event.preventDefault(), { once: true });
    element.click();
  });

  await clickWithoutNavigation(lessonInformationLink);
  await clickWithoutNavigation(caCard.getByRole('link', { name: 'View current outdoor classes (opens in new tab)' }));
  await clickWithoutNavigation(caCard.getByRole('link', { name: 'Explore Personal Swim Training (opens in new tab)' }));
  await clickWithoutNavigation(caCard.getByRole('link', { name: 'Review CA outdoor lesson details (opens in new tab)' }));
  await clickWithoutNavigation(page.getByRole('link', { name: 'swim.lessons@columbiaassociation.org' }));
  await clickWithoutNavigation(page.getByRole('link', { name: 'Visit official website (opens in new tab)' }));
  await clickWithoutNavigation(page.getByRole('link', { name: 'Review current eligibility (opens in new tab)' }));
  await clickWithoutNavigation(page.getByRole('link', { name: 'please send me the details' }));

  await expect.poll(() => page.evaluate(() => globalThis.recordedAnalyticsEvents.filter(eventArguments => (
    eventArguments[1] === 'ca_external_link'
  )))).toEqual([
    ['event', 'ca_external_link', { link_context: 'lesson_resources', link_purpose: 'provider_website', link_destination: 'columbia_association' }],
    ['event', 'ca_external_link', { link_context: 'lesson_resources', link_purpose: 'provider_website', link_destination: 'columbia_association_registration' }],
    ['event', 'ca_external_link', { link_context: 'lesson_resources', link_purpose: 'provider_website', link_destination: 'columbia_association' }],
    ['event', 'ca_external_link', { link_context: 'lesson_resources', link_purpose: 'provider_website', link_destination: 'columbia_association' }],
    ['event', 'ca_external_link', { link_context: 'lesson_resources', link_purpose: 'provider_contact', link_destination: 'email' }],
    ['event', 'ca_external_link', { link_context: 'lesson_resources', link_purpose: 'related_program', link_destination: 'team_unify' }],
    ['event', 'ca_external_link', { link_context: 'lesson_resources', link_purpose: 'related_program', link_destination: 'go_motion' }],
    ['event', 'ca_external_link', { link_context: 'lesson_resources', link_purpose: 'provider_recommendation', link_destination: 'email' }]
  ]);
});

test('[WF-LAYOUT-001] mobile pages retain the shared viewport gutter', async ({ page }) => {
  await page.setViewportSize(MOBILE_VIEWPORT);
  await page.goto('/swim-meet-resources.html');

  await expect(page.locator('#mainContent')).toHaveCSS('padding-left', '12px');
  await expect(page.locator('#mainContent')).toHaveCSS('padding-right', '12px');
});

for (const scenario of directoryScenarios) {
  test(`[WF-DATA-001-${scenario.reference}] ${scenario.path} announces completed directory loading`, async ({ page }) => {
    await page.goto(scenario.path);
    await expect(page.locator(scenario.status)).toHaveText(scenario.announcement);
    await expect(page.locator(scenario.list)).toHaveAttribute('aria-busy', 'false');
  });
}

for (const scenario of directoryScenarios) {
  test(`[WF-DATA-002-${scenario.reference}] ${scenario.path} requests only the annual data required for its workflow`, async ({ page }) => {
    const requestedDomains = [];
    page.on('request', request => {
      const match = request.url().match(/\/assets\/data\/2026\/(pools|teams|meets)\/\1\.json/);
      if (match) requestedDomains.push(match[1]);
    });

    await page.goto(scenario.path);
    await expect(page.locator(scenario.status)).toHaveText(scenario.readyText);
    expect(requestedDomains.sort()).toEqual(scenario.domains);
  });
}

for (const scenario of directoryScenarios) {
  test(`[WF-DATA-005-${scenario.reference}] ${scenario.path} does not flash a visible loading placeholder`, async ({ page }) => {
    let resumePoolRequest;
    const poolRequestPaused = new Promise(resolve => {
      resumePoolRequest = resolve;
    });
    await page.route('**/assets/data/2026/pools/pools.json*', async route => {
      await poolRequestPaused;
      await route.continue();
    });

    try {
      await page.goto(scenario.path, { waitUntil: 'domcontentloaded' });
      await expect(page.locator(scenario.list)).toHaveAttribute('aria-busy', 'true');
      await expect(page.locator(scenario.list)).toBeEmpty();
      if (scenario.reference === 'POOLS') {
        await expect(page.locator('#poolStatusLegend')).toBeHidden();
      }
    } finally {
      resumePoolRequest();
    }

    await expect(page.locator(scenario.status)).toHaveText(scenario.readyText);
    if (scenario.reference === 'POOLS') {
      await expect(page.locator('#poolStatusLegend')).toBeVisible();
    }
  });
}

test('[WF-DATA-006] FAQ and footer distinguish seasonal-source checks from data updates', async ({ page }) => {
  await page.goto('/faq.html');

  const faqTimestamps = page.locator('.faq-item__source-freshness time');
  const footerFreshness = page.locator('.footer__data-freshness:not(.footer__weather-freshness)');
  const footerTimestamps = footerFreshness.locator('time');
  await expect(faqTimestamps).toHaveCount(2);
  for (const faqTimestamp of await faqTimestamps.all()) {
    await expect(faqTimestamp).toHaveAttribute('datetime', /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}-(?:04|05):00$/);
    await expect(faqTimestamp).toHaveText(/^[A-Z][a-z]+ \d{1,2}, \d{4} at \d{1,2}:\d{2} [AP]M$/);
  }
  await expect(footerFreshness).toContainText('Data last checked:');
  await expect(footerFreshness).toContainText('last updated:');
  await expect(footerTimestamps).toHaveCount(2);
  for (const footerTimestamp of await footerTimestamps.all()) {
    await expect(footerTimestamp).toHaveAttribute('datetime', /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}-(?:04|05):00$/);
    await expect(footerTimestamp).toHaveText(/^[A-Z][a-z]+ \d{1,2}, \d{1,2}:\d{2} [AP]M$/);
  }

  for (const viewport of [{ width: 1280, height: 900 }, { width: 320, height: 640 }]) {
    await page.setViewportSize(viewport);
    expect(await page.locator('.footer').evaluate(footer => ({
      heightFits: footer.scrollHeight <= footer.clientHeight + 1,
      widthFits: footer.scrollWidth <= footer.clientWidth + 1
    }))).toEqual({ heightFits: true, widthFits: true });
  }
});

test('[WF-DATA-007] footer keeps the last weather update current while weather checks are enabled', async ({ page }) => {
  await page.route('https://api.weather.gov/**', route => route.abort());
  await page.addInitScript(() => {
    localStorage.setItem('cnsl_weather_alert_last_successful_check', JSON.stringify({ updatedAt: '2026-06-02T14:15:00-04:00' }));
  });
  await page.goto('/faq.html');

  const weatherFreshness = page.locator('#footerWeatherFreshness');
  const weatherTimestamp = page.locator('#footerWeatherUpdated');
  await expect(weatherFreshness).toBeVisible();
  await expect(weatherTimestamp).toHaveText('June 2, 2:15 PM');
  await expect(weatherTimestamp).toHaveAttribute('datetime', '2026-06-02T14:15:00-04:00');

  await page.evaluate(() => {
    localStorage.setItem('cnsl_weather_alert_last_successful_check', JSON.stringify({ updatedAt: '2026-06-02T14:20:00-04:00' }));
    globalThis.dispatchEvent(new CustomEvent('cnsl:weather-alert-status-changed'));
  });
  await expect(weatherTimestamp).toHaveText('June 2, 2:20 PM');

  for (const viewport of [{ width: 1280, height: 900 }, { width: 320, height: 640 }]) {
    await page.setViewportSize(viewport);
    expect(await page.locator('.footer').evaluate(footer => {
      const dataFreshness = footer.querySelector('.footer__data-freshness:not(.footer__weather-freshness)').getBoundingClientRect();
      const weatherFreshness = footer.querySelector('.footer__weather-freshness').getBoundingClientRect();
      return {
        heightFits: footer.scrollHeight <= footer.clientHeight + 1,
        weatherOnOwnLine: weatherFreshness.top >= dataFreshness.bottom - 1,
        widthFits: footer.scrollWidth <= footer.clientWidth + 1
      };
    })).toEqual({ heightFits: true, weatherOnOwnLine: true, widthFits: true });
  }

  await page.evaluate(() => {
    const preferences = globalThis.PreferencesService.get();
    globalThis.PreferencesService.save({ ...preferences, weatherRefreshMinutes: 0 });
    globalThis.dispatchEvent(new CustomEvent('cnsl:preferences-changed'));
  });
  await expect(weatherFreshness).toBeHidden();
});

test('[WF-DATA-007-POOLS] pool summaries and requested details render before optional enrichment settles', async ({ page }) => {
  let releaseOptionalRequests;
  const optionalRequestsPaused = new Promise(resolve => {
    releaseOptionalRequests = resolve;
  });
  for (const domain of ['teams', 'meets']) {
    await page.route(`**/assets/data/2026/${domain}/${domain}.json*`, async route => {
      await optionalRequestsPaused;
      await route.continue();
    });
  }

  try {
    await page.goto('/pools.html', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#poolListStatus')).toContainText('Pool directory loaded.');
    await expect(page.locator('#poolList .pool-card')).toHaveCount(23);
    await expect(page.locator('#poolList + .pool-status-legend')).toBeVisible();
    await expect(page.locator('.pool-status-legend .pool-status-indicator')).toHaveCount(4);
    for (const color of ['green', 'yellow', 'red', 'gray']) {
      await expect(page.locator(`.pool-status-legend .pool-status-indicator.${color}`)).toBeVisible();
    }
    await expect(page.locator('.pool-status-legend__item')).toHaveText([
      'Open for public use',
      'Special schedule or restrictions',
      'Currently closed',
      'Schedule not available or applicable'
    ]);
    await expect(page.locator('.pool-status-legend__note')).toContainText('quick guides based on today\'s published public hours');
    await expect(page.locator('#poolList .pool-details[data-pool-details-hydrated="false"]')).toHaveCount(23);
    await expect(page.locator('#poolList .pool-contact')).toHaveCount(0);

    const firstPool = page.locator('#poolList .pool-card').first();
    await firstPool.locator('.pool-header__toggle').click();
    await expect(firstPool.locator('.pool-details')).toHaveAttribute('data-pool-details-hydrated', 'true');
    await expect(firstPool.locator('.pool-contact')).toBeVisible();
    await expect(firstPool.locator('.pool-hours')).toBeVisible();
    expect(await page.evaluate(() => performance.getEntriesByName('cnsl:pools:summary-visible').length)).toBe(1);
    expect(await page.evaluate(() => performance.getEntriesByName('cnsl:pools:optional-enrichment-settled').length)).toBe(0);
  } finally {
    releaseOptionalRequests();
  }

  await expect.poll(() => page.evaluate(() => performance.getEntriesByName('cnsl:pools:optional-enrichment-settled').length)).toBe(1);
});

test('[WF-DATA-008] generic routes use compact weather eligibility without loading pools data', async ({ page }) => {
  const poolDataRequests = [];
  page.on('request', request => {
    if (request.url().includes('/assets/data/2026/pools/pools.json')) poolDataRequests.push(request.url());
  });

  await page.goto('/faq.html');
  await expect(page.locator('h1')).toHaveText('Frequently Asked Questions');
  expect(poolDataRequests).toEqual([]);
  expect(await page.evaluate(() => Object.keys(globalThis.WEATHER_OPERATING_WINDOWS.dailyOperatingWindows).length)).toBeGreaterThan(0);
});

test('[WF-DATA-003] pool load failures are announced and do not leave the directory busy', async ({ page }) => {
  await page.route('**/assets/data/2026/pools/pools.json*', route => route.fulfill({ status: 503, body: '{}' }));
  await page.goto('/pools.html');

  await expect(page.locator('#poolListStatus')).toHaveText('The pool directory did not load. Please check your connection and refresh the page to try again.');
  await expect(page.locator('#poolList')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('#seasonInfo')).toBeHidden();
});

test('[WF-DATA-004] malformed published pool responses are announced as unavailable', async ({ page }) => {
  await page.route('**/assets/data/2026/pools/pools.json*', route => route.fulfill({ json: {} }));
  await page.goto('/pools.html');

  await expect(page.locator('#poolListStatus')).toHaveText('The pool directory did not load. Please check your connection and refresh the page to try again.');
  await expect(page.locator('#poolList')).toHaveAttribute('aria-busy', 'false');
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

test('[WF-HOME-001] season summary and sharing actions appear only on the home page', async ({ page }) => {
  await initializeAnalyticsRecorder(page);
  await page.goto('/');

  await expect(page.locator('.season-text')).toHaveText('The 2026 season runs from May 23 to September 7.');
  await expect(page.getByRole('link', { name: "CA's 2026 Pool Season" })).toBeVisible();
  await expect(page.getByRole('button', { name: 'QR Code' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Text' })).toHaveAttribute('href', 'sms:?&body=Find%20Columbia%20pools%20and%20CNSL%20schedules%3A%20https%3A%2F%2Fpools.longreachmarlins.org');
  await expect(page.getByRole('link', { name: 'Email' })).toHaveAttribute('href', 'mailto:?subject=Columbia%20Pools%20and%20CNSL%20Schedules&body=Find%20Columbia%20pools%20and%20CNSL%20schedules%3A%20https%3A%2F%2Fpools.longreachmarlins.org');
  await expect(page.getByRole('link', { name: 'Facebook (opens in new tab)' })).toHaveAttribute('href', 'https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Fpools.longreachmarlins.org');
  await expect(page.getByRole('link', { name: 'X (opens in new tab)' })).toHaveAttribute('href', 'https://x.com/intent/post?text=Find%20Columbia%20pools%20and%20CNSL%20schedules%3A%20https%3A%2F%2Fpools.longreachmarlins.org');
  await expect(page.getByRole('link', { name: 'Send Feedback' })).toHaveAttribute('href', 'contact.html');
  await page.getByRole('link', { name: 'Meets' }).focus();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'QR Code' })).toBeFocused();
  await page.keyboard.press('Enter');
  const qrDialog = page.getByRole('dialog', { name: 'Scan to open site' });
  await expect(qrDialog).toBeVisible();
  await expect(qrDialog.getByRole('img', { name: 'QR code for https://pools.longreachmarlins.org' })).toHaveAttribute('src', /assets\/images\/share-site-qr\.svg\?v=/);
  await expect(qrDialog.getByRole('link', { name: 'https://pools.longreachmarlins.org' })).toHaveAttribute('href', 'https://pools.longreachmarlins.org/');
  await expect(page.getByRole('button', { name: 'Close QR code' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(qrDialog).toBeHidden();
  await expect(page.getByRole('button', { name: 'QR Code' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Text' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Email' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Facebook (opens in new tab)' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'X (opens in new tab)' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Send Feedback' })).toBeFocused();

  for (const method of ['text', 'email', 'facebook', 'x']) {
    await page.locator(`[data-analytics-share-method="${method}"] .share-site__icon`).evaluate(icon => {
      icon.parentElement.addEventListener('click', event => event.preventDefault(), { once: true });
      icon.dispatchEvent(new globalThis.MouseEvent('click', { bubbles: true, cancelable: true }));
    });
  }
  await expect.poll(() => page.evaluate(() => globalThis.recordedAnalyticsEvents.filter(eventArguments => eventArguments[1] === 'ca_share' || eventArguments[1] === 'ca_external_link'))).toEqual([
    ['event', 'ca_share', { method: 'qr_code', content_type: 'website', item_id: 'home_page' }],
    ['event', 'ca_share', { method: 'text', content_type: 'website', item_id: 'home_page' }],
    ['event', 'ca_share', { method: 'email', content_type: 'website', item_id: 'home_page' }],
    ['event', 'ca_share', { method: 'facebook', content_type: 'website', item_id: 'home_page' }],
    ['event', 'ca_share', { method: 'x', content_type: 'website', item_id: 'home_page' }]
  ]);

  await page.locator('a.directory-link').evaluate(link => {
    link.addEventListener('click', event => event.preventDefault(), { once: true });
    link.dispatchEvent(new globalThis.MouseEvent('click', { bubbles: true, cancelable: true }));
  });
  await expect.poll(() => page.evaluate(() => globalThis.recordedAnalyticsEvents.at(-1))).toEqual(['event', 'ca_external_link', { link_context: 'official_information', link_purpose: 'general', link_destination: 'columbia_association' }]);

  await page.setViewportSize(MOBILE_VIEWPORT);
  const compactLinkLayout = await page.locator('.quick-link-card').evaluateAll(cards => cards
    .filter(card => card.getClientRects().length > 0)
    .map(card => {
      const bounds = card.getBoundingClientRect();
      return { left: bounds.left, top: bounds.top, right: bounds.right, height: bounds.height };
    }));
  expect(new Set(compactLinkLayout.map(card => Math.round(card.top))).size).toBe(1);
  expect(compactLinkLayout.every(card => card.left >= 0 && card.right <= MOBILE_VIEWPORT.width && card.height >= 44 && card.height < 80)).toBe(true);

  const compactShareLayout = await page.locator('.share-site__links .share-site__link').evaluateAll(links => links.map(link => {
    const bounds = link.getBoundingClientRect();
    return { top: bounds.top, right: bounds.right, height: bounds.height };
  }));
  expect(new Set(compactShareLayout.map(link => link.top)).size).toBe(2);
  expect(compactShareLayout.every(link => link.right <= MOBILE_VIEWPORT.width && link.height >= 44)).toBe(true);

  await page.goto('/pools.html');
  await expect(page.locator('.season-text')).toHaveCount(0);
  await expect(page.getByRole('link', { name: "CA's 2026 Pool Season" })).toHaveCount(0);
  await expect(page.locator('.share-site')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Interactive CA Pool Directory' })).toBeVisible();
  await expect.poll(() => page.locator('#poolList, #seasonInfo').evaluateAll(elements => elements.map(element => element.id))).toEqual(['poolList', 'seasonInfo']);
});

test('[WF-SEASON-001] off-season pages replace date-sensitive content with the shared season message', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-08T12:00:00-04:00'));

  const routes = [
    { path: '/index.html', seasonalSelector: '.home-view' },
    { path: '/pools.html', seasonalSelector: '#poolList' },
    { path: '/teams.html', seasonalSelector: '#teamList' },
    { path: '/meets.html', seasonalSelector: '#meetList' }
  ];

  for (const route of routes) {
    await page.goto(route.path);
    const message = page.locator('.off-season-message');
    await expect(message).toBeVisible();
    await expect(message.getByRole('heading')).toHaveText('Thank you for a great swim season!');
    await expect(message).toContainText('Keep swimming in the off-season');
    await expect(message).toContainText('Do good & be great!');
    await expect(page.locator(route.seasonalSelector)).toBeHidden();
  }

  await expect(page.getByRole('heading', { name: 'Meet Schedule', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: /2026 Meet Schedule/ })).toBeHidden();
});

test('[WF-CONTACT-001] author contact options are collected on the Contact page', async ({ page }) => {
  await page.goto('/contact.html');
  const appVersion = await page.evaluate(() => globalThis.APP_VERSION);
  const bugFeatureSubject = encodeURIComponent(`CA Pool & CNSL Assistant - Bug / Feature - Version ${appVersion}`);

  await expect(page.getByRole('heading', { level: 1, name: 'Contact' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'General feedback' })).toHaveAttribute('href', 'mailto:simonkurtz+pool-app@gmail.com?subject=CA%20Pool%20%26%20CNSL%20Assistant%20-%20Feedback');
  await expect(page.getByRole('link', { name: 'Report a bug or request a feature' })).toHaveAttribute('href', `mailto:simonkurtz+pool-app@gmail.com?subject=${bugFeatureSubject}`);
  await expect(page.getByRole('link', { name: 'Report a data issue' })).toHaveAttribute('href', 'mailto:simonkurtz+pool-app@gmail.com?subject=CA%20Pool%20%26%20CNSL%20Assistant%20-%20Data');
  await expect(page.getByRole('link', { name: 'Connect with Simon on LinkedIn (opens in new tab)' })).toHaveAttribute('href', 'https://www.linkedin.com/in/simonkurtz');
  await expect(page.getByRole('link', { name: 'Message Simon on Facebook (opens in new tab)' })).toHaveAttribute('href', 'https://www.facebook.com/simonkurtz82');
});

analyticsTest('[WF-ANALYTICS-001] analytics publishes a page view and each public app version once per browser profile after the Google tag script loads', async ({
  blockedExternalRequests,
  page
}) => {
  const browserContext = page.context();
  await prepareStableWeatherResponses(page);
  let releaseTagScript;
  let reportTagScriptRequest;
  let tagScriptRequestCount = 0;
  const tagScriptRequested = new Promise(resolve => {
    reportTagScriptRequest = resolve;
  });
  await browserContext.route('https://www.googletagmanager.com/**', async route => {
    tagScriptRequestCount += 1;
    reportTagScriptRequest();
    if (tagScriptRequestCount === 1) {
      await new Promise(release => {
        releaseTagScript = release;
      });
    }
    await route.fulfill({
      contentType: 'application/javascript',
      body: 'globalThis.cnslTagScriptLoaded = true;'
    });
  });

  await browserContext.route('https://pools.longreachmarlins.org/**', async route => {
    const requestedUrl = new URL(route.request().url());
    const localPath = requestedUrl.pathname === '/pools' ? '/pools.html' : requestedUrl.pathname;
    const response = await page.request.get(`http://127.0.0.1:4173${localPath}`);
    await route.fulfill({ response });
  });

  await page.addInitScript(({ analyticsVersionKey }) => {
    localStorage.setItem(analyticsVersionKey, '2.8.4');
    localStorage.setItem('cnsl_current_version', '9999.0.0');
    localStorage.setItem('cnsl_settings_notice_dismissed', 'true');
  }, { analyticsVersionKey: AppConfig.ANALYTICS_APP_VERSION_STORAGE_KEY });

  await page.goto('https://pools.longreachmarlins.org/index.html', { waitUntil: 'domcontentloaded' });
  await tagScriptRequested;
  const measurementId = await page.evaluate(() => globalThis.GA4_MEASUREMENT_ID);
  const appVersion = await page.evaluate(() => globalThis.APP_VERSION);
  await expect(page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length)).resolves.toBe(0);

  await expect.poll(() => page.evaluate(() => globalThis.dataLayer.map(argumentsList => Array.from(argumentsList))))
    .toEqual([
      ['consent', 'default', {
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied',
        analytics_storage: 'granted'
      }],
      ['set', 'ads_data_redaction', true],
      ['set', {
        allow_google_signals: false,
        allow_ad_personalization_signals: false,
        page_location: 'https://pools.longreachmarlins.org/index.html',
        page_referrer: ''
      }]
    ]);

  releaseTagScript();
  await expect.poll(() => page.evaluate(() => ({
    loaded: globalThis.cnslTagScriptLoaded,
    commandTypes: globalThis.dataLayer.map(argumentsList => {
      const [commandType, commandName] = Array.from(argumentsList);
      return typeof commandName === 'string' ? [commandType, commandName] : [commandType];
    })
  }))).toEqual({
    loaded: true,
    commandTypes: [
      ['consent', 'default'],
      ['set', 'ads_data_redaction'],
      ['set'],
      ['js'],
      ['config', measurementId],
      ['event', 'page_view'],
      ['event', 'ca_version'],
      ['event', 'ca_upgrade']
    ]
  });
  await expect.poll(() => page.evaluate(() => globalThis.dataLayer.map(argumentsList => Array.from(argumentsList))))
    .toContainEqual(['event', 'ca_version', { app_version: appVersion }]);
  await expect.poll(() => page.evaluate(() => globalThis.dataLayer.map(argumentsList => Array.from(argumentsList))))
    .toContainEqual(['event', 'ca_upgrade', { upgrade_path: `2.8.4 -> ${appVersion}` }]);
  await expect.poll(() => page.evaluate(() => localStorage.getItem(globalThis.ANALYTICS_APP_VERSION_STORAGE_KEY)))
    .toBe(appVersion);
  await expect.poll(() => page.evaluate(() => localStorage.getItem(globalThis.ANALYTICS_UPGRADE_PATH_STORAGE_KEY)))
    .toBeNull();
  await expect.poll(() => page.evaluate(() => localStorage.getItem(globalThis.ANALYTICS_VERSION_REPORTED_STORAGE_KEY)))
    .toBe(appVersion);
  await expect.poll(() => page.evaluate(() => {
    const pageViewCommand = globalThis.dataLayer.find(argumentsList => argumentsList[1] === 'page_view');
    return Array.from(pageViewCommand)[2];
  })).toEqual({
    page_location: 'https://pools.longreachmarlins.org/index.html',
    page_referrer: '',
    page_title: 'Home'
  });

  await page.goto('https://pools.longreachmarlins.org/settings.html', { waitUntil: 'domcontentloaded' });
  await expect.poll(() => page.evaluate(() => globalThis.dataLayer.map(argumentsList => Array.from(argumentsList))))
    .toContainEqual(['event', 'page_view', {
      page_location: 'https://pools.longreachmarlins.org/settings.html',
      page_referrer: '',
      page_title: 'Settings'
    }]);
  await expect.poll(() => page.evaluate(() => globalThis.dataLayer.map(argumentsList => Array.from(argumentsList))))
    .not.toContainEqual(['event', 'ca_version', { app_version: appVersion }]);

  await page.goto('https://pools.longreachmarlins.org/pools', { waitUntil: 'domcontentloaded' });
  await expect.poll(() => page.evaluate(() => globalThis.dataLayer.map(argumentsList => Array.from(argumentsList))))
    .toContainEqual(['event', 'page_view', {
      page_location: 'https://pools.longreachmarlins.org/pools.html',
      page_referrer: '',
      page_title: 'Pools'
    }]);

  const profilePage = await browserContext.newPage();
  await profilePage.goto('https://pools.longreachmarlins.org/contact.html', { waitUntil: 'domcontentloaded' });
  await expect.poll(() => profilePage.evaluate(() => globalThis.dataLayer.map(argumentsList => Array.from(argumentsList))))
    .not.toContainEqual(['event', 'ca_version', { app_version: appVersion }]);
  await expect.poll(() => profilePage.evaluate(() => localStorage.getItem(globalThis.ANALYTICS_VERSION_REPORTED_STORAGE_KEY)))
    .toBe(appVersion);
  await expect.poll(() => profilePage.evaluate(() => sessionStorage.getItem(globalThis.ANALYTICS_VERSION_REPORTED_STORAGE_KEY)))
    .toBeNull();
  await profilePage.close();

  await page.evaluate(() => {
    localStorage.setItem(
      globalThis.ANALYTICS_VERSION_REPORTED_STORAGE_KEY,
      `${globalThis.APP_VERSION}-previous`
    );
  });
  await page.goto('https://pools.longreachmarlins.org/contact.html', { waitUntil: 'domcontentloaded' });
  await expect.poll(() => page.evaluate(() => globalThis.dataLayer.map(argumentsList => Array.from(argumentsList))))
    .toContainEqual(['event', 'ca_version', { app_version: appVersion }]);
  await expect.poll(() => page.evaluate(() => localStorage.getItem(globalThis.ANALYTICS_VERSION_REPORTED_STORAGE_KEY)))
    .toBe(appVersion);
  expect(blockedExternalRequests).toEqual([]);
});

analyticsTest('[WF-ANALYTICS-008] analytics records first use without publishing an upgrade path', async ({ page }) => {
  await page.route('https://www.googletagmanager.com/**', route => route.fulfill({
    contentType: 'application/javascript',
    body: 'globalThis.cnslTagScriptLoaded = true;'
  }));
  await page.route('https://pools.longreachmarlins.org/**', async route => {
    const requestedUrl = new URL(route.request().url());
    const response = await page.request.get(`http://127.0.0.1:4173${requestedUrl.pathname}`);
    await route.fulfill({ response });
  });

  await page.goto('https://pools.longreachmarlins.org/contact.html', { waitUntil: 'domcontentloaded' });
  const appVersion = await page.evaluate(() => globalThis.APP_VERSION);
  await expect.poll(() => page.evaluate(() => globalThis.cnslTagScriptLoaded)).toBe(true);
  await expect.poll(() => page.evaluate(() => localStorage.getItem(globalThis.ANALYTICS_APP_VERSION_STORAGE_KEY)))
    .toBe(appVersion);
  const eventNames = await page.evaluate(() => globalThis.dataLayer
    .filter(argumentsList => argumentsList[0] === 'event')
    .map(argumentsList => argumentsList[1]));
  expect(eventNames).not.toContain('ca_upgrade');
});

analyticsTest('[WF-ANALYTICS-009] analytics uses zero when prior use is known but its version is unavailable', async ({ page }) => {
  await page.route('https://www.googletagmanager.com/**', route => route.fulfill({
    contentType: 'application/javascript',
    body: 'globalThis.cnslTagScriptLoaded = true;'
  }));
  await page.route('https://pools.longreachmarlins.org/**', async route => {
    const requestedUrl = new URL(route.request().url());
    const response = await page.request.get(`http://127.0.0.1:4173${requestedUrl.pathname}`);
    await route.fulfill({ response });
  });
  await page.addInitScript(({ analyticsVersionKey }) => {
    localStorage.setItem(analyticsVersionKey, 'unknown');
  }, { analyticsVersionKey: AppConfig.ANALYTICS_APP_VERSION_STORAGE_KEY });

  await page.goto('https://pools.longreachmarlins.org/contact.html', { waitUntil: 'domcontentloaded' });
  const appVersion = await page.evaluate(() => globalThis.APP_VERSION);
  await expect.poll(() => page.evaluate(() => globalThis.dataLayer.map(argumentsList => Array.from(argumentsList))))
    .toContainEqual(['event', 'ca_upgrade', { upgrade_path: `0 -> ${appVersion}` }]);
  await expect.poll(() => page.evaluate(() => localStorage.getItem(globalThis.ANALYTICS_APP_VERSION_STORAGE_KEY)))
    .toBe(appVersion);
});

analyticsTest('[WF-ANALYTICS-010] analytics uses the service-worker upgrade version when local version state was cleared', async ({ page }) => {
  await page.route('https://www.googletagmanager.com/**', route => route.fulfill({
    contentType: 'application/javascript',
    body: 'globalThis.cnslTagScriptLoaded = true;'
  }));
  await page.route('https://pools.longreachmarlins.org/**', async route => {
    const requestedUrl = new URL(route.request().url());
    const response = await page.request.get(`http://127.0.0.1:4173${requestedUrl.pathname}`);
    await route.fulfill({ response });
  });
  await page.addInitScript(({ upgradeFromVersionKey }) => {
    sessionStorage.setItem(upgradeFromVersionKey, '2.8.4');
  }, { upgradeFromVersionKey: AppConfig.SERVICE_WORKER_UPGRADE_FROM_VERSION_STORAGE_KEY });

  await page.goto('https://pools.longreachmarlins.org/contact.html', { waitUntil: 'domcontentloaded' });
  const appVersion = await page.evaluate(() => globalThis.APP_VERSION);
  await expect.poll(() => page.evaluate(() => globalThis.dataLayer.map(argumentsList => Array.from(argumentsList))))
    .toContainEqual(['event', 'ca_upgrade', { upgrade_path: `2.8.4 -> ${appVersion}` }]);
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem(
    globalThis.SERVICE_WORKER_UPGRADE_FROM_VERSION_STORAGE_KEY
  ))).toBeNull();
});

analyticsTest('[WF-ANALYTICS-011] analytics uses the newest predecessor across a multi-step upgrade history', async ({ page }) => {
  await page.route('https://www.googletagmanager.com/**', route => route.fulfill({
    contentType: 'application/javascript',
    body: 'globalThis.cnslTagScriptLoaded = true;'
  }));
  await page.route('https://pools.longreachmarlins.org/**', async route => {
    const requestedUrl = new URL(route.request().url());
    const response = await page.request.get(`http://127.0.0.1:4173${requestedUrl.pathname}`);
    await route.fulfill({ response });
  });
  await page.addInitScript(storageKeys => {
    localStorage.setItem(storageKeys.analyticsVersion, '2.8.4');
    localStorage.setItem(storageKeys.releaseNoticeVersion, '2.16.1');
    localStorage.setItem(storageKeys.reportedVersion, '2.17.0');
    sessionStorage.setItem(storageKeys.serviceWorkerVersion, '2.17.1');
  }, {
    analyticsVersion: AppConfig.ANALYTICS_APP_VERSION_STORAGE_KEY,
    releaseNoticeVersion: AppConfig.APP_VERSION_STORAGE_KEY,
    reportedVersion: AppConfig.ANALYTICS_VERSION_REPORTED_STORAGE_KEY,
    serviceWorkerVersion: AppConfig.SERVICE_WORKER_UPGRADE_FROM_VERSION_STORAGE_KEY
  });

  await page.goto('https://pools.longreachmarlins.org/contact.html', { waitUntil: 'domcontentloaded' });
  const appVersion = await page.evaluate(() => globalThis.APP_VERSION);
  await expect.poll(() => page.evaluate(() => globalThis.dataLayer.map(argumentsList => Array.from(argumentsList))))
    .toContainEqual(['event', 'ca_upgrade', { upgrade_path: `2.17.1 -> ${appVersion}` }]);
  await expect.poll(() => page.evaluate(() => localStorage.getItem(globalThis.ANALYTICS_APP_VERSION_STORAGE_KEY)))
    .toBe(appVersion);
});

analyticsTest('[WF-ANALYTICS-012] analytics simulation cannot reach public network endpoints', async ({
  blockedExternalRequests,
  page
}) => {
  const publicUrls = [
    'https://pools.longreachmarlins.org/',
    'https://www.google-analytics.com/g/collect?v=2',
    'https://region1.google-analytics.com/g/collect?v=2',
    'https://www.googletagmanager.com/gtag/js?id=G-TEST',
    'https://static.cloudflareinsights.com/beacon.min.js',
    'https://cloudflareinsights.com/cdn-cgi/rum',
    'https://api.weather.gov/'
  ];

  await expect(page.evaluate(() => globalThis.navigator.webdriver)).resolves.toBe(false);
  const requestResults = await page.evaluate(async urls => Promise.all(urls.map(async url => {
    try {
      await fetch(url, { mode: 'no-cors' });
      return false;
    } catch (_error) {
      return true;
    }
  })), publicUrls);

  expect(requestResults).toEqual(publicUrls.map(() => true));
  expect(blockedExternalRequests).toHaveLength(publicUrls.length);
  expect([...blockedExternalRequests].sort()).toEqual([...publicUrls].sort());
});

analyticsTest('[WF-ANALYTICS-013] VS Code embedded browsers cannot publish analytics when WebDriver is hidden', async ({
  blockedExternalRequests,
  page
}) => {
  await prepareStableWeatherResponses(page);
  await page.addInitScript(() => {
    Object.defineProperty(globalThis.navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0 Code-Insiders/1.125.0-insider Electron/42.2.0'
    });
  });
  await page.route('https://pools.longreachmarlins.org/**', async route => {
    const requestedUrl = new URL(route.request().url());
    const response = await page.request.get(`http://127.0.0.1:4173${requestedUrl.pathname}`);
    await route.fulfill({ response });
  });

  await page.goto('https://pools.longreachmarlins.org/index.html', { waitUntil: 'domcontentloaded' });

  await expect(page.evaluate(() => globalThis.navigator.webdriver)).resolves.toBe(false);
  await expect(page.evaluate(() => globalThis.navigator.userAgent)).resolves.toContain('Code-Insiders/');
  await expect(page.locator('#cnslAnalyticsScript')).toHaveCount(0);
  await expect(page.evaluate(() => globalThis.dataLayer)).resolves.toBeUndefined();
  expect(blockedExternalRequests).toEqual([]);
});

analyticsTest('[WF-ANALYTICS-002] flyer QR campaign visits publish reviewed attribution and clear their landing tags', async ({ page }) => {
  await page.route('https://www.googletagmanager.com/**', route => route.fulfill({
    contentType: 'application/javascript',
    body: 'globalThis.cnslTagScriptLoaded = true;'
  }));
  await page.route('https://pools.longreachmarlins.org/**', async route => {
    const requestedUrl = new URL(route.request().url());
    const response = await page.request.get(`http://127.0.0.1:4173${requestedUrl.pathname}`);
    await route.fulfill({ response });
  });

  await page.goto('https://pools.longreachmarlins.org/?utm_source=flyer&utm_medium=qr&utm_campaign=2026_pool_season', { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL('https://pools.longreachmarlins.org/');
  await expect.poll(() => page.evaluate(() => globalThis.dataLayer.map(argumentsList => Array.from(argumentsList))))
    .toContainEqual(['event', 'ca_flyer_visit']);

  const measurementCommands = await page.evaluate(() => globalThis.dataLayer.map(argumentsList => Array.from(argumentsList)));
  expect(JSON.stringify(measurementCommands)).not.toContain('utm_source=flyer');
  expect(measurementCommands.find(argumentsList => argumentsList[0] === 'config')[2]).toMatchObject({
    campaign_source: 'flyer',
    campaign_medium: 'qr',
    campaign_name: '2026_pool_season'
  });
  expect(measurementCommands.find(argumentsList => argumentsList[1] === 'page_view')[2]).toMatchObject({
    page_location: 'https://pools.longreachmarlins.org/',
    page_referrer: ''
  });
});

analyticsTest('[WF-ANALYTICS-003] unrecognized campaign input is neither consumed nor counted', async ({ page }) => {
  await page.route('https://www.googletagmanager.com/**', route => route.fulfill({
    contentType: 'application/javascript',
    body: 'globalThis.cnslTagScriptLoaded = true;'
  }));
  await page.route('https://pools.longreachmarlins.org/**', async route => {
    const requestedUrl = new URL(route.request().url());
    const response = await page.request.get(`http://127.0.0.1:4173${requestedUrl.pathname}`);
    await route.fulfill({ response });
  });

  await page.goto('https://pools.longreachmarlins.org/?utm_source=javascript%3Aalert(1)&utm_medium=qr&utm_campaign=2026_pool_season', { waitUntil: 'domcontentloaded' });
  await expect.poll(() => page.evaluate(() => globalThis.dataLayer.some(argumentsList => Array.from(argumentsList)[1] === 'page_view'))).toBe(true);
  expect(new URL(page.url()).searchParams.get('utm_source')).toBe('javascript:alert(1)');
  expect(await page.evaluate(() => globalThis.dataLayer.map(argumentsList => Array.from(argumentsList)).filter(argumentsList => argumentsList[1] === 'ca_flyer_visit'))).toEqual([]);
  expect(await page.evaluate(() => Array.from(globalThis.dataLayer.find(argumentsList => Array.from(argumentsList)[0] === 'config'))[2])).not.toHaveProperty('campaign_source');
  expect(await page.evaluate(() => Array.from(globalThis.dataLayer.find(argumentsList => Array.from(argumentsList)[1] === 'page_view'))[2])).toMatchObject({
    page_location: 'https://pools.longreachmarlins.org/',
    page_referrer: ''
  });
});

analyticsTest('[WF-ANALYTICS-006] app QR campaign visits publish reviewed attribution without counting as flyer visits', async ({ page }) => {
  await page.route('https://www.googletagmanager.com/**', route => route.fulfill({
    contentType: 'application/javascript',
    body: 'globalThis.cnslTagScriptLoaded = true;'
  }));
  await page.route('https://pools.longreachmarlins.org/**', async route => {
    const requestedUrl = new URL(route.request().url());
    const response = await page.request.get(`http://127.0.0.1:4173${requestedUrl.pathname}`);
    await route.fulfill({ response });
  });

  await page.goto('https://pools.longreachmarlins.org/?utm_source=app&utm_medium=qr&utm_campaign=2026_pool_season', { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL('https://pools.longreachmarlins.org/');

  const measurementCommands = await page.evaluate(() => globalThis.dataLayer.map(argumentsList => Array.from(argumentsList)));
  expect(JSON.stringify(measurementCommands)).not.toContain('utm_source=app');
  expect(measurementCommands.find(argumentsList => argumentsList[0] === 'config')[2]).toMatchObject({
    campaign_source: 'app',
    campaign_medium: 'qr',
    campaign_name: '2026_pool_season'
  });
  expect(measurementCommands.filter(argumentsList => argumentsList[1] === 'ca_flyer_visit')).toEqual([]);
});

test('[WF-ANALYTICS-004] directory detail opens publish only a broad directory name', async ({ page }) => {
  await initializeAnalyticsRecorder(page);

  const scenarios = [
    { path: '/pools.html', ready: '#poolListStatus', readyText: 'Pool directory loaded.', toggle: '.pool-header__toggle[aria-expanded="false"]' },
    { path: '/teams.html', ready: '#teamListStatus', readyText: 'Team directory loaded.', toggle: '.team-header__toggle[aria-expanded="false"]' },
    { path: '/meets.html', ready: '#meetListStatus', readyText: 'Meet schedule loaded.', toggle: '.meet-date-header__toggle[aria-expanded="false"]' }
  ];
  for (const scenario of scenarios) {
    await page.goto(scenario.path);
    await expect(page.locator(scenario.ready)).toContainText(scenario.readyText);
    await page.locator(scenario.toggle).first().click();
  }

  await expect.poll(() => page.evaluate(() => globalThis.recordedAnalyticsEvents.filter(eventArguments => eventArguments[1] === 'ca_directory_detail_open'))).toEqual([
    ['event', 'ca_directory_detail_open', { directory_name: 'pools' }],
    ['event', 'ca_directory_detail_open', { directory_name: 'teams' }],
    ['event', 'ca_directory_detail_open', { directory_name: 'meets' }]
  ]);
  await page.evaluate(() => {
    const interactionType = globalThis.AnalyticsInteractionType.DIRECTORY_DETAIL_OPEN;
    globalThis.cnslAnalytics.trackInteraction(interactionType, { directoryName: 'Bryant Woods' });
    globalThis.cnslAnalytics.trackInteraction(interactionType, { directoryName: 'cfhss' });
    globalThis.cnslAnalytics.trackInteraction(interactionType, { directoryName: '2026-06-20' });
  });
  await expect.poll(() => page.evaluate(() => globalThis.recordedAnalyticsEvents.filter(eventArguments => eventArguments[1] === 'ca_directory_detail_open'))).toHaveLength(3);
});

test('[WF-ANALYTICS-007] external links publish fixed destinations without URL details', async ({ page }) => {
  await initializeAnalyticsRecorder(page);
  await page.goto('/pools.html');
  await expect(page.locator('#poolListStatus')).toContainText('Pool directory loaded.');

  const poolCard = page.locator('[data-pool-card]').first();
  const toggle = poolCard.locator('.pool-header__toggle');
  if (await toggle.getAttribute('aria-expanded') === 'false') await toggle.click();

  const clickWithoutNavigation = locator => locator.evaluate(link => {
    link.addEventListener('click', event => event.preventDefault(), { once: true });
    link.click();
  });
  await clickWithoutNavigation(poolCard.locator('.phone-link'));
  await clickWithoutNavigation(poolCard.locator('.address-link'));
  await clickWithoutNavigation(poolCard.locator('.directions-link'));
  await poolCard.evaluate(card => {
    const appleMapsLink = globalThis.document.createElement('a');
    appleMapsLink.href = 'https://maps.apple.com/?daddr=private+address';
    appleMapsLink.textContent = 'Apple Maps';
    appleMapsLink.addEventListener('click', event => event.preventDefault(), { once: true });
    card.append(appleMapsLink);
    appleMapsLink.click();
    const unknownLink = globalThis.document.createElement('a');
    unknownLink.href = 'https://unreviewed.example/private?token=secret#details';
    unknownLink.textContent = 'Unknown destination';
    unknownLink.addEventListener('click', event => event.preventDefault(), { once: true });
    card.append(unknownLink);
    unknownLink.click();
  });

  await expect.poll(() => page.evaluate(() => globalThis.recordedAnalyticsEvents.filter(eventArguments => eventArguments[1] === 'ca_external_link'))).toEqual([
    ['event', 'ca_external_link', { link_context: 'pool_details', link_purpose: 'general', link_destination: 'phone_call' }],
    ['event', 'ca_external_link', { link_context: 'pool_details', link_purpose: 'general', link_destination: 'google_maps' }],
    ['event', 'ca_external_link', { link_context: 'pool_details', link_purpose: 'general', link_destination: 'google_maps' }],
    ['event', 'ca_external_link', { link_context: 'pool_details', link_purpose: 'general', link_destination: 'apple_maps' }],
    ['event', 'ca_external_link', { link_context: 'pool_details', link_purpose: 'general', link_destination: 'other' }]
  ]);
  await page.evaluate(() => {
    globalThis.cnslAnalytics.trackInteraction(globalThis.AnalyticsInteractionType.EXTERNAL_LINK, {
      context: 'pool_details',
      destination: 'https://unreviewed.example/private?token=secret',
      purpose: 'general'
    });
  });
  const externalEvents = await page.evaluate(() => globalThis.recordedAnalyticsEvents.filter(eventArguments => eventArguments[1] === 'ca_external_link'));
  expect(externalEvents).toHaveLength(5);
  expect(JSON.stringify(externalEvents)).not.toContain('secret');
  expect(JSON.stringify(externalEvents)).not.toContain('410-');
});

test('[WF-ANALYTICS-005] browser verification blocks Google Analytics collection', async ({ page }) => {
  await page.route('https://pools.longreachmarlins.org/**', async route => {
    const requestedUrl = new URL(route.request().url());
    const response = await page.request.get(`http://127.0.0.1:4173${requestedUrl.pathname}`);
    await route.fulfill({ response });
  });

  await page.goto('https://pools.longreachmarlins.org/index.html', { waitUntil: 'domcontentloaded' });
  const measurementId = await page.evaluate(() => globalThis.GA4_MEASUREMENT_ID);
  await expect(page.evaluate(() => globalThis.navigator.webdriver)).resolves.toBe(true);
  await expect(page.evaluate(id => globalThis[`ga-disable-${id}`], measurementId)).resolves.not.toBe(true);
  await expect(page.locator('#cnslAnalyticsScript')).toHaveCount(0);
  await expect(page.evaluate(() => globalThis.dataLayer)).resolves.toBeUndefined();
  await expect(page.goto('https://www.google-analytics.com/g/collect?v=2')).rejects.toThrow(/ERR_BLOCKED_BY_CLIENT/);
});

test('[WF-RELEASE-001] release updates are announced once after a stable version is acknowledged', async ({ page }) => {
  await initializeAnalyticsRecorder(page);
  await page.addInitScript(() => {
    if (!localStorage.getItem('cnsl_current_version')) {
      localStorage.setItem('cnsl_current_version', '2.16.1');
    }
  });
  await page.setViewportSize(MOBILE_VIEWPORT);
  await page.goto('/pools.html');
  const currentVersion = await page.evaluate(() => globalThis.APP_VERSION);
  const releaseSeries = currentVersion.split('.').slice(0, 2).join('.');

  const notice = page.locator('#releaseNotice');
  await expect(notice).toBeVisible();
  await expect(notice).toContainText(`App updated to V${releaseSeries}`);
  const closeBox = await page.getByRole('button', { name: 'Dismiss application update' }).boundingBox();
  const menuBox = await page.getByRole('button', { name: 'Open navigation menu' }).boundingBox();
  expect(closeBox.width).toBe(menuBox.width);
  expect(closeBox.x).toBe(menuBox.x);
  await page.getByRole('button', { name: 'Dismiss application update' }).focus();
  await page.keyboard.press('Enter');
  await expect(notice).toBeHidden();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('cnsl_current_version'))).toBe(currentVersion);
  await expect.poll(() => page.evaluate(() => globalThis.recordedAnalyticsEvents.filter(eventArguments => eventArguments[1] === 'ca_banner_interaction' && eventArguments[2].banner_name === 'release_notice'))).toEqual([
    ['event', 'ca_banner_interaction', { banner_name: 'release_notice', banner_action: 'view' }],
    ['event', 'ca_banner_interaction', { banner_name: 'release_notice', banner_action: 'dismiss' }]
  ]);

  await page.goto('/teams.html');
  await expect(page.locator('#releaseNotice')).toBeHidden();

  await page.evaluate(() => localStorage.setItem('cnsl_current_version', '2.0.0'));
  await page.goto('/about.html');
  await expect(page.locator('#releaseNotice')).toBeVisible();
  await page.locator('#releaseNoticeLink').click();
  await expect(page).toHaveURL(/\/whats-new\.html$/);
  await expect(page.getByRole('heading', { name: new RegExp(`^Version ${releaseSeries.replace('.', '\\.')}\\.\\d+ - `) }).first()).toBeVisible();
  await expect(page.locator('#releaseNotice')).toBeHidden();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('cnsl_current_version'))).toBe(currentVersion);
  await expect.poll(() => page.evaluate(() => globalThis.recordedAnalyticsEvents.filter(eventArguments => eventArguments[1] === 'ca_banner_interaction' && eventArguments[2].banner_name === 'release_notice'))).toEqual([
    ['event', 'ca_banner_interaction', { banner_name: 'release_notice', banner_action: 'view' }],
    ['event', 'ca_banner_interaction', { banner_name: 'release_notice', banner_action: 'dismiss' }],
    ['event', 'ca_banner_interaction', { banner_name: 'release_notice', banner_action: 'view' }],
    ['event', 'ca_banner_interaction', { banner_name: 'release_notice', banner_action: 'open' }]
  ]);
});

test('[WF-INSTALL-001] first mobile use keeps settings and prioritizes platform install guidance', async ({ page }) => {
  await page.setViewportSize(MOBILE_VIEWPORT);
  await initializeAnalyticsRecorder(page);
  await page.addInitScript(() => {
    Object.defineProperty(globalThis.navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1'
    });
    localStorage.setItem('cnsl_preferences', JSON.stringify({ theme: 'dark' }));
    localStorage.removeItem('cnsl_current_version');
    localStorage.removeItem('cnsl_settings_notice_dismissed');
  });

  await page.goto('/index.html');
  const currentVersion = await page.evaluate(() => globalThis.APP_VERSION);

  await expect(page.locator('#releaseNotice')).toBeHidden();
  await expect(page.locator('#settingsNotice')).toBeVisible();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('cnsl_current_version'))).toBe(currentVersion);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('cnsl_preferences')))).toEqual({ theme: 'dark' });

  const shortcut = page.getByRole('button', { name: 'Phone Install', exact: true });
  await expect(shortcut).toBeVisible();
  await shortcut.click();
  await expect(page.locator('#installApp')).toHaveAttribute('open', '');
  await expect(page.locator('#iosInstallInstructions')).toBeVisible();
  await expect(page.locator('#androidInstallInstructions')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Install app', exact: true })).toBeHidden();
  await expect.poll(() => page.evaluate(() => globalThis.recordedAnalyticsEvents.filter(eventArguments => eventArguments[1] === 'ca_install_interaction'))).toEqual([
    ['event', 'ca_install_interaction', { install_action: 'instructions_open' }]
  ]);
});

test('[WF-INSTALL-002] Android install shortcut shows only Android guidance when installable', async ({ page }) => {
  await page.setViewportSize(MOBILE_VIEWPORT);
  await initializeAnalyticsRecorder(page);
  await page.addInitScript(() => {
    Object.defineProperty(globalThis.navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0 (Linux; Android 15; Mobile) AppleWebKit/537.36 Chrome/136.0 Mobile Safari/537.36'
    });
  });
  await page.goto('/index.html');
  await page.evaluate(() => {
    const installPrompt = new Event('beforeinstallprompt', { cancelable: true });
    installPrompt.prompt = () => {};
    installPrompt.userChoice = Promise.resolve({ outcome: 'dismissed' });
    globalThis.dispatchEvent(installPrompt);
  });

  const shortcut = page.getByRole('button', { name: 'Phone Install', exact: true });
  await expect(shortcut).toBeVisible();
  await shortcut.click();
  await expect(page.locator('#androidInstallInstructions')).toBeVisible();
  await expect(page.locator('#iosInstallInstructions')).toBeHidden();
  const installButton = page.getByRole('button', { name: 'Install app', exact: true });
  await expect(installButton).toBeVisible();
  await installButton.click({ force: true });
  await expect.poll(() => page.evaluate(() => globalThis.recordedAnalyticsEvents.filter(eventArguments => eventArguments[1] === 'ca_install_interaction'))).toEqual([
    ['event', 'ca_install_interaction', { install_action: 'instructions_open' }],
    ['event', 'ca_install_interaction', { install_action: 'prompt_open' }],
    ['event', 'ca_install_interaction', { install_action: 'prompt_dismissed' }]
  ]);
  await page.evaluate(() => {
    globalThis.cnslAnalytics.trackInteraction(
      globalThis.AnalyticsInteractionType.INSTALL,
      { action: 'android' }
    );
  });
  await expect.poll(() => page.evaluate(() => globalThis.recordedAnalyticsEvents.filter(eventArguments => eventArguments[1] === 'ca_install_interaction'))).toHaveLength(3);
});

test('[WF-INSTALL-003] accepted browser installation publishes only coarse install stages', async ({ page }) => {
  await page.setViewportSize(MOBILE_VIEWPORT);
  await initializeAnalyticsRecorder(page);
  await page.addInitScript(() => {
    Object.defineProperty(globalThis.navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0 (Linux; Android 15; Mobile) AppleWebKit/537.36 Chrome/136.0 Mobile Safari/537.36'
    });
  });
  await page.goto('/index.html');
  await page.evaluate(() => {
    const installPrompt = new Event('beforeinstallprompt', { cancelable: true });
    installPrompt.prompt = () => {};
    installPrompt.userChoice = Promise.resolve({ outcome: 'accepted' });
    globalThis.dispatchEvent(installPrompt);
  });

  await page.getByRole('button', { name: 'Phone Install', exact: true }).click();
  const installButton = page.getByRole('button', { name: 'Install app', exact: true });
  await expect(installButton).toBeVisible();
  await installButton.click({ force: true });
  await page.evaluate(() => globalThis.dispatchEvent(new Event('appinstalled')));
  await expect.poll(() => page.evaluate(() => globalThis.recordedAnalyticsEvents.filter(eventArguments => eventArguments[1] === 'ca_install_interaction'))).toEqual([
    ['event', 'ca_install_interaction', { install_action: 'instructions_open' }],
    ['event', 'ca_install_interaction', { install_action: 'prompt_open' }],
    ['event', 'ca_install_interaction', { install_action: 'prompt_accepted' }],
    ['event', 'ca_install_interaction', { install_action: 'installed' }]
  ]);
});

test('[WF-SETTINGS-003] home page settings reminder is dismissed permanently by link or close button', async ({ page }) => {
  await initializeAnalyticsRecorder(page);
  await page.goto('/index.html');

  const notice = page.locator('#settingsNotice');
  await expect(notice).toBeVisible();
  await expect(notice).toContainText('First time here? Set your preferences in Settings!');
  await page.locator('#settingsNoticeLink').click();
  await expect(page.locator('#settingsDialog')).toBeVisible();
  await expect(notice).toBeHidden();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('cnsl_settings_notice_dismissed'))).toBe('true');

  await page.getByRole('button', { name: 'Close settings' }).click();
  await page.goto('/index.html');
  await expect(notice).toBeHidden();

  await page.evaluate(() => localStorage.removeItem('cnsl_settings_notice_dismissed'));
  await page.reload();
  await expect(notice).toBeVisible();
  await page.getByRole('button', { name: 'Dismiss settings reminder' }).focus();
  await page.keyboard.press('Enter');
  await expect(notice).toBeHidden();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('cnsl_settings_notice_dismissed'))).toBe('true');
  await expect.poll(() => page.evaluate(() => globalThis.recordedAnalyticsEvents.filter(eventArguments => eventArguments[1] === 'ca_banner_interaction' && eventArguments[2].banner_name === 'settings_notice'))).toEqual([
    ['event', 'ca_banner_interaction', { banner_name: 'settings_notice', banner_action: 'view' }],
    ['event', 'ca_banner_interaction', { banner_name: 'settings_notice', banner_action: 'open' }],
    ['event', 'ca_banner_interaction', { banner_name: 'settings_notice', banner_action: 'view' }],
    ['event', 'ca_banner_interaction', { banner_name: 'settings_notice', banner_action: 'dismiss' }]
  ]);

  await page.goto('/pools.html');
  await expect(page.locator('#settingsNotice')).toHaveCount(0);
});

test('[WF-POOLS-001] pool feature filters expose their state and resulting count', async ({ page }) => {
  await initializeAnalyticsRecorder(page);
  await page.goto('/pools.html');
  await expect(page.locator('#poolListStatus')).toContainText('Pool directory loaded.');

  const filters = page.locator('#togglePoolFeatureFilters');
  await page.locator('#poolFeatureFilter').click({ position: { x: 4, y: 4 } });
  await expect(filters).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('.pool-filter__group--accessibility')).toBeVisible();
  await expect(page.locator('.pool-filter__option--young-swimmers').first()).toBeVisible();
  await expect(page.locator('.pool-filter__option--water-play').first()).toBeVisible();
  await expect(page.getByLabel('Meter lanes')).toBeVisible();
  await expect(page.getByLabel('Yard lanes')).toBeVisible();
  await expect(page.locator('.pool-filter__data-marker')).toHaveCount(0);
  await expect(page.locator('#poolLaneUnitsNote')).toHaveCount(0);
  const chipColors = await Promise.all([
    page.locator('.pool-filter__option--accessibility > span').first().evaluate(chip => globalThis.getComputedStyle(chip).backgroundColor),
    page.locator('.pool-filter__option--young-swimmers > span').first().evaluate(chip => globalThis.getComputedStyle(chip).backgroundColor),
    page.locator('.pool-filter__option--water-play > span').first().evaluate(chip => globalThis.getComputedStyle(chip).backgroundColor)
  ]);
  expect(new Set(chipColors).size).toBe(3);
  await page.locator('input[name="poolFeature"]').first().check();

  await expect(page.locator('#poolFilterSummary')).toHaveText(/\d+ \/ 23 pools/);
  await expect(page.locator('#poolFeatureFilterCount')).toHaveText('1 selected');

  await page.locator('#clearPoolFeatureFilters').click();
  await expect(filters).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#poolFilterSummary')).toHaveText('23 pools');
  await expect.poll(() => page.evaluate(() => globalThis.recordedAnalyticsEvents.filter(eventArguments => eventArguments[1] === 'ca_setting_change'))).toEqual([
    ['event', 'ca_setting_change', { setting_name: 'pool_feature_filters' }],
    ['event', 'ca_setting_change', { setting_name: 'pool_feature_filters' }]
  ]);

  await page.locator('#poolFeatureFilterOptions').evaluate(options => {
    const untrustedInput = options.ownerDocument.createElement('input');
    untrustedInput.type = 'checkbox';
    untrustedInput.name = 'poolFeature';
    untrustedInput.value = 'person@example.com';
    untrustedInput.checked = true;
    options.appendChild(untrustedInput);
    untrustedInput.dispatchEvent(new options.ownerDocument.defaultView.Event('change', { bubbles: true }));
  });
  await expect.poll(() => page.evaluate(() => globalThis.recordedAnalyticsEvents.filter(eventArguments => eventArguments[1] === 'ca_setting_change'))).toHaveLength(2);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('cnsl_preferences')).poolFeatureFilters)).toEqual([]);
});

test('[WF-POOLS-014] yoga feature filter finds the pool with published yoga programming', async ({ page }) => {
  await page.goto('/pools.html');
  await expect(page.locator('#poolListStatus')).toContainText('Pool directory loaded.');

  await page.locator('#togglePoolFeatureFilters').click();
  await expect(page.getByLabel('Yoga')).toBeVisible();
  await page.getByLabel('Yoga').check();

  await expect(page.locator('#poolFilterSummary')).toHaveText('1 / 23 pools');
  await expect(page.locator('#poolList .pool-card')).toHaveCount(1);
  await expect(page.locator('#poolList .pool-card')).toContainText('Stevens Forest');
});

test('[WF-POOLS-018] lessons feature identifies CA outdoor lesson pools and links with the shared icon', async ({ page }) => {
  await page.goto('/pools.html');
  await expect(page.locator('#poolListStatus')).toContainText('Pool directory loaded.');

  await page.locator('#togglePoolFeatureFilters').click();
  await page.getByLabel('Lessons').check();

  await expect(page.locator('#poolFilterSummary')).toHaveText('7 / 23 pools');
  await expect(page.locator('#poolList .pool-card')).toHaveCount(7);
  await expect.poll(() => page.locator('#poolList .pool-card').evaluateAll(cards => cards.map(card => card.dataset.poolName))).toEqual([
    'Dorsey Hall',
    'Faulkner Ridge',
    'Hawthorn',
    'Kendall Ridge',
    'River Hill',
    'Running Brook',
    'Talbott Springs'
  ]);

  const firstPool = page.locator('#poolList .pool-card').first();
  await firstPool.locator('.pool-header__toggle').click();
  const lessonsPill = firstPool.getByRole('link', { name: 'Lessons' });
  const lessonsLinkIcon = lessonsPill.locator('.feature-pill__link-icon');
  await expect(lessonsPill).toHaveAttribute('href', 'lessons.html');
  await expect(lessonsLinkIcon).toBeVisible();
  await expect(lessonsLinkIcon.locator('use')).toHaveAttribute('href', '#icon-link');
});

test('[WF-POOLS-002] pool availability filters cover live status and the upcoming seven days', async ({ page }) => {
  await page.route('**/assets/data/2026/pools/pools.json*', async route => {
    const response = await route.fetch();
    const poolData = await response.json();
    poolData.pools.forEach((pool, index) => {
      pool.schedules = [{
        startDate: '2026-05-23',
        endDate: '2026-09-07',
        hours: [
          {
            weekDays: index === 2 ? ['Tue', 'Wed'] : ['Tue'],
            startTime: index === 1 ? '3:45PM' : '1:00PM',
            endTime: index < 2 ? '6:00PM' : '4:00PM',
            types: ['Rec Swim'],
            accessStatus: 'public'
          },
          ...(['Thu', 'Fri', 'Sat', 'Sun', 'Mon'][index - 3] ? [{
            weekDays: [['Thu', 'Fri', 'Sat', 'Sun', 'Mon'][index - 3]],
            startTime: '1:00PM',
            endTime: '4:00PM',
            types: ['Rec Swim'],
            accessStatus: 'public'
          }] : []),
          ...(index === 4 ? [{
            weekDays: ['Thu'],
            startTime: '6:00PM',
            endTime: '9:00PM',
            types: ['Registration-required event'],
            accessStatus: 'public',
            isSpecialEvent: true
          }] : [])
        ]
      }];
      pool.scheduleOverrides = [];
    });
    await route.fulfill({ response, json: poolData });
  });
  await page.goto('/pools.html');
  await page.evaluate(() => {
    globalThis.TimeUtils.getCurrentEasternTimeInfo = () => ({
      date: '2026-05-26', day: 'Tue', minutes: 15 * 60, isValid: true
    });
    globalThis.dispatchEvent(new globalThis.Event('cnsl:preferences-changed'));
  });
  await page.locator('#togglePoolFeatureFilters').click();
  await expect(page.getByLabel('When pools are open for general use')).toBeVisible();

  await expect(page.locator('#poolAvailabilityFilter option')).toHaveText([
    'All pools',
    'Now',
    'Within the hour',
    'For next 2 hours',
    'Today',
    'Tomorrow',
    'Thursday',
    'Friday',
    'Saturday',
    'Sunday',
    'Monday'
  ]);

  await page.selectOption('#poolAvailabilityFilter', 'open-now');
  await expect(page.locator('#poolFilterSummary')).toHaveText('22 / 23 pools');

  await page.locator('#poolAvailabilityFilter').focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('#poolAvailabilityFilter')).toHaveValue('opens-soon');
  await expect(page.locator('#poolFilterSummary')).toHaveText('1 / 23 pools');
  await expect(page.locator('#poolListStatus')).toHaveText('Pool directory filtered to pools opening within the hour.');

  await page.keyboard.press('ArrowDown');
  await expect(page.locator('#poolAvailabilityFilter')).toHaveValue('open-next-two-hours');

  await page.keyboard.press('ArrowDown');
  await expect(page.locator('#poolAvailabilityFilter')).toHaveValue('open-today');
  await expect(page.locator('#poolFilterSummary')).toHaveText('23 / 23 pools');
  await expect(page.locator('#poolListStatus')).toHaveText('Pool directory filtered to pools with general-use hours today.');
  await expect(page.locator('#poolList .pool-status-indicator.gray')).toHaveCount(0);

  await page.keyboard.press('ArrowDown');
  await expect(page.locator('#poolAvailabilityFilter')).toHaveValue('open-tomorrow');
  await expect(page.locator('#poolFilterSummary')).toHaveText('1 / 23 pools');
  await expect(page.locator('#poolListStatus')).toHaveText('Pool directory filtered to pools with general-use hours tomorrow.');
  await expect(page.locator('#poolList .pool-transition-summary')).toHaveText('Wed 1pm - 4pm');
  await expect(page.locator('#poolList .pool-transition-summary')).toHaveAttribute(
    'aria-label',
    'Wednesday general-use hours: 1:00 PM to 4:00 PM'
  );
  await expect(page.locator('#poolList .pool-status-indicator.gray')).toHaveCount(1);
  await expect(page.locator('#poolList .pool-header__toggle')).toHaveAccessibleName(/Current status not applicable/);
  await expect(page.locator('#poolList')).not.toContainText(/Opens in|Closes in/);

  await page.selectOption('#poolAvailabilityFilter', 'open-day-2');
  await expect(page.locator('#poolFilterSummary')).toHaveText('1 / 23 pools');
  await expect(page.locator('#poolListStatus')).toHaveText('Pool directory filtered to pools with general-use hours Thursday.');
  await expect(page.locator('#poolList .pool-transition-summary')).toHaveText('Thu 1pm - 4pm');
  await expect(page.locator('#poolList .pool-status-indicator.gray')).toHaveCount(1);

  await page.selectOption('#poolAvailabilityFilter', 'open-next-two-hours');
  await expect(page.locator('#poolFilterSummary')).toHaveText('1 / 23 pools');
  await expect(page.locator('#poolList .pool-card')).toHaveCount(1);
  await expect(page.locator('#poolFeatureFilterCount')).toHaveText('1 selected');

  await page.locator('#clearPoolFeatureFilters').click();
  await expect(page.locator('#poolAvailabilityFilter')).toHaveValue('all');
  await expect(page.locator('#poolFilterSummary')).toHaveText('23 pools');
});

test('[WF-POOLS-003] pool tile features are ordered by category then alphabetically', async ({ page }) => {
  await page.route('**/assets/data/2026/pools/pools.json*', async route => {
    const response = await route.fetch();
    const poolData = await response.json();
    const scrambledFeatures = ['wifi', 'slide', 'wading', 'lap', 'ada compliant', 'bathhouse', 'family changing room', 'beach entry'];
    poolData.pools.forEach(pool => {
      pool.features = scrambledFeatures;
    });
    await route.fulfill({ response, json: poolData });
  });
  await page.goto('/pools.html');
  await expect(page.locator('#poolListStatus')).toContainText('Pool directory loaded.');

  const firstPoolCard = page.locator('.pool-card').first();
  await firstPoolCard.locator('.pool-header__toggle').click();
  await expect(firstPoolCard.locator('.pool-course')).toHaveCount(0);
  await expect(firstPoolCard.locator('.feature-pill')).toHaveText([
    'ADA compliant',
    'Family changing room',
    'Beach entry',
    'Wading pool',
    '6 lanes',
    'Lap',
    'Meter lanes',
    'Slide',
    'Bathhouse',
    'Wi-Fi'
  ]);
});

test('[WF-POOLS-004] collapsed favorite pool stays collapsed after filters redraw the directory', async ({ page }) => {
  await initializeAnalyticsRecorder(page);
  await page.goto('/pools.html');
  await page.evaluate(() => {
    localStorage.setItem('cnsl_preferences', JSON.stringify({ favoritePoolName: 'Bryant Woods' }));
  });
  await page.reload();
  await expect(page.locator('#poolListStatus')).toContainText('Pool directory loaded.');

  let favoriteToggle = page.locator('.favorite-card .pool-header__toggle');
  await expect(favoriteToggle).toHaveAttribute('aria-expanded', 'true');
  await favoriteToggle.evaluate(toggle => {
    toggle.closest('[data-pool-card]').classList.remove('favorite-card');
    toggle.click();
  });
  favoriteToggle = page.locator('[data-pool-name="Bryant Woods"] [data-pool-card-action="toggle"]');
  await expect(favoriteToggle).toHaveAttribute('aria-expanded', 'false');
  await expect.poll(() => page.evaluate(() => globalThis.recordedAnalyticsEvents.at(-1))).toEqual([
    'event', 'ca_setting_change', { setting_name: 'favorite_pool_expanded' }
  ]);

  await page.locator('#togglePoolFeatureFilters').click();
  await page.locator('input[name="poolFeature"]').first().check();
  await page.locator('#clearPoolFeatureFilters').click();
  favoriteToggle = page.locator('.favorite-card .pool-header__toggle');
  await expect(favoriteToggle).toHaveAttribute('aria-expanded', 'false');

  await page.reload();
  await expect(page.locator('.favorite-card .pool-header__toggle')).toHaveAttribute('aria-expanded', 'false');
});

test('[WF-TEAMS-001] collapsed favorite team stays collapsed after returning to the directory', async ({ page }) => {
  await initializeAnalyticsRecorder(page);
  await page.goto('/teams.html');
  await page.evaluate(() => {
    localStorage.setItem('cnsl_preferences', JSON.stringify({ favoriteTeamId: 'cfhss' }));
  });
  await page.reload();
  await expect(page.locator('#teamListStatus')).toContainText('Team directory loaded.');

  const favoriteToggle = page.locator('.favorite-card .team-header__toggle');
  await expect(favoriteToggle).toHaveAttribute('aria-expanded', 'true');
  await favoriteToggle.evaluate(toggle => {
    toggle.closest('[data-team-card]').classList.remove('favorite-card');
    toggle.click();
  });
  const stableFavoriteToggle = page.locator('[data-team-id="cfhss"] [data-team-card-action="toggle"]');
  await expect(stableFavoriteToggle).toHaveAttribute('aria-expanded', 'false');
  await expect.poll(() => page.evaluate(() => globalThis.recordedAnalyticsEvents.filter(eventArguments => eventArguments[1] === 'ca_setting_change'))).toEqual([
    ['event', 'ca_setting_change', { setting_name: 'favorite_team_expanded' }]
  ]);

  await page.reload();
  await expect(page.locator('.favorite-card .team-header__toggle')).toHaveAttribute('aria-expanded', 'false');
});

test('[WF-TEAMS-002] team directory groups practice and meet disclosures in one readable schedule list', async ({ page }) => {
  await setAgendaReferenceTime(page);
  await page.goto('/teams.html');
  await expect(page.locator('#teamListStatus')).toContainText('Team directory loaded.');

  const sundevils = page.locator('.team-card[data-team-id="cfhss"]');
  await sundevils.locator('.team-header__toggle').click();
  const schedules = sundevils.locator('.practice-schedule');
  const scheduleRows = schedules.locator(':scope > .practice-schedule__phase');
  await expect(schedules.getByRole('heading', { name: 'Schedules' })).toBeVisible();
  await expect(scheduleRows).toHaveCount(3);
  await expect(scheduleRows.locator('.practice-schedule__title')).toHaveText(['Pre-season practices', 'In-season practices', 'Meets']);
  const collapsedGaps = await scheduleRows.evaluateAll(rows => rows.slice(1).map((row, index) => (
    Math.round(row.getBoundingClientRect().top - rows[index].getBoundingClientRect().bottom)
  )));
  expect(collapsedGaps[0]).toBe(collapsedGaps[1]);
  const preSeason = sundevils.locator('.practice-schedule__phase').filter({ hasText: 'Pre-season practices' });
  const inSeason = sundevils.locator('.practice-schedule__phase').filter({ hasText: 'In-season practices' });
  await expect(preSeason).toHaveCount(1);
  await expect(inSeason).toHaveCount(1);
  await expect(preSeason).not.toHaveAttribute('open', '');
  await expect(inSeason).not.toHaveAttribute('open', '');
  await expect(preSeason).toHaveClass(/practice-schedule__phase--current/);
  await expect(preSeason.locator('.practice-schedule__badge')).toHaveText('Current schedule');
  await preSeason.locator('summary').click();
  await expect(preSeason.locator('.practice-period--current')).toHaveCount(1);
  await expect(preSeason.locator('.practice-period--current')).toContainText('May 26 - May 29');
  await expect(preSeason.locator('.practice-period__badge')).toHaveText('Current period');
  await expect(preSeason.locator('.practice-period--upcoming')).toHaveCount(0);
  const practicePanelWidth = await sundevils.locator('.practice-schedule').evaluate(element => element.getBoundingClientRect().width);
  const teamCardWidth = await sundevils.evaluate(element => element.getBoundingClientRect().width);
  expect(practicePanelWidth).toBeLessThan(teamCardWidth);
  expect(practicePanelWidth).toBeGreaterThan(608);
  expect(practicePanelWidth).toBeLessThanOrEqual(704);
  await expect(inSeason).not.toHaveClass(/practice-schedule__phase--current/);
  await inSeason.locator('summary').click();
  await expect(inSeason.locator('.practice-schedule__body')).toBeVisible();
  await expect(inSeason).toContainText('Swansfield Pool');
  await expect(inSeason).toContainText('8:00 - 8:30am');
  const meetSchedule = schedules.locator('.team-meets__phase');
  await expect(meetSchedule).not.toHaveAttribute('open', '');
  await expect(meetSchedule.getByText('Home meet')).toBeVisible();
  await expect(meetSchedule.locator('.team-meets__table')).not.toBeVisible();
  await meetSchedule.locator('summary').focus();
  await page.keyboard.press('Enter');
  await expect(meetSchedule).toHaveAttribute('open', '');
  await expect(meetSchedule.locator('.team-meets__body > .team-meets__table')).toBeVisible();
  await expect(meetSchedule.locator('thead th')).toHaveText(['Date', 'Meet', 'Matchup', 'Pool']);
  await expect(meetSchedule.locator('tbody tr')).toHaveCount(8);
  const timeTrials = meetSchedule.locator('tbody tr').first();
  await expect(timeTrials.locator('td').nth(0)).toContainText('June 6');
  await expect(timeTrials.locator('.team-meets__time')).toHaveText('7:00 AM - 12:00 PM');
  await expect(timeTrials.locator('td').nth(1)).toHaveText('Time Trials for returning / experienced swimmers');
  const firstMeet = meetSchedule.locator('tbody tr').nth(1);
  await expect(firstMeet.locator('td').nth(0)).toContainText('June 13');
  await expect(firstMeet.locator('.team-meets__time')).toHaveText('7:00 AM - 12:00 PM');
  await expect(firstMeet.locator('td').nth(1)).toHaveText('Dual #1');
  await expect(firstMeet).toHaveClass(/team-meets__row--home/);
  await expect(firstMeet.locator('.team-meets__matchup')).toHaveText("Clary's Forest, Hawthorn, Swansfield vs. Oakland Mills");
  await expect(firstMeet.locator('.team-meets__matchup strong')).toHaveText("Clary's Forest, Hawthorn, Swansfield");
  await expect(firstMeet.locator('.team-meets__course--nonstandard')).toHaveText('6-lane / 25-meter');
  const awayMeet = meetSchedule.locator('tbody tr').nth(2);
  await expect(awayMeet).not.toHaveClass(/team-meets__row--home/);
  await expect(awayMeet.locator('.team-meets__matchup')).toHaveText("Owen Brown vs. Clary's Forest, Hawthorn, Swansfield");
  await expect(awayMeet.locator('.team-meets__matchup strong')).toHaveText("Clary's Forest, Hawthorn, Swansfield");
  await expect(awayMeet.locator('.team-meets__course')).toHaveText('8-lane / 25-yard');
  await expect(awayMeet.locator('.team-meets__course--nonstandard')).toHaveCount(0);
  await expect(firstMeet.locator('.team-meets__matchup-team')).toHaveText(["Clary's Forest, Hawthorn, Swansfield", 'vs. Oakland Mills']);
  await expect(firstMeet.getByRole('link', { name: 'Swansfield' })).toHaveAttribute('href', /pools\.html\?pool=/);
  await expect(firstMeet).not.toContainText('Swansfield Pool');
  const primaryActions = sundevils.locator('.team-actions--website');
  const calendarActions = sundevils.locator('.team-actions--calendar');
  await expect(sundevils.locator('.practice-schedule + .team-actions--website')).toHaveCount(1);
  await expect(primaryActions.locator('a')).toHaveText(['Team Website', 'Practice Schedule']);
  await expect(primaryActions.getByRole('link', { name: 'Team Website' })).toBeVisible();
  await expect(primaryActions.getByRole('link', { name: 'Practice Schedule' })).toHaveAttribute('href', /practice-schedule/);
  await expect(calendarActions.locator('a')).toHaveText(['Team Calendar']);
  await expect(calendarActions.getByRole('link', { name: 'Team Calendar' })).toHaveAttribute('href', /\/page\/calendar$/);
  await expect(calendarActions.getByRole('link', { name: 'Subscribe to team events calendar' })).toHaveCount(0);
});

test('[WF-TEAMS-009] next pre-season practice period is marked upcoming between published ranges', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-05-30T12:00:00'));
  await page.goto('/teams.html');
  await expect(page.locator('#teamListStatus')).toContainText('Team directory loaded.');

  const sundevils = page.locator('.team-card[data-team-id="cfhss"]');
  await sundevils.locator('.team-header__toggle').click();
  const preSeason = sundevils.locator('.practice-schedule__phase').filter({ hasText: 'Pre-season practices' });
  await preSeason.locator('summary').click();

  const upcomingPeriod = preSeason.locator('.practice-period--upcoming');
  await expect(preSeason).not.toHaveClass(/practice-schedule__phase--current/);
  await expect(upcomingPeriod).toHaveCount(1);
  await expect(upcomingPeriod).toContainText('June 1 - June 18');
  await expect(upcomingPeriod.locator('.practice-period__badge')).toHaveText('Upcoming period');
});

test('[WF-TEAMS-003] team directory filters regular practice times to selected practice groups', async ({ page }) => {
  await seedPreferences(page, { practiceGroups: ['9-10'] });
  await page.goto('/teams.html');
  await expect(page.locator('#teamListStatus')).toContainText('Team directory loaded.');

  const sundevils = page.locator('.team-card[data-team-id="cfhss"]');
  await sundevils.locator('.team-header__toggle').click();
  const schedule = sundevils.locator('.practice-schedule__phase').filter({ hasText: 'In-season practices' });
  await schedule.locator('summary').click();
  await expect(schedule).toContainText('8:30 - 9:15am');
  await expect(schedule).toContainText('5:00 - 5:45pm');
  await expect(schedule).not.toContainText('8:00 - 8:30am');
  await expect(schedule).not.toContainText('9:15 - 10:00am');
  await expect(schedule).not.toContainText('5:45 - 6:30pm');
});

test('[WF-TEAMS-004] published Long Reach merchandise and booster actions appear in team details', async ({ page }) => {
  await page.setViewportSize(MOBILE_VIEWPORT);
  await initializeAnalyticsRecorder(page);
  await page.goto('/teams.html');
  await expect(page.locator('#teamListStatus')).toContainText('Team directory loaded.');

  const marlins = page.locator('.team-card[data-team-id="lrm"]');
  const merchandiseLink = marlins.getByRole('link', { name: 'Get Your Official Marlins Gear! (opens in new tab)' });
  await expect(merchandiseLink).toBeHidden();
  await marlins.locator('.team-header__toggle').click();
  await expect(merchandiseLink).toBeVisible();
  await expect(merchandiseLink)
    .toHaveAttribute('href', 'https://2026-long-marlins-swimseason.spiritsale.com/');
  await expect(marlins.getByRole('link', { name: 'Team Calendar' }))
    .toHaveAttribute('href', 'https://www.gomotionapp.com/team/reccnsllrm/page/events');
  await expect(marlins.getByRole('link', { name: 'Subscribe to team events calendar' }))
    .toHaveAttribute('href', 'https://www.gomotionapp.com/rest/ics/system/5/Events.ics?key=eH0JlshDIHydTEGomF73nQ%3D%3D&enabled=false&tz=America%2FNew_York');
  const calendarActionTops = await marlins.locator('.team-actions--calendar a').evaluateAll(links => (
    links.map(link => link.getBoundingClientRect().top)
  ));
  expect(Math.abs(calendarActionTops[0] - calendarActionTops[1])).toBeLessThan(1);
  await expect(marlins.getByRole('link', { name: 'Booster Club', exact: true }))
    .toHaveAttribute('href', 'https://www.longreachmarlins.org/');
  await marlins.locator('.team-merchandise').evaluate(link => {
    link.addEventListener('click', event => event.preventDefault(), { once: true });
    link.classList.remove('team-merchandise');
    link.click();
  });
  await expect.poll(() => page.evaluate(() => globalThis.recordedAnalyticsEvents.at(-1))).toEqual([
    'event', 'ca_external_link', { link_context: 'team_details', link_purpose: 'merchandise', link_destination: 'spirit_sale' }
  ]);
  await merchandiseLink.evaluate(link => {
    link.closest('[data-team-card]').dataset.analyticsContext = 'injected_context';
    link.dataset.analyticsLinkPurpose = 'injected_purpose';
    link.addEventListener('click', event => event.preventDefault(), { once: true });
    link.click();
  });
  await expect.poll(() => page.evaluate(() => globalThis.recordedAnalyticsEvents.at(-1))).toEqual([
    'event', 'ca_external_link', { link_context: 'other', link_purpose: 'general', link_destination: 'spirit_sale' }
  ]);
  await expect(marlins.locator('.team-header__toggle')).toHaveAttribute('aria-expanded', 'true');

  const sundevils = page.locator('.team-card[data-team-id="cfhss"]');
  await expect(sundevils.locator('.team-merchandise')).toHaveCount(0);
  await expect(sundevils.getByRole('link', { name: /Booster Club/ })).toHaveCount(0);
});

test('[WF-TEAMS-005] unknown team deep links leave the loaded directory stable', async ({ page }) => {
  await page.goto('/teams.html?team=not-a-published-team%22%5D');
  await expect(page.locator('#teamListStatus')).toContainText('Team directory loaded.');
  const teamCards = page.locator('.team-card');
  const renderedTeamCount = await teamCards.count();
  expect(renderedTeamCount).toBeGreaterThan(0);
  await expect(page.locator('.team-card.highlighted')).toHaveCount(0);
  await page.waitForTimeout(300);
  await expect(teamCards).toHaveCount(renderedTeamCount);
  await expect(page.locator('.team-card.highlighted')).toHaveCount(0);
});

test('[WF-TEAMS-006] team meet schedule shows all columns within its phone-width panel', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 900 });
  await setAgendaReferenceTime(page);
  await page.goto('/teams.html');
  await expect(page.locator('#teamListStatus')).toContainText('Team directory loaded.');

  const sundevils = page.locator('.team-card[data-team-id="cfhss"]');
  await sundevils.locator('.team-header__toggle').click();
  const meetSchedule = sundevils.locator('.team-meets__phase');
  await meetSchedule.locator('summary').click();
  const scheduleBody = meetSchedule.locator('.team-meets__body');
  await expect(scheduleBody.locator(':scope > .team-meets__table')).toBeVisible();
  const sizing = await scheduleBody.evaluate(element => ({
    overflow: element.scrollWidth - element.clientWidth,
    bodyWidth: element.getBoundingClientRect().width,
    tableWidth: element.querySelector('.team-meets__table').getBoundingClientRect().width
  }));
  expect(sizing.overflow).toBeLessThanOrEqual(1);
  expect(Math.abs(sizing.tableWidth - sizing.bodyWidth)).toBeLessThanOrEqual(1);
  await expect(meetSchedule.locator('tbody tr').first().locator('td').nth(1)).toHaveText('Time Trials for returning / experienced swimmers');
  await expect(meetSchedule.locator('tbody tr').first().locator('.team-meets__time')).toHaveText('7:00 AM - 12:00 PM');
  await expect(meetSchedule.locator('tbody tr').first().locator('td').nth(2)).toBeEmpty();
  await expect(meetSchedule.locator('tbody tr').first().locator('td').nth(3)).toContainText('Swansfield');
  await expect(meetSchedule.locator('tbody tr').nth(1).locator('td').nth(1)).toHaveText('Dual #1');
  await expect(meetSchedule.locator('tbody tr').nth(1).locator('.team-meets__time')).toHaveText('7:00 AM - 12:00 PM');
  await expect(meetSchedule).toContainText('All-City Championship Meet Part 1');
  await expect(meetSchedule.locator('.team-meets__course--nonstandard').first()).toHaveText('6-lane / 25-meter');
});

test('[WF-TEAMS-007] phone-width team details expose upcoming and full practice schedules without cramped labels', async ({ page }) => {
  await page.setViewportSize(MOBILE_VIEWPORT);
  await setAgendaReferenceTime(page);
  await page.goto('/teams.html');
  await expect(page.locator('#teamListStatus')).toContainText('Team directory loaded.');

  const snappers = page.locator('.team-card[data-team-id="pls"]');
  await snappers.locator('.team-header__toggle').click();
  await expect(snappers.locator('.favorite-week')).toContainText('Next morning practice');

  const preSeason = snappers.locator('.practice-schedule__phase').filter({ hasText: 'Pre-season practices' });
  const inSeason = snappers.locator('.practice-schedule__phase').filter({ hasText: 'In-season practices' });
  await expect(preSeason).toHaveAttribute('open', '');
  await expect(inSeason).toHaveAttribute('open', '');
  await expect(preSeason.locator('.practice-schedule__body')).toBeVisible();
  await expect(inSeason.locator('.practice-schedule__body')).toBeVisible();
  await expect(inSeason).toContainText('Morning Practice:');

  const trainingLabel = preSeason.locator('.session-group', { hasText: 'Lap requirement training' });
  const labelSizing = await trainingLabel.evaluate(label => {
    const styles = label.ownerDocument.defaultView.getComputedStyle(label);
    return {
      height: label.getBoundingClientRect().height,
      lineHeight: Number.parseFloat(styles.lineHeight),
      marginRight: Number.parseFloat(styles.marginRight)
    };
  });
  expect(labelSizing.marginRight).toBe(0);
  expect(labelSizing.height).toBeLessThanOrEqual(labelSizing.lineHeight + 1);
});

test('[WF-TEAMS-008] touch-capable team details expose every published practice phase', async ({ browser }) => {
  const touchContext = await browser.newContext({
    baseURL: 'http://127.0.0.1:4173',
    hasTouch: true,
    isMobile: true,
    viewport: { width: 980, height: 915 }
  });
  const touchPage = await touchContext.newPage();

  try {
    await prepareStableWeatherResponses(touchPage);
    await touchPage.goto('/teams.html');
    await expect(touchPage.locator('#teamListStatus')).toContainText('Team directory loaded.');
    await expect.poll(() => touchPage.evaluate(() => ({
      compact: globalThis.matchMedia('(max-width: 48rem)').matches,
      maxTouchPoints: globalThis.navigator.maxTouchPoints
    }))).toEqual({ compact: false, maxTouchPoints: 1 });

    const marlins = touchPage.locator('.team-card[data-team-id="lrm"]');
    await marlins.locator('.team-header__toggle').click();
    await expect(marlins.locator('.practice-schedule__phase').filter({ hasText: 'Pre-season practices' })).toHaveAttribute('open', '');
    await expect(marlins.locator('.practice-schedule__phase').filter({ hasText: 'In-season practices' })).toHaveAttribute('open', '');
  } finally {
    await touchContext.close();
  }
});

test('[WF-AGENDA-001] team directory shows the same next practices and swim event agenda as home', async ({ page }) => {
  await setAgendaReferenceTime(page);
  await page.goto('/teams.html');
  await expect(page.locator('#teamListStatus')).toContainText('Team directory loaded.');

  const snappers = page.locator('.team-card[data-team-id="pls"]');
  await snappers.locator('.team-header__toggle').click();
  const agenda = snappers.locator('.favorite-week');
  await expect(agenda.getByRole('heading', { name: 'Upcoming events' })).toBeVisible();
  await expect(agenda.locator('.favorite-week__status')).toHaveCount(0);
  await expect(agenda.locator('.favorite-week__events li')).toHaveCount(3);
  await expect(agenda.locator('.favorite-week__day-relative')).toHaveText(['today', 'in 11 days', 'in 24 days']);
  await expect(agenda.locator('.favorite-week__day-relative.upcoming-day-pill')).toHaveCount(3);
  await expect(agenda.locator('.favorite-week__day-relative.upcoming-day-pill--today')).toHaveText('today');
  await expect.poll(() => agenda.locator('.favorite-week__day').first().evaluate(day => {
    const dayHeading = day.querySelector('h4');
    const events = day.querySelector('.favorite-week__events');
    return Math.round(events.getBoundingClientRect().left - dayHeading.getBoundingClientRect().left);
  })).toBe(0);
  await expect.poll(() => agenda.locator('.favorite-week__day').first().evaluate(day => {
    const heading = day.querySelector('h4');
    const date = heading.querySelector('span');
    const relativeDay = heading.querySelector('.favorite-week__day-relative');
    const headingBox = heading.getBoundingClientRect();
    const dateBox = date.getBoundingClientRect();
    const relativeDayBox = relativeDay.getBoundingClientRect();
    return {
      alignedRight: Math.abs(headingBox.right - relativeDayBox.right) <= 1,
      sameLine: relativeDayBox.top < dateBox.bottom && relativeDayBox.bottom > dateBox.top
    };
  })).toEqual({ alignedRight: true, sameLine: true });
  await expect(agenda).toContainText('Next morning practice');
  await expect(agenda).toContainText('Next evening practice');
  await expect(agenda).toContainText('Next swim event: Time Trials for returning / experienced swimmers');
  await expect(agenda).toContainText('7:00 AM - 12:00 PM');
  await expect(agenda).not.toContainText("Each Team's Home Pool");
  await expect(agenda).not.toContainText('Jeffers Hill Pool');
});

test('[WF-AGENDA-006] desktop team agendas align to the centered team-details measure', async ({ page }) => {
  await setAgendaReferenceTime(page);
  await page.goto('/teams.html');
  await expect(page.locator('#teamListStatus')).toContainText('Team directory loaded.');

  const snappers = page.locator('.team-card[data-team-id="pls"]');
  await snappers.locator('.team-header__toggle').click();
  await expect.poll(() => snappers.locator('.favorite-week__days').evaluate(days => {
    const firstDay = days.querySelector('.favorite-week__day');
    const heading = firstDay.querySelector('h4');
    const events = firstDay.querySelector('.favorite-week__events');
    return {
      aligned: Math.abs(heading.getBoundingClientRect().left - events.getBoundingClientRect().left) <= 1,
      width: Math.round(days.getBoundingClientRect().width)
    };
  })).toEqual({ aligned: true, width: 704 });
});

test('[WF-AGENDA-002] home page shows the next practices and swim event for a selected favorite team', async ({ page }) => {
  await setAgendaReferenceTime(page);
  await seedPreferences(page, { favoriteTeamId: 'pls' });
  let resolveTeamRequest;
  let confirmTeamRequest;
  const teamRequestAllowed = new Promise(resolve => { resolveTeamRequest = resolve; });
  const teamRequestStarted = new Promise(resolve => { confirmTeamRequest = resolve; });
  await page.route('**/assets/data/2026/teams/teams.json*', async route => {
    confirmTeamRequest();
    await teamRequestAllowed;
    await route.continue();
  });
  await page.goto('/index.html');

  const agenda = page.locator('#favoriteWeek');
  await teamRequestStarted;
  await expect(agenda).toBeHidden();
  await expect(page.locator('#shareSite')).toBeHidden();
  await expect(page.locator('html')).toHaveClass(/has-saved-favorite-team/);
  await expect(page.locator('#favoriteWeekTitle')).toBeEmpty();
  await expect(page.locator('#favoriteWeekStatus')).toBeHidden();
  await expect(agenda).not.toContainText("Your team's upcoming events");
  resolveTeamRequest();
  await expect(agenda).toBeVisible();
  await expect(agenda.getByRole('heading', { name: /Upcoming Snappers events/ })).toBeVisible();
  await expect(agenda.locator('.favorite-badge')).toHaveCount(0);
  await expect(agenda.getByRole('link', { name: 'Team details' })).toHaveCount(0);
  await expect(page.locator('#favoriteWeekStatus')).toBeHidden();
  await expect(agenda.locator('.favorite-week__events li')).toHaveCount(3);
  await expect(agenda).toContainText('Tuesday, May 26');
  await expect(agenda).toContainText('Next morning practice');
  await expect(agenda).toContainText('Next evening practice');
  await expect(agenda).toContainText('Next swim event: Time Trials for returning / experienced swimmers');
  await expect(agenda).toContainText('7:00 AM - 12:00 PM');
  await expect(agenda).toContainText('Phelps Luck');
  await expect(agenda).not.toContainText('Phelps Luck Pool');
  await expect(agenda.getByRole('link', { name: 'Phelps Luck' }).first()).toHaveAttribute('href', 'pools.html?pool=plp');
  await expect(agenda).not.toContainText("Each Team's Home Pool");
  await expect(agenda).not.toContainText('Jeffers Hill Pool');
  await expect(agenda).toContainText('5:00 - 5:30pm First Splash');
  await expect(page.locator('#shareSite')).toBeVisible();
  await expect.poll(() => page.locator('#favoriteWeekToggle').evaluate(toggle => {
    const iconBounds = toggle.querySelector('.favorite-week__toggle-icon').getBoundingClientRect();
    const toggleBounds = toggle.getBoundingClientRect();
    return Math.abs(toggleBounds.right - iconBounds.right) <= 1;
  })).toBe(true);
  await expect.poll(() => page.evaluate(() => {
    const agendaBottom = globalThis.document.getElementById('favoriteWeek').getBoundingClientRect().bottom;
    const shareTop = globalThis.document.getElementById('shareSite').getBoundingClientRect().top;
    return shareTop >= agendaBottom;
  })).toBe(true);

  const toggle = page.locator('#favoriteWeekToggle');
  await toggle.press('Enter');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('#favoriteWeekContent')).toBeHidden();
  await toggle.press('Enter');
  await expect(page.locator('#favoriteWeekContent')).toBeVisible();
});

test('[WF-AGENDA-007] home page follows the My Meet Day experimental opt-in', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-06-12T12:00:00-04:00'));
  await seedPreferences(page, { experimentalFeatures: ['my-meet-day'], favoriteTeamId: 'lrm' });
  await page.goto('/index.html');

  const meetDay = page.locator('#myMeetDay');
  await expect(meetDay).toBeVisible();
  await expect(meetDay.getByRole('heading', { name: /My Meet Day/ })).toBeVisible();
  await expect(meetDay.locator('.experimental-badge')).toHaveText('Experimental');
  await expect(meetDay).toContainText('Away meet');
  await expect(meetDay).toContainText('Marlins @ Watercats');
  await expect(meetDay).toContainText('tomorrow');
  await expect(meetDay).toContainText('Faulkner Ridge Pool');
  await expect(meetDay).toContainText('10518 Marble Faun Court, Columbia, MD 21044');
  await expect(meetDay).toContainText('6-lane / 25-meter (may mean more heats & longer meet time)');
  await expect(meetDay).toContainText('Arrive by 7:15 AM');
  await expect(meetDay).toContainText('Start at 7:25 AM');
  await expect(meetDay).toContainText('By 7:55 AM');
  await expect(meetDay).toContainText('Starts at 8:00 AM');
  await expect(meetDay).toContainText('Please park by the neighborhood center behind the pool.');
  await expect(meetDay).toContainText('The six spaces near the pool entrance are reserved for coaches and managers.');
  await expect(meetDay).toContainText('Please set up behind the wading pool, just to the right of the entrance. If more space is needed, please use the area outside the side gates.');
  await expect(meetDay).toContainText('The host team did not provide a check-in location.');
  await expect(meetDay).toContainText("Your team's clerk of course will have a table behind the wading pool.");
  await expect(meetDay).toContainText('We accept cash and prefer small bills (no $100 bills).');
  await expect(meetDay.getByText('Meals', { exact: true })).toBeVisible();
  await expect(meetDay.getByText('Snacks', { exact: true })).toBeVisible();
  await expect(meetDay.getByText('Drinks', { exact: true })).toBeVisible();
  await expect(meetDay).toContainText('a variety of drinks');
  await expect(meetDay).toContainText('Starbucks coffee');
  await expect(meetDay).toContainText('vegan by request');
  await expect(meetDay).toContainText('volunteers from both teams');
  const agenda = page.locator('#favoriteWeek');
  await expect(agenda).toBeVisible();
  await expect.poll(() => page.evaluate(() => {
    const concessionsBounds = globalThis.document.querySelector('.my-meet-day__fact--concessions').getBoundingClientRect();
    const agendaDay = globalThis.document.querySelector('#favoriteWeek .favorite-week__day');
    const agendaHeadingBounds = agendaDay.querySelector('h3').getBoundingClientRect();
    const agendaEventBounds = agendaDay.querySelector('.favorite-week__event-heading').getBoundingClientRect();
    const agendaSessionBounds = agendaDay.querySelector('.sessions').getBoundingClientRect();
    const matchesConcessions = bounds => (
      Math.abs(bounds.left - concessionsBounds.left) <= 1
      && Math.abs(bounds.width - concessionsBounds.width) <= 1
    );

    return {
      eventMatches: matchesConcessions(agendaEventBounds),
      headingMatches: matchesConcessions(agendaHeadingBounds),
      sessionMatches: matchesConcessions(agendaSessionBounds)
    };
  })).toEqual({ eventMatches: true, headingMatches: true, sessionMatches: true });
  const poolLinks = meetDay.getByRole('link', { name: 'Faulkner Ridge Pool', exact: true });
  await expect(poolLinks).toHaveCount(2);
  await expect(poolLinks.first()).toHaveAttribute('href', 'pools.html?pool=frp');
  const directionsLink = meetDay.getByRole('link', { name: 'Get directions to Faulkner Ridge Pool in Google Maps' });
  await expect(directionsLink).toBeVisible();
  await expect(directionsLink.locator('svg')).toHaveCount(1);
  await expect(directionsLink).toContainText('Directions');
  await expect(directionsLink).toHaveAttribute('href', /https:\/\/www\.google\.com\/maps\/dir\//);
  await expect(meetDay.getByRole('heading', { name: 'Key times' })).toHaveCount(0);
  const poolLink = poolLinks.first();
  await poolLink.focus();
  await expect(poolLink).toBeFocused();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => {
    const sectionRect = globalThis.document.getElementById('myMeetDay').getBoundingClientRect();
    const toggle = globalThis.document.getElementById('myMeetDayToggle');
    const iconRect = toggle.querySelector('.favorite-week__toggle-icon').getBoundingClientRect();
    const labelRect = toggle.querySelector('.experimental-heading').getBoundingClientRect();
    const toggleRect = toggle.getBoundingClientRect();
    const sectionCenter = sectionRect.left + (sectionRect.width / 2);
    const labelCenter = labelRect.left + (labelRect.width / 2);
    return {
      iconAlignedRight: Math.abs(toggleRect.right - iconRect.right) <= 1,
      isCentered: Math.abs(sectionCenter - labelCenter) <= 1,
      hasHorizontalOverflow: globalThis.document.documentElement.scrollWidth > globalThis.document.documentElement.clientWidth
    };
  })).toEqual({ iconAlignedRight: true, isCentered: true, hasHorizontalOverflow: false });
  const meetDayToggle = page.locator('#myMeetDayToggle');
  await meetDayToggle.press('Enter');
  await expect(meetDayToggle).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('#myMeetDayContent')).toBeHidden();
  await meetDayToggle.press('Enter');
  await expect(page.locator('#myMeetDayContent')).toBeVisible();
});

test('[WF-AGENDA-008] dedicated My Meet Day route loads only after the experiment is enabled', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-06-11T12:00:00-04:00'));
  await page.goto('/my-meet-day.html');

  await expect(page.getByRole('heading', { name: /My Meet Day/ })).toBeVisible();
  await expect(page.locator('#myMeetDayDisabled')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open Experimental Features' })).toHaveAttribute('href', 'settings.html');
  await expect(page.locator('script[data-my-meet-day-dependency]')).toHaveCount(0);
  const navigationLink = page.locator('#navMenu [data-experimental-feature="my-meet-day"]');
  await page.getByRole('button', { name: 'Open navigation menu' }).click();
  await expect(navigationLink).toBeHidden();
  await page.getByRole('button', { name: 'Close navigation menu' }).click();

  await page.evaluate(() => {
    globalThis.PreferencesService.save({ experimentalFeatures: ['my-meet-day'], favoriteTeamId: 'lrm' });
    globalThis.dispatchEvent(new globalThis.CustomEvent('cnsl:preferences-changed'));
  });

  await expect(page.locator('#myMeetDay')).toBeVisible();
  await expect(page.locator('#myMeetDay')).toContainText('Marlins @ Watercats');
  await expect(page.locator('#myMeetDay')).toContainText('in 2 days');
  await expect(page.locator('#myMeetDay')).toContainText('Arrive by 7:15 AM');
  await expect(page.locator('#myMeetDay')).toContainText('Start at 7:25 AM');
  await expect(page.locator('#myMeetDay')).toContainText('By 7:55 AM');
  await expect(page.locator('#myMeetDay')).toContainText('Starts at 8:00 AM');
  await expect(page.locator('#myMeetDay')).toContainText('Please park by the neighborhood center behind the pool.');
  await expect(page.locator('#myMeetDay')).toContainText('The six spaces near the pool entrance are reserved for coaches and managers.');
  await expect(page.locator('#myMeetDay')).toContainText('Please set up behind the wading pool, just to the right of the entrance. If more space is needed, please use the area outside the side gates.');
  await expect(page.locator('#myMeetDay').getByRole('link', { name: 'Faulkner Ridge Pool', exact: true })).toHaveCount(2);
  await expect(page.locator('#myMeetDay').getByRole('heading', { name: 'Key times' })).toHaveCount(0);
  await expect(page.locator('#myMeetDay')).toContainText('The host team did not provide a check-in location.');
  await expect(page.locator('#myMeetDay')).toContainText("Your team's clerk of course will have a table behind the wading pool.");
  await expect(page.locator('#myMeetDay')).toContainText('We accept cash and prefer small bills (no $100 bills).');
  await expect(page.locator('#myMeetDay').getByText('Meals', { exact: true })).toBeVisible();
  await expect(page.locator('#myMeetDay').getByText('Snacks', { exact: true })).toBeVisible();
  await expect(page.locator('#myMeetDay').getByText('Drinks', { exact: true })).toBeVisible();
  await expect(page.locator('#myMeetDayStatus')).toHaveText('Meet-day details loaded.');
  await expect(page.locator('script[data-my-meet-day-dependency]')).toHaveCount(20);
  const controllerVersion = await page.locator('script[src*="js/my-meet-day.js"]').evaluate(script => new URL(script.src).searchParams.get('v'));
  const dependencyVersions = await page.locator('script[data-my-meet-day-dependency]').evaluateAll(scripts => (
    scripts.map(script => new URL(script.src).searchParams.get('v'))
  ));
  expect(controllerVersion).toBeTruthy();
  expect(dependencyVersions.every(version => version === controllerVersion)).toBe(true);
  await page.getByRole('button', { name: 'Open navigation menu' }).click();
  await expect(navigationLink).toBeVisible();
  await expect(navigationLink).toHaveAttribute('href', 'my-meet-day.html');

  await page.evaluate(() => {
    globalThis.PreferencesService.save({ experimentalFeatures: ['my-meet-day'], favoriteTeamId: '' });
    globalThis.dispatchEvent(new globalThis.CustomEvent('cnsl:preferences-changed'));
  });
  await expect(page.locator('#myMeetDay')).toBeHidden();
  await expect(page.locator('#myMeetDayNoFavorite')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Choose favorite team' })).toHaveAttribute('href', 'settings.html');
});

test('[WF-AGENDA-009] completed meets advance only the dedicated My Meet Day route beyond two days', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-06-13T12:01:00-04:00'));
  await seedPreferences(page, { experimentalFeatures: ['my-meet-day'], favoriteTeamId: 'lrm' });

  await page.goto('/index.html');
  await expect(page.locator('#favoriteWeek')).toBeVisible();
  await expect(page.locator('#myMeetDay')).toBeHidden();

  await page.getByRole('button', { name: 'Open navigation menu' }).click();
  await page.getByRole('link', { name: /My Meet Day/ }).click();

  await expect(page.locator('#myMeetDay')).toBeVisible();
  await expect(page.locator('#myMeetDay')).toContainText('Piranhas @ Marlins');
  await expect(page.locator('#myMeetDay')).toContainText('in 7 days');
});

test('[WF-HOME-002] home page keeps compact link actions readable on narrow phones', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto('/index.html');

  await expect.poll(() => page.locator('.quick-links-grid .quick-link-card').evaluateAll(elements => {
    const visibleElements = elements.filter(element => element.getClientRects().length > 0);
    return {
      fits: visibleElements.every(element => {
        const bounds = element.getBoundingClientRect();
        return bounds.left >= 0 && bounds.right <= globalThis.innerWidth && bounds.height >= 44;
      }),
      rows: new Set(visibleElements.map(element => Math.round(element.getBoundingClientRect().top))).size
    };
  })).toEqual({ fits: true, rows: 1 });
  await expect.poll(() => page.locator('.share-site__links .share-site__link').evaluateAll(elements => (
    new Set(elements.map(element => Math.round(element.getBoundingClientRect().top))).size
  ))).toBe(2);
});

test('[WF-AGENDA-003] shared team agenda filters published practice times by selected group', async ({ page }) => {
  await setAgendaReferenceTime(page);
  await seedPreferences(page, { favoriteTeamId: 'pls', practiceGroups: ['8-under'] });
  await page.goto('/index.html');

  const agenda = page.locator('#favoriteWeek');
  await expect(agenda.locator('.session-item:has(.session-group)')).toHaveText([
    /5:30 - 6:00pm\s+8 and under/,
    /8:00 - 8:30am\s+8 and under/
  ]);
  await expect(agenda).not.toContainText('First Splash');
  await expect(agenda).not.toContainText('9 - 12');
  await expect(agenda).not.toContainText('13 and over');
});

test('[WF-AGENDA-004] home page loads agenda dependencies only after a favorite team is selected', async ({ page }) => {
  await setAgendaReferenceTime(page);
  await page.goto('/index.html');

  await expect(page.locator('#favoriteWeek')).toBeHidden();
  await expect(page.locator('#shareSite')).toBeVisible();
  await expect(page.locator('script[data-home-schedule-dependency]')).toHaveCount(0);

  await page.evaluate(() => {
    globalThis.PreferencesService.save({ favoriteTeamId: 'pls' });
    globalThis.dispatchEvent(new globalThis.CustomEvent('cnsl:preferences-changed'));
  });

  await expect(page.locator('#favoriteWeek')).toBeVisible();
  await expect(page.locator('script[data-home-schedule-dependency]')).toHaveCount(20);
  const homeScheduleVersion = await page.locator('script[src*="js/home-schedule.js"]').evaluate(script => new URL(script.src).searchParams.get('v'));
  const dependencyVersions = await page.locator('script[data-home-schedule-dependency]').evaluateAll(scripts => (
    scripts.map(script => new URL(script.src).searchParams.get('v'))
  ));
  expect(homeScheduleVersion).toBeTruthy();
  expect(dependencyVersions.every(version => version === homeScheduleVersion)).toBe(true);
  await expect(page.locator('#favoriteWeek')).toContainText('Phelps Luck');
  await expect(page.locator('#favoriteWeek')).not.toContainText('Phelps Luck Pool');
});

test('[WF-AGENDA-005] changing to an unavailable favorite does not display the prior team heading', async ({ page }) => {
  await setAgendaReferenceTime(page);
  await seedPreferences(page, { favoriteTeamId: 'pls' });
  await page.goto('/index.html');

  await expect(page.locator('#favoriteWeekTitle')).toHaveText('Upcoming Snappers events');

  await page.evaluate(() => {
    localStorage.setItem('cnsl_preferences', JSON.stringify({ favoriteTeamId: 'former-team' }));
    globalThis.dispatchEvent(new globalThis.Event('cnsl:preferences-changed'));
  });

  await expect(page.locator('#favoriteWeek')).toBeVisible();
  await expect(page.locator('#favoriteWeekTitle')).toHaveText('Favorite team not found');
  await expect(page.locator('#favoriteWeekStatus')).toHaveText('That team is not listed this season. Please choose another favorite on the Teams page.');
  await expect(page.locator('#favoriteWeek')).not.toContainText('Upcoming Snappers events');
});

test('[WF-POOLS-005] location distances use outlined pills and can sort nearest pools first', async ({ page }) => {
  await page.context().grantPermissions(['geolocation']);
  await page.context().setGeolocation({ latitude: 39.2105, longitude: -76.8721 });
  await seedPreferences(page, { locationAwarenessEnabled: true });
  await page.goto('/pools.html');

  const sortControl = page.locator('#poolSortControls');
  const firstDistance = page.locator('.distance-badge').first();
  await expect(page.locator('#poolListStatus')).toContainText('Pool directory loaded.');
  await expect(firstDistance).toBeVisible();
  await page.locator('#togglePoolFeatureFilters').press('Enter');
  await expect(page.locator('#togglePoolFeatureFilters')).toHaveAttribute('aria-expanded', 'true');
  await expect(sortControl).toBeVisible();
  const distanceStyle = await firstDistance.evaluate(element => {
    const styles = globalThis.getComputedStyle(element);
    return { backgroundColor: styles.backgroundColor, borderStyle: styles.borderStyle };
  });
  expect(distanceStyle).toEqual({ backgroundColor: 'rgba(0, 0, 0, 0)', borderStyle: 'solid' });

  await page.selectOption('#poolSortOrder', 'distance');
  await expect(page.locator('#poolListStatus')).toHaveText('Pool directory sorted by nearest distance.');
  const distances = await page.locator('.distance-badge').evaluateAll(badges => badges.map(badge => Number.parseFloat(badge.textContent.match(/[0-9.]+/)[0])));
  expect(distances).toEqual([...distances].sort((first, second) => first - second));
});

test('[WF-POOLS-006] location distances recover after a transient lookup timeout', async ({ page }) => {
  await seedPreferences(page, { locationAwarenessEnabled: true });
  await page.addInitScript(() => {
    let requestCount = 0;
    Object.defineProperty(globalThis.navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition(success, error) {
          requestCount += 1;
          sessionStorage.setItem('cnsl_location_request_count', String(requestCount));
          if (requestCount === 1) {
            error({ code: 3, message: 'Timed out' });
            return;
          }
          success({ coords: { latitude: 39.2105, longitude: -76.8721 } });
        }
      }
    });
  });

  await page.goto('/pools.html');

  await expect(page.locator('.distance-badge').first()).toBeVisible();
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem('cnsl_location_request_count'))).toBe('2');
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

test('[WF-MEETS-001] meet pool links open the expanded destination without moving the page', async ({ page }) => {
  await page.setViewportSize(MOBILE_VIEWPORT);
  await page.context().grantPermissions(['geolocation']);
  await page.context().setGeolocation({ latitude: 39.2105, longitude: -76.8721 });
  await page.addInitScript(() => {
    localStorage.setItem('cnsl_preferences', JSON.stringify({ locationAwarenessEnabled: true }));
  });
  await page.goto('/meets.html');
  await expect(page.locator('#meetListStatus')).toContainText('Meet schedule loaded.');
  await expect(page.locator('#meetList')).toContainText('6-lane / 25-meter');
  await expect(page.locator('#meetList')).toContainText('6-lane / 25-yard');
  await expect(page.locator('#meetList')).toContainText('8-lane / 25-yard');

  const poolLink = page.locator('.pool-link').last();
  const targetPoolId = await poolLink.evaluate(link => new URL(link.href).searchParams.get('pool'));
  await poolLink.evaluate(link => {
    const card = link.closest('.meet-date-card');
    const toggle = card.querySelector('.meet-date-header__toggle');
    if (toggle.getAttribute('aria-expanded') !== 'true') toggle.click();
  });
  await expect(poolLink).toBeVisible();
  await poolLink.click();

  const targetCard = page.locator(`.pool-card[data-pool-id="${targetPoolId}"]`);
  await expect(page.locator('#poolListStatus')).toContainText('Pool directory loaded.');
  await expect(page.locator('.distance-badge').first()).toBeVisible();
  await expect.poll(() => page.evaluate(() => new URL(globalThis.location.href).searchParams.get('pool'))).toBe(targetPoolId);
  await expect(targetCard.locator('.pool-header__toggle')).toHaveAttribute('aria-expanded', 'true');
  await expect.poll(() => page.evaluate(() => globalThis.scrollY)).toBe(0);
});

test('[WF-MEETS-002] favorite team matchups appear first on every meet day they compete', async ({ page }) => {
  await seedPreferences(page, { favoriteTeamId: 'cfhss' });
  await page.goto('/meets.html');
  await expect(page.locator('#meetListStatus')).toContainText('Meet schedule loaded.');

  const favoriteDayPlacement = await page.locator('.meet-date-card').evaluateAll(cards => cards
    .filter(card => card.querySelector('.favorite-meet'))
    .map(card => card.querySelector('.meet-date-details > .meet-details').classList.contains('favorite-meet')));

  expect(favoriteDayPlacement.length).toBeGreaterThan(1);
  expect(favoriteDayPlacement.every(firstIsFavorite => firstIsFavorite)).toBe(true);

  const favoriteMeet = page.locator('.favorite-meet:visible').first();
  const favoriteMarker = favoriteMeet.getByRole('img', { name: 'Favorite team' });
  const favoriteTeam = favoriteMarker.locator('..');
  const otherTeam = favoriteMeet.locator('.home-team:not(:has(.favorite-marker)), .visiting-team:not(:has(.favorite-marker))');
  await expect(favoriteMarker).toHaveText('★');
  await expect.poll(async () => ({
    color: await favoriteTeam.evaluate(element => element.ownerDocument.defaultView.getComputedStyle(element).color),
    fontWeight: await favoriteTeam.evaluate(element => element.ownerDocument.defaultView.getComputedStyle(element).fontWeight)
  })).toEqual({
    color: await otherTeam.evaluate(element => element.ownerDocument.defaultView.getComputedStyle(element).color),
    fontWeight: await otherTeam.evaluate(element => element.ownerDocument.defaultView.getComputedStyle(element).fontWeight)
  });
});

test('[WF-MEETS-003] regular meet-day labels advance from upcoming through ongoing to completed', async ({ page }) => {
  await page.setViewportSize(MOBILE_VIEWPORT);
  await page.clock.install({ time: new Date('2026-06-13T06:59:30-04:00') });
  await page.goto('/meets.html');
  await expect(page.locator('#meetListStatus')).toContainText('Meet schedule loaded.');

  const firstDualMeet = page.locator('.meet-date-card[data-meet-date="2026-06-13"]');
  const secondDualMeet = page.locator('.meet-date-card[data-meet-date="2026-06-20"]');
  await expect(firstDualMeet.locator('.meet-live-badge')).toHaveText('Upcoming');
  await expect(firstDualMeet.locator('.meet-date-header__relative')).toHaveText('today');
  await expect(firstDualMeet.locator('.meet-date-header__relative.upcoming-day-pill--today')).toHaveText('today');
  await expect(secondDualMeet.locator('.meet-date-header__relative')).toHaveText('in 7 days');
  await expect(page.locator('.meet-date-card[data-meet-date="2026-06-06"] .meet-date-header__relative')).toHaveCount(0);
  await expect(page.locator('.meet-status-indicator')).toHaveCount(0);
  const mobileHeaderLayout = await firstDualMeet.locator('.meet-date-header').evaluate(header => {
    const meetNameBounds = header.querySelector('.meet-name-header').getBoundingClientRect();
    const badgeBounds = header.querySelector('.meet-live-badge').getBoundingClientRect();
    return {
      badgeGap: badgeBounds.left - meetNameBounds.right,
      topOffset: Math.abs(badgeBounds.top - meetNameBounds.top)
    };
  });
  expect(mobileHeaderLayout.badgeGap).toBeGreaterThanOrEqual(7);
  expect(mobileHeaderLayout.topOffset).toBeLessThanOrEqual(1);
  const completedTimeTrials = page.locator('.meet-date-card[data-meet-date="2026-06-06"] .meet-live-badge--completed');
  await expect(completedTimeTrials).toHaveText('✓ Completed');
  await expect(completedTimeTrials.locator('.meet-live-badge__check')).toHaveAttribute('aria-hidden', 'true');

  await firstDualMeet.locator('.meet-date-header__toggle').focus();
  await page.clock.fastForward(31 * 1000);
  await expect(firstDualMeet.locator('.meet-live-badge')).toHaveText('Ongoing');
  await expect(firstDualMeet.locator('.meet-date-header__toggle')).toBeFocused();

  await page.clock.fastForward((5 * 60 * 60 * 1000));
  await expect(firstDualMeet.locator('.meet-live-badge--completed')).toHaveText('✓ Completed');
  await expect(secondDualMeet.locator('.meet-live-badge')).toHaveText('Upcoming');
  await expect(page.locator('#meetListStatus')).toHaveText('Meet status updated for the current date and time.');
});

test('[WF-MEETS-004] Time Trials advances from upcoming to ongoing using its published hours', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-06-06T06:59:30-04:00') });
  await page.goto('/meets.html');
  await expect(page.locator('#meetListStatus')).toContainText('Meet schedule loaded.');

  const timeTrials = page.locator('.meet-date-card[data-meet-date="2026-06-06"]');
  await expect(timeTrials.locator('.meet-live-badge')).toHaveText('Upcoming');
  await expect(timeTrials.locator('.meet-time')).toHaveText('7:00 AM - 12:00 PM');
  await expect(page.locator('.meet-date-card[data-meet-date="2026-06-13"] .meet-live-badge')).toHaveCount(0);

  await page.clock.fastForward(31 * 1000);
  await expect(timeTrials.locator('.meet-live-badge')).toHaveText('Ongoing');
});

test('[WF-MEETS-005] next-day meet labels emphasize tomorrow separately from later dates', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-06-05T12:00:00-04:00') });
  await page.goto('/meets.html');
  await expect(page.locator('#meetListStatus')).toContainText('Meet schedule loaded.');

  const timeTrialsRelativeDay = page.locator('.meet-date-card[data-meet-date="2026-06-06"] .meet-date-header__relative');
  await expect(timeTrialsRelativeDay).toHaveText('tomorrow');
  await expect(timeTrialsRelativeDay).toHaveClass(/upcoming-day-pill--tomorrow/);
  await expect(page.locator('.meet-date-card[data-meet-date="2026-06-13"] .meet-date-header__relative')).not.toHaveClass(/upcoming-day-pill--tomorrow/);
});

for (const scenario of directoryScenarios) {
  test(`[WF-DIR-002-${scenario.reference}] ${scenario.path} directory tiles point, stay still, and expand from their surface`, async ({ page }) => {
    await page.goto(scenario.path);
    await expect(page.locator(scenario.status)).toContainText('loaded.');

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

test('[WF-POOLS-006] desktop expanded pool details group contact links and fit the weekly calendar', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await seedPreferences(page, {
    favoritePoolName: 'Bryant Woods',
    poolScheduleLayout: 'calendar'
  });
  await page.goto('/pools.html');
  await expect(page.locator('#poolListStatus')).toContainText('Pool directory loaded.');

  const favoriteCard = page.locator('.favorite-card');
  const calendar = favoriteCard.locator('.schedule-calendar');
  await expect(calendar).toBeVisible();
  await expect(favoriteCard.locator('.address-section__phone')).not.toContainText('Pool Desk');
  await expect(favoriteCard.locator('.phone-link')).toHaveAttribute('aria-label', /Call Bryant Woods pool desk at 410-730-5326/);
  await expect(favoriteCard.getByRole('link', { name: 'Get directions to Bryant Woods in Google Maps' })).toBeVisible();
  const layout = await favoriteCard.evaluate(card => {
    const contactBox = card.querySelector('.pool-contact').getBoundingClientRect();
    const addressSection = card.querySelector('.address-section');
    const addressBox = addressSection.getBoundingClientRect();
    const addressDetailsBox = card.querySelector('.address-section__details').getBoundingClientRect();
    const addressLinkBox = card.querySelector('.address-link').getBoundingClientRect();
    const phoneBox = card.querySelector('.address-section__phone').getBoundingClientRect();
    const caWebsiteBox = card.querySelector('.ca-website-section').getBoundingClientRect();
    const schedule = card.querySelector('.schedule-calendar');
    const hours = card.querySelector('.pool-hours');
    const features = card.querySelector('.pool-features');
    return {
      contactDisplay: card.ownerDocument.defaultView.getComputedStyle(card.querySelector('.pool-contact')).display,
      addressHasAccentBorder: card.ownerDocument.defaultView.getComputedStyle(addressSection).borderLeftWidth === '3px',
      addressIsFullWidth: Math.abs(addressBox.width - contactBox.width) <= 1,
      addressIsIndented: addressLinkBox.left > addressDetailsBox.left,
      phoneIsBesideAddress: phoneBox.left >= addressDetailsBox.right && phoneBox.top < addressDetailsBox.bottom,
      caWebsiteIsUnderPhone: caWebsiteBox.top >= phoneBox.bottom && caWebsiteBox.left >= addressDetailsBox.right,
      phoneIsInsideAddress: phoneBox.top > addressBox.top && phoneBox.bottom <= addressBox.bottom,
      caWebsiteIsInsideAddress: caWebsiteBox.bottom <= addressBox.bottom,
      calendarFits: schedule.scrollWidth <= schedule.clientWidth + 1,
      featuresHasAccentBorder: card.ownerDocument.defaultView.getComputedStyle(features).borderLeftWidth === '3px',
      addressToHoursGap: Math.round(hours.getBoundingClientRect().top - contactBox.bottom),
      hoursToFeaturesGap: Math.round(features.getBoundingClientRect().top - hours.getBoundingClientRect().bottom)
    };
  });

  expect(layout.contactDisplay).toBe('flex');
  expect(layout.addressHasAccentBorder).toBe(true);
  expect(layout.addressIsFullWidth).toBe(true);
  expect(layout.addressIsIndented).toBe(true);
  expect(layout.phoneIsBesideAddress).toBe(true);
  expect(layout.caWebsiteIsUnderPhone).toBe(true);
  expect(layout.phoneIsInsideAddress).toBe(true);
  expect(layout.caWebsiteIsInsideAddress).toBe(true);
  expect(layout.calendarFits).toBe(true);
  expect(layout.featuresHasAccentBorder).toBe(true);
  expect(layout.addressToHoursGap).toBe(layout.hoursToFeaturesGap);
});

test('[WF-POOLS-020] linked pool expands without moving the page and keeps a clear directions action', async ({ page }) => {
  await page.goto('/pools.html?pool=frp');
  await expect(page.locator('#poolListStatus')).toContainText('Pool directory loaded.');

  const linkedPool = page.locator('.pool-card[data-pool-id="frp"]');
  await expect(linkedPool).toHaveClass(/highlighted/);
  await expect(linkedPool.locator('.pool-header__toggle')).toHaveAttribute('aria-expanded', 'true');
  await expect(linkedPool.getByRole('link', { name: 'Get directions to Faulkner Ridge in Google Maps' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => globalThis.scrollY)).toBe(0);
});

test('[WF-POOLS-007] mobile calendar schedules reveal today when a pool is expanded', async ({ page }) => {
  await page.setViewportSize({ ...MOBILE_VIEWPORT, height: 900 });
  await page.clock.setFixedTime(new Date('2026-06-24T12:00:00-04:00'));
  await seedPreferences(page, { poolScheduleLayout: 'calendar' });
  await page.goto('/pools.html');
  await expect(page.locator('#poolListStatus')).toContainText('Pool directory loaded.');

  const firstPool = page.locator('.pool-card').first();
  await firstPool.locator('.pool-header__toggle').click();
  expect(await firstPool.locator('.address-section').evaluate(element => ({
    fits: element.scrollWidth <= element.clientWidth + 1,
    actionToRight: element.querySelector('.ca-website-section').getBoundingClientRect().left
      >= element.querySelector('.address-section__details').getBoundingClientRect().right
  }))).toEqual({ fits: true, actionToRight: true });
  const calendar = firstPool.locator('.schedule-calendar');
  await expect(calendar).toBeVisible();
  await expect(firstPool.locator('.week-text')).toContainText('Week of June 22 - June 28');
  await expect(calendar.locator('.schedule-calendar__day.is-today')).toBeVisible();
  await expect(calendar.locator('.schedule-calendar__day.is-today')).toContainText('June 24');
  await expect.poll(() => calendar.evaluate(element => element.scrollLeft)).toBeGreaterThan(0);
  expect(await calendar.evaluate(element => {
    const today = element.querySelector('.schedule-calendar__day.is-today');
    const calendarBounds = element.getBoundingClientRect();
    const todayBounds = today.getBoundingClientRect();
    return todayBounds.left < calendarBounds.right && todayBounds.right > calendarBounds.left;
  })).toBe(true);
});

test('[WF-POOLS-016] weekly calendars highlight modeled swim meets and Time Trials as meet days', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-06-02T12:00:00-04:00'));
  await seedPreferences(page, { favoritePoolName: 'Kendall Ridge', poolScheduleLayout: 'calendar' });
  await page.goto('/pools.html');
  await expect(page.locator('#poolListStatus')).toContainText('Pool directory loaded.');

  const calendar = page.locator('.favorite-card .schedule-calendar');
  const timeTrials = calendar.locator('.schedule-calendar__day').filter({ hasText: 'June 6' });
  await expect(timeTrials).toHaveClass(/has-swim-meet/);
  await expect(timeTrials.locator('.schedule-calendar__meet')).toHaveText('Swim League');
  await expect(timeTrials.locator('.schedule-activity--event')).toContainText('Swim Meet');
  await expect(calendar.locator('.schedule-calendar__day').filter({ hasText: 'June 5' })).not.toHaveClass(/has-swim-meet/);

  await page.locator('.favorite-card .next-week').click();
  await expect(calendar.locator('.schedule-calendar__day').filter({ hasText: 'June 13' })).not.toHaveClass(/has-swim-meet/);
  await page.locator('.favorite-card .next-week').click();
  const hostedDualMeet = calendar.locator('.schedule-calendar__day').filter({ hasText: 'June 20' });
  await expect(hostedDualMeet).toHaveClass(/has-swim-meet/);
  await expect(hostedDualMeet.locator('.schedule-calendar__meet')).toHaveText('Swim League');
  await expect(hostedDualMeet.locator('.override-notice')).toHaveCount(0);
  await expect(hostedDualMeet.locator('.schedule-activity--event')).toContainText('Dual Meet #2');
  const hostedDualMeetLink = hostedDualMeet.locator('.schedule-activity__link');
  await expect(hostedDualMeetLink).toHaveText('Dual Meet #2');
  await expect(hostedDualMeetLink).toHaveAttribute('href', 'meets.html?date=2026-06-20&pool=krp');
  await hostedDualMeetLink.click();

  const linkedMeet = page.locator('.meet-date-card[data-meet-date="2026-06-20"] .meet-details[data-meet-pool-id="krp"]');
  await expect(page).toHaveURL(/meets\.html\?date=2026-06-20&pool=krp$/);
  await expect(linkedMeet).toBeVisible();
  await expect(linkedMeet).toHaveClass(/highlighted/);
  await expect(linkedMeet).toContainText('Pointers Run');
  await expect(linkedMeet).toContainText('Long Reach');
});

test('[WF-POOLS-017] weekly calendars highlight public pool-party overrides as events', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-07-06T12:00:00-04:00'));
  await seedPreferences(page, { favoritePoolName: 'Kendall Ridge', poolScheduleLayout: 'calendar' });
  await page.goto('/pools.html');
  await expect(page.locator('#poolListStatus')).toContainText('Pool directory loaded.');

  const poolParty = page.locator('.favorite-card .schedule-calendar__day').filter({ hasText: 'July 9' });
  await expect(poolParty.locator('.schedule-activity--event.override-slot')).toContainText('Pool Party');
  await expect(poolParty).toContainText('Long Reach Village Pool Party; registration required');
});

test('[WF-POOLS-021] Aqua Fitness schedules link to official class details', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-06-22T12:00:00-04:00'));
  await seedPreferences(page, { poolScheduleLayout: 'list' });
  await page.goto('/pools.html');
  await expect(page.locator('#poolListStatus')).toContainText('Pool directory loaded.');

  const expectedLinks = new Map([
    ['Bryant Woods', 'https://columbiaassn.clubautomation.com/calendar/event-info?id=368278&style=0'],
    ['Locust Park', 'https://columbiaassn.clubautomation.com/calendar/event-info?id=368279&style=0'],
    ['Stevens Forest', 'https://columbiaassn.clubautomation.com/calendar/event-info?id=368280&style=0']
  ]);

  for (const [poolName, sourceUrl] of expectedLinks) {
    const poolCard = page.locator('.pool-card').filter({ hasText: poolName });
    await poolCard.locator('.pool-header__toggle').click();
    const sourceLinks = poolCard.getByRole('link', { name: 'Aqua Fitness official details (opens in new tab)' });
    await expect(sourceLinks.first()).toBeVisible();
    await expect(sourceLinks.first()).toHaveAttribute('href', sourceUrl);
    await expect(sourceLinks.first()).toHaveAttribute('target', '_blank');
    await expect(sourceLinks.first()).toHaveAttribute('rel', 'noopener');
    await poolCard.locator('.pool-header__toggle').click();
  }

  const nonAquaPool = page.locator('.pool-card').filter({ hasText: 'Kendall Ridge' });
  await nonAquaPool.locator('.pool-header__toggle').click();
  await expect(nonAquaPool.locator('.schedule-activity__source-link')).toHaveCount(0);

  await seedPreferences(page, { poolScheduleLayout: 'calendar' });
  await page.reload();
  await expect(page.locator('#poolListStatus')).toContainText('Pool directory loaded.');
  const bryantWoods = page.locator('.pool-card').filter({ hasText: 'Bryant Woods' });
  await bryantWoods.locator('.pool-header__toggle').click();
  await expect(bryantWoods.locator('.schedule-calendar .schedule-activity__source-link').first()).toBeVisible();
});

test('[WF-POOLS-008] desktop site header remains visible while the pool directory scrolls', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/pools.html');
  await expect(page.locator('#poolListStatus')).toContainText('Pool directory loaded.');

  await page.locator('#mainContent').evaluate(main => {
    const scrollSpacer = globalThis.document.createElement('div');
    scrollSpacer.setAttribute('aria-hidden', 'true');
    scrollSpacer.style.height = '100rem';
    main.append(scrollSpacer);
  });

  await page.evaluate(() => {
    globalThis.document.documentElement.style.scrollBehavior = 'auto';
    globalThis.scrollTo(0, globalThis.document.documentElement.scrollHeight);
  });
  const scrollPosition = await page.evaluate(() => globalThis.scrollY);
  const headerTop = await page.locator('.header').evaluate(header => Math.round(header.getBoundingClientRect().top));

  expect(scrollPosition).toBeGreaterThan(0);
  expect(headerTop).toBe(0);
});

test('[WF-SETTINGS-001] settings dialog is evenly inset on mobile and centered on desktop', async ({ page }) => {
  const mobileViewport = MOBILE_VIEWPORT;
  await page.setViewportSize(mobileViewport);
  await page.goto('/settings.html');
  const dialog = page.locator('#settingsDialog');
  await expect(dialog).toBeVisible();
  let bounds = await dialog.boundingBox();

  expect(bounds.x).toBeGreaterThanOrEqual(8);
  expect(Math.abs(bounds.height - (mobileViewport.height * 0.75))).toBeLessThanOrEqual(1);
  expect(Math.abs(bounds.x - (mobileViewport.width - bounds.x - bounds.width))).toBeLessThanOrEqual(1);
  expect(Math.abs(bounds.y + (bounds.height / 2) - (mobileViewport.height / 2))).toBeLessThanOrEqual(1);
  await expect.poll(() => page.evaluate(() => {
    const dialogElement = globalThis.document.getElementById('settingsDialog');
    const panel = dialogElement.querySelector('.settings-dialog__panel');
    const form = globalThis.document.getElementById('settingsForm');
    return {
      dialogOverflowY: globalThis.getComputedStyle(dialogElement).overflowY,
      dialogScrollable: dialogElement.scrollHeight > dialogElement.clientHeight,
      formOverflowY: globalThis.getComputedStyle(form).overflowY,
      formScrollable: form.scrollHeight > form.clientHeight,
      panelOverflowY: globalThis.getComputedStyle(panel).overflowY,
      panelScrollable: panel.scrollHeight > panel.clientHeight
    };
  })).toEqual({
    dialogOverflowY: 'hidden',
    dialogScrollable: false,
    formOverflowY: 'auto',
    formScrollable: true,
    panelOverflowY: 'hidden',
    panelScrollable: false
  });
  await expect(page.locator('#settingsForm > .settings-group').evaluateAll(groups => groups.map(group => {
    const heading = group.querySelector(':scope > legend, :scope > .settings-label');
    const collapsibleHeading = heading?.tagName === 'SUMMARY'
      ? heading.querySelector(':scope > .settings-collapsible__heading')
      : null;
    const primaryHeading = collapsibleHeading?.querySelector(':scope > span:first-child') || collapsibleHeading;
    return primaryHeading ? primaryHeading.textContent.trim() : heading?.textContent.trim() || '';
  }))).resolves.toEqual([
    'Favorites',
    'Schedules',
    'Pool visits',
    'Display and accessibility',
    'Experimental Features'
  ]);
  const favoriteSettings = page.locator('#favoriteSettings');
  const scheduleSettings = page.locator('#scheduleSettings');
  await expect(favoriteSettings).toHaveAttribute('open', '');
  await expect(scheduleSettings).not.toHaveAttribute('open', '');
  await expect(page.locator('#favoritePool')).toBeVisible();
  await expect(page.getByRole('group', { name: 'Swim Team Practice Groups' })).toBeHidden();
  await scheduleSettings.locator('summary').press('Enter');
  await expect(scheduleSettings).toHaveAttribute('open', '');
  await expect(favoriteSettings).not.toHaveAttribute('open', '');
  await expect(page.getByRole('group', { name: 'Swim Team Practice Groups' })).toBeVisible();
  const practiceBounds = await page.locator('.settings-checkbox-list .settings-checkbox').evaluateAll(options => options.map(option => option.getBoundingClientRect().x));
  expect(new Set(practiceBounds.map(position => Math.round(position))).size).toBe(2);
  const accessibilitySettings = page.locator('#accessibilitySettings');
  const accessibilitySummary = accessibilitySettings.locator('summary');
  await expect(accessibilitySettings).not.toHaveAttribute('open', '');
  await expect(page.getByLabel('Extra large')).toBeHidden();
  await accessibilitySummary.press('Enter');
  await expect(accessibilitySettings).toHaveAttribute('open', '');
  await expect(page.getByLabel('Extra large')).toBeVisible();
  await accessibilitySummary.press('Enter');
  await expect(accessibilitySettings).not.toHaveAttribute('open', '');
  const closeButtonBounds = await page.getByRole('button', { name: 'Close settings' }).boundingBox();
  expect(closeButtonBounds.width).toBeLessThan(closeButtonBounds.height);
  let clearButtonBounds = await page.getByRole('button', { name: 'Clear all app data' }).boundingBox();
  let clearActionsBounds = await page.locator('.settings-actions').boundingBox();
  expect(Math.abs(clearButtonBounds.x + (clearButtonBounds.width / 2) - (clearActionsBounds.x + (clearActionsBounds.width / 2)))).toBeLessThanOrEqual(1);
  await page.getByRole('button', { name: 'Close settings' }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole('button', { name: 'Open settings' }).click();
  await expect(favoriteSettings).toHaveAttribute('open', '');
  await expect(accessibilitySettings).not.toHaveAttribute('open', '');
  await page.getByRole('button', { name: 'Close settings' }).click();

  const desktopViewport = { width: 1280, height: 800 };
  await page.setViewportSize(desktopViewport);
  await page.goto('/settings.html');
  bounds = await dialog.boundingBox();

  expect(Math.abs(bounds.height - (desktopViewport.height * 0.75))).toBeLessThanOrEqual(1);
  expect(Math.abs(bounds.x + (bounds.width / 2) - (desktopViewport.width / 2))).toBeLessThanOrEqual(1);
  expect(Math.abs(bounds.y + (bounds.height / 2) - (desktopViewport.height / 2))).toBeLessThanOrEqual(1);
  clearButtonBounds = await page.getByRole('button', { name: 'Clear all app data' }).boundingBox();
  clearActionsBounds = await page.locator('.settings-actions').boundingBox();
  expect(Math.abs(clearButtonBounds.x + (clearButtonBounds.width / 2) - (clearActionsBounds.x + (clearActionsBounds.width / 2)))).toBeLessThanOrEqual(1);
});

test('[WF-SETTINGS-012] settings dialog closes from the backdrop and restores launcher focus', async ({ page }) => {
  await page.setViewportSize(MOBILE_VIEWPORT);
  await page.goto('/settings.html');

  const dialog = page.locator('#settingsDialog');
  const launcher = page.getByRole('button', { name: 'Open settings' });
  await expect(dialog).toBeVisible();

  await page.locator('.settings-dialog__notice').click();
  await expect(dialog).toBeVisible();

  await page.mouse.click(4, 4);
  await expect(dialog).not.toBeVisible();
  await expect(launcher).toBeFocused();
});

test('[WF-SETTINGS-002] settings persist choices locally and confirm before clearing all app data', async ({ page }) => {
  await initializeAnalyticsRecorder(page);
  await page.goto('/settings.html');
  await expect(page.locator('#favoritePool')).toBeEnabled();
  await page.locator('#scheduleSettings summary').click();
  await expect(page.getByRole('group', { name: 'Swim Team Practice Groups' })).toBeVisible();
  await expect(page.getByLabel('First Splash')).toBeChecked();
  await expect(page.getByLabel('8 and under')).toBeChecked();
  await expect(page.getByLabel('9-10')).toBeChecked();

  await page.locator('#accessibilitySettings summary').click();
  await page.getByLabel('Dark').check();
  await page.locator('#scheduleSettings summary').click();
  await page.getByLabel('Weekly calendar').check();
  await page.locator('#poolVisitSettings summary').click();
  await page.getByLabel('Use my current location to estimate distances to pools').check();
  await page.getByLabel('10 min').check();
  await page.locator('#scheduleSettings summary').click();
  await page.getByLabel('First Splash').uncheck();
  await page.getByLabel('8 and under').uncheck();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('cnsl_preferences')).theme)).toBe('dark');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('cnsl_preferences')).weatherRefreshMinutes)).toBe(10);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('cnsl_preferences')).practiceGroups)).toEqual(['9-10', '11-12', '13-14', '15-18']);
  await expect(page.getByLabel('Share anonymous page usage through Google Analytics')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => Object.hasOwn(JSON.parse(localStorage.getItem('cnsl_preferences')), 'analyticsEnabled'))).toBe(false);
  await expect(page.locator('#cnslAnalyticsScript')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => globalThis.recordedAnalyticsEvents.filter(eventArguments => eventArguments[1] === 'ca_setting_change'))).toEqual([
    ['event', 'ca_setting_change', { setting_name: 'theme' }],
    ['event', 'ca_setting_change', { setting_name: 'pool_schedule_layout' }],
    ['event', 'ca_setting_change', { setting_name: 'location_awareness' }],
    ['event', 'ca_setting_change', { setting_name: 'weather_refresh_minutes' }],
    ['event', 'ca_setting_change', { setting_name: 'practice_groups' }],
    ['event', 'ca_setting_change', { setting_name: 'practice_groups' }]
  ]);

  await page.locator('#favoriteSettings summary').click();
  await page.locator('#favoritePool').selectOption({ label: 'Bryant Woods' });
  await page.locator('#favoriteTeam').selectOption('cfhss');
  await page.locator('#favoritePool').selectOption('');
  await expect.poll(() => page.evaluate(() => globalThis.recordedAnalyticsEvents.filter(eventArguments => eventArguments[1] === 'ca_setting_change'))).toEqual([
    ['event', 'ca_setting_change', { setting_name: 'theme' }],
    ['event', 'ca_setting_change', { setting_name: 'pool_schedule_layout' }],
    ['event', 'ca_setting_change', { setting_name: 'location_awareness' }],
    ['event', 'ca_setting_change', { setting_name: 'weather_refresh_minutes' }],
    ['event', 'ca_setting_change', { setting_name: 'practice_groups' }],
    ['event', 'ca_setting_change', { setting_name: 'practice_groups' }],
    ['event', 'ca_setting_change', { setting_name: 'favorite_pool', selection: 'Bryant Woods' }],
    ['event', 'ca_setting_change', { setting_name: 'favorite_team', selection: 'CHS Swim Sundevils' }],
    ['event', 'ca_setting_change', { setting_name: 'favorite_pool', selection: 'none' }]
  ]);

  await page.locator('#favoriteTeam').evaluate(select => {
    const untrustedOption = select.ownerDocument.createElement('option');
    untrustedOption.value = 'person@example.com';
    untrustedOption.textContent = 'Untrusted value';
    select.appendChild(untrustedOption);
    select.value = untrustedOption.value;
    select.dispatchEvent(new select.ownerDocument.defaultView.Event('change', { bubbles: true }));
  });
  await expect.poll(() => page.evaluate(() => globalThis.recordedAnalyticsEvents.filter(eventArguments => eventArguments[1] === 'ca_setting_change'))).toHaveLength(9);

  const dismissedClearPrompt = page.waitForEvent('dialog').then(async dialog => {
    expect(dialog.type()).toBe('confirm');
    expect(dialog.message()).toBe('Clear all app data from this device?');
    await dialog.dismiss();
  });
  await page.getByRole('button', { name: 'Clear all app data' }).click();
  await dismissedClearPrompt;
  await expect(page.getByLabel('Dark')).toBeChecked();
  await expect(page.getByLabel('First Splash')).not.toBeChecked();
  await expect.poll(() => page.evaluate(() => globalThis.recordedAnalyticsEvents.filter(eventArguments => eventArguments[1] === 'ca_setting_change'))).toHaveLength(9);

  await page.evaluate(async () => {
    localStorage.setItem('cnsl_current_version', 'saved');
    localStorage.setItem('cnsl_settings_notice_dismissed', 'true');
    localStorage.setItem('cnsl_weather_alert_last_successful_check', 'saved');
    localStorage.setItem('unrelated_local_key', 'saved');
    sessionStorage.setItem('cnsl_weather_alert_status', 'saved');
    sessionStorage.setItem('cnsl_weather_alert_expanded', 'false');
    sessionStorage.setItem('unrelated_session_key', 'saved');
    await globalThis.caches.open('cnsl-static-test-reset');
    await globalThis.caches.open('unrelated-cache');
  });
  const acceptedClearPrompt = page.waitForEvent('dialog').then(async dialog => {
    expect(dialog.type()).toBe('confirm');
    expect(dialog.message()).toBe('Clear all app data from this device?');
    await dialog.accept();
  });
  await page.getByRole('button', { name: 'Clear all app data' }).click();
  await acceptedClearPrompt;
  await expect(page.locator('#settingsStatus')).toHaveText('All app data has been cleared from this device.');
  await expect.poll(() => page.locator('#settingsStatus').evaluate(status => globalThis.getComputedStyle(status).textAlign)).toBe('center');
  await expect.poll(() => page.evaluate(async () => ({
    preferences: localStorage.getItem('cnsl_preferences'),
    currentVersion: localStorage.getItem('cnsl_current_version'),
    settingsNotice: localStorage.getItem('cnsl_settings_notice_dismissed'),
    weatherLastSuccessfulCheck: localStorage.getItem('cnsl_weather_alert_last_successful_check'),
    unrelatedLocal: localStorage.getItem('unrelated_local_key'),
    weatherStatus: sessionStorage.getItem('cnsl_weather_alert_status'),
    weatherDisclosure: sessionStorage.getItem('cnsl_weather_alert_expanded'),
    unrelatedSession: sessionStorage.getItem('unrelated_session_key'),
    caches: await globalThis.caches.keys()
  }))).toMatchObject({
    preferences: null,
    currentVersion: null,
    settingsNotice: null,
    weatherLastSuccessfulCheck: null,
    unrelatedLocal: 'saved',
    weatherStatus: null,
    weatherDisclosure: null,
    unrelatedSession: 'saved',
    caches: expect.not.arrayContaining(['cnsl-static-test-reset'])
  });
  await expect(page.getByLabel('First Splash')).toBeChecked();
  await expect(page.getByLabel('8 and under')).toBeChecked();
  await expect.poll(() => page.evaluate(() => globalThis.recordedAnalyticsEvents.filter(eventArguments => eventArguments[1] === 'ca_setting_change'))).toEqual([
    ['event', 'ca_setting_change', { setting_name: 'theme' }],
    ['event', 'ca_setting_change', { setting_name: 'pool_schedule_layout' }],
    ['event', 'ca_setting_change', { setting_name: 'location_awareness' }],
    ['event', 'ca_setting_change', { setting_name: 'weather_refresh_minutes' }],
    ['event', 'ca_setting_change', { setting_name: 'practice_groups' }],
    ['event', 'ca_setting_change', { setting_name: 'practice_groups' }],
    ['event', 'ca_setting_change', { setting_name: 'favorite_pool', selection: 'Bryant Woods' }],
    ['event', 'ca_setting_change', { setting_name: 'favorite_team', selection: 'CHS Swim Sundevils' }],
    ['event', 'ca_setting_change', { setting_name: 'favorite_pool', selection: 'none' }],
    ['event', 'ca_setting_change', { setting_name: 'theme' }],
    ['event', 'ca_setting_change', { setting_name: 'pool_schedule_layout' }],
    ['event', 'ca_setting_change', { setting_name: 'location_awareness' }],
    ['event', 'ca_setting_change', { setting_name: 'weather_refresh_minutes' }],
    ['event', 'ca_setting_change', { setting_name: 'practice_groups' }],
    ['event', 'ca_setting_change', { setting_name: 'favorite_team', selection: 'none' }]
  ]);
});

test('[WF-SETTINGS-011] experimental features are collapsed, tracked, and gated by device opt-in', async ({ page }) => {
  await initializeAnalyticsRecorder(page);
  await page.goto('/settings.html');

  const experiments = page.locator('#experimentalFeatures');
  const enabledCount = page.locator('#experimentalFeaturesCount');
  await expect(experiments).not.toHaveAttribute('open', '');
  await expect(enabledCount).toHaveText('0/1 enabled');
  await expect(page.getByText('Experimental features may change or provide incomplete information.', { exact: false })).toBeHidden();
  await experiments.locator('summary').click();
  await expect(page.getByText('Please do not rely on them as your only source, and validate all information with your team and official sources.', { exact: false })).toBeVisible();
  await expect(experiments.locator('input[name="experimentalFeatures"]')).toHaveCount(1);
  await expect(experiments.getByText('My Meet Day', { exact: true })).toBeVisible();
  await expect(experiments.locator('.settings-experiment__description')).toHaveText("See personalized details for your favorite team's next meet, including key times and host-pool guidance when available.");
  const disclaimer = experiments.locator('.settings-experiments__disclaimer');
  await expect(disclaimer).toHaveCSS('font-style', 'italic');
  await expect.poll(() => disclaimer.evaluate(element => ({
    followsOptions: element.previousElementSibling?.classList.contains('settings-experiments__options'),
    fontSize: Number.parseFloat(globalThis.getComputedStyle(element).fontSize)
  }))).toEqual({ followsOptions: true, fontSize: 13.12 });

  const meetDaySwitch = page.getByLabel('Enable My Meet Day');
  await expect(meetDaySwitch).not.toBeChecked();
  await meetDaySwitch.check();
  await expect(meetDaySwitch).toBeChecked();
  await expect(experiments.locator('.settings-switch__state')).toHaveText('On');
  await expect(enabledCount).toHaveText('1/1 enabled');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('cnsl_preferences')).experimentalFeatures)).toEqual(['my-meet-day']);
  await expect.poll(() => page.evaluate(() => globalThis.recordedAnalyticsEvents.filter(eventArguments => eventArguments[1] === 'ca_experimental_feature_change'))).toEqual([
    ['event', 'ca_experimental_feature_change', { feature_action: 'enabled', feature_name: 'my-meet-day' }]
  ]);

  await page.getByRole('button', { name: 'Close settings' }).click();
  await page.getByRole('button', { name: 'Open navigation menu' }).click();
  const meetDayLink = page.getByRole('link', { name: /My Meet Day/ });
  await expect(meetDayLink).toBeVisible();
  await expect(meetDayLink.locator('.experimental-badge')).toHaveText('Experimental');
  const meetDayNavLayout = await meetDayLink.evaluate(link => {
    const badgeBounds = link.querySelector('.experimental-badge').getBoundingClientRect();
    const iconBounds = link.querySelector('.nav-menu__icon').getBoundingClientRect();
    const labelBounds = link.querySelector('.nav-menu__item-label').getBoundingClientRect();

    return {
      badgeLeft: badgeBounds.left,
      badgeTop: badgeBounds.top,
      iconRight: iconBounds.right,
      labelBottom: labelBounds.bottom,
      labelLeft: labelBounds.left
    };
  });
  expect(meetDayNavLayout.badgeLeft).toBeCloseTo(meetDayNavLayout.labelLeft, 0);
  expect(meetDayNavLayout.badgeTop).toBeGreaterThanOrEqual(meetDayNavLayout.labelBottom);
  expect(meetDayNavLayout.badgeLeft).toBeGreaterThan(meetDayNavLayout.iconRight);

  await page.goto('/settings.html');
  await experiments.locator('summary').click();
  await page.getByLabel('Enable My Meet Day').uncheck();
  await expect(experiments.locator('.settings-switch__state')).toHaveText('Off');
  await expect(enabledCount).toHaveText('0/1 enabled');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('cnsl_preferences')).experimentalFeatures)).toEqual([]);
  await expect.poll(() => page.evaluate(() => globalThis.recordedAnalyticsEvents.filter(eventArguments => eventArguments[1] === 'ca_experimental_feature_change'))).toEqual([
    ['event', 'ca_experimental_feature_change', { feature_action: 'enabled', feature_name: 'my-meet-day' }],
    ['event', 'ca_experimental_feature_change', { feature_action: 'disabled', feature_name: 'my-meet-day' }]
  ]);
});

test('[WF-SETTINGS-004] system theme follows OS color scheme changes while explicit dark remains dark', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/settings.html');
  const root = page.locator('html');

  await expect(root).toHaveAttribute('data-theme', 'system');
  await expect(root).toHaveAttribute('data-color-scheme', 'dark');
  await expect.poll(() => root.evaluate(element => globalThis.getComputedStyle(element).getPropertyValue('--light-bg').trim())).toBe('#101820');

  await page.emulateMedia({ colorScheme: 'light' });
  await expect(root).toHaveAttribute('data-color-scheme', 'light');

  await page.locator('#accessibilitySettings summary').click();
  await page.getByLabel('Dark').check();
  await expect(root).toHaveAttribute('data-theme', 'dark');
  await expect(root).toHaveAttribute('data-color-scheme', 'dark');
});

test('[WF-SETTINGS-008] accessibility settings apply immediately, persist locally, and report categories only', async ({ page }) => {
  await initializeAnalyticsRecorder(page);
  await page.goto('/settings.html');
  const root = page.locator('html');
  const accessibilitySettings = page.locator('#accessibilitySettings');

  await expect(accessibilitySettings).not.toHaveAttribute('open', '');
  await accessibilitySettings.locator('summary').click();

  await expect(page.getByLabel('Default', { exact: true })).toBeChecked();
  await expect(page.getByRole('radiogroup', { name: 'Contrast' }).getByLabel('Device default')).toBeChecked();
  await expect(page.getByRole('radiogroup', { name: 'Motion' }).getByLabel('Device default')).toBeChecked();
  await expect(page.getByLabel('Underline text links')).not.toBeChecked();

  await page.getByLabel('Extra large').check();
  await page.getByRole('radiogroup', { name: 'Contrast' }).getByLabel('High').check();
  await page.getByRole('radiogroup', { name: 'Motion' }).getByLabel('Reduced').check();
  await page.getByLabel('Underline text links').check();

  await expect(root).toHaveAttribute('data-text-size', 'extra-large');
  await expect(root).toHaveAttribute('data-contrast', 'high');
  await expect(root).toHaveAttribute('data-contrast-mode', 'high');
  await expect(root).toHaveAttribute('data-motion', 'reduced');
  await expect(root).toHaveAttribute('data-motion-mode', 'reduced');
  await expect(root).toHaveAttribute('data-underline-links', 'true');
  await expect(root).toHaveCSS('font-size', '20px');
  await page.locator('#poolVisitSettings summary').click();
  await expect(page.getByRole('link', { name: 'View weather source details.' })).toHaveCSS('text-decoration-line', 'underline');
  await expect.poll(() => page.locator('.settings-segmented label').first().evaluate(element => parseFloat(globalThis.getComputedStyle(element).transitionDuration))).toBeLessThanOrEqual(0.001);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('cnsl_preferences')))).toMatchObject({
    textSize: 'extra-large',
    contrast: 'high',
    motion: 'reduced',
    underlineLinks: true
  });
  await expect.poll(() => page.evaluate(() => globalThis.recordedAnalyticsEvents.filter(eventArguments => eventArguments[1] === 'ca_setting_change'))).toEqual([
    ['event', 'ca_setting_change', { setting_name: 'text_size' }],
    ['event', 'ca_setting_change', { setting_name: 'contrast' }],
    ['event', 'ca_setting_change', { setting_name: 'motion' }],
    ['event', 'ca_setting_change', { setting_name: 'underline_links' }]
  ]);

  await page.reload();
  await expect(accessibilitySettings).not.toHaveAttribute('open', '');
  await accessibilitySettings.locator('summary').click();
  await expect(page.getByLabel('Extra large')).toBeChecked();
  await expect(page.getByRole('radiogroup', { name: 'Contrast' }).getByLabel('High')).toBeChecked();
  await expect(page.getByRole('radiogroup', { name: 'Motion' }).getByLabel('Reduced')).toBeChecked();
  await expect(page.getByLabel('Underline text links')).toBeChecked();
  await expect(root).toHaveAttribute('data-text-size', 'extra-large');
});

test('[WF-SETTINGS-009] device contrast, reduced motion, and forced colors update effective accessibility modes', async ({ page }) => {
  await page.emulateMedia({ contrast: 'more', reducedMotion: 'reduce' });
  await page.goto('/settings.html');
  const root = page.locator('html');

  await expect(root).toHaveAttribute('data-contrast', 'system');
  await expect(root).toHaveAttribute('data-contrast-mode', 'high');
  await expect(root).toHaveAttribute('data-motion', 'system');
  await expect(root).toHaveAttribute('data-motion-mode', 'reduced');

  await page.emulateMedia({ contrast: 'no-preference', reducedMotion: 'no-preference' });
  await expect(root).toHaveAttribute('data-contrast-mode', 'default');
  await expect(root).toHaveAttribute('data-motion-mode', 'default');

  await page.emulateMedia({ forcedColors: 'active' });
  await expect(root).toHaveAttribute('data-contrast-mode', 'high');
  await page.locator('#poolVisitSettings summary').click();
  await expect(page.getByRole('link', { name: 'View weather source details.' })).toHaveCSS('text-decoration-line', 'underline');
});

test('[WF-SETTINGS-010] extra-large text reflows without page-level horizontal overflow', async ({ page }) => {
  await page.setViewportSize(MOBILE_VIEWPORT);
  await seedPreferences(page, { textSize: 'extra-large' });

  for (const path of ['/index.html', '/pools.html', '/teams.html', '/meets.html', '/settings.html']) {
    await page.goto(path);
    await expect(page.locator('html')).toHaveAttribute('data-text-size', 'extra-large');
    await expect.poll(() => page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth)).toBe(true);
  }
});

test('[WF-SETTINGS-005] weather safety alerts show the most recent check after updates are turned off', async ({ page }) => {
  await seedPreferences(page, { weatherRefreshMinutes: 0 });
  await page.addInitScript(() => {
    localStorage.setItem('cnsl_weather_alert_last_successful_check', JSON.stringify({ updatedAt: '2026-06-02T14:15:00-04:00' }));
  });
  await page.goto('/settings.html');
  await page.locator('#poolVisitSettings summary').click();

  const weatherCheckStatus = page.locator('#weatherCheckStatus');
  await expect(weatherCheckStatus).toHaveText('Most recent successful weather check: Jun 2, 2026, 2:15 PM. Weather safety alerts are currently off.');
  await expect(weatherCheckStatus.locator('time')).toHaveAttribute('datetime', '2026-06-02T14:15:00-04:00');
  await expect(weatherCheckStatus.locator('time')).toHaveCSS('display', 'block');
  await expect(weatherCheckStatus).toHaveCSS('border-left-style', 'solid');
});

test('[WF-SETTINGS-006] weather safety alerts retain the last successful check when the weather service is unavailable', async ({ page }) => {
  await page.unroute('https://api.weather.gov/**');
  await page.route('https://api.weather.gov/**', route => route.abort());
  await page.addInitScript(() => {
    localStorage.setItem('cnsl_weather_alert_last_successful_check', JSON.stringify({ updatedAt: '2026-06-02T14:15:00-04:00' }));
  });
  await page.goto('/settings.html');
  await page.locator('#poolVisitSettings summary').click();
  await page.evaluate(async () => {
    const poolData = { pools: [{ schedules: [{
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      hours: [{ weekDays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], types: ['Rec Swim'], startTime: '12:00am', endTime: '11:59pm' }]
    }] }] };
    const status = await globalThis.WeatherAlertService.getCurrentStatus({
      fetchImplementation: async () => { throw new Error('offline'); },
      poolData,
      refreshMinutes: 5,
      storage: null
    });
    globalThis.WeatherAlertService.setLatestStatus(status);
    globalThis.dispatchEvent(new CustomEvent('cnsl:weather-alert-status-changed'));
  });

  const weatherCheckStatus = page.locator('#weatherCheckStatus');
  await expect(weatherCheckStatus).toHaveText('Weather service is temporarily unavailable. Most recent successful weather check: Jun 2, 2026, 2:15 PM');
  await expect(weatherCheckStatus.locator('time')).toHaveAttribute('datetime', '2026-06-02T14:15:00-04:00');
  await expect(page.locator('#weatherAlert')).toBeHidden();
});

test('[WF-SETTINGS-007] weather source details expose fixed Columbia-area National Weather Service requests in a new tab', async ({ page }) => {
  await page.goto('/settings.html');
  await page.locator('#poolVisitSettings summary').click();
  const sourceDetailsLink = page.getByRole('link', { name: 'View weather source details.' });

  await expect(sourceDetailsLink).toHaveAttribute('href', 'faq.html#weather-safety-location');
  await expect(sourceDetailsLink).toHaveAttribute('target', '_blank');
  await expect(sourceDetailsLink).toHaveAttribute('rel', 'noopener');

  await page.goto('/faq.html#weather-safety-location');
  const weatherDetails = page.locator('#weather-safety-location');
  const nwsLinks = weatherDetails.getByRole('link');

  await expect(weatherDetails).toContainText('does not track, save, or send your location');
  await expect(nwsLinks.nth(0)).toHaveText('Active weather alerts (data only)');
  await expect(nwsLinks.nth(1)).toHaveText('Local forecast information (data only)');
  await expect(nwsLinks.nth(2)).toHaveText('Local weather information (web)');
  await expect(nwsLinks.nth(0)).toHaveAttribute('href', 'https://api.weather.gov/alerts/active?point=39.2014%2C-76.8610');
  await expect(nwsLinks.nth(1)).toHaveAttribute('href', 'https://api.weather.gov/points/39.2014,-76.8610');
  await expect(nwsLinks.nth(2)).toHaveAttribute('href', 'https://forecast.weather.gov/MapClick.php?lat=39.2014&lon=-76.8610');
  await expect(nwsLinks.nth(0)).toHaveAttribute('target', '_blank');
  await expect(nwsLinks.nth(1)).toHaveAttribute('target', '_blank');
  await expect(nwsLinks.nth(2)).toHaveAttribute('target', '_blank');
  await expect(nwsLinks.nth(0)).toHaveAttribute('rel', 'noopener');
  await expect(nwsLinks.nth(1)).toHaveAttribute('rel', 'noopener');
  await expect(nwsLinks.nth(2)).toHaveAttribute('rel', 'noopener');
  await page.setViewportSize(MOBILE_VIEWPORT);
  await expect(weatherDetails.locator('ul')).toHaveCSS('padding-left', '24px');
});

test('[WF-WEATHER-001] desktop weather safety alerts restore collapsed details on every page', async ({ page }) => {
  await prepareVisibleWeatherAlert(page);
  await page.addInitScript(() => {
    sessionStorage.setItem('cnsl_weather_alert_expanded', 'false');
  });

  for (const path of publishedPagePaths) {
    await page.goto(path, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#weatherAlert')).toBeVisible();
    await expect(page.locator('.weather-alert__title')).toHaveText('Weather alert');
    await expect(page.locator('#weatherAlertMessage')).toContainText('Severe Thunderstorm Warning');
    await expect(page.locator('#weatherAlertUpdated')).not.toHaveText('');
    await expect(page.locator('#weatherAlertUpdated')).toHaveAttribute('datetime', /2026-/);
    await expect(page.locator('#weatherAlertDetails')).toBeHidden();
    await expect(page.getByRole('link', { name: 'Live pool status' })).toBeHidden();
    await expect(page.getByRole('link', { name: 'NWS local alerts' })).toBeHidden();
    await expect(page.getByRole('button', { name: 'Expand weather safety alert' })).toBeVisible();
  }

  await expect(page.locator('#weatherAlertMessage .weather-alert__type-icon')).toHaveText('⚠️');
  await expect(page.locator('#weatherAlertMessage .weather-alert__guidance')).toHaveText('Check live pool status before leaving.');
  await expect(page.locator('#weatherAlertMessage .weather-alert__guidance')).toHaveCSS('display', 'block');
  const collapsedAlertBox = await page.locator('#weatherAlert').boundingBox();
  const collapsedTitleBox = await page.locator('.weather-alert__title').boundingBox();
  const collapsedToggleBox = await page.getByRole('button', { name: 'Expand weather safety alert' }).boundingBox();
  await page.getByRole('button', { name: 'Expand weather safety alert' }).click();
  await expect(page.locator('#weatherAlertDetails')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Live pool status' })).toBeVisible();
  const nwsAlertLink = page.getByRole('link', { name: 'NWS local alerts' });
  await expect(nwsAlertLink).toBeVisible();
  await expect(nwsAlertLink).toHaveAttribute('href', 'https://forecast.weather.gov/MapClick.php?lat=39.2014&lon=-76.8610');
  await expect(nwsAlertLink).toHaveAttribute('target', '_blank');
  await expect(nwsAlertLink).toHaveAttribute('rel', 'noopener noreferrer');
  const expandedAlertBox = await page.locator('#weatherAlert').boundingBox();
  const expandedTitleBox = await page.locator('.weather-alert__title').boundingBox();
  const expandedToggleBox = await page.getByRole('button', { name: 'Collapse weather safety alert' }).boundingBox();
  const expandedActionBox = await page.getByRole('link', { name: 'Live pool status' }).boundingBox();
  const expandedNwsActionBox = await page.getByRole('link', { name: 'NWS local alerts' }).boundingBox();
  expect(collapsedAlertBox.height).toBeCloseTo(70, 1);
  expect(expandedAlertBox.height).toBeGreaterThanOrEqual(collapsedAlertBox.height);
  expect(expandedTitleBox.height).toBe(collapsedTitleBox.height);
  expect(collapsedToggleBox.height).toBe(collapsedTitleBox.height);
  expect(expandedToggleBox.height).toBe(collapsedToggleBox.height);
  expect(expandedToggleBox.y - collapsedToggleBox.y).toBeCloseTo(expandedTitleBox.y - collapsedTitleBox.y, 1);
  expect(expandedActionBox.y).toBe(expandedToggleBox.y);
  expect(expandedActionBox.height).toBe(expandedToggleBox.height);
  expect(expandedNwsActionBox.y).toBe(expandedToggleBox.y);
  expect(expandedNwsActionBox.height).toBe(expandedToggleBox.height);
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem('cnsl_weather_alert_expanded'))).toBe('true');
});

test('[WF-WEATHER-006] forecast alerts emphasize only the recognized hazard label', async ({ page }) => {
  await page.addInitScript(refreshMinutes => {
    const status = {
      guidance: 'Check live pool status before leaving.',
      hazardLabel: 'thunderstorms and hail',
      hazards: ['thunderstorms', 'hail'],
      isInclement: true,
      message: "This afternoon's forecast includes thunderstorms and hail.",
      source: 'forecast',
      updatedAt: new Date().toISOString()
    };
    sessionStorage.setItem('cnsl_weather_alert_status', JSON.stringify({
      expiresAt: Date.now() + 60_000,
      refreshMinutes,
      status
    }));
    sessionStorage.setItem('cnsl_weather_alert_expanded', 'false');
  }, AppConfig.WEATHER_ALERT_DEFAULT_REFRESH_MINUTES);

  await page.goto('/', { waitUntil: 'domcontentloaded' });

  const message = page.locator('#weatherAlertMessage');
  await expect(message).toHaveText("This afternoon's forecast includes ⛈️thunderstorms and 🧊hail. Check live pool status before leaving.");
  await expect(message.locator('strong')).toHaveText(['⛈️thunderstorms', '🧊hail']);
  await expect(message.locator('strong')).toHaveCount(2);
  await expect(message.locator('.weather-alert__type-icon')).toHaveCount(2);
  await expect(message.locator('.weather-alert__type-icon').nth(0)).toHaveAttribute('aria-hidden', 'true');
  await expect(message.locator('.weather-alert__guidance')).toHaveText('Check live pool status before leaving.');
  await expect(message.locator('.weather-alert__guidance')).toHaveCSS('display', 'block');
  await expect(message.locator('.weather-alert__guidance a')).toHaveCount(0);
  await expect(page.locator('#weatherAlertUpdated')).toHaveAttribute('datetime', /.+/);
  await expect(page.getByRole('link', { name: 'NWS local alerts' })).toBeHidden();
  await expect(page.getByRole('button', { name: 'Expand weather safety alert' })).toBeVisible();
  await expect(page.locator('#weatherAlertDetails')).toBeHidden();
});

test('[WF-WEATHER-002] mobile weather safety alert keeps navigation visible and collapses with a stable arrow control', async ({ page }) => {
  await page.setViewportSize(MOBILE_VIEWPORT);
  await prepareVisibleWeatherAlert(page);
  await page.goto('/index.html');

  await page.locator('.site-title').evaluate(title => {
    title.textContent = 'CA Pool and CNSL Assistant Weather Safety Information';
  });
  const alert = page.locator('#weatherAlert');
  const toggle = page.getByRole('button', { name: 'Collapse weather safety alert' });
  const action = page.getByRole('link', { name: 'Live pool status' });
  const nwsAlertLink = page.getByRole('link', { name: 'NWS local alerts' });
  const icon = page.locator('.weather-alert__toggle-icon');
  const warningIcon = page.locator('.weather-alert__warning-icon');
  const liveIndicator = page.locator('.weather-alert__live-indicator');
  await expect(alert).toBeVisible();
  await expect(page.locator('.weather-alert__title')).toBeVisible();
  await expect(warningIcon).toBeVisible();
  await expect(liveIndicator).toBeVisible();
  await expect(page.locator('.weather-alert__copy')).toHaveCSS('text-align', 'center');
  const titleBackground = await page.locator('.weather-alert__title').evaluate(element => element.ownerDocument.defaultView.getComputedStyle(element).backgroundColor);
  const actionBackground = await action.evaluate(element => element.ownerDocument.defaultView.getComputedStyle(element).backgroundColor);
  expect(titleBackground).toBe(actionBackground);
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(action).toBeVisible();
  await expect(nwsAlertLink).toBeVisible();
  const expandedTitleBox = await page.locator('.weather-alert__title').boundingBox();
  const expandedToggleSize = await toggle.boundingBox();
  const expandedActionBox = await action.boundingBox();
  const expandedNwsActionBox = await nwsAlertLink.boundingBox();
  expect(expandedToggleSize.width).toBe(expandedToggleSize.height);
  expect(expandedToggleSize.height).toBe(expandedTitleBox.height);
  expect(expandedToggleSize.height).toBe(expandedActionBox.height);
  expect(expandedActionBox.y).toBeGreaterThanOrEqual(expandedTitleBox.y + expandedTitleBox.height);
  expect(expandedNwsActionBox.y).toBe(expandedActionBox.y);
  const expandedAlertBackground = await alert.evaluate(element => element.ownerDocument.defaultView.getComputedStyle(element).backgroundColor);
  await expect(icon).toHaveCSS('transform', 'none');
  await expect(icon).toHaveCSS('transition-duration', '0s');

  const navigationToggle = page.getByRole('button', { name: 'Open navigation menu' });
  await navigationToggle.click();
  const homeLink = page.locator('#navMenu a').first();
  await expect(homeLink).toBeVisible();
  const headerBox = await page.locator('.header').boundingBox();
  const homeLinkBox = await homeLink.boundingBox();
  expect(homeLinkBox.y).toBeGreaterThanOrEqual(headerBox.y + headerBox.height);
  await page.keyboard.press('Escape');
  await expect(navigationToggle).toBeFocused();

  await toggle.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#weatherAlertDetails')).toBeHidden();
  await expect(page.locator('.weather-alert__title')).toBeVisible();
  const expandToggle = page.getByRole('button', { name: 'Expand weather safety alert' });
  await expect(expandToggle).toHaveAttribute('aria-expanded', 'false');
  await expect(action).toBeHidden();
  await expect(nwsAlertLink).toBeHidden();
  await expect(icon).toHaveCSS('transform', 'matrix(-1, 0, 0, -1, 0, 0)');
  const collapsedToggleSize = await expandToggle.boundingBox();
  const collapsedAlertBackground = await alert.evaluate(element => element.ownerDocument.defaultView.getComputedStyle(element).backgroundColor);
  expect(collapsedToggleSize.width).toBe(expandedToggleSize.width);
  expect(collapsedToggleSize.height).toBe(expandedToggleSize.height);
  expect(collapsedToggleSize.x).toBe(expandedToggleSize.x);
  expect(collapsedToggleSize.y).toBe(expandedToggleSize.y);
  expect(collapsedAlertBackground).toBe(expandedAlertBackground);
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem('cnsl_weather_alert_expanded'))).toBe('false');

  const navigationRequests = [];
  page.on('request', request => navigationRequests.push(request.url()));
  await page.goto('/about.html');
  const restoredToggle = page.getByRole('button', { name: 'Expand weather safety alert' });
  await expect(restoredToggle).toBeVisible();
  await expect(page.getByRole('link', { name: 'Live pool status' })).toBeHidden();
  const bannerWasVisibleAtFirstPaint = await page.locator('#weatherAlert').evaluate(banner => new Promise(resolve => {
    banner.ownerDocument.defaultView.requestAnimationFrame(() => resolve(!banner.hidden));
  }));
  expect(bannerWasVisibleAtFirstPaint).toBe(true);
  expect(navigationRequests.filter(url => url.includes('/assets/data/2026/pools/pools.json') || url.startsWith('https://api.weather.gov/'))).toEqual([]);

  await restoredToggle.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#weatherAlertDetails')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Live pool status' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Collapse weather safety alert' })).toBeFocused();
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem('cnsl_weather_alert_expanded'))).toBe('true');
});

test('[WF-WEATHER-003] turning weather safety alerts off hides an active banner immediately', async ({ page }) => {
  await prepareVisibleWeatherAlert(page);
  await page.goto('/settings.html');
  await expect(page.locator('#weatherAlert')).toBeVisible();

  await page.locator('#poolVisitSettings summary').click();
  await page.getByRole('radio', { name: 'Off', exact: true }).check();
  await expect(page.locator('#weatherAlert')).toBeHidden();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('cnsl_preferences')).weatherRefreshMinutes)).toBe(0);

  await page.goto('/index.html');
  await expect(page.locator('#weatherAlert')).toBeHidden();
});

test('[WF-POOLS-009] practice-only schedules identify teams from detailed schedule overlap where available', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-06-25T12:00:00-04:00'));
  await page.goto('/pools.html');
  await expect(page.locator('#poolListStatus')).toContainText('Pool directory loaded.');

  const jeffersHill = page.locator('.pool-card').filter({ hasText: 'Jeffers Hill' });
  await jeffersHill.locator('.pool-header__toggle').click();
  await expect(jeffersHill).toContainText('CNSL Practice Only');
  const marlinsName = jeffersHill.locator('.schedule-activity__team-names').filter({ hasText: 'Marlins' }).first();
  await expect(marlinsName).toBeVisible();
  expect(await marlinsName.evaluate(element => (
    element.getBoundingClientRect().top >= element.previousElementSibling.getBoundingClientRect().bottom
  ))).toBe(true);

  const hawthorn = page.locator('.pool-card').filter({ hasText: 'Hawthorn' });
  await hawthorn.locator('.pool-header__toggle').click();
  await expect(hawthorn.locator('.schedule-activity__team-names').filter({ hasText: 'Sundevils' }).first()).toBeVisible();

  const hopewell = page.locator('.pool-card').filter({ hasText: 'Hopewell' });
  await hopewell.locator('.pool-header__toggle').click();
  await expect(hopewell.locator('.schedule-activity__team-names').filter({ hasText: 'Dolphins, Barracudas' }).first()).toBeVisible();

  const faulknerRidge = page.locator('.pool-card').filter({ hasText: 'Faulkner Ridge' });
  await faulknerRidge.locator('.pool-header__toggle').click();
  await expect(faulknerRidge).toContainText('CNSL Practice Only');
  await expect(faulknerRidge.locator('.schedule-activity__team-names').filter({ hasText: 'Challenge' }).first()).toBeVisible();
});

test('[WF-POOLS-010] practice-only schedules do not infer a team from pool association alone', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-06-25T12:00:00-04:00'));
  await page.route('**/assets/data/2026/teams/teams.json*', async route => {
    const response = await route.fetch();
    const data = await response.json();
    const longReach = data.teams.find(team => team.id === 'lrm');
    delete longReach.practice;
    await route.fulfill({ response, json: data });
  });
  await page.goto('/pools.html');
  await expect(page.locator('#poolListStatus')).toContainText('Pool directory loaded.');

  const jeffersHill = page.locator('.pool-card').filter({ hasText: 'Jeffers Hill' });
  await jeffersHill.locator('.pool-header__toggle').click();
  await expect(jeffersHill).toContainText('CNSL Practice Only');
  await expect(jeffersHill.locator('.schedule-activity__team-names')).toHaveCount(0);
});

test('[WF-POOLS-011] team-only practice uses restricted live status and public availability filtering', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-05-26T15:30:00-04:00'));
  await page.goto('/pools.html');
  await expect(page.locator('#poolListStatus')).toContainText('Pool directory loaded.');

  let jeffersHill = page.locator('.pool-card').filter({ hasText: 'Jeffers Hill' });
  await jeffersHill.locator('.pool-header__toggle').click();
  await expect(jeffersHill).toContainText('Clippers Practice Only');
  await expect(jeffersHill.locator('.open-status')).toContainText('Closed to the public');
  await expect(jeffersHill.locator('.open-status')).toHaveClass(/status-yellow/);

  await page.locator('#togglePoolFeatureFilters').click();
  await page.selectOption('#poolAvailabilityFilter', 'open-now');
  jeffersHill = page.locator('.pool-card').filter({ hasText: 'Jeffers Hill' });
  await expect(jeffersHill).toHaveCount(0);
});

test('[WF-POOLS-012] live status updates after a team-only practice period ends without a reload', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-05-26T18:59:30-04:00') });
  await page.goto('/pools.html');
  await expect(page.locator('#poolListStatus')).toContainText('Pool directory loaded.');

  const jeffersHill = page.locator('.pool-card').filter({ hasText: 'Jeffers Hill' });
  const toggle = jeffersHill.locator('.pool-header__toggle');
  await toggle.evaluate(button => button.click());
  await expect(jeffersHill.locator('.open-status')).toContainText('Closed to the public');
  await expect(jeffersHill.locator('.open-status')).toHaveClass(/status-yellow/);

  await toggle.focus();
  await page.clock.fastForward(31 * 1000);
  await expect(jeffersHill.locator('.open-status')).toContainText('Closed');
  await expect(jeffersHill.locator('.open-status')).toHaveClass(/status-red/);
  await expect(jeffersHill.locator('.pool-header__toggle')).toBeFocused();
  await expect(page.locator('#poolListStatus')).toHaveText('Pool availability updated for the current time.');
});

test('[WF-POOLS-013] open-now results update after a public-use period ends without a reload', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-05-26T18:59:30-04:00') });
  await page.goto('/pools.html');
  await expect(page.locator('#poolListStatus')).toContainText('Pool directory loaded.');

  await page.locator('#togglePoolFeatureFilters').evaluate(button => button.click());
  await page.selectOption('#poolAvailabilityFilter', 'open-now');
  const clarysForest = page.locator('.pool-card').filter({ hasText: "Clary's Forest" });
  await expect(clarysForest).toHaveCount(1);

  await page.clock.fastForward(31 * 1000);
  await expect(clarysForest).toHaveCount(0);
  await expect(page.locator('#poolListStatus')).toHaveText('Pool availability updated for the current time.');
});

test('[WF-POOLS-014] semantic practice status drives detail and calendar styling when its label changes', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-06-25T12:00:00-04:00'));
  await seedPreferences(page, { poolScheduleLayout: 'calendar' });
  await page.route('**/assets/data/2026/pools/pools.json*', async route => {
    const response = await route.fetch();
    const poolData = await response.json();
    poolData.pools.forEach(pool => {
      pool.schedules.forEach(schedule => {
        schedule.hours.forEach(hours => {
          if (hours.accessStatus === 'practice-only') hours.types = ['Published Team Session'];
        });
      });
    });
    await route.fulfill({ response, json: poolData });
  });
  await page.goto('/pools.html');
  await expect(page.locator('#poolListStatus')).toContainText('Pool directory loaded.');

  const jeffersHill = page.locator('.pool-card').filter({ hasText: 'Jeffers Hill' });
  await jeffersHill.locator('.pool-header__toggle').click();
  const marlinsName = jeffersHill.locator('.schedule-activity__team-names').filter({ hasText: 'Marlins' }).first();
  await expect(marlinsName).toBeVisible();
  await expect(marlinsName.locator('xpath=..')).toHaveClass(/schedule-activity--event/);
  await expect(marlinsName.locator('xpath=..')).toContainText('Published Team Session');
});

test('[WF-POOLS-015] opens-soon results update when a public opening enters the next hour', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-05-26T13:59:30-04:00') });
  await page.route('**/assets/data/2026/pools/pools.json*', async route => {
    const response = await route.fetch();
    const poolData = await response.json();
    poolData.pools.forEach(pool => {
      pool.schedules = [{
        startDate: '2026-05-23',
        endDate: '2026-09-07',
        hours: [{
          weekDays: ['Tue'],
          startTime: '3:00PM',
          endTime: '6:00PM',
          types: ['Rec Swim'],
          accessStatus: 'public'
        }]
      }];
      pool.scheduleOverrides = [];
    });
    await route.fulfill({ response, json: poolData });
  });
  await page.goto('/pools.html');
  await expect(page.locator('#poolListStatus')).toContainText('Pool directory loaded.');

  await page.locator('#togglePoolFeatureFilters').click();
  await page.selectOption('#poolAvailabilityFilter', 'opens-soon');
  await expect(page.locator('#poolList .pool-card')).toHaveCount(0);

  await page.clock.fastForward(31 * 1000);
  await expect(page.locator('#poolList .pool-card')).toHaveCount(23);
  await expect(page.locator('#poolListStatus')).toHaveText('Pool availability updated for the current time.');
});

test('[WF-POOLS-019] Masters-only hours are restricted program access instead of a public opening', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-06-10T06:30:00-04:00'));
  await seedPreferences(page, { poolScheduleLayout: 'calendar' });
  await page.goto('/pools.html');
  await expect(page.locator('#poolListStatus')).toContainText('Pool directory loaded.');

  let talbottSprings = page.locator('.pool-card').filter({ hasText: 'Talbott Springs' });
  await talbottSprings.locator('.pool-header__toggle').click();
  await expect(talbottSprings.locator('.open-status')).toContainText('Restricted Access');
  await expect(talbottSprings.locator('.open-status')).toHaveClass(/status-yellow/);
  await expect(talbottSprings.locator('.schedule-activity--restricted').filter({ hasText: 'Masters Swim' })).toHaveCount(3);

  await page.locator('#togglePoolFeatureFilters').click();
  await page.selectOption('#poolAvailabilityFilter', 'open-now');
  talbottSprings = page.locator('.pool-card').filter({ hasText: 'Talbott Springs' });
  await expect(talbottSprings).toHaveCount(0);
});

test('[WF-POOLS-016] collapsed opening and closing countdowns update without interaction', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-05-26T14:58:30-04:00') });
  await page.route('**/assets/data/2026/pools/pools.json*', async route => {
    const response = await route.fetch();
    const poolData = await response.json();
    poolData.pools.forEach((pool, index) => {
      pool.schedules = [{
        startDate: '2026-05-23',
        endDate: '2026-09-07',
        hours: [{
          weekDays: ['Tue'],
          startTime: index === 0 ? '1:00PM' : '3:00PM',
          endTime: index === 0 ? '3:00PM' : '6:00PM',
          types: ['Rec Swim'],
          accessStatus: 'public'
        }]
      }];
      pool.scheduleOverrides = [];
    });
    await route.fulfill({ response, json: poolData });
  });
  await page.goto('/pools.html');
  await expect(page.locator('#poolListStatus')).toContainText('Pool directory loaded.');

  const closingCard = page.locator('#poolList .pool-card').first();
  const openingCard = page.locator('#poolList .pool-card').nth(1);
  await expect(closingCard).toHaveClass(/collapsed/);
  await expect(openingCard).toHaveClass(/collapsed/);
  await expect(closingCard.locator('.pool-transition-summary')).toHaveText('Closes in 2 mins');
  await expect(openingCard.locator('.pool-transition-summary')).toHaveText('Opens in 2 mins');

  await page.clock.fastForward(31 * 1000);
  await expect(closingCard.locator('.pool-transition-summary')).toHaveText('Closes in 1 min');
  await expect(openingCard.locator('.pool-transition-summary')).toHaveText('Opens in 1 min');
});
