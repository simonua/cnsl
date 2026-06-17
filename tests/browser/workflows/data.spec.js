const { test, expect } = require('../browser-test');
const {
  ACTIVE_SEASON_YEAR,
  getAnnualDataRoute,
  getAnnualDataUrlPattern,
  prepareStableWeatherResponses
} = require('../browser-test-helpers');

const WEATHER_CHECKED_AT = `${ACTIVE_SEASON_YEAR}-06-02T14:15:00-04:00`;
const WEATHER_REFRESHED_AT = `${ACTIVE_SEASON_YEAR}-06-02T14:20:00-04:00`;
const { directoryScenarios } = require('./workflow-scenarios');

test.beforeEach(async ({ page }) => {
  await prepareStableWeatherResponses(page);
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
      for (const domain of ['pools', 'teams', 'meets']) {
        if (getAnnualDataUrlPattern(domain).test(request.url())) requestedDomains.push(domain);
      }
    });

    await page.goto(scenario.path);
    await expect(page.locator(scenario.list)).toHaveAttribute('aria-busy', 'false');
    await expect(page.locator(`${scenario.list} ${scenario.item}`).first()).toBeVisible();
    expect(requestedDomains.sort()).toEqual(scenario.domains);
  });
}

for (const scenario of directoryScenarios) {
  test(`[WF-DATA-005-${scenario.reference}] ${scenario.path} does not flash a visible loading placeholder`, async ({ page }) => {
    let resumePoolRequest;
    const poolRequestPaused = new Promise(resolve => {
      resumePoolRequest = resolve;
    });
    await page.route(getAnnualDataRoute('pools'), async route => {
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

    await expect(page.locator(scenario.list)).toHaveAttribute('aria-busy', 'false');
    await expect(page.locator(`${scenario.list} ${scenario.item}`).first()).toBeVisible();
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
  await page.addInitScript(updatedAt => {
    localStorage.setItem('cnsl_weather_alert_last_successful_check', JSON.stringify({ updatedAt }));
  }, WEATHER_CHECKED_AT);
  await page.goto('/faq.html');

  const weatherFreshness = page.locator('#footerWeatherFreshness');
  const weatherTimestamp = page.locator('#footerWeatherUpdated');
  await expect(weatherFreshness).toBeVisible();
  await expect(weatherFreshness).toHaveAttribute('aria-hidden', 'false');
  await expect(weatherTimestamp).toHaveText('June 2, 2:15 PM');
  await expect(weatherTimestamp).toHaveAttribute('datetime', WEATHER_CHECKED_AT);

  await page.evaluate(updatedAt => {
    localStorage.setItem('cnsl_weather_alert_last_successful_check', JSON.stringify({ updatedAt }));
    globalThis.dispatchEvent(new CustomEvent('cnsl:weather-alert-status-changed'));
  }, WEATHER_REFRESHED_AT);
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

  const visibleRowHeight = await weatherFreshness.evaluate(element => element.getBoundingClientRect().height);

  await page.evaluate(() => {
    const preferences = globalThis.PreferencesService.get();
    globalThis.PreferencesService.save({ ...preferences, weatherRefreshMinutes: 0 });
    globalThis.dispatchEvent(new CustomEvent('cnsl:preferences-changed'));
  });
  await expect(weatherFreshness).toBeHidden();
  await expect(weatherFreshness).toHaveAttribute('aria-hidden', 'true');
  expect(await weatherFreshness.evaluate(element => element.getBoundingClientRect().height)).toBe(visibleRowHeight);

  await page.evaluate(() => {
    localStorage.removeItem('cnsl_weather_alert_last_successful_check');
    const preferences = globalThis.PreferencesService.get();
    globalThis.PreferencesService.save({ ...preferences, weatherRefreshMinutes: 5 });
    globalThis.dispatchEvent(new CustomEvent('cnsl:preferences-changed'));
  });
  await expect(weatherFreshness).toBeHidden();
  await expect(weatherFreshness).toHaveAttribute('aria-hidden', 'true');
  await expect(weatherFreshness).not.toContainText('Not checked yet');
  expect(await weatherFreshness.evaluate(element => element.getBoundingClientRect().height)).toBe(visibleRowHeight);
});

test('[WF-DATA-007-POOLS] pool summaries and requested details render before optional enrichment settles', async ({ page }) => {
  let releaseOptionalRequests;
  const optionalRequestsPaused = new Promise(resolve => {
    releaseOptionalRequests = resolve;
  });
  for (const domain of ['teams', 'meets']) {
    await page.route(getAnnualDataRoute(domain), async route => {
      await optionalRequestsPaused;
      await route.continue();
    });
  }

  try {
    await page.goto('/pools.html', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#poolList')).toHaveAttribute('aria-busy', 'false');
    const poolCount = await page.locator('#poolList .pool-card').count();
    expect(poolCount).toBeGreaterThan(0);
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
    await expect(page.locator('#poolList .pool-details[data-pool-details-hydrated="false"]')).toHaveCount(poolCount);
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
    if (getAnnualDataUrlPattern('pools').test(request.url())) poolDataRequests.push(request.url());
  });

  await page.goto('/faq.html');
  await expect(page.locator('h1')).toHaveText('Frequently Asked Questions');
  expect(poolDataRequests).toEqual([]);
  expect(await page.evaluate(() => Object.keys(globalThis.WEATHER_OPERATING_WINDOWS.dailyOperatingWindows).length)).toBeGreaterThan(0);
});

test('[WF-DATA-003] pool load failures are announced and do not leave the directory busy', async ({ page }) => {
  await page.route(getAnnualDataRoute('pools'), route => route.fulfill({ status: 503, body: '{}' }));
  await page.goto('/pools.html');

  await expect(page.locator('#poolListStatus')).toHaveText('The pool directory did not load. Please check your connection and refresh the page to try again.');
  await expect(page.locator('#poolList')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('#seasonInfo')).toBeHidden();
});

test('[WF-DATA-004] malformed published pool responses are announced as unavailable', async ({ page }) => {
  await page.route(getAnnualDataRoute('pools'), route => route.fulfill({ json: {} }));
  await page.goto('/pools.html');

  await expect(page.locator('#poolListStatus')).toHaveText('The pool directory did not load. Please check your connection and refresh the page to try again.');
  await expect(page.locator('#poolList')).toHaveAttribute('aria-busy', 'false');
});
