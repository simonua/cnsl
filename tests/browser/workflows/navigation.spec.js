const { test, expect } = require('../browser-test');
const {
  getAnnualDataUrlPattern,
  MOBILE_VIEWPORT,
  prepareStableWeatherResponses
} = require('../browser-test-helpers');

const WARMED_ROUTE_SCENARIOS = Object.freeze([
  Object.freeze({
    path: 'pools.html',
    readySelector: '#poolList',
    reference: 'WF-NAV-004',
    title: 'Pools'
  }),
  Object.freeze({
    path: 'teams.html',
    readySelector: '#teamList',
    reference: 'WF-NAV-005',
    title: 'Teams'
  }),
  Object.freeze({
    path: 'meets.html',
    readySelector: '#meetList',
    reference: 'WF-NAV-006',
    title: 'Meets'
  })
]);

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

test('[WF-NAV-002] home startup warms each primary directory route without optional annual data', async ({ page }) => {
  const requestedUrls = [];
  page.on('request', request => requestedUrls.push(request.url()));

  await page.goto('/index.html');
  const warmupResult = await page.evaluate(() => globalThis.cnslRouteWarmup.startupPromise);
  await page.waitForLoadState('networkidle');

  expect(warmupResult).toEqual({ mode: 'prerender', routeCount: 3 });
  const prerenderRules = await page.locator('script[type="speculationrules"]').evaluate(element => JSON.parse(element.textContent));
  expect(prerenderRules.prerender).toHaveLength(1);
  expect(prerenderRules.prerender[0].urls).toEqual(WARMED_ROUTE_SCENARIOS.map(scenario => (
    new URL(`/${scenario.path}`, page.url()).href
  )));
  expect(requestedUrls.some(url => getAnnualDataUrlPattern('pools').test(url))).toBe(false);
  expect(requestedUrls.some(url => getAnnualDataUrlPattern('teams').test(url))).toBe(false);
  expect(requestedUrls.some(url => getAnnualDataUrlPattern('meets').test(url))).toBe(false);

  const rejectedResult = await page.evaluate(() => globalThis.cnslRouteWarmup.warmRoutes([{
    document: 'https://example.invalid/pools.html'
  }]));
  expect(rejectedResult).toEqual({ mode: 'none', routeCount: 0 });
  expect(requestedUrls.some(url => url.startsWith('https://example.invalid/'))).toBe(false);

  await page.addInitScript(() => {
    let isPrerendering = true;
    globalThis.recordedRouteReadinessMessages = [];
    globalThis.BroadcastChannel = class BroadcastChannelFixture {
      postMessage(message) {
        globalThis.recordedRouteReadinessMessages.push(message);
      }
    };
    Object.defineProperty(globalThis.Document.prototype, 'prerendering', {
      configurable: true,
      get: () => isPrerendering
    });
    globalThis.activatePrerenderFixture = () => {
      isPrerendering = false;
      globalThis.document.dispatchEvent(new globalThis.Event('prerenderingchange'));
    };
  });
  for (const scenario of WARMED_ROUTE_SCENARIOS) {
    requestedUrls.length = 0;
    const primaryDomain = scenario.path.replace('.html', '');
    const optionalDomains = ['pools', 'teams', 'meets'].filter(domain => domain !== primaryDomain);

    await page.goto(`/${scenario.path}`);
    await expect(page).toHaveURL(new RegExp(`/${scenario.path.replace('.', '\\.')}\u0024`));
    await expect(page.locator(scenario.readySelector)).toHaveAttribute('aria-busy', 'false');
    expect(await page.evaluate(() => globalThis.recordedRouteReadinessMessages.map(message => message.state))).toEqual([
      'preparing',
      'ready'
    ]);
    expect(requestedUrls.some(url => getAnnualDataUrlPattern(primaryDomain).test(url))).toBe(true);
    optionalDomains.forEach(domain => {
      expect(requestedUrls.some(url => getAnnualDataUrlPattern(domain).test(url))).toBe(false);
    });

    await page.evaluate(() => globalThis.activatePrerenderFixture());
    for (const domain of optionalDomains) {
      await expect.poll(() => requestedUrls.some(url => getAnnualDataUrlPattern(domain).test(url))).toBe(true);
    }
  }
});

