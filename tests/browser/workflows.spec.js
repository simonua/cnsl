const { test, expect } = require('@playwright/test');

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

const publishedPagePaths = [
  '/index.html', '/pools.html', '/teams.html', '/meets.html', '/settings.html',
  '/swim-meet-resources.html', '/whats-new.html', '/about.html', '/faq.html', '/offline.html'
];

test.beforeEach(async ({ page }) => {
  await prepareStableWeatherResponses(page);
});

test('navigation contains keyboard focus and restores it when dismissed', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
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

for (const scenario of [
  { path: '/pools.html', list: '#poolList', status: '#poolListStatus', message: /Pool directory loaded\. 23 pools available\./ },
  { path: '/teams.html', list: '#teamList', status: '#teamListStatus', message: /Team directory loaded\./ },
  { path: '/meets.html', list: '#meetList', status: '#meetListStatus', message: /Meet schedule loaded\./ }
]) {
  test(`${scenario.path} announces completed directory loading`, async ({ page }) => {
    await page.goto(scenario.path);
    await expect(page.locator(scenario.status)).toHaveText(scenario.message);
    await expect(page.locator(scenario.list)).toHaveAttribute('aria-busy', 'false');
  });
}

for (const scenario of [
  { path: '/pools.html', status: '#poolListStatus', readyText: /Pool directory loaded\./, domains: ['pools'] },
  { path: '/teams.html', status: '#teamListStatus', readyText: /Team directory loaded\./, domains: ['pools', 'teams'] },
  { path: '/meets.html', status: '#meetListStatus', readyText: /Meet schedule loaded\./, domains: ['meets', 'pools', 'teams'] }
]) {
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

test('season summary and CA season action appear on the home page', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('.season-text')).toHaveText('The 2026 season runs from May 23 to September 7');
  await expect(page.getByRole('link', { name: "CA's 2026 Pool Season" })).toBeVisible();

  await page.goto('/pools.html');
  await expect(page.locator('.season-text')).toHaveCount(0);
  await expect(page.getByRole('link', { name: "CA's 2026 Pool Season" })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Interactive CA Pool Directory' })).toBeVisible();
});

test('pool feature filters expose their state and resulting count', async ({ page }) => {
  await page.goto('/pools.html');
  await expect(page.locator('#poolListStatus')).toContainText('Pool directory loaded.');

  const filters = page.locator('#togglePoolFeatureFilters');
  await filters.click();
  await expect(filters).toHaveAttribute('aria-expanded', 'true');
  await page.locator('input[name="poolFeature"]').first().check();

  await expect(page.locator('#poolFilterSummary')).toHaveText(/Showing \d+ of 23 pools/);
  await expect(page.locator('#poolFeatureFilterCount')).toHaveText('1 selected');
});

test('location distances use outlined pills and can sort nearest pools first', async ({ page }) => {
  await page.context().grantPermissions(['geolocation']);
  await page.context().setGeolocation({ latitude: 39.2105, longitude: -76.8721 });
  await page.addInitScript(() => {
    localStorage.setItem('cnsl_preferences', JSON.stringify({ locationAwarenessEnabled: true }));
  });
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
  await page.setViewportSize({ width: 390, height: 844 });
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
  await expect(targetCard.locator('.pool-header__toggle')).toHaveAttribute('aria-expanded', 'true');
  await expect.poll(() => targetCard.evaluate(card => {
    const headerBottom = card.ownerDocument.querySelector('.header').getBoundingClientRect().bottom;
    const poolHeadingTop = card.querySelector('.pool-header').getBoundingClientRect().top;
    return poolHeadingTop > headerBottom;
  })).toBe(true);
});

test('favorite team matchups appear first on every meet day they compete', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('cnsl_preferences', JSON.stringify({ favoriteTeamId: 'cfhss' }));
  });
  await page.goto('/meets.html');
  await expect(page.locator('#meetListStatus')).toContainText('Meet schedule loaded.');

  const favoriteDayPlacement = await page.locator('.meet-date-card').evaluateAll(cards => cards
    .filter(card => card.querySelector('.favorite-meet'))
    .map(card => card.querySelector('.meet-date-details > .meet-details').classList.contains('favorite-meet')));

  expect(favoriteDayPlacement.length).toBeGreaterThan(1);
  expect(favoriteDayPlacement.every(firstIsFavorite => firstIsFavorite)).toBe(true);
});

for (const scenario of [
  { path: '/pools.html', status: '#poolListStatus', surface: '.pool-card.collapsed', toggle: '.pool-header__toggle' },
  { path: '/teams.html', status: '#teamListStatus', surface: '.team-card.collapsed', toggle: '.team-header__toggle' },
  { path: '/meets.html', status: '#meetListStatus', surface: '.meet-date-card.collapsed', toggle: '.meet-date-header__toggle' }
]) {
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
  await page.addInitScript(() => {
    localStorage.setItem('cnsl_preferences', JSON.stringify({
      favoritePoolName: 'Bryant Woods',
      poolScheduleLayout: 'calendar'
    }));
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
      phoneFollowsAddressClosely: phoneBox.top - addressLinkBox.bottom <= 12,
      phoneIsInsideAddress: phoneBox.top > addressBox.top && phoneBox.bottom <= addressBox.bottom,
      caWebsiteIsInsideAddress: caWebsiteBox.bottom <= addressBox.bottom,
      calendarFits: schedule.scrollWidth <= schedule.clientWidth + 1,
      featuresHasAccentBorder: card.ownerDocument.defaultView.getComputedStyle(features).borderLeftWidth === '3px',
      featuresGap: Math.round(features.getBoundingClientRect().top - hours.getBoundingClientRect().bottom)
    };
  });

  expect(layout.contactDisplay).toBe('flex');
  expect(layout.addressHasAccentBorder).toBe(true);
  expect(layout.addressIsFullWidth).toBe(true);
  expect(layout.addressIsIndented).toBe(true);
  expect(layout.caWebsiteIsBesideAddress).toBe(true);
  expect(layout.phoneFollowsAddressClosely).toBe(true);
  expect(layout.phoneIsInsideAddress).toBe(true);
  expect(layout.caWebsiteIsInsideAddress).toBe(true);
  expect(layout.calendarFits).toBe(true);
  expect(layout.featuresHasAccentBorder).toBe(true);
  expect(layout.featuresGap).toBeLessThanOrEqual(12);
});

