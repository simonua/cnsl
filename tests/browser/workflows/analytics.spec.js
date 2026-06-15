const { analyticsTest, test, expect } = require('../browser-test');
const AppConfig = require('../../../scripts/adapters/app-config.js');
const {
  initializeAnalyticsRecorder,
  prepareStableWeatherResponses
} = require('../browser-test-helpers');

test.beforeEach(async ({ page }) => {
  await prepareStableWeatherResponses(page);
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
  await prepareStableWeatherResponses(profilePage);
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

  await page.unroute('https://api.weather.gov/**');
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
