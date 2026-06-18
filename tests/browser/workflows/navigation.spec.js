const { test, expect } = require('../browser-test');
const {
  getAnnualDataUrlPattern,
  MOBILE_VIEWPORT,
  prepareStableWeatherResponses
} = require('../browser-test-helpers');

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

test('[WF-NAV-002] home startup warms only the Pools route and its primary annual data', async ({ page }) => {
  const requestedUrls = [];
  page.on('request', request => requestedUrls.push(request.url()));

  await page.goto('/index.html');
  const warmupResult = await page.evaluate(() => globalThis.cnslRouteWarmup.startupPromise);
  await page.waitForLoadState('networkidle');

  expect(warmupResult).toEqual({ mode: 'prerender', routeCount: 1 });
  const prerenderRules = await page.locator('script[type="speculationrules"]').evaluate(element => JSON.parse(element.textContent));
  expect(prerenderRules.prerender).toHaveLength(1);
  expect(prerenderRules.prerender[0].urls).toEqual([`${new URL('/pools.html', page.url()).href}`]);
  expect(prerenderRules.prerender[0].urls.some(url => url.endsWith('/teams.html'))).toBe(false);
  expect(prerenderRules.prerender[0].urls.some(url => url.endsWith('/meets.html'))).toBe(false);
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
    Object.defineProperty(globalThis.Document.prototype, 'prerendering', {
      configurable: true,
      get: () => isPrerendering
    });
    globalThis.activatePrerenderFixture = () => {
      isPrerendering = false;
      globalThis.document.dispatchEvent(new globalThis.Event('prerenderingchange'));
    };
  });
  await page.goto('/pools.html');
  await expect(page).toHaveURL(/\/pools\.html$/);
  await expect(page.locator('#poolList')).toHaveAttribute('aria-busy', 'false');
  expect(requestedUrls.some(url => getAnnualDataUrlPattern('pools').test(url))).toBe(true);
  expect(requestedUrls.some(url => getAnnualDataUrlPattern('teams').test(url))).toBe(false);
  expect(requestedUrls.some(url => getAnnualDataUrlPattern('meets').test(url))).toBe(false);

  await page.evaluate(() => globalThis.activatePrerenderFixture());
  await expect.poll(() => requestedUrls.some(url => getAnnualDataUrlPattern('teams').test(url))).toBe(true);
  await expect.poll(() => requestedUrls.some(url => getAnnualDataUrlPattern('meets').test(url))).toBe(true);
});

test('[WF-NAV-003] home startup falls back to a Pools document prefetch', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(globalThis.HTMLScriptElement, 'supports', {
      configurable: true,
      value: () => false
    });
  });

  await page.goto('/index.html');
  const warmupResult = await page.evaluate(() => globalThis.cnslRouteWarmup.startupPromise);

  expect(warmupResult).toEqual({ mode: 'prefetch', routeCount: 1 });
  await expect(page.locator('link[rel="prefetch"][as="document"]')).toHaveAttribute('href', /\/pools\.html$/);
  await expect(page.locator('script[type="speculationrules"]')).toHaveCount(0);
});

test('[WF-NAV-004] Pools navigation keeps Home visible until primary route rendering is ready', async ({ page }) => {
  await page.goto('/index.html');
  await page.evaluate(() => globalThis.cnslRouteWarmup.startupPromise);

  await page.evaluate(() => new Promise(resolve => {
    const channel = new globalThis.BroadcastChannel(globalThis.ROUTE_WARMUP_CHANNEL_NAME);
    channel.postMessage({
      route: new URL('pools.html', globalThis.document.baseURI).href,
      state: globalThis.ROUTE_WARMUP_READINESS_STATES.PREPARING
    });
    globalThis.requestAnimationFrame(() => {
      channel.close();
      resolve();
    });
  }));

  const poolsLink = page.locator('a[href="pools.html"]:visible').first();
  await poolsLink.click({ noWaitAfter: true });

  await expect(page).toHaveURL(/\/index\.html$/);
  await expect(page.locator('#mainContent')).toBeVisible();
  await expect(poolsLink).toHaveAttribute('aria-busy', 'true');

  await page.evaluate(() => {
    const channel = new globalThis.BroadcastChannel(globalThis.ROUTE_WARMUP_CHANNEL_NAME);
    channel.postMessage({
      route: new URL('pools.html', globalThis.document.baseURI).href,
      state: globalThis.ROUTE_WARMUP_READINESS_STATES.READY
    });
    channel.close();
  });

  await expect(page).toHaveURL(/\/pools\.html$/);
  await expect(page.locator('#poolList')).toHaveAttribute('aria-busy', 'false');
});
