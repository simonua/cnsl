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
    reference: 'POOLS',
    path: '/pools.html',
    list: '#poolList',
    status: '#poolListStatus',
    announcement: /Pool directory loaded\. 23 pools available\./,
    readyText: /Pool directory loaded\./,
    domains: ['pools', 'teams'],
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

  await page.locator('#navMenu').evaluate(nav => nav.classList.remove('active'));
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Open navigation menu' })).toBeFocused();
  await expect(page.locator('#navMenu')).toHaveAttribute('aria-hidden', 'true');
  await expect(page.locator('#mainContent')).toHaveJSProperty('inert', false);
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

test('[WF-DATA-003] pool load failures are announced and do not leave the directory busy', async ({ page }) => {
  await page.route('**/assets/data/2026/pools/pools.json*', route => route.fulfill({ status: 503, body: '{}' }));
  await page.goto('/pools.html');

  await expect(page.locator('#poolListStatus')).toHaveText('Pool information is currently unavailable. Please try again later.');
  await expect(page.locator('#poolList')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('#seasonInfo')).toBeHidden();
});

test('[WF-DATA-004] malformed published pool responses are announced as unavailable', async ({ page }) => {
  await page.route('**/assets/data/2026/pools/pools.json*', route => route.fulfill({ json: {} }));
  await page.goto('/pools.html');

  await expect(page.locator('#poolListStatus')).toHaveText('Pool information is currently unavailable. Please try again later.');
  await expect(page.locator('#poolList')).toHaveAttribute('aria-busy', 'false');
});