test('mobile calendar schedules reveal today when a pool is expanded', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.clock.setFixedTime(new Date('2026-05-24T12:00:00-04:00'));
  await page.addInitScript(() => {
    localStorage.setItem('cnsl_preferences', JSON.stringify({ poolScheduleLayout: 'calendar' }));
  });
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
  await expect(calendar.locator('.schedule-calendar__day.is-today')).toBeVisible();
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

test('settings persist choices locally and announce clearing saved settings', async ({ page }) => {
  await page.goto('/settings.html');
  await expect(page.locator('#favoritePool')).toBeEnabled();

  await page.getByLabel('Dark').check();
  await page.getByLabel('10 min').check();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('cnsl_preferences')).theme)).toBe('dark');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('cnsl_preferences')).weatherRefreshMinutes)).toBe(10);
  await expect(page.getByLabel('Share anonymous page usage through Google Analytics')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => Object.hasOwn(JSON.parse(localStorage.getItem('cnsl_preferences')), 'analyticsEnabled'))).toBe(false);
  await expect(page.locator('#cnslAnalyticsScript')).toHaveCount(0);

  await page.getByRole('button', { name: 'Clear saved settings' }).click();
  await expect(page.locator('#settingsStatus')).toHaveText('Saved settings removed from this device.');
});

test('visible weather safety alerts render with update times on every page', async ({ page }) => {
  await prepareVisibleWeatherAlert(page);
  await page.addInitScript(() => {
    sessionStorage.setItem('cnsl_weather_alert_expanded', 'false');
  });

  for (const path of publishedPagePaths) {
    await page.goto(path);
    await expect(page.locator('#weatherAlert')).toBeVisible();
    await expect(page.locator('.weather-alert__title')).toHaveText('Weather safety alert');
    await expect(page.locator('#weatherAlertMessage')).toContainText('Severe Thunderstorm Warning');
    await expect(page.locator('#weatherAlertUpdated')).not.toHaveText('');
    await expect(page.locator('#weatherAlertUpdated')).toHaveAttribute('datetime', /2026-/);
    await expect(page.locator('#weatherAlertDetails')).toBeVisible();
    await expect(page.locator('#weatherAlertToggle')).toBeHidden();
  }
});

test('mobile weather safety alert keeps navigation visible and collapses with a stable arrow control', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await prepareVisibleWeatherAlert(page);
  await page.goto('/index.html');

  await page.locator('.site-title').evaluate(title => {
    title.textContent = 'CA Pool and CNSL Assistant Weather Safety Information';
  });
  const alert = page.locator('#weatherAlert');
  const toggle = page.getByRole('button', { name: 'Collapse weather safety alert' });
  const action = page.getByRole('link', { name: 'Live pool status' });
  const icon = page.locator('.weather-alert__toggle-icon');
  await expect(alert).toBeVisible();
  await expect(page.locator('.weather-alert__title')).toBeVisible();
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
  expect(expandedTitleBox.x + expandedTitleBox.width).toBeLessThanOrEqual(expandedActionBox.x);
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
  await expect(action).toBeVisible();
  await expect(icon).toHaveCSS('transform', 'matrix(-1, 0, 0, -1, 0, 0)');
  const collapsedToggleSize = await expandToggle.boundingBox();
  const collapsedActionBox = await action.boundingBox();
  const collapsedAlertBackground = await alert.evaluate(element => element.ownerDocument.defaultView.getComputedStyle(element).backgroundColor);
  expect(collapsedToggleSize.width).toBe(expandedToggleSize.width);
  expect(collapsedToggleSize.height).toBe(expandedToggleSize.height);
  expect(collapsedToggleSize.x).toBe(expandedToggleSize.x);
  expect(collapsedToggleSize.y).toBe(expandedToggleSize.y);
  expect(collapsedActionBox.x).toBe(expandedActionBox.x);
  expect(collapsedActionBox.y).toBe(expandedActionBox.y);
  expect(collapsedAlertBackground).toBe(expandedAlertBackground);
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem('cnsl_weather_alert_expanded'))).toBe('false');

  const navigationRequests = [];
  page.on('request', request => navigationRequests.push(request.url()));
  await page.goto('/about.html');
  const restoredToggle = page.getByRole('button', { name: 'Expand weather safety alert' });
  await expect(restoredToggle).toBeVisible();
  await expect(page.getByRole('link', { name: 'Live pool status' })).toBeVisible();
  const bannerWasVisibleAtFirstPaint = await page.locator('#weatherAlert').evaluate(banner => new Promise(resolve => {
    banner.ownerDocument.defaultView.requestAnimationFrame(() => resolve(!banner.hidden));
  }));
  expect(bannerWasVisibleAtFirstPaint).toBe(true);
  expect(navigationRequests.filter(url => url.includes('/assets/data/2026/pools/pools.json') || url.startsWith('https://api.weather.gov/'))).toEqual([]);

  await restoredToggle.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#weatherAlertDetails')).toBeVisible();
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