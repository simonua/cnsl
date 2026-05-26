const { test, expect } = require('@playwright/test');
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
  '/swim-meet-resources.html', '/whats-new.html', '/about.html', '/faq.html', '/offline.html'
];

const directoryScenarios = [
  {
    path: '/pools.html',
    list: '#poolList',
    status: '#poolListStatus',
    announcement: /Pool directory loaded\. 23 pools available\./,
    readyText: /Pool directory loaded\./,
    domains: ['pools'],
    surface: '.pool-card.collapsed',
    toggle: '.pool-header__toggle'
  },
  {
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

test('navigation contains keyboard focus and restores it when dismissed', async ({ page }) => {
  await page.setViewportSize(MOBILE_VIEWPORT);
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

for (const scenario of directoryScenarios) {
  test(`${scenario.path} announces completed directory loading`, async ({ page }) => {
    await page.goto(scenario.path);
    await expect(page.locator(scenario.status)).toHaveText(scenario.announcement);
    await expect(page.locator(scenario.list)).toHaveAttribute('aria-busy', 'false');
  });
}

for (const scenario of directoryScenarios) {
  test(`${scenario.path} requests only the annual data required for its workflow`, async ({ page }) => {
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

test('pool load failures are announced and do not leave the directory busy', async ({ page }) => {
  await page.route('**/assets/data/2026/pools/pools.json*', route => route.fulfill({ status: 503, body: '{}' }));
  await page.goto('/pools.html');

  await expect(page.locator('#poolListStatus')).toHaveText('Pool information is currently unavailable. Please try again later.');
  await expect(page.locator('#poolList')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('#seasonInfo')).toBeHidden();
});

test('malformed published pool responses are announced as unavailable', async ({ page }) => {
  await page.route('**/assets/data/2026/pools/pools.json*', route => route.fulfill({ json: {} }));
  await page.goto('/pools.html');

  await expect(page.locator('#poolListStatus')).toHaveText('Pool information is currently unavailable. Please try again later.');
  await expect(page.locator('#poolList')).toHaveAttribute('aria-busy', 'false');
});

test('season summary and sharing actions appear only on the home page', async ({ page }) => {
  await initializeAnalyticsRecorder(page);
  await page.goto('/');

  await expect(page.locator('.season-text')).toHaveText('The 2026 season runs from May 23 to September 7.');
  await expect(page.getByRole('link', { name: "CA's 2026 Pool Season" })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Text' })).toHaveAttribute('href', 'sms:?&body=Find%20Columbia%20pools%20and%20CNSL%20schedules%3A%20https%3A%2F%2Fpools.longreachmarlins.org');
  await expect(page.getByRole('link', { name: 'Email' })).toHaveAttribute('href', 'mailto:?subject=Columbia%20Pools%20and%20CNSL%20Schedules&body=Find%20Columbia%20pools%20and%20CNSL%20schedules%3A%20https%3A%2F%2Fpools.longreachmarlins.org');
  await expect(page.getByRole('link', { name: 'Facebook (opens in new tab)' })).toHaveAttribute('href', 'https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Fpools.longreachmarlins.org');
  await expect(page.getByRole('link', { name: 'Send Feedback' })).toHaveAttribute('href', 'mailto:simonkurtz@gmail.com?subject=CA%20Pool%20%26%20CNSL%20Assistant%20App%20Feedback');
  await page.getByRole('link', { name: 'Meets' }).focus();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Text' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Email' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Facebook (opens in new tab)' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Send Feedback' })).toBeFocused();

  for (const method of ['text', 'email', 'facebook']) {
    await page.locator(`[data-analytics-share-method="${method}"] .share-site__icon`).evaluate(icon => {
      icon.parentElement.addEventListener('click', event => event.preventDefault(), { once: true });
      icon.dispatchEvent(new globalThis.MouseEvent('click', { bubbles: true, cancelable: true }));
    });
  }
  await expect.poll(() => page.evaluate(() => globalThis.recordedAnalyticsEvents)).toEqual([
    ['event', 'ca_share', { method: 'text', content_type: 'website', item_id: 'home_page' }],
    ['event', 'ca_external_link', {}],
    ['event', 'ca_share', { method: 'email', content_type: 'website', item_id: 'home_page' }],
    ['event', 'ca_external_link', {}],
    ['event', 'ca_share', { method: 'facebook', content_type: 'website', item_id: 'home_page' }],
    ['event', 'ca_external_link', {}]
  ]);

  await page.locator('a.directory-link').evaluate(link => {
    link.addEventListener('click', event => event.preventDefault(), { once: true });
    link.dispatchEvent(new globalThis.MouseEvent('click', { bubbles: true, cancelable: true }));
  });
  await expect.poll(() => page.evaluate(() => globalThis.recordedAnalyticsEvents.at(-1))).toEqual(['event', 'ca_external_link', {}]);

  await page.setViewportSize(MOBILE_VIEWPORT);
  const compactLinkLayout = await page.locator('.quick-link-card').evaluateAll(cards => cards.map(card => {
    const bounds = card.getBoundingClientRect();
    return { top: bounds.top, right: bounds.right, height: bounds.height };
  }));
  expect(new Set(compactLinkLayout.map(card => card.top)).size).toBe(1);
  expect(compactLinkLayout.every(card => card.right <= MOBILE_VIEWPORT.width && card.height >= 44 && card.height < 80)).toBe(true);

  const compactShareLayout = await page.locator('.share-site__links .share-site__link').evaluateAll(links => links.map(link => {
    const bounds = link.getBoundingClientRect();
    return { top: bounds.top, right: bounds.right, height: bounds.height };
  }));
  expect(new Set(compactShareLayout.map(link => link.top)).size).toBe(1);
  expect(compactShareLayout.every(link => link.right <= MOBILE_VIEWPORT.width && link.height >= 44)).toBe(true);

  await page.goto('/pools.html');
  await expect(page.locator('.season-text')).toHaveCount(0);
  await expect(page.getByRole('link', { name: "CA's 2026 Pool Season" })).toHaveCount(0);
  await expect(page.locator('.share-site')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Interactive CA Pool Directory' })).toBeVisible();
  await expect.poll(() => page.locator('#poolList, #seasonInfo').evaluateAll(elements => elements.map(element => element.id))).toEqual(['poolList', 'seasonInfo']);
});

test('analytics publishes a page view and public app version only after the Google tag script loads', async ({ page }) => {
  let releaseTagScript;
  let reportTagScriptRequest;
  const tagScriptRequested = new Promise(resolve => {
    reportTagScriptRequest = resolve;
  });
  await page.route('https://www.googletagmanager.com/**', async route => {
    reportTagScriptRequest();
    await new Promise(release => {
      releaseTagScript = release;
    });
    await route.fulfill({
      contentType: 'application/javascript',
      body: 'globalThis.cnslTagScriptLoaded = true;'
    });
  });

  await page.route('https://pools.longreachmarlins.org/**', async route => {
    const requestedUrl = new URL(route.request().url());
    const response = await page.request.get(`http://127.0.0.1:4173${requestedUrl.pathname}`);
    await route.fulfill({ response });
  });

  await page.goto('https://pools.longreachmarlins.org/index.html', { waitUntil: 'domcontentloaded' });
  await tagScriptRequested;
  const measurementId = await page.evaluate(() => globalThis.GA4_MEASUREMENT_ID);
  const appVersion = await page.evaluate(() => globalThis.APP_VERSION);

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
      ['event', 'ca_version']
    ]
  });
  await expect.poll(() => page.evaluate(() => Array.from(globalThis.dataLayer.at(-2))[2])).toMatchObject({
    page_location: 'https://pools.longreachmarlins.org/index.html',
    page_referrer: ''
  });
  await expect.poll(() => page.evaluate(() => Array.from(globalThis.dataLayer.at(-1))[2])).toEqual({
    app_version: appVersion
  });
  await page.unrouteAll({ behavior: 'ignoreErrors' });
});

test('release updates are announced once after a stable version is acknowledged', async ({ page }) => {
  await page.setViewportSize(MOBILE_VIEWPORT);
  await page.goto('/index.html');

  const notice = page.locator('#releaseNotice');
  await expect(notice).toBeVisible();
  await expect(notice).toContainText('App updated to V2.1.0.');
  const closeBox = await page.getByRole('button', { name: 'Dismiss application update' }).boundingBox();
  const menuBox = await page.getByRole('button', { name: 'Open navigation menu' }).boundingBox();
  expect(closeBox.width).toBe(menuBox.width);
  expect(closeBox.x).toBe(menuBox.x);
  await page.getByRole('button', { name: 'Dismiss application update' }).focus();
  await page.keyboard.press('Enter');
  await expect(notice).toBeHidden();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('cnsl_current_version'))).toBe('2.1.0');

  await page.goto('/pools.html');
  await expect(page.locator('#releaseNotice')).toHaveCount(0);

  await page.evaluate(() => localStorage.setItem('cnsl_current_version', '2.0.0'));
  await page.goto('/index.html');
  await expect(page.locator('#releaseNotice')).toBeVisible();
  await page.locator('#releaseNoticeLink').click();
  await expect(page).toHaveURL(/\/whats-new\.html$/);
  await expect(page.getByRole('heading', { name: 'Version 2.1.0 - May 2026' })).toBeVisible();
  await expect(page.locator('#releaseNotice')).toBeHidden();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('cnsl_current_version'))).toBe('2.1.0');
});

