const { test, expect } = require('../browser-test');
const {
  AUDIENCE_VIEWPORTS,
  MOBILE_VIEWPORT,
  initializeAnalyticsRecorder,
  prepareStableWeatherResponses
} = require('../browser-test-helpers');

test.beforeEach(async ({ page }) => {
  await prepareStableWeatherResponses(page);
});

test.describe('first mobile visit', () => {
  test.use({ firstVisit: true });

test('[WF-INSTALL-001] first mobile use keeps welcome and Apple install guidance available', async ({ page }) => {
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
  await expect(page.locator('#welcomeDialog')).toBeVisible();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('cnsl_current_version'))).toBe(currentVersion);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('cnsl_preferences')))).toEqual({ theme: 'dark' });

  const homeInstallLink = page.locator('.share-site__links + .share-site__install a[href="install.html"]');
  await expect(homeInstallLink).toBeVisible();
  await expect(homeInstallLink).toHaveAttribute('href', 'install.html');
   await page.getByRole('button', { name: 'Close welcome' }).click();
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

test('[WF-INSTALL-006] header install action persists in browser mode and hides after installation', async ({ page }) => {
  await page.setViewportSize(AUDIENCE_VIEWPORTS.NARROW_PHONE);
  await page.goto('/about.html');

  const installLink = page.locator('#headerInstallLink');
  await expect(installLink).toBeVisible();
  await expect(installLink).toHaveAttribute('href', 'install.html');
  await expect(installLink).toHaveAttribute('title', 'Install app');
  await expect(installLink).toHaveAccessibleName('Install app');
  await expect.poll(() => installLink.evaluate(link => {
    const bounds = link.getBoundingClientRect();
    return { height: bounds.height, width: bounds.width };
  })).toEqual({ height: 44, width: 44 });
  await expect.poll(() => page.locator('.header').evaluate(header => {
    const homeBounds = header.querySelector('a[aria-label="Home"]').getBoundingClientRect();
    const titleBounds = header.querySelector('.site-title').getBoundingClientRect();
    const actionBounds = header.querySelector('.header__actions').getBoundingClientRect();
    const headerBounds = header.getBoundingClientRect();
    return {
      actionAfterTitle: actionBounds.left >= titleBounds.right,
      controlsContained: Math.max(homeBounds.bottom, titleBounds.bottom, actionBounds.bottom) <= headerBounds.bottom,
      titleAfterHome: titleBounds.left >= homeBounds.right
    };
  })).toEqual({ actionAfterTitle: true, controlsContained: true, titleAfterHome: true });

  await installLink.click();
  await expect(page).toHaveURL(/\/install\.html$/);
  await page.evaluate(() => globalThis.dispatchEvent(new Event('appinstalled')));
  await expect(page.locator('#headerInstallLink')).toBeHidden();
});

test('[WF-INSTALL-007] header install action stays hidden in standalone display mode', async ({ page }) => {
  await page.addInitScript(() => {
    const browserMatchMedia = globalThis.matchMedia.bind(globalThis);
    globalThis.matchMedia = query => query === '(display-mode: standalone)'
      ? {
        addEventListener() {},
        matches: true,
        media: query,
        removeEventListener() {}
      }
      : browserMatchMedia(query);
  });

  await page.goto('/about.html');
  await expect(page.locator('#headerInstallLink')).toBeHidden();
});