test('[WF-OFFLINE-001] loaded directory features remain usable while offline status is announced', async ({ page, context }) => {
  await page.goto('/teams.html');
  await expect(page.locator('#teamListStatus')).toContainText('Team directory loaded.');
  await expect(page.locator('#connectivityStatus')).toBeHidden();

  await context.setOffline(true);
  await expect(page.locator('#connectivityStatus')).toBeVisible();
  await expect(page.locator('#connectivityStatus')).toContainText('Offline mode');
  await expect(page.locator('#connectivityStatus')).toContainText('Saved schedules remain available when previously loaded.');
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
  await expect(page.getByRole('link', { name: 'Send Feedback' })).toHaveAttribute('href', 'mailto:simonkurtz@gmail.com?subject=CA%20Pool%20%26%20CNSL%20Assistant%20App%20Feedback');
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
  await expect(page.getByRole('link', { name: 'Send Feedback' })).toBeFocused();

  for (const method of ['text', 'email', 'facebook']) {
    await page.locator(`[data-analytics-share-method="${method}"] .share-site__icon`).evaluate(icon => {
      icon.parentElement.addEventListener('click', event => event.preventDefault(), { once: true });
      icon.dispatchEvent(new globalThis.MouseEvent('click', { bubbles: true, cancelable: true }));
    });
  }
  await expect.poll(() => page.evaluate(() => globalThis.recordedAnalyticsEvents.filter(eventArguments => eventArguments[1] === 'ca_share' || eventArguments[1] === 'ca_external_link'))).toEqual([
    ['event', 'ca_share', { method: 'qr_code', content_type: 'website', item_id: 'home_page' }],
    ['event', 'ca_share', { method: 'text', content_type: 'website', item_id: 'home_page' }],
    ['event', 'ca_external_link', { link_context: 'share', link_purpose: 'general' }],
    ['event', 'ca_share', { method: 'email', content_type: 'website', item_id: 'home_page' }],
    ['event', 'ca_external_link', { link_context: 'share', link_purpose: 'general' }],
    ['event', 'ca_share', { method: 'facebook', content_type: 'website', item_id: 'home_page' }],
    ['event', 'ca_external_link', { link_context: 'share', link_purpose: 'general' }]
  ]);

  await page.locator('a.directory-link').evaluate(link => {
    link.addEventListener('click', event => event.preventDefault(), { once: true });
    link.dispatchEvent(new globalThis.MouseEvent('click', { bubbles: true, cancelable: true }));
  });
  await expect.poll(() => page.evaluate(() => globalThis.recordedAnalyticsEvents.at(-1))).toEqual(['event', 'ca_external_link', { link_context: 'official_information', link_purpose: 'general' }]);

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
  expect(new Set(compactShareLayout.map(link => link.top)).size).toBe(2);
  expect(compactShareLayout.every(link => link.right <= MOBILE_VIEWPORT.width && link.height >= 44)).toBe(true);

  await page.goto('/pools.html');
  await expect(page.locator('.season-text')).toHaveCount(0);
  await expect(page.getByRole('link', { name: "CA's 2026 Pool Season" })).toHaveCount(0);
  await expect(page.locator('.share-site')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Interactive CA Pool Directory' })).toBeVisible();
  await expect.poll(() => page.locator('#poolList, #seasonInfo').evaluateAll(elements => elements.map(element => element.id))).toEqual(['poolList', 'seasonInfo']);
});

test('[WF-ANALYTICS-001] analytics publishes a page view and public app version only after the Google tag script loads', async ({ page }) => {
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

  await page.addInitScript(() => {
    localStorage.setItem('cnsl_current_version', '9999.0.0');
    localStorage.setItem('cnsl_settings_notice_dismissed', 'true');
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
        analytics_storage: 'denied'
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

test('[WF-ANALYTICS-002] flyer QR campaign visits publish reviewed attribution and clear their landing tags', async ({ page }) => {
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
  await page.unrouteAll({ behavior: 'ignoreErrors' });
});

test('[WF-ANALYTICS-003] unrecognized campaign input is neither consumed nor counted', async ({ page }) => {
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
  await page.unrouteAll({ behavior: 'ignoreErrors' });
});

test('[WF-RELEASE-001] release updates are announced once after a stable version is acknowledged', async ({ page }) => {
  await initializeAnalyticsRecorder(page);
  await page.setViewportSize(MOBILE_VIEWPORT);
  await page.goto('/index.html');
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

  await page.goto('/pools.html');
  await expect(page.locator('#releaseNotice')).toHaveCount(0);

  await page.evaluate(() => localStorage.setItem('cnsl_current_version', '2.0.0'));
  await page.goto('/index.html');
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

test('[WF-POOLS-002] pool availability filters show pools open now, opening soon, or open for the next two hours', async ({ page }) => {
  await page.route('**/assets/data/2026/pools/pools.json*', async route => {
    const response = await route.fetch();
    const poolData = await response.json();
    poolData.pools.forEach((pool, index) => {
      pool.schedules = [{
        startDate: '2026-05-23',
        endDate: '2026-09-07',
        hours: [{
          weekDays: ['Tue'],
          startTime: index === 1 ? '3:45PM' : '1:00PM',
          endTime: index < 2 ? '6:00PM' : '4:00PM',
          types: ['Rec Swim'],
          accessStatus: 'public'
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
  await expect(page.locator('#poolFilterSummary')).toHaveText('22 / 23 pools');

  await page.locator('#poolAvailabilityFilter').focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('#poolAvailabilityFilter')).toHaveValue('opens-soon');
  await expect(page.locator('#poolFilterSummary')).toHaveText('1 / 23 pools');
  await expect(page.locator('#poolListStatus')).toHaveText('Pool directory filtered to pools opening within the hour.');

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
  await expect.poll(() => page.evaluate(() => globalThis.recordedAnalyticsEvents)).toEqual([
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
  await expect(timeTrials.locator('.team-meets__time')).toHaveText('8:00 AM - 12:00 PM');
  await expect(timeTrials.locator('td').nth(1)).toHaveText('Time Trials for returning / experienced swimmers');
  const firstMeet = meetSchedule.locator('tbody tr').nth(1);
  await expect(firstMeet.locator('td').nth(0)).toContainText('June 13');
  await expect(firstMeet.locator('.team-meets__time')).toHaveText('8:00 AM - 12:00 PM');
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
    'event', 'ca_external_link', { link_context: 'team_details', link_purpose: 'merchandise' }
  ]);
  await merchandiseLink.evaluate(link => {
    link.closest('[data-team-card]').dataset.analyticsContext = 'injected_context';
    link.dataset.analyticsLinkPurpose = 'injected_purpose';
    link.addEventListener('click', event => event.preventDefault(), { once: true });
    link.click();
  });
  await expect.poll(() => page.evaluate(() => globalThis.recordedAnalyticsEvents.at(-1))).toEqual([
    'event', 'ca_external_link', { link_context: 'other', link_purpose: 'general' }
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
  await expect(meetSchedule.locator('tbody tr').first().locator('.team-meets__time')).toHaveText('8:00 AM - 12:00 PM');
  await expect(meetSchedule.locator('tbody tr').first().locator('td').nth(2)).toBeEmpty();
  await expect(meetSchedule.locator('tbody tr').first().locator('td').nth(3)).toContainText('Swansfield');
  await expect(meetSchedule.locator('tbody tr').nth(1).locator('td').nth(1)).toHaveText('Dual #1');
  await expect(meetSchedule.locator('tbody tr').nth(1).locator('.team-meets__time')).toHaveText('8:00 AM - 12:00 PM');
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
  await expect(agenda).toContainText('8:00 AM - 12:00 PM');
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
  await expect(agenda).toContainText('8:00 AM - 12:00 PM');
  await expect(agenda).toContainText('Phelps Luck');
  await expect(agenda).not.toContainText('Phelps Luck Pool');
  await expect(agenda.getByRole('link', { name: 'Phelps Luck' }).first()).toHaveAttribute('href', 'pools.html?pool=plp');
  await expect(agenda).not.toContainText("Each Team's Home Pool");
  await expect(agenda).not.toContainText('Jeffers Hill Pool');
  await expect(agenda).toContainText('5:00 - 5:30pm First Splash');
  await expect(page.locator('#shareSite')).toBeVisible();
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

test('[WF-HOME-002] home page keeps compact link actions readable on narrow phones', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto('/index.html');

  const hasSingleRow = selector => page.locator(selector).evaluateAll(elements => (
    new Set(elements.map(element => Math.round(element.getBoundingClientRect().top))).size === 1
  ));

  await expect.poll(() => hasSingleRow('.quick-links-grid .quick-link-card')).toBe(true);
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
    localStorage.setItem('cnsl_preferences', JSON.stringify({ favoriteTeamId: 'pls' }));
    globalThis.dispatchEvent(new globalThis.Event('cnsl:preferences-changed'));
  });

  await expect(page.locator('#favoriteWeek')).toBeVisible();
  await expect(page.locator('script[data-home-schedule-dependency]')).toHaveCount(16);
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
  await expect(page.locator('#favoriteWeekTitle')).toHaveText('Favorite team unavailable');
  await expect(page.locator('#favoriteWeekStatus')).toHaveText('Your saved favorite team is no longer listed for this season.');
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

test('[WF-MEETS-001] meet pool links reveal the destination below the mobile fixed header', async ({ page }) => {
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
  await expect(targetCard.locator('.pool-header__toggle')).toHaveAttribute('aria-expanded', 'true');
  await expect.poll(() => page.evaluate(() => Number.parseInt(sessionStorage.getItem('cnsl_linked_pool_scroll_count') || '0', 10))).toBe(1);
  await expect.poll(() => targetCard.evaluate(card => {
    const headerBottom = card.ownerDocument.querySelector('.header').getBoundingClientRect().bottom;
    const poolHeadingTop = card.querySelector('.pool-header').getBoundingClientRect().top;
    return poolHeadingTop > headerBottom;
  })).toBe(true);
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
});

test('[WF-MEETS-003] regular meet-day labels advance from upcoming to ongoing and to the next meet after noon', async ({ page }) => {
  await page.setViewportSize(MOBILE_VIEWPORT);
  await page.clock.install({ time: new Date('2026-06-13T07:59:30-04:00') });
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
  await expect(page.locator('.meet-date-card[data-meet-date="2026-06-06"] .meet-live-badge')).toHaveCount(0);

  await firstDualMeet.locator('.meet-date-header__toggle').focus();
  await page.clock.fastForward(31 * 1000);
  await expect(firstDualMeet.locator('.meet-live-badge')).toHaveText('Ongoing');
  await expect(firstDualMeet.locator('.meet-date-header__toggle')).toBeFocused();

  await page.clock.fastForward((4 * 60 * 60 * 1000));
  await expect(firstDualMeet.locator('.meet-live-badge')).toHaveCount(0);
  await expect(secondDualMeet.locator('.meet-live-badge')).toHaveText('Upcoming');
  await expect(page.locator('#meetListStatus')).toHaveText('Meet status updated for the current date and time.');
});

test('[WF-MEETS-004] Time Trials advances from upcoming to ongoing using its published hours', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-06-06T07:59:30-04:00') });
  await page.goto('/meets.html');
  await expect(page.locator('#meetListStatus')).toContainText('Meet schedule loaded.');

  const timeTrials = page.locator('.meet-date-card[data-meet-date="2026-06-06"]');
  await expect(timeTrials.locator('.meet-live-badge')).toHaveText('Upcoming');
  await expect(timeTrials.locator('.meet-time')).toHaveText('8:00 AM - 12:00 PM');
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

test('[WF-SETTINGS-001] settings dialog is right-aligned on mobile and centered on desktop', async ({ page }) => {
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
  let clearButtonBounds = await page.getByRole('button', { name: 'Clear all app data' }).boundingBox();
  let clearActionsBounds = await page.locator('.settings-actions').boundingBox();
  expect(Math.abs(clearButtonBounds.x + (clearButtonBounds.width / 2) - (clearActionsBounds.x + (clearActionsBounds.width / 2)))).toBeLessThanOrEqual(1);
  const practiceBounds = await page.locator('.settings-checkbox-list .settings-checkbox').evaluateAll(options => options.map(option => option.getBoundingClientRect().x));
  expect(new Set(practiceBounds.map(position => Math.round(position))).size).toBe(2);
  await page.getByRole('button', { name: 'Close settings' }).click();
  await expect(dialog).not.toBeVisible();

  const desktopViewport = { width: 1280, height: 800 };
  await page.setViewportSize(desktopViewport);
  await page.goto('/settings.html');
  bounds = await dialog.boundingBox();

  expect(Math.abs(bounds.x + (bounds.width / 2) - (desktopViewport.width / 2))).toBeLessThanOrEqual(1);
  expect(Math.abs(bounds.y + (bounds.height / 2) - (desktopViewport.height / 2))).toBeLessThanOrEqual(1);
  clearButtonBounds = await page.getByRole('button', { name: 'Clear all app data' }).boundingBox();
  clearActionsBounds = await page.locator('.settings-actions').boundingBox();
  expect(Math.abs(clearButtonBounds.x + (clearButtonBounds.width / 2) - (clearActionsBounds.x + (clearActionsBounds.width / 2)))).toBeLessThanOrEqual(1);
});

test('[WF-SETTINGS-002] settings persist choices locally and confirm before clearing all app data', async ({ page }) => {
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
    ['event', 'ca_setting_change', { setting_name: 'weather_refresh_minutes' }],
    ['event', 'ca_setting_change', { setting_name: 'practice_groups' }],
    ['event', 'ca_setting_change', { setting_name: 'practice_groups' }]
  ]);

  await page.locator('#favoritePool').selectOption({ label: 'Bryant Woods' });
  await page.locator('#favoriteTeam').selectOption('cfhss');
  await page.locator('#favoritePool').selectOption('');
  await expect.poll(() => page.evaluate(() => globalThis.recordedAnalyticsEvents)).toEqual([
    ['event', 'ca_setting_change', { setting_name: 'theme' }],
    ['event', 'ca_setting_change', { setting_name: 'pool_schedule_layout' }],
    ['event', 'ca_setting_change', { setting_name: 'location_awareness' }],
    ['event', 'ca_setting_change', { setting_name: 'weather_refresh_minutes' }],
    ['event', 'ca_setting_change', { setting_name: 'practice_groups' }],
    ['event', 'ca_setting_change', { setting_name: 'practice_groups' }],
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
  await expect.poll(() => page.evaluate(() => globalThis.recordedAnalyticsEvents)).toHaveLength(9);

  const dismissedClearPrompt = page.waitForEvent('dialog').then(async dialog => {
    expect(dialog.type()).toBe('confirm');
    expect(dialog.message()).toBe('Clear all app data from this device?');
    await dialog.dismiss();
  });
  await page.getByRole('button', { name: 'Clear all app data' }).click();
  await dismissedClearPrompt;
  await expect(page.getByLabel('Dark')).toBeChecked();
  await expect(page.getByLabel('First Splash')).not.toBeChecked();
  await expect.poll(() => page.evaluate(() => globalThis.recordedAnalyticsEvents)).toHaveLength(9);

  await page.evaluate(async () => {
    localStorage.setItem('cnsl_current_version', 'saved');
    localStorage.setItem('cnsl_settings_notice_dismissed', 'true');
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
  await expect(page.locator('#settingsStatus')).toHaveText('All app data cleared from this device.');
  await expect.poll(() => page.locator('#settingsStatus').evaluate(status => globalThis.getComputedStyle(status).textAlign)).toBe('center');
  await expect.poll(() => page.evaluate(async () => ({
    preferences: localStorage.getItem('cnsl_preferences'),
    currentVersion: localStorage.getItem('cnsl_current_version'),
    settingsNotice: localStorage.getItem('cnsl_settings_notice_dismissed'),
    unrelatedLocal: localStorage.getItem('unrelated_local_key'),
    weatherStatus: sessionStorage.getItem('cnsl_weather_alert_status'),
    weatherDisclosure: sessionStorage.getItem('cnsl_weather_alert_expanded'),
    unrelatedSession: sessionStorage.getItem('unrelated_session_key'),
    caches: await globalThis.caches.keys()
  }))).toMatchObject({
    preferences: null,
    currentVersion: null,
    settingsNotice: null,
    unrelatedLocal: 'saved',
    weatherStatus: null,
    weatherDisclosure: null,
    unrelatedSession: 'saved',
    caches: expect.not.arrayContaining(['cnsl-static-test-reset'])
  });
  await expect(page.getByLabel('First Splash')).toBeChecked();
  await expect(page.getByLabel('8 and under')).toBeChecked();
  await expect.poll(() => page.evaluate(() => globalThis.recordedAnalyticsEvents)).toEqual([
    ['event', 'ca_setting_change', { setting_name: 'theme' }],
    ['event', 'ca_setting_change', { setting_name: 'pool_schedule_layout' }],
    ['event', 'ca_setting_change', { setting_name: 'location_awareness' }],
    ['event', 'ca_setting_change', { setting_name: 'weather_refresh_minutes' }],
    ['event', 'ca_setting_change', { setting_name: 'practice_groups' }],
    ['event', 'ca_setting_change', { setting_name: 'practice_groups' }],
    ['event', 'ca_setting_change', { setting_name: 'favorite_pool' }],
    ['event', 'ca_setting_change', { setting_name: 'favorite_team' }],
    ['event', 'ca_setting_change', { setting_name: 'favorite_pool' }],
    ['event', 'ca_setting_change', { setting_name: 'theme' }],
    ['event', 'ca_setting_change', { setting_name: 'pool_schedule_layout' }],
    ['event', 'ca_setting_change', { setting_name: 'location_awareness' }],
    ['event', 'ca_setting_change', { setting_name: 'weather_refresh_minutes' }],
    ['event', 'ca_setting_change', { setting_name: 'practice_groups' }],
    ['event', 'ca_setting_change', { setting_name: 'favorite_team' }]
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

  await page.getByLabel('Dark').check();
  await expect(root).toHaveAttribute('data-theme', 'dark');
  await expect(root).toHaveAttribute('data-color-scheme', 'dark');
});

test('[WF-SETTINGS-005] weather safety alerts show the most recent check after updates are turned off', async ({ page }) => {
  await seedPreferences(page, { weatherRefreshMinutes: 0 });
  await page.addInitScript(() => {
    sessionStorage.setItem('cnsl_weather_alert_status', JSON.stringify({
      expiresAt: 1,
      refreshMinutes: 5,
      status: { isInclement: false, updatedAt: '2026-06-02T14:15:00-04:00' }
    }));
  });
  await page.goto('/settings.html');

  const weatherCheckStatus = page.locator('#weatherCheckStatus');
  await expect(weatherCheckStatus).toHaveText('Most recent successful weather check: Jun 2, 2026, 2:15 PM EDT. Weather safety alerts are currently off.');
  await expect(weatherCheckStatus.locator('time')).toHaveAttribute('datetime', '2026-06-02T14:15:00-04:00');
  await expect(weatherCheckStatus).toHaveCSS('border-left-style', 'solid');
});

test('[WF-SETTINGS-006] weather safety alerts retain the last successful check when the weather service is unavailable', async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem('cnsl_weather_alert_status', JSON.stringify({
      expiresAt: 1,
      refreshMinutes: 5,
      status: { isInclement: false, updatedAt: '2026-06-02T14:15:00-04:00' }
    }));
  });
  await page.goto('/settings.html');
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
  await expect(weatherCheckStatus).toHaveText('Weather service is temporarily unavailable. Most recent successful weather check: Jun 2, 2026, 2:15 PM EDT.');
  await expect(weatherCheckStatus.locator('time')).toHaveAttribute('datetime', '2026-06-02T14:15:00-04:00');
  await expect(page.locator('#weatherAlert')).toBeHidden();
});

test('[WF-WEATHER-001] desktop weather safety alerts restore collapsed details on every page', async ({ page }) => {
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

test('[WF-WEATHER-003] turning weather safety alerts off hides an active banner immediately', async ({ page }) => {
  await prepareVisibleWeatherAlert(page);
  await page.goto('/settings.html');
  await expect(page.locator('#weatherAlert')).toBeVisible();

  await page.getByLabel('Off').check();
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
  await expect(faulknerRidge.locator('.schedule-activity__team-names')).toHaveCount(0);
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
  await expect(jeffersHill.locator('.open-status')).toContainText('Practice Only');
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
  await expect(jeffersHill.locator('.open-status')).toContainText('Practice Only');
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
  await expect(marlinsName.locator('xpath=..')).toHaveClass(/schedule-activity--team/);
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
