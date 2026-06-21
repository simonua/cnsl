const { test, expect } = require('../browser-test');
const {
  MOBILE_VIEWPORT,
  initializeAnalyticsRecorder,
  prepareStableWeatherResponses
} = require('../browser-test-helpers');

test.beforeEach(async ({ page }) => {
  await prepareStableWeatherResponses(page);
});

test('[WF-INSTALL-001] first mobile use keeps settings and links to Apple install guidance', async ({ page }) => {
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

  const homeInstallLink = page.locator('.share-site__links + .share-site__install a[href="install.html"]');
  await expect(homeInstallLink).toBeVisible();
  await expect(homeInstallLink).toHaveAttribute('href', 'install.html');
  await page.getByRole('button', { name: 'Open navigation menu' }).click();
  const navigationInstallLink = page.locator('#navMenu a[href="install.html"]');
  await expect(navigationInstallLink).toBeVisible();
  await expect(navigationInstallLink).toHaveAttribute('href', 'install.html');
  await page.getByRole('button', { name: 'Close navigation menu' }).click();
  await homeInstallLink.click();
  await expect(page).toHaveURL(/\/install\.html$/);
  await expect(page.locator('#appleInstallOption')).toHaveAttribute('open', '');
  await expect(page.locator('#androidInstallOption')).not.toHaveAttribute('open', '');
  await expect(page.getByRole('button', { name: 'Install app', exact: true })).toBeHidden();
  await expect.poll(() => page.evaluate(() => globalThis.recordedAnalyticsEvents.filter(eventArguments => eventArguments[1] === 'ca_install_interaction'))).toEqual([]);
});

test('[WF-INSTALL-002] Android install view opens matching guidance and offers the browser prompt', async ({ page }) => {
  await page.setViewportSize(MOBILE_VIEWPORT);
  await initializeAnalyticsRecorder(page);
  await page.addInitScript(() => {
    Object.defineProperty(globalThis.navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0 (Linux; Android 15; Mobile) AppleWebKit/537.36 Chrome/136.0 Mobile Safari/537.36'
    });
  });
  await page.goto('/install.html');
  await expect(page.locator('#androidInstallOption')).toHaveAttribute('open', '');
  await expect(page.locator('#appleInstallOption')).not.toHaveAttribute('open', '');
  await page.evaluate(() => {
    const installPrompt = new Event('beforeinstallprompt', { cancelable: true });
    installPrompt.prompt = () => {};
    installPrompt.userChoice = Promise.resolve({ outcome: 'dismissed' });
    globalThis.dispatchEvent(installPrompt);
  });

  const installButton = page.getByRole('button', { name: 'Install app', exact: true });
  await expect(installButton).toBeVisible();
  await installButton.click({ force: true });
  await expect(installButton).toBeHidden();
  await expect(page.locator('#installAppStatus')).toBeVisible();
  await expect.poll(() => page.evaluate(() => globalThis.recordedAnalyticsEvents.filter(eventArguments => eventArguments[1] === 'ca_install_interaction'))).toEqual([
    ['event', 'ca_install_interaction', { install_action: 'prompt_open' }],
    ['event', 'ca_install_interaction', { install_action: 'prompt_dismissed' }]
  ]);
  await page.evaluate(() => {
    globalThis.cnslAnalytics.trackInteraction(
      globalThis.AnalyticsInteractionType.INSTALL,
      { action: 'android' }
    );
  });
  await expect.poll(() => page.evaluate(() => globalThis.recordedAnalyticsEvents.filter(eventArguments => eventArguments[1] === 'ca_install_interaction'))).toHaveLength(2);
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
  await page.goto('/install.html');
  await page.evaluate(() => {
    const installPrompt = new Event('beforeinstallprompt', { cancelable: true });
    installPrompt.prompt = () => {};
    installPrompt.userChoice = Promise.resolve({ outcome: 'accepted' });
    globalThis.dispatchEvent(installPrompt);
  });

  const installButton = page.getByRole('button', { name: 'Install app', exact: true });
  await expect(installButton).toBeVisible();
  await installButton.click({ force: true });
  await page.evaluate(() => globalThis.dispatchEvent(new Event('appinstalled')));
  await expect(page.locator('#installAppStatus')).toBeVisible();
  await expect.poll(() => page.evaluate(() => globalThis.recordedAnalyticsEvents.filter(eventArguments => eventArguments[1] === 'ca_install_interaction'))).toEqual([
    ['event', 'ca_install_interaction', { install_action: 'prompt_open' }],
    ['event', 'ca_install_interaction', { install_action: 'prompt_accepted' }],
    ['event', 'ca_install_interaction', { install_action: 'installed' }]
  ]);
});

test('[WF-INSTALL-004] non-mobile visitors start with both platform tiles collapsed', async ({ page }) => {
  await page.goto('/install.html');

  const androidOption = page.locator('#androidInstallOption');
  const appleOption = page.locator('#appleInstallOption');
  await expect(androidOption).not.toHaveAttribute('open', '');
  await expect(appleOption).not.toHaveAttribute('open', '');
  await expect(page.getByRole('button', { name: 'Install app', exact: true })).toBeHidden();
  const androidBounds = await androidOption.boundingBox();
  const appleBounds = await appleOption.boundingBox();
  expect(androidBounds.y + androidBounds.height).toBeLessThanOrEqual(appleBounds.y);

  await page.locator('#androidInstallOption summary').focus();
  await page.keyboard.press('Enter');
  await expect(androidOption).toHaveAttribute('open', '');
  await page.locator('#appleInstallOption summary').focus();
  await page.keyboard.press('Enter');
  await expect(appleOption).toHaveAttribute('open', '');
  await expect(androidOption).not.toHaveAttribute('open', '');
});

test('[WF-INSTALL-005] unavailable Android browser prompt leaves manual guidance usable', async ({ page }) => {
  await page.setViewportSize(MOBILE_VIEWPORT);
  await initializeAnalyticsRecorder(page);
  await page.addInitScript(() => {
    Object.defineProperty(globalThis.navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0 (Linux; Android 15; Mobile) AppleWebKit/537.36 Chrome/136.0 Mobile Safari/537.36'
    });
  });
  await page.goto('/install.html');
  await page.evaluate(() => {
    const installPrompt = new Event('beforeinstallprompt', { cancelable: true });
    installPrompt.prompt = () => {};
    installPrompt.userChoice = new Promise((resolve, reject) => {
      globalThis.rejectInstallChoice = reject;
    });
    globalThis.dispatchEvent(installPrompt);
  });

  const installButton = page.getByRole('button', { name: 'Install app', exact: true });
  await installButton.click({ force: true });
  await page.evaluate(() => globalThis.rejectInstallChoice(new Error('Prompt unavailable')));

  await expect(page.locator('#installAppStatus')).toBeVisible();
  await expect(page.locator('#androidInstallOption')).toHaveAttribute('open', '');
  await expect(installButton).toBeHidden();
  await expect.poll(() => page.evaluate(() => globalThis.recordedAnalyticsEvents.filter(eventArguments => eventArguments[1] === 'ca_install_interaction'))).toEqual([
    ['event', 'ca_install_interaction', { install_action: 'prompt_open' }]
  ]);
});
