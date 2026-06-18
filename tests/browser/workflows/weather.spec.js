const { test, expect } = require('../browser-test');
const AppConfig = require('../../../scripts/adapters/app-config.js');
const {
  MOBILE_VIEWPORT,
  getAnnualDataUrlPattern,
  prepareStableWeatherResponses,
  prepareVisibleWeatherAlert
} = require('../browser-test-helpers');
const { publishedPagePaths } = require('./workflow-scenarios');

test.beforeEach(async ({ page }) => {
  await prepareStableWeatherResponses(page);
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
    await expect(page.locator('#weatherAlertUpdated')).toHaveAttribute('datetime', /^\d{4}-/);
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
  await expect(nwsAlertLink).toHaveAttribute('href', AppConfig.WEATHER_PUBLIC_ALERTS_URL);
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
  expect(collapsedToggleBox.width).toBe(collapsedToggleBox.height);
  expect(collapsedToggleBox.height).toBeGreaterThanOrEqual(44);
  expect(expandedToggleBox.height).toBe(collapsedToggleBox.height);
  expect(expandedToggleBox.y - collapsedToggleBox.y).toBeCloseTo(expandedTitleBox.y - collapsedTitleBox.y, 1);
  expect(expandedActionBox.y + expandedActionBox.height / 2).toBeCloseTo(expandedToggleBox.y + expandedToggleBox.height / 2, 1);
  expect(expandedNwsActionBox.y).toBe(expandedActionBox.y);
  expect(expandedNwsActionBox.height).toBe(expandedActionBox.height);
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
  expect(expandedToggleSize.height).toBeGreaterThanOrEqual(44);
  expect(expandedActionBox.height).toBe(expandedTitleBox.height);
  expect(expandedActionBox.y).toBeGreaterThanOrEqual(expandedTitleBox.y + expandedTitleBox.height);
  expect(expandedNwsActionBox.y).toBe(expandedActionBox.y);
  expect(expandedNwsActionBox.height).toBe(expandedActionBox.height);
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
  expect(navigationRequests.filter(url => getAnnualDataUrlPattern('pools').test(url) || url.startsWith(AppConfig.WEATHER_API_BASE_URL))).toEqual([]);

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