test('pool feature filters expose their state and resulting count', async ({ page }) => {
  await initializeAnalyticsRecorder(page);
  await page.goto('/pools.html');
  await expect(page.locator('#poolListStatus')).toContainText('Pool directory loaded.');

  const filters = page.locator('#togglePoolFeatureFilters');
  await page.locator('#poolFeatureFilter').click({ position: { x: 4, y: 4 } });
  await expect(filters).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('.pool-filter__group--accessibility')).toBeVisible();
  await expect(page.locator('.pool-filter__option--young-swimmers').first()).toBeVisible();
  await expect(page.locator('.pool-filter__option--water-play').first()).toBeVisible();
  const chipColors = await Promise.all([
    page.locator('.pool-filter__option--accessibility > span').first().evaluate(chip => globalThis.getComputedStyle(chip).backgroundColor),
    page.locator('.pool-filter__option--young-swimmers > span').first().evaluate(chip => globalThis.getComputedStyle(chip).backgroundColor),
    page.locator('.pool-filter__option--water-play > span').first().evaluate(chip => globalThis.getComputedStyle(chip).backgroundColor)
  ]);
  expect(new Set(chipColors).size).toBe(3);
  await page.locator('input[name="poolFeature"]').first().check();

  await expect(page.locator('#poolFilterSummary')).toHaveText(/Showing \d+ of 23 pools/);
  await expect(page.locator('#poolFeatureFilterCount')).toHaveText('1 selected');

  await page.locator('#clearPoolFeatureFilters').click();
  await expect(filters).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#poolFilterSummary')).toHaveText('23 pools');
  await expect.poll(() => page.evaluate(() => globalThis.recordedAnalyticsEvents)).toEqual([
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
  await expect.poll(() => page.evaluate(() => globalThis.recordedAnalyticsEvents)).toHaveLength(2);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('cnsl_preferences')).poolFeatureFilters)).toEqual([]);
});