test('[WF-NAV-003] home startup falls back to directory document prefetches', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(globalThis.HTMLScriptElement, 'supports', {
      configurable: true,
      value: () => false
    });
  });

  await page.goto('/index.html');
  const warmupResult = await page.evaluate(() => globalThis.cnslRouteWarmup.startupPromise);

  expect(warmupResult).toEqual({ mode: 'prefetch', routeCount: 3 });
  const prefetchedRoutes = await page.locator('link[rel="prefetch"][as="document"]').evaluateAll(links => (
    links.map(link => new URL(link.href).pathname)
  ));
  expect(prefetchedRoutes).toEqual(WARMED_ROUTE_SCENARIOS.map(scenario => `/${scenario.path}`));
  await expect(page.locator('script[type="speculationrules"]')).toHaveCount(0);
});

test('[WF-NAV-007] shared subheader keeps notice state and scrolls with page content', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('cnsl_current_version', globalThis.APP_VERSION || '0.0.0');
    localStorage.setItem('cnsl_settings_notice_dismissed', 'true');
  });
  await page.goto('/faq.html');

  const subheader = page.locator('#appSubheader');
  await expect(subheader).toHaveCSS('position', 'static');
  await expect(subheader.locator('#attentionBanner')).toHaveCount(1);
  await expect(subheader.locator('#weatherAlert')).toHaveCount(1);
  await expect(subheader.locator('#connectivityStatus')).toHaveCount(1);
  await expect(subheader.locator('#releaseNotice')).toHaveCount(1);
  await expect(subheader.locator('#settingsNotice')).toHaveCount(1);

  const initialTop = await subheader.evaluate(element => element.getBoundingClientRect().top);
  await page.evaluate(() => globalThis.scrollTo(0, globalThis.document.documentElement.scrollHeight));
  await expect.poll(() => subheader.evaluate(element => element.getBoundingClientRect().top)).toBeLessThan(initialTop);
  await expect(page.locator('.header')).toHaveCSS('position', 'fixed');
});

for (const scenario of WARMED_ROUTE_SCENARIOS) {
  test(`[${scenario.reference}] ${scenario.title} navigation keeps Home visible until primary rendering is ready`, async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push({ name: error.name, message: error.message }));

    await page.goto('/index.html');
    await page.evaluate(() => globalThis.cnslRouteWarmup.startupPromise);

    await page.evaluate(routePath => new Promise(resolve => {
      const channel = new globalThis.BroadcastChannel(globalThis.ROUTE_WARMUP_CHANNEL_NAME);
      channel.postMessage({
        route: new URL(routePath, globalThis.document.baseURI).href,
        state: globalThis.ROUTE_WARMUP_READINESS_STATES.PREPARING
      });
      globalThis.requestAnimationFrame(() => {
        channel.close();
        resolve();
      });
    }), scenario.path);

    const routeLink = page.locator(`a[href="${scenario.path}"]:visible`).first();
    await routeLink.click({ noWaitAfter: true });

    await expect(page).toHaveURL(/\/index\.html$/);
    await expect(page.locator('#mainContent')).toBeVisible();
    await expect(routeLink).toHaveAttribute('aria-busy', 'true');

    await page.evaluate(routePath => {
      const channel = new globalThis.BroadcastChannel(globalThis.ROUTE_WARMUP_CHANNEL_NAME);
      channel.postMessage({
        route: new URL(routePath, globalThis.document.baseURI).href,
        state: globalThis.ROUTE_WARMUP_READINESS_STATES.READY
      });
      channel.close();
    }, scenario.path);

    await expect(page).toHaveURL(new RegExp(`/${scenario.path.replace('.', '\\.')}\u0024`));
    await expect(page.locator(scenario.readySelector)).toHaveAttribute('aria-busy', 'false');
    expect(pageErrors).toEqual([]);
  });
}
