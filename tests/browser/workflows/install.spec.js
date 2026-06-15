const { test, expect } = require('../browser-test');
const {
  MOBILE_VIEWPORT,
  initializeAnalyticsRecorder,
  prepareStableWeatherResponses
} = require('../browser-test-helpers');

test.beforeEach(async ({ page }) => {
  await prepareStableWeatherResponses(page);
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