test('pool availability filters show pools open now or for the next two hours', async ({ page }) => {
  await page.route('**/assets/data/2026/pools/pools.json*', async route => {
    const response = await route.fetch();
    const poolData = await response.json();
    poolData.pools.forEach((pool, index) => {
      pool.schedules = [{
        startDate: '2026-05-23',
        endDate: '2026-09-07',
        hours: [{
          weekDays: ['Tue'],
          startTime: '1:00PM',
          endTime: index === 0 ? '6:00PM' : '4:00PM',
          types: ['Rec Swim']
        }]
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

  await page.selectOption('#poolAvailabilityFilter', 'open-now');
  await expect(page.locator('#poolFilterSummary')).toHaveText('Showing 23 of 23 pools');

  await page.selectOption('#poolAvailabilityFilter', 'open-next-two-hours');
  await expect(page.locator('#poolFilterSummary')).toHaveText('Showing 1 of 23 pools');
  await expect(page.locator('#poolList .pool-card')).toHaveCount(1);
  await expect(page.locator('#poolFeatureFilterCount')).toHaveText('1 selected');

  await page.locator('#clearPoolFeatureFilters').click();
  await expect(page.locator('#poolAvailabilityFilter')).toHaveValue('all');
  await expect(page.locator('#poolFilterSummary')).toHaveText('23 pools');
});

test('pool tile features are ordered by category then alphabetically', async ({ page }) => {
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
  await expect(firstPoolCard.locator('.feature-pill')).toHaveText([
    'ADA compliant',
    'Family changing room',
    'Beach entry',
    'Wading pool',
    'Lap',
    'Slide',
    'Bathhouse',
    'Wi-Fi'
  ]);
});

test('collapsed favorite pool stays collapsed after filters redraw the directory', async ({ page }) => {
  await initializeAnalyticsRecorder(page);
  await page.goto('/pools.html');
  await page.evaluate(() => {
    localStorage.setItem('cnsl_preferences', JSON.stringify({ favoritePoolName: 'Bryant Woods' }));
  });
  await page.reload();
  await expect(page.locator('#poolListStatus')).toContainText('Pool directory loaded.');

  let favoriteToggle = page.locator('.favorite-card .pool-header__toggle');
  await expect(favoriteToggle).toHaveAttribute('aria-expanded', 'true');
  await favoriteToggle.click();
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

test('collapsed favorite team stays collapsed after returning to the directory', async ({ page }) => {
  await initializeAnalyticsRecorder(page);
  await page.goto('/teams.html');
  await page.evaluate(() => {
    localStorage.setItem('cnsl_preferences', JSON.stringify({ favoriteTeamId: 'cfhss' }));
  });
  await page.reload();
  await expect(page.locator('#teamListStatus')).toContainText('Team directory loaded.');

  const favoriteToggle = page.locator('.favorite-card .team-header__toggle');
  await expect(favoriteToggle).toHaveAttribute('aria-expanded', 'true');
  await favoriteToggle.click();
  await expect(favoriteToggle).toHaveAttribute('aria-expanded', 'false');
  await expect.poll(() => page.evaluate(() => globalThis.recordedAnalyticsEvents)).toEqual([
    ['event', 'ca_setting_change', { setting_name: 'favorite_team_expanded' }]
  ]);

  await page.reload();
  await expect(page.locator('.favorite-card .team-header__toggle')).toHaveAttribute('aria-expanded', 'false');
});

test('team directory displays verified regular practices from public team schedules', async ({ page }) => {
  await setAgendaReferenceTime(page);
  await page.goto('/teams.html');
  await expect(page.locator('#teamListStatus')).toContainText('Team directory loaded.');

  const sundevils = page.locator('.team-card[data-team-id="cfhss"]');
  await sundevils.locator('.team-header__toggle').click();
  await expect(sundevils.locator('.practice-schedule')).toContainText('Regular Practice Schedule');
  await expect(sundevils.locator('.practice-schedule')).toContainText('Swansfield Pool');
  await expect(sundevils.locator('.practice-schedule')).toContainText('8:00 - 8:30am');
  await expect(sundevils.getByRole('link', { name: 'Practice Schedule' })).toHaveAttribute('href', /practice-schedule/);
  await expect(sundevils.getByRole('link', { name: 'Team Calendar' })).toHaveAttribute('href', /\/page\/calendar$/);
});

test('team directory filters regular practice times to selected practice groups', async ({ page }) => {
  await seedPreferences(page, { practiceGroups: ['9-10'] });
  await page.goto('/teams.html');
  await expect(page.locator('#teamListStatus')).toContainText('Team directory loaded.');

  const sundevils = page.locator('.team-card[data-team-id="cfhss"]');
  await sundevils.locator('.team-header__toggle').click();
  const schedule = sundevils.locator('.practice-schedule');
  await expect(schedule).toContainText('8:30 - 9:15am');
  await expect(schedule).toContainText('5:00 - 5:45pm');
  await expect(schedule).not.toContainText('8:00 - 8:30am');
  await expect(schedule).not.toContainText('9:15 - 10:00am');
  await expect(schedule).not.toContainText('5:45 - 6:30pm');
});

test('team directory shows the same next practices and swim event agenda as home', async ({ page }) => {
  await setAgendaReferenceTime(page);
  await page.goto('/teams.html');
  await expect(page.locator('#teamListStatus')).toContainText('Team directory loaded.');

  const snappers = page.locator('.team-card[data-team-id="pls"]');
  await snappers.locator('.team-header__toggle').click();
  const agenda = snappers.locator('.favorite-week');
  await expect(agenda.getByRole('heading', { name: /Phelps Luck Snappers: Upcoming events/ })).toBeVisible();
  await expect(agenda.locator('.favorite-week__events li')).toHaveCount(3);
  await expect(agenda).toContainText('Next morning practice');
  await expect(agenda).toContainText('Next evening practice');
  await expect(agenda).toContainText('Next swim event: Time Trials for returning/experienced swimmers');
  await expect(agenda).not.toContainText("Each Team's Home Pool");
  await expect(agenda).not.toContainText('Jeffers Hill Pool');
});

test('home page shows the next practices and swim event for a selected favorite team', async ({ page }) => {
  await setAgendaReferenceTime(page);
  await seedPreferences(page, { favoriteTeamId: 'pls' });
  await page.goto('/index.html');

  const agenda = page.locator('#favoriteWeek');
  await expect(agenda).toBeVisible();
  await expect(agenda.getByRole('heading', { name: /Upcoming Snappers events/ })).toBeVisible();
  await expect(agenda.locator('.favorite-badge')).toHaveCount(0);
  const teamDetailsLink = agenda.getByRole('link', { name: 'Team details' });
  await expect(teamDetailsLink).toBeVisible();
  await expect(page.locator('#favoriteWeekStatus')).toBeHidden();
  await expect(agenda.locator('.favorite-week__events li')).toHaveCount(3);
  await expect(agenda).toContainText('Tuesday, May 26');
  await expect(agenda).toContainText('Next morning practice');
  await expect(agenda).toContainText('Next evening practice');
  await expect(agenda).toContainText('Next swim event: Time Trials for returning/experienced swimmers');
  await expect(agenda).toContainText('Phelps Luck Pool');
  await expect(agenda.getByRole('link', { name: 'Phelps Luck Pool' }).first()).toHaveAttribute('href', 'pools.html?pool=plp');
  await expect(agenda).not.toContainText("Each Team's Home Pool");
  await expect(agenda).not.toContainText('Jeffers Hill Pool');
  await expect(agenda).toContainText('First Splash: 5:00 - 5:30pm');

  const toggle = page.locator('#favoriteWeekToggle');
  await toggle.press('Enter');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('#favoriteWeekContent')).toBeHidden();
  await expect(teamDetailsLink).toBeHidden();
  await toggle.press('Enter');
  await expect(page.locator('#favoriteWeekContent')).toBeVisible();
  await expect(teamDetailsLink).toBeVisible();
});

test('home page keeps its three-link rows intact on narrow phones', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto('/index.html');

  const hasSingleRow = selector => page.locator(selector).evaluateAll(elements => (
    new Set(elements.map(element => Math.round(element.getBoundingClientRect().top))).size === 1
  ));

  await expect.poll(() => hasSingleRow('.quick-links-grid .quick-link-card')).toBe(true);
  await expect.poll(() => hasSingleRow('.share-site__links .share-site__link')).toBe(true);
});

test('shared team agenda filters published practice times by selected group', async ({ page }) => {
  await setAgendaReferenceTime(page);
  await seedPreferences(page, { favoriteTeamId: 'pls', practiceGroups: ['8-under'] });
  await page.goto('/index.html');

  const agenda = page.locator('#favoriteWeek');
  await expect(agenda).toContainText('8 and under: 5:30 - 6:00pm');
  await expect(agenda).not.toContainText('First Splash: 5:00 - 5:30pm');
  await expect(agenda).not.toContainText('9 - 12: 6:00 - 6:30pm');
  await expect(agenda).not.toContainText('13 and over: 6:30 - 7:00pm');
});

test('home page loads agenda dependencies only after a favorite team is selected', async ({ page }) => {
  await setAgendaReferenceTime(page);
  await page.goto('/index.html');

  await expect(page.locator('#favoriteWeek')).toBeHidden();
  await expect(page.locator('script[data-home-schedule-dependency]')).toHaveCount(0);

  await page.evaluate(() => {
    localStorage.setItem('cnsl_preferences', JSON.stringify({ favoriteTeamId: 'pls' }));
    globalThis.dispatchEvent(new globalThis.Event('cnsl:preferences-changed'));
  });

  await expect(page.locator('#favoriteWeek')).toBeVisible();
  await expect(page.locator('script[data-home-schedule-dependency]')).toHaveCount(8);
  await expect(page.locator('#favoriteWeek')).toContainText('Phelps Luck Pool');
});

test('location distances use outlined pills and can sort nearest pools first', async ({ page }) => {
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

test('meet pool links reveal the destination below the mobile fixed header', async ({ page }) => {
  await page.setViewportSize(MOBILE_VIEWPORT);
  await page.context().grantPermissions(['geolocation']);
  await page.context().setGeolocation({ latitude: 39.2105, longitude: -76.8721 });
  await page.addInitScript(() => {
    localStorage.setItem('cnsl_preferences', JSON.stringify({ locationAwarenessEnabled: true }));
    sessionStorage.setItem('cnsl_linked_pool_scroll_count', '0');
    const originalScrollTo = globalThis.scrollTo.bind(globalThis);
    globalThis.scrollTo = (...args) => {
      const count = Number.parseInt(sessionStorage.getItem('cnsl_linked_pool_scroll_count') || '0', 10);
      sessionStorage.setItem('cnsl_linked_pool_scroll_count', String(count + 1));
      originalScrollTo(...args);
    };
  });
  await page.goto('/meets.html');
  await expect(page.locator('#meetListStatus')).toContainText('Meet schedule loaded.');

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
  await expect(targetCard.locator('.pool-header__toggle')).toHaveAttribute('aria-expanded', 'true');
  await expect.poll(() => page.evaluate(() => Number.parseInt(sessionStorage.getItem('cnsl_linked_pool_scroll_count') || '0', 10))).toBe(1);
  await expect.poll(() => targetCard.evaluate(card => {
    const headerBottom = card.ownerDocument.querySelector('.header').getBoundingClientRect().bottom;
    const poolHeadingTop = card.querySelector('.pool-header').getBoundingClientRect().top;
    return poolHeadingTop > headerBottom;
  })).toBe(true);
});

test('favorite team matchups appear first on every meet day they compete', async ({ page }) => {
  await seedPreferences(page, { favoriteTeamId: 'cfhss' });
  await page.goto('/meets.html');
  await expect(page.locator('#meetListStatus')).toContainText('Meet schedule loaded.');

  const favoriteDayPlacement = await page.locator('.meet-date-card').evaluateAll(cards => cards
    .filter(card => card.querySelector('.favorite-meet'))
    .map(card => card.querySelector('.meet-date-details > .meet-details').classList.contains('favorite-meet')));

  expect(favoriteDayPlacement.length).toBeGreaterThan(1);
  expect(favoriteDayPlacement.every(firstIsFavorite => firstIsFavorite)).toBe(true);
});

for (const scenario of directoryScenarios) {
  test(`${scenario.path} directory tiles point, stay still, and expand from their surface`, async ({ page }) => {
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
    await surface.click({ position: { x: 2, y: 2 } });
    await expect(stableToggle).toHaveAttribute('aria-expanded', 'true');
  });
}

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

test('desktop expanded pool details group contact links and fit the weekly calendar', async ({ page }) => {
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
      caWebsiteIsBesideAddress: caWebsiteBox.left >= addressDetailsBox.right && caWebsiteBox.top < addressDetailsBox.bottom,
      phoneIsUnderCaWebsite: phoneBox.top >= caWebsiteBox.bottom && phoneBox.left >= addressDetailsBox.right,
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
  expect(layout.caWebsiteIsBesideAddress).toBe(true);
  expect(layout.phoneIsUnderCaWebsite).toBe(true);
  expect(layout.phoneIsInsideAddress).toBe(true);
  expect(layout.caWebsiteIsInsideAddress).toBe(true);
  expect(layout.calendarFits).toBe(true);
  expect(layout.featuresHasAccentBorder).toBe(true);
  expect(layout.addressToHoursGap).toBe(layout.hoursToFeaturesGap);
});

test('mobile calendar schedules reveal today when a pool is expanded', async ({ page }) => {
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

test('desktop site header remains visible while the pool directory scrolls', async ({ page }) => {
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

test('settings dialog is right-aligned on mobile and centered on desktop', async ({ page }) => {
  const mobileViewport = MOBILE_VIEWPORT;
  await page.setViewportSize(mobileViewport);
  await page.goto('/settings.html');
  const dialog = page.locator('#settingsDialog');
  await expect(dialog).toBeVisible();
  let bounds = await dialog.boundingBox();

  expect(Math.abs(bounds.x + bounds.width - mobileViewport.width)).toBeLessThanOrEqual(1);
  expect(Math.abs(bounds.y + (bounds.height / 2) - (mobileViewport.height / 2))).toBeLessThanOrEqual(1);
  const closeButtonBounds = await page.getByRole('button', { name: 'Close settings' }).boundingBox();
  expect(closeButtonBounds.width).toBeLessThan(closeButtonBounds.height);
  await page.mouse.click(closeButtonBounds.x - 2, closeButtonBounds.y + (closeButtonBounds.height / 2));
  await expect(dialog).not.toBeVisible();

  const desktopViewport = { width: 1280, height: 800 };
  await page.setViewportSize(desktopViewport);
  await page.goto('/settings.html');
  bounds = await dialog.boundingBox();

  expect(Math.abs(bounds.x + (bounds.width / 2) - (desktopViewport.width / 2))).toBeLessThanOrEqual(1);
  expect(Math.abs(bounds.y + (bounds.height / 2) - (desktopViewport.height / 2))).toBeLessThanOrEqual(1);
});

test('settings persist choices locally and confirm before clearing saved settings', async ({ page }) => {
  await initializeAnalyticsRecorder(page);
  await page.goto('/settings.html');
  await expect(page.locator('#favoritePool')).toBeEnabled();
  await expect(page.getByRole('group', { name: 'Practice groups' })).toBeVisible();
  await expect(page.getByLabel('First Splash')).toBeChecked();
  await expect(page.getByLabel('8 and under')).toBeChecked();
  await expect(page.getByLabel('9-10')).toBeChecked();

  await page.getByLabel('Dark').check();
  await page.getByLabel('Weekly calendar').check();
  await page.getByLabel('Use my current location to estimate distances to pools').check();
  await page.getByLabel('10 min').check();
  await page.getByLabel('First Splash').uncheck();
  await page.getByLabel('8 and under').uncheck();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('cnsl_preferences')).theme)).toBe('dark');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('cnsl_preferences')).weatherRefreshMinutes)).toBe(10);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('cnsl_preferences')).practiceGroups)).toEqual(['9-10', '11-12', '13-14', '15-18']);
  await expect(page.getByLabel('Share anonymous page usage through Google Analytics')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => Object.hasOwn(JSON.parse(localStorage.getItem('cnsl_preferences')), 'analyticsEnabled'))).toBe(false);
  await expect(page.locator('#cnslAnalyticsScript')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => globalThis.recordedAnalyticsEvents)).toEqual([
    ['event', 'ca_setting_change', { setting_name: 'theme' }],
    ['event', 'ca_setting_change', { setting_name: 'pool_schedule_layout' }],
    ['event', 'ca_setting_change', { setting_name: 'location_awareness' }],
    ['event', 'ca_setting_change', { setting_name: 'weather_refresh_minutes' }]
  ]);

  await page.locator('#favoritePool').selectOption({ label: 'Bryant Woods' });
  await page.locator('#favoriteTeam').selectOption('cfhss');
  await page.locator('#favoritePool').selectOption('');
  await expect.poll(() => page.evaluate(() => globalThis.recordedAnalyticsEvents)).toEqual([
    ['event', 'ca_setting_change', { setting_name: 'theme' }],
    ['event', 'ca_setting_change', { setting_name: 'pool_schedule_layout' }],
    ['event', 'ca_setting_change', { setting_name: 'location_awareness' }],
    ['event', 'ca_setting_change', { setting_name: 'weather_refresh_minutes' }],
    ['event', 'ca_setting_change', { setting_name: 'favorite_pool' }],
    ['event', 'ca_setting_change', { setting_name: 'favorite_team' }],
    ['event', 'ca_setting_change', { setting_name: 'favorite_pool' }]
  ]);

  await page.locator('#favoriteTeam').evaluate(select => {
    const untrustedOption = select.ownerDocument.createElement('option');
    untrustedOption.value = 'person@example.com';
    untrustedOption.textContent = 'Untrusted value';
    select.appendChild(untrustedOption);
    select.value = untrustedOption.value;
    select.dispatchEvent(new select.ownerDocument.defaultView.Event('change', { bubbles: true }));
  });
  await expect.poll(() => page.evaluate(() => globalThis.recordedAnalyticsEvents)).toHaveLength(7);

  const dismissedClearPrompt = page.waitForEvent('dialog').then(async dialog => {
    expect(dialog.type()).toBe('confirm');
    expect(dialog.message()).toBe('Clear all saved settings from this device?');
    await dialog.dismiss();
  });
  await page.getByRole('button', { name: 'Clear saved settings' }).click();
  await dismissedClearPrompt;
  await expect(page.getByLabel('Dark')).toBeChecked();
  await expect(page.getByLabel('First Splash')).not.toBeChecked();
  await expect.poll(() => page.evaluate(() => globalThis.recordedAnalyticsEvents)).toHaveLength(7);

  const acceptedClearPrompt = page.waitForEvent('dialog').then(async dialog => {
    expect(dialog.type()).toBe('confirm');
    expect(dialog.message()).toBe('Clear all saved settings from this device?');
    await dialog.accept();
  });
  await page.getByRole('button', { name: 'Clear saved settings' }).click();
  await acceptedClearPrompt;
  await expect(page.locator('#settingsStatus')).toBeEmpty();
  await expect(page.getByLabel('First Splash')).toBeChecked();
  await expect(page.getByLabel('8 and under')).toBeChecked();
  await expect.poll(() => page.evaluate(() => globalThis.recordedAnalyticsEvents)).toEqual([
    ['event', 'ca_setting_change', { setting_name: 'theme' }],
    ['event', 'ca_setting_change', { setting_name: 'pool_schedule_layout' }],
    ['event', 'ca_setting_change', { setting_name: 'location_awareness' }],
    ['event', 'ca_setting_change', { setting_name: 'weather_refresh_minutes' }],
    ['event', 'ca_setting_change', { setting_name: 'favorite_pool' }],
    ['event', 'ca_setting_change', { setting_name: 'favorite_team' }],
    ['event', 'ca_setting_change', { setting_name: 'favorite_pool' }],
    ['event', 'ca_setting_change', { setting_name: 'theme' }],
    ['event', 'ca_setting_change', { setting_name: 'pool_schedule_layout' }],
    ['event', 'ca_setting_change', { setting_name: 'location_awareness' }],
    ['event', 'ca_setting_change', { setting_name: 'weather_refresh_minutes' }],
    ['event', 'ca_setting_change', { setting_name: 'favorite_team' }]
  ]);
});

test('desktop weather safety alerts restore collapsed details on every page', async ({ page }) => {
  await prepareVisibleWeatherAlert(page);
  await page.addInitScript(() => {
    sessionStorage.setItem('cnsl_weather_alert_expanded', 'false');
  });

  for (const path of publishedPagePaths) {
    await page.goto(path);
    await expect(page.locator('#weatherAlert')).toBeVisible();
    await expect(page.locator('.weather-alert__title')).toHaveText('Weather alert');
    await expect(page.locator('#weatherAlertMessage')).toContainText('Severe Thunderstorm Warning');
    await expect(page.locator('#weatherAlertUpdated')).not.toHaveText('');
    await expect(page.locator('#weatherAlertUpdated')).toHaveAttribute('datetime', /2026-/);
    await expect(page.locator('#weatherAlertDetails')).toBeHidden();
    await expect(page.getByRole('link', { name: 'Live pool status' })).toBeHidden();
    await expect(page.getByRole('button', { name: 'Expand weather safety alert' })).toBeVisible();
  }

  const collapsedAlertBox = await page.locator('#weatherAlert').boundingBox();
  const collapsedTitleBox = await page.locator('.weather-alert__title').boundingBox();
  const collapsedToggleBox = await page.getByRole('button', { name: 'Expand weather safety alert' }).boundingBox();
  await page.getByRole('button', { name: 'Expand weather safety alert' }).click();
  await expect(page.locator('#weatherAlertDetails')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Live pool status' })).toBeVisible();
  const expandedAlertBox = await page.locator('#weatherAlert').boundingBox();
  const expandedTitleBox = await page.locator('.weather-alert__title').boundingBox();
  const expandedToggleBox = await page.getByRole('button', { name: 'Collapse weather safety alert' }).boundingBox();
  const expandedActionBox = await page.getByRole('link', { name: 'Live pool status' }).boundingBox();
  expect(collapsedAlertBox.height).toBeCloseTo(70, 1);
  expect(expandedAlertBox.height).toBe(collapsedAlertBox.height);
  expect(expandedTitleBox.y).toBe(collapsedTitleBox.y);
  expect(expandedTitleBox.height).toBe(collapsedTitleBox.height);
  expect(collapsedToggleBox.height).toBe(collapsedTitleBox.height);
  expect(expandedToggleBox.y).toBe(collapsedToggleBox.y);
  expect(expandedToggleBox.height).toBe(collapsedToggleBox.height);
  expect(expandedActionBox.y).toBe(expandedToggleBox.y);
  expect(expandedActionBox.height).toBe(expandedToggleBox.height);
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem('cnsl_weather_alert_expanded'))).toBe('true');
});

test('mobile weather safety alert keeps navigation visible and collapses with a stable arrow control', async ({ page }) => {
  await page.setViewportSize(MOBILE_VIEWPORT);
  await prepareVisibleWeatherAlert(page);
  await page.goto('/index.html');

  await page.locator('.site-title').evaluate(title => {
    title.textContent = 'CA Pool and CNSL Assistant Weather Safety Information';
  });
  const alert = page.locator('#weatherAlert');
  const toggle = page.getByRole('button', { name: 'Collapse weather safety alert' });
  const action = page.getByRole('link', { name: 'Live pool status' });
  const icon = page.locator('.weather-alert__toggle-icon');
  const warningIcon = page.locator('.weather-alert__warning-icon');
  const liveIndicator = page.locator('.weather-alert__live-indicator');
  await expect(alert).toBeVisible();
  await expect(page.locator('.weather-alert__title')).toBeVisible();
  await expect(warningIcon).toBeVisible();
  await expect(liveIndicator).toBeVisible();
  await expect(page.locator('.weather-alert__copy')).toHaveCSS('text-align', 'center');
  const titleBackground = await page.locator('.weather-alert__title').evaluate(element => element.ownerDocument.defaultView.getComputedStyle(element).backgroundColor);
  const actionBackground = await page.locator('.weather-alert__link').evaluate(element => element.ownerDocument.defaultView.getComputedStyle(element).backgroundColor);
  expect(titleBackground).toBe(actionBackground);
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(action).toBeVisible();
  const expandedTitleBox = await page.locator('.weather-alert__title').boundingBox();
  const expandedToggleSize = await toggle.boundingBox();
  const expandedActionBox = await action.boundingBox();
  expect(expandedToggleSize.width).toBe(expandedToggleSize.height);
  expect(expandedToggleSize.height).toBe(expandedTitleBox.height);
  expect(expandedToggleSize.height).toBe(expandedActionBox.height);
  expect(expandedActionBox.y).toBeGreaterThanOrEqual(expandedTitleBox.y + expandedTitleBox.height);
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

test('turning weather safety alerts off hides an active banner immediately', async ({ page }) => {
  await prepareVisibleWeatherAlert(page);
  await page.goto('/settings.html');
  await expect(page.locator('#weatherAlert')).toBeVisible();

  await page.getByLabel('Off').check();
  await expect(page.locator('#weatherAlert')).toBeHidden();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('cnsl_preferences')).weatherRefreshMinutes)).toBe(0);

  await page.goto('/index.html');
  await expect(page.locator('#weatherAlert')).toBeHidden();
});