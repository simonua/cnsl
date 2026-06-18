const { test, expect } = require('../browser-test');
const {
  ACTIVE_SEASON_YEAR,
  MOBILE_VIEWPORT,
  initializeAnalyticsRecorder,
  prepareStableWeatherResponses,
  seedPreferences
} = require('../browser-test-helpers');

const WEATHER_CHECKED_AT = `${ACTIVE_SEASON_YEAR}-06-02T14:15:00-04:00`;
const WEATHER_CHECKED_LABEL = `Jun 2, ${ACTIVE_SEASON_YEAR}, 2:15 PM`;

test.beforeEach(async ({ page }) => {
  await prepareStableWeatherResponses(page);
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

test('[WF-SETTINGS-001] settings dialog is evenly inset on mobile and centered on desktop', async ({ page }) => {
  const mobileViewport = MOBILE_VIEWPORT;
  await page.setViewportSize(mobileViewport);
  await page.goto('/settings.html');
  const dialog = page.locator('#settingsDialog');
  await expect(dialog).toBeVisible();
  let bounds = await dialog.boundingBox();

  expect(bounds.x).toBeGreaterThanOrEqual(8);
  expect(Math.abs(bounds.height - (mobileViewport.height * 0.75))).toBeLessThanOrEqual(1);
  expect(Math.abs(bounds.x - (mobileViewport.width - bounds.x - bounds.width))).toBeLessThanOrEqual(1);
  expect(Math.abs(bounds.y + (bounds.height / 2) - (mobileViewport.height / 2))).toBeLessThanOrEqual(1);
  await expect.poll(() => page.evaluate(() => {
    const dialogElement = globalThis.document.getElementById('settingsDialog');
    const panel = dialogElement.querySelector('.settings-dialog__panel');
    const form = globalThis.document.getElementById('settingsForm');
    return {
      dialogOverflowY: globalThis.getComputedStyle(dialogElement).overflowY,
      dialogScrollable: dialogElement.scrollHeight > dialogElement.clientHeight,
      formOverflowY: globalThis.getComputedStyle(form).overflowY,
      formScrollable: form.scrollHeight > form.clientHeight,
      panelOverflowY: globalThis.getComputedStyle(panel).overflowY,
      panelScrollable: panel.scrollHeight > panel.clientHeight
    };
  })).toEqual({
    dialogOverflowY: 'hidden',
    dialogScrollable: false,
    formOverflowY: 'auto',
    formScrollable: true,
    panelOverflowY: 'hidden',
    panelScrollable: false
  });
  await expect(page.locator('#settingsForm > .settings-group').evaluateAll(groups => groups.map(group => {
    const heading = group.querySelector(':scope > legend, :scope > .settings-label');
    const collapsibleHeading = heading?.tagName === 'SUMMARY'
      ? heading.querySelector(':scope > .settings-collapsible__heading')
      : null;
    const primaryHeading = collapsibleHeading?.querySelector(':scope > span:first-child') || collapsibleHeading;
    return primaryHeading ? primaryHeading.textContent.trim() : heading?.textContent.trim() || '';
  }))).resolves.toEqual([
    'Favorites',
    'Schedules',
    'Pool visits',
    'Display & Accessibility',
    'Experimental Features',
    'App Maintenance'
  ]);
  const lightHeaderColors = await page.locator('#favoriteSettings, #experimentalFeatures').evaluateAll(sections => sections.map(section => ({
    content: globalThis.getComputedStyle(section.querySelector(':scope > div')).backgroundColor,
    header: globalThis.getComputedStyle(section.querySelector(':scope > summary')).backgroundColor
  })));
  expect(lightHeaderColors.every(colors => colors.header !== colors.content)).toBe(true);
  expect(lightHeaderColors[0].header).not.toBe(lightHeaderColors[1].header);
  const favoriteSettings = page.locator('#favoriteSettings');
  const scheduleSettings = page.locator('#scheduleSettings');
  await expect(favoriteSettings).toHaveAttribute('open', '');
  await expect(scheduleSettings).not.toHaveAttribute('open', '');
  await expect(page.locator('#favoritePool')).toBeVisible();
  await expect(page.getByRole('group', { name: 'Swim Team Practice Groups' })).toBeHidden();
  await scheduleSettings.locator('summary').press('Enter');
  await expect(scheduleSettings).toHaveAttribute('open', '');
  await expect(favoriteSettings).not.toHaveAttribute('open', '');
  await expect(page.getByRole('group', { name: 'Swim Team Practice Groups' })).toBeVisible();
  const practiceBounds = await page.locator('.settings-checkbox-list .settings-checkbox').evaluateAll(options => options.map(option => option.getBoundingClientRect().x));
  expect(new Set(practiceBounds.map(position => Math.round(position))).size).toBe(2);
  const accessibilitySettings = page.locator('#accessibilitySettings');
  const accessibilitySummary = accessibilitySettings.locator('summary');
  await expect(accessibilitySettings).not.toHaveAttribute('open', '');
  await expect(page.getByLabel('Extra large')).toBeHidden();
  await accessibilitySummary.press('Enter');
  await expect(accessibilitySettings).toHaveAttribute('open', '');
  await expect(page.getByLabel('Extra large')).toBeVisible();
  await accessibilitySummary.press('Enter');
  await expect(accessibilitySettings).not.toHaveAttribute('open', '');
  const maintenanceSettings = page.locator('#maintenanceSettings');
  await expect(maintenanceSettings).not.toHaveAttribute('open', '');
  await expect(page.getByRole('button', { name: 'Force update' })).toBeHidden();
  await maintenanceSettings.locator('summary').press('Enter');
  await expect(maintenanceSettings).toHaveAttribute('open', '');
  const closeButtonBounds = await page.getByRole('button', { name: 'Close settings' }).boundingBox();
  expect(closeButtonBounds.width).toBeLessThan(closeButtonBounds.height);
  let forceUpdateButtonBounds = await page.getByRole('button', { name: 'Force update' }).boundingBox();
  let resetButtonBounds = await page.getByRole('button', { name: 'Reset all settings' }).boundingBox();
  let maintenanceBounds = await maintenanceSettings.locator('.settings-section__content').boundingBox();
  expect(forceUpdateButtonBounds.x).toBeGreaterThanOrEqual(maintenanceBounds.x);
  expect(forceUpdateButtonBounds.x + forceUpdateButtonBounds.width).toBeLessThanOrEqual(maintenanceBounds.x + maintenanceBounds.width);
  expect(resetButtonBounds.x).toBeGreaterThanOrEqual(maintenanceBounds.x);
  expect(resetButtonBounds.x + resetButtonBounds.width).toBeLessThanOrEqual(maintenanceBounds.x + maintenanceBounds.width);
  expect(forceUpdateButtonBounds.y + forceUpdateButtonBounds.height <= resetButtonBounds.y
    || resetButtonBounds.y + resetButtonBounds.height <= forceUpdateButtonBounds.y
    || forceUpdateButtonBounds.x + forceUpdateButtonBounds.width <= resetButtonBounds.x
    || resetButtonBounds.x + resetButtonBounds.width <= forceUpdateButtonBounds.x).toBe(true);
  await page.getByRole('button', { name: 'Close settings' }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole('button', { name: 'Open settings' }).click();
  await expect(favoriteSettings).toHaveAttribute('open', '');
  await expect(accessibilitySettings).not.toHaveAttribute('open', '');
  await expect(maintenanceSettings).not.toHaveAttribute('open', '');
  await page.getByRole('button', { name: 'Close settings' }).click();

  const desktopViewport = { width: 1280, height: 800 };
  await page.setViewportSize(desktopViewport);
  await page.goto('/settings.html');
  bounds = await dialog.boundingBox();

  expect(Math.abs(bounds.height - (desktopViewport.height * 0.75))).toBeLessThanOrEqual(1);
  expect(Math.abs(bounds.x + (bounds.width / 2) - (desktopViewport.width / 2))).toBeLessThanOrEqual(1);
  expect(Math.abs(bounds.y + (bounds.height / 2) - (desktopViewport.height / 2))).toBeLessThanOrEqual(1);
  await maintenanceSettings.locator('summary').click();
  forceUpdateButtonBounds = await page.getByRole('button', { name: 'Force update' }).boundingBox();
  resetButtonBounds = await page.getByRole('button', { name: 'Reset all settings' }).boundingBox();
  maintenanceBounds = await maintenanceSettings.locator('.settings-section__content').boundingBox();
  expect(forceUpdateButtonBounds.x).toBeGreaterThanOrEqual(maintenanceBounds.x);
  expect(forceUpdateButtonBounds.x + forceUpdateButtonBounds.width).toBeLessThanOrEqual(maintenanceBounds.x + maintenanceBounds.width);
  expect(resetButtonBounds.x).toBeGreaterThanOrEqual(maintenanceBounds.x);
  expect(resetButtonBounds.x + resetButtonBounds.width).toBeLessThanOrEqual(maintenanceBounds.x + maintenanceBounds.width);
  expect(forceUpdateButtonBounds.y + forceUpdateButtonBounds.height <= resetButtonBounds.y
    || resetButtonBounds.y + resetButtonBounds.height <= forceUpdateButtonBounds.y
    || forceUpdateButtonBounds.x + forceUpdateButtonBounds.width <= resetButtonBounds.x
    || resetButtonBounds.x + resetButtonBounds.width <= forceUpdateButtonBounds.x).toBe(true);
});

test('[WF-SETTINGS-013] force update reports progress and recovers without changing preferences', async ({ page }) => {
  await seedPreferences(page, { theme: 'dark' });
  await page.goto('/settings.html');
  const savedPreferences = await page.evaluate(() => localStorage.getItem('cnsl_preferences'));
  await page.evaluate(() => {
    globalThis.cnslPwa = {
      forceUpdate: () => new Promise((resolveUpdate, rejectUpdate) => {
        globalThis.resolveForcedUpdate = resolveUpdate;
        globalThis.rejectForcedUpdate = () => rejectUpdate(new Error('network unavailable'));
      })
    };
  });

  const forceUpdateButton = page.getByRole('button', { name: 'Force update' });
  await page.locator('#maintenanceSettings summary').click();
  await forceUpdateButton.click();
  await expect(forceUpdateButton).toBeDisabled();
  await expect(forceUpdateButton).toHaveAttribute('aria-busy', 'true');
  await expect(page.locator('#settingsStatus')).toHaveText('Checking for the latest app files...');

  await page.evaluate(() => globalThis.rejectForcedUpdate());
  await expect(forceUpdateButton).toBeEnabled();
  await expect(forceUpdateButton).not.toHaveAttribute('aria-busy');
  await expect(page.locator('#settingsStatus')).toHaveText('The app could not refresh right now. Please check your connection and try again.');
  await expect.poll(() => page.evaluate(() => localStorage.getItem('cnsl_preferences'))).toBe(savedPreferences);
});

test('[WF-SETTINGS-014] preference changes update other open app tabs', async ({ page }) => {
  const secondPage = await page.context().newPage();
  await prepareStableWeatherResponses(secondPage);
  await Promise.all([page.goto('/index.html'), secondPage.goto('/settings.html')]);
  await page.evaluate(() => {
    globalThis.crossTabPreferenceEvents = [];
    globalThis.addEventListener(globalThis.PREFERENCES_CHANGED_EVENT_NAME, event => {
      globalThis.crossTabPreferenceEvents.push(event.detail);
    });
  });

  await secondPage.locator('#accessibilitySettings summary').click();
  await secondPage.getByLabel('Dark').check();

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect.poll(() => page.evaluate(() => globalThis.crossTabPreferenceEvents)).toEqual([
    { source: 'storage' }
  ]);
  await secondPage.close();
});

test('[WF-SETTINGS-012] settings dialog closes from the backdrop and restores launcher focus', async ({ page }) => {
  await page.setViewportSize(MOBILE_VIEWPORT);
  await page.goto('/settings.html');

  const dialog = page.locator('#settingsDialog');
  const launcher = page.getByRole('button', { name: 'Open settings' });
  await expect(dialog).toBeVisible();

  await page.locator('.settings-dialog__notice').click();
  await expect(dialog).toBeVisible();

  await page.mouse.click(4, 4);
  await expect(dialog).not.toBeVisible();
  await expect(launcher).toBeFocused();
});

test('[WF-SETTINGS-002] settings persist choices locally and reset without clearing app lifecycle data', async ({ page }) => {
  await initializeAnalyticsRecorder(page);
  await page.goto('/settings.html');
  await expect(page.locator('#favoritePool')).toBeEnabled();
  await page.locator('#scheduleSettings summary').click();
  await expect(page.getByRole('group', { name: 'Swim Team Practice Groups' })).toBeVisible();
  await expect(page.getByLabel('First Splash')).toBeChecked();
  await expect(page.getByLabel('8 and under')).toBeChecked();
  await expect(page.getByLabel('9-10')).toBeChecked();

  await page.locator('#accessibilitySettings summary').click();
  await page.getByLabel('Dark').check();
  await page.locator('#scheduleSettings summary').click();
  await page.getByLabel('Weekly calendar').check();
  await page.locator('#poolVisitSettings summary').click();
  await page.getByLabel('Use my current location to estimate distances to pools').check();
  await page.getByLabel('10 min').check();
  await page.locator('#scheduleSettings summary').click();
  await page.getByLabel('First Splash').uncheck();
  await page.getByLabel('8 and under').uncheck();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('cnsl_preferences')).theme)).toBe('dark');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('cnsl_preferences')).weatherRefreshMinutes)).toBe(10);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('cnsl_preferences')).practiceGroups)).toEqual(['9-10', '11-12', '13-14', '15-18']);
  await expect(page.getByLabel('Share anonymous page usage through Google Analytics')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => Object.hasOwn(JSON.parse(localStorage.getItem('cnsl_preferences')), 'analyticsEnabled'))).toBe(false);
  await expect(page.locator('#cnslAnalyticsScript')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => globalThis.recordedAnalyticsEvents.filter(eventArguments => eventArguments[1] === 'ca_setting_change'))).toEqual([
    ['event', 'ca_setting_change', { setting_name: 'theme' }],
    ['event', 'ca_setting_change', { setting_name: 'pool_schedule_layout' }],
    ['event', 'ca_setting_change', { setting_name: 'location_awareness' }],
    ['event', 'ca_setting_change', { setting_name: 'weather_refresh_minutes' }],
    ['event', 'ca_setting_change', { setting_name: 'practice_groups' }],
    ['event', 'ca_setting_change', { setting_name: 'practice_groups' }]
  ]);

  await page.locator('#favoriteSettings summary').click();
  const favoritePoolOption = await page.locator('#favoritePool option:not([value=""])').first().evaluate(option => ({
    label: option.textContent,
    value: option.value
  }));
  const favoriteTeamOption = await page.locator('#favoriteTeam option:not([value=""])').first().evaluate(option => ({
    label: option.textContent,
    value: option.value
  }));
  await page.locator('#favoritePool').selectOption(favoritePoolOption.value);
  await page.locator('#favoriteTeam').selectOption(favoriteTeamOption.value);
  await page.locator('#favoritePool').selectOption('');
  await expect.poll(() => page.evaluate(() => globalThis.recordedAnalyticsEvents.filter(eventArguments => eventArguments[1] === 'ca_setting_change'))).toEqual([
    ['event', 'ca_setting_change', { setting_name: 'theme' }],
    ['event', 'ca_setting_change', { setting_name: 'pool_schedule_layout' }],
    ['event', 'ca_setting_change', { setting_name: 'location_awareness' }],
    ['event', 'ca_setting_change', { setting_name: 'weather_refresh_minutes' }],
    ['event', 'ca_setting_change', { setting_name: 'practice_groups' }],
    ['event', 'ca_setting_change', { setting_name: 'practice_groups' }],
    ['event', 'ca_setting_change', { setting_name: 'favorite_pool', selection: favoritePoolOption.label }],
    ['event', 'ca_setting_change', { setting_name: 'favorite_team', selection: favoriteTeamOption.label }],
    ['event', 'ca_setting_change', { setting_name: 'favorite_pool', selection: 'none' }]
  ]);

  await page.locator('#favoriteTeam').evaluate(select => {
    const untrustedOption = select.ownerDocument.createElement('option');
    untrustedOption.value = 'person@example.com';
    untrustedOption.textContent = 'Untrusted value';
    select.appendChild(untrustedOption);
    select.value = untrustedOption.value;
    select.dispatchEvent(new select.ownerDocument.defaultView.Event('change', { bubbles: true }));
  });
  await expect.poll(() => page.evaluate(() => globalThis.recordedAnalyticsEvents.filter(eventArguments => eventArguments[1] === 'ca_setting_change'))).toHaveLength(9);

  const dismissedResetPrompt = page.waitForEvent('dialog').then(async dialog => {
    expect(dialog.type()).toBe('confirm');
    expect(dialog.message()).toBe('Reset all settings to their defaults on this device?');
    await dialog.dismiss();
  });
  await page.locator('#maintenanceSettings summary').click();
  await page.getByRole('button', { name: 'Reset all settings' }).click();
  await dismissedResetPrompt;
  await expect(page.getByLabel('Dark')).toBeChecked();
  await expect(page.getByLabel('First Splash')).not.toBeChecked();
  await expect.poll(() => page.evaluate(() => globalThis.recordedAnalyticsEvents.filter(eventArguments => eventArguments[1] === 'ca_setting_change'))).toHaveLength(9);

  const preservedState = await page.evaluate(async () => {
    const localEntries = globalThis.APP_LOCAL_STORAGE_KEYS
      .filter(key => key !== globalThis.PREFERENCES_STORAGE_KEY)
      .map(key => [key, key.includes('version') ? globalThis.APP_VERSION : `saved:${key}`]);
    const sessionEntries = globalThis.APP_SESSION_STORAGE_KEYS
      .map(key => [key, `saved:${key}`]);
    localEntries.forEach(([key, value]) => localStorage.setItem(key, value));
    sessionEntries.forEach(([key, value]) => sessionStorage.setItem(key, value));
    localStorage.setItem('unrelated_local_key', 'saved');
    sessionStorage.setItem('unrelated_session_key', 'saved');
    await globalThis.caches.open('cnsl-static-test-reset');
    await globalThis.caches.open('unrelated-cache');
    return {
      local: Object.fromEntries(localEntries),
      session: Object.fromEntries(sessionEntries),
      versionEventCount: globalThis.recordedAnalyticsEvents
        .filter(eventArguments => eventArguments[1] === 'ca_version').length
    };
  });
  const acceptedResetPrompt = page.waitForEvent('dialog').then(async dialog => {
    expect(dialog.type()).toBe('confirm');
    expect(dialog.message()).toBe('Reset all settings to their defaults on this device?');
    await dialog.accept();
  });
  await page.getByRole('button', { name: 'Reset all settings' }).click();
  await acceptedResetPrompt;
  await expect(page.locator('#settingsStatus')).toHaveText('All settings have been reset to their defaults.');
  await expect.poll(() => page.locator('#settingsStatus').evaluate(status => globalThis.getComputedStyle(status).textAlign)).toBe('center');
  await expect.poll(() => page.evaluate(async () => ({
    preferences: localStorage.getItem('cnsl_preferences'),
    local: Object.fromEntries(globalThis.APP_LOCAL_STORAGE_KEYS
      .filter(key => key !== globalThis.PREFERENCES_STORAGE_KEY)
      .map(key => [key, localStorage.getItem(key)])),
    unrelatedLocal: localStorage.getItem('unrelated_local_key'),
    session: Object.fromEntries(globalThis.APP_SESSION_STORAGE_KEYS
      .map(key => [key, sessionStorage.getItem(key)])),
    unrelatedSession: sessionStorage.getItem('unrelated_session_key'),
    caches: await globalThis.caches.keys()
  }))).toMatchObject({
    preferences: null,
    local: preservedState.local,
    unrelatedLocal: 'saved',
    session: preservedState.session,
    unrelatedSession: 'saved',
    caches: expect.arrayContaining(['cnsl-static-test-reset', 'unrelated-cache'])
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => globalThis.recordedAnalyticsEvents
    .filter(eventArguments => eventArguments[1] === 'ca_version').length)).toBe(preservedState.versionEventCount);
  await expect(page.getByLabel('First Splash')).toBeChecked();
  await expect(page.getByLabel('8 and under')).toBeChecked();
  await expect.poll(() => page.evaluate(() => globalThis.recordedAnalyticsEvents.filter(eventArguments => eventArguments[1] === 'ca_setting_change'))).toEqual([
    ['event', 'ca_setting_change', { setting_name: 'theme' }],
    ['event', 'ca_setting_change', { setting_name: 'pool_schedule_layout' }],
    ['event', 'ca_setting_change', { setting_name: 'location_awareness' }],
    ['event', 'ca_setting_change', { setting_name: 'weather_refresh_minutes' }],
    ['event', 'ca_setting_change', { setting_name: 'practice_groups' }],
    ['event', 'ca_setting_change', { setting_name: 'practice_groups' }],
    ['event', 'ca_setting_change', { setting_name: 'favorite_pool', selection: favoritePoolOption.label }],
    ['event', 'ca_setting_change', { setting_name: 'favorite_team', selection: favoriteTeamOption.label }],
    ['event', 'ca_setting_change', { setting_name: 'favorite_pool', selection: 'none' }],
    ['event', 'ca_setting_change', { setting_name: 'theme' }],
    ['event', 'ca_setting_change', { setting_name: 'pool_schedule_layout' }],
    ['event', 'ca_setting_change', { setting_name: 'location_awareness' }],
    ['event', 'ca_setting_change', { setting_name: 'weather_refresh_minutes' }],
    ['event', 'ca_setting_change', { setting_name: 'practice_groups' }],
    ['event', 'ca_setting_change', { setting_name: 'favorite_team', selection: 'none' }]
  ]);
});

test('[WF-SETTINGS-011] experimental features are collapsed, tracked, and gated by device opt-in', async ({ page }) => {
  await initializeAnalyticsRecorder(page);
  await page.goto('/settings.html');

  const experiments = page.locator('#experimentalFeatures');
  const enabledCount = page.locator('#experimentalFeaturesCount');
  const featureOptions = experiments.locator('input[name="experimentalFeatures"]');
  const featureCount = await featureOptions.count();
  expect(featureCount).toBeGreaterThan(0);
  await expect(experiments).not.toHaveAttribute('open', '');
  await expect(enabledCount).toHaveText(`0/${featureCount} enabled`);
  await expect(page.getByText('Experimental features may change or provide incomplete information.', { exact: false })).toBeHidden();
  await experiments.locator('summary').click();
  await expect(page.getByText('Please do not rely on them as your only source, and validate all information with your team and official sources.', { exact: false })).toBeVisible();
  await expect(featureOptions).toHaveCount(featureCount);
  await expect(experiments.getByText('My Meet Day', { exact: true })).toBeVisible();
  await expect(experiments.locator('.settings-experiment__description')).toHaveText("See personalized details for your favorite team's next meet, including key times and host-pool guidance when available.");
  const disclaimer = experiments.locator('.settings-experiments__disclaimer');
  await expect(disclaimer).toHaveCSS('font-style', 'italic');
  await expect.poll(() => disclaimer.evaluate(element => ({
    followsOptions: element.previousElementSibling?.classList.contains('settings-experiments__options'),
    fontSize: Number.parseFloat(globalThis.getComputedStyle(element).fontSize)
  }))).toEqual({ followsOptions: true, fontSize: 13.12 });

  const meetDaySwitch = page.getByLabel('Enable My Meet Day');
  await expect(meetDaySwitch).not.toBeChecked();
  await meetDaySwitch.check();
  await expect(meetDaySwitch).toBeChecked();
  await expect(experiments.locator('.settings-switch__state')).toHaveText('On');
  await expect(enabledCount).toHaveText(`1/${featureCount} enabled`);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('cnsl_preferences')).experimentalFeatures)).toEqual(['my-meet-day']);
  await expect.poll(() => page.evaluate(() => globalThis.recordedAnalyticsEvents.filter(eventArguments => eventArguments[1] === 'ca_experimental_feature_change'))).toEqual([
    ['event', 'ca_experimental_feature_change', { feature_action: 'enabled', feature_name: 'my-meet-day' }]
  ]);

  await page.getByRole('button', { name: 'Close settings' }).click();
  await page.getByRole('button', { name: 'Open navigation menu' }).click();
  const meetDayLink = page.getByRole('link', { name: /My Meet Day/ });
  await expect(meetDayLink).toBeVisible();
  await expect(meetDayLink.locator('.experimental-badge')).toHaveText('Experimental');
  const meetDayNavLayout = await meetDayLink.evaluate(link => {
    const badgeBounds = link.querySelector('.experimental-badge').getBoundingClientRect();
    const iconBounds = link.querySelector('.nav-menu__icon').getBoundingClientRect();
    const labelBounds = link.querySelector('.nav-menu__item-label').getBoundingClientRect();

    return {
      badgeLeft: badgeBounds.left,
      badgeTop: badgeBounds.top,
      iconRight: iconBounds.right,
      labelBottom: labelBounds.bottom,
      labelLeft: labelBounds.left
    };
  });
  expect(meetDayNavLayout.badgeLeft).toBeCloseTo(meetDayNavLayout.labelLeft, 0);
  expect(meetDayNavLayout.badgeTop).toBeGreaterThanOrEqual(meetDayNavLayout.labelBottom);
  expect(meetDayNavLayout.badgeLeft).toBeGreaterThan(meetDayNavLayout.iconRight);

  await page.goto('/settings.html');
  await experiments.locator('summary').click();
  await page.getByLabel('Enable My Meet Day').uncheck();
  await expect(experiments.locator('.settings-switch__state')).toHaveText('Off');
  await expect(enabledCount).toHaveText(`0/${featureCount} enabled`);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('cnsl_preferences')).experimentalFeatures)).toEqual([]);
  await expect.poll(() => page.evaluate(() => globalThis.recordedAnalyticsEvents.filter(eventArguments => eventArguments[1] === 'ca_experimental_feature_change'))).toEqual([
    ['event', 'ca_experimental_feature_change', { feature_action: 'enabled', feature_name: 'my-meet-day' }],
    ['event', 'ca_experimental_feature_change', { feature_action: 'disabled', feature_name: 'my-meet-day' }]
  ]);
});

test('[WF-SETTINGS-004] system theme follows OS color scheme changes while explicit dark remains dark', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/settings.html');
  const root = page.locator('html');

  await expect(root).toHaveAttribute('data-theme', 'system');
  await expect(root).toHaveAttribute('data-color-scheme', 'dark');
  await expect.poll(() => root.evaluate(element => globalThis.getComputedStyle(element).getPropertyValue('--light-bg').trim())).toBe('#101820');
  const darkHeaderColor = await page.locator('#favoriteSettings > summary').evaluate(summary => globalThis.getComputedStyle(summary).backgroundColor);

  await page.emulateMedia({ colorScheme: 'light' });
  await expect(root).toHaveAttribute('data-color-scheme', 'light');
  await expect.poll(() => page.locator('#favoriteSettings > summary').evaluate(summary => globalThis.getComputedStyle(summary).backgroundColor)).not.toBe(darkHeaderColor);

  await page.locator('#accessibilitySettings summary').click();
  await page.getByLabel('Dark').check();
  await expect(root).toHaveAttribute('data-theme', 'dark');
  await expect(root).toHaveAttribute('data-color-scheme', 'dark');
});

test('[WF-SETTINGS-008] accessibility settings apply immediately, persist locally, and report categories only', async ({ page }) => {
  await initializeAnalyticsRecorder(page);
  await page.goto('/settings.html');
  const root = page.locator('html');
  const accessibilitySettings = page.locator('#accessibilitySettings');

  await expect(accessibilitySettings).not.toHaveAttribute('open', '');
  await accessibilitySettings.locator('summary').click();

  await expect(page.getByLabel('Default', { exact: true })).toBeChecked();
  await expect(page.getByRole('radiogroup', { name: 'Contrast' }).getByLabel('Device default')).toBeChecked();
  await expect(page.getByRole('radiogroup', { name: 'Motion' }).getByLabel('Device default')).toBeChecked();
  await expect(page.getByLabel('Underline text links')).not.toBeChecked();

  await page.getByLabel('Extra large').check();
  await page.getByRole('radiogroup', { name: 'Contrast' }).getByLabel('High').check();
  await page.getByRole('radiogroup', { name: 'Motion' }).getByLabel('Reduced').check();
  await page.getByLabel('Underline text links').check();

  await expect(root).toHaveAttribute('data-text-size', 'extra-large');
  await expect(root).toHaveAttribute('data-contrast', 'high');
  await expect(root).toHaveAttribute('data-contrast-mode', 'high');
  await expect(root).toHaveAttribute('data-motion', 'reduced');
  await expect(root).toHaveAttribute('data-motion-mode', 'reduced');
  await expect(root).toHaveAttribute('data-underline-links', 'true');
  await expect(root).toHaveCSS('font-size', '20px');
  await page.locator('#poolVisitSettings summary').click();
  await expect(page.getByRole('link', { name: 'View weather source details.' })).toHaveCSS('text-decoration-line', 'underline');
  await expect.poll(() => page.locator('.settings-segmented label').first().evaluate(element => parseFloat(globalThis.getComputedStyle(element).transitionDuration))).toBeLessThanOrEqual(0.001);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('cnsl_preferences')))).toMatchObject({
    textSize: 'extra-large',
    contrast: 'high',
    motion: 'reduced',
    underlineLinks: true
  });
  await expect.poll(() => page.evaluate(() => globalThis.recordedAnalyticsEvents.filter(eventArguments => eventArguments[1] === 'ca_setting_change'))).toEqual([
    ['event', 'ca_setting_change', { setting_name: 'text_size' }],
    ['event', 'ca_setting_change', { setting_name: 'contrast' }],
    ['event', 'ca_setting_change', { setting_name: 'motion' }],
    ['event', 'ca_setting_change', { setting_name: 'underline_links' }]
  ]);

  await page.reload();
  await expect(accessibilitySettings).not.toHaveAttribute('open', '');
  await accessibilitySettings.locator('summary').click();
  await expect(page.getByLabel('Extra large')).toBeChecked();
  await expect(page.getByRole('radiogroup', { name: 'Contrast' }).getByLabel('High')).toBeChecked();
  await expect(page.getByRole('radiogroup', { name: 'Motion' }).getByLabel('Reduced')).toBeChecked();
  await expect(page.getByLabel('Underline text links')).toBeChecked();
  await expect(root).toHaveAttribute('data-text-size', 'extra-large');
});

test('[WF-SETTINGS-015] page content preferences hide visual introductions while preserving semantic headings', async ({ page }) => {
  await initializeAnalyticsRecorder(page);
  await page.goto('/settings.html');
  const root = page.locator('html');
  const accessibilitySettings = page.locator('#accessibilitySettings');

  await accessibilitySettings.locator('summary').click();
  await expect(page.getByLabel('Hide the welcome and season introduction on Home')).not.toBeChecked();
  await expect(page.getByLabel('Hide headings at the top of individual pages')).not.toBeChecked();

  await page.getByLabel('Hide the welcome and season introduction on Home').focus();
  await page.getByLabel('Hide the welcome and season introduction on Home').press('Space');
  await page.getByLabel('Hide headings at the top of individual pages').check();
  await expect(root).toHaveAttribute('data-hide-home-intro', 'true');
  await expect(root).toHaveAttribute('data-hide-page-headings', 'true');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('cnsl_preferences')))).toMatchObject({
    hideHomeIntro: true,
    hidePageHeadings: true
  });
  await expect.poll(() => page.evaluate(() => globalThis.recordedAnalyticsEvents.filter(eventArguments => eventArguments[1] === 'ca_setting_change'))).toEqual([
    ['event', 'ca_setting_change', { setting_name: 'hide_home_intro' }],
    ['event', 'ca_setting_change', { setting_name: 'hide_page_headings' }]
  ]);

  const settingsHeading = page.getByRole('heading', { level: 1, name: 'Settings' });
  await expect(settingsHeading).toHaveCount(1);
  await expect.poll(() => settingsHeading.evaluate(heading => {
    const styles = globalThis.getComputedStyle(heading);
    return { clip: styles.clip, height: styles.height, position: styles.position, width: styles.width };
  })).toEqual({ clip: 'rect(0px, 0px, 0px, 0px)', height: '1px', position: 'absolute', width: '1px' });

  await page.goto('/index.html');
  await expect(page.getByRole('heading', { level: 1, name: 'CA Outdoor Pools & CNSL Swim Teams' })).toHaveCount(1);
  await expect(page.locator('.welcome-message')).toBeHidden();
  await expect(page.locator('.season-text')).toBeHidden();
  await expect(page.getByRole('link', { name: /Pool Season/ })).toBeVisible();

  await page.goto('/pools.html');
  const poolsHeading = page.getByRole('heading', { level: 1, name: 'Pools & Hours' });
  await expect(poolsHeading).toHaveCount(1);
  await expect.poll(() => poolsHeading.evaluate(heading => globalThis.getComputedStyle(heading).position)).toBe('absolute');

  await page.goto('/settings.html');
  await page.locator('#maintenanceSettings summary').click();
  const acceptedResetPrompt = page.waitForEvent('dialog').then(dialog => dialog.accept());
  await page.getByRole('button', { name: 'Reset all settings' }).click();
  await acceptedResetPrompt;
  await expect(root).toHaveAttribute('data-hide-home-intro', 'false');
  await expect(root).toHaveAttribute('data-hide-page-headings', 'false');
  await page.locator('#accessibilitySettings summary').click();
  await expect(page.getByLabel('Hide the welcome and season introduction on Home')).not.toBeChecked();
  await expect(page.getByLabel('Hide headings at the top of individual pages')).not.toBeChecked();
});

test('[WF-SETTINGS-009] device contrast, reduced motion, and forced colors update effective accessibility modes', async ({ page }) => {
  await page.emulateMedia({ contrast: 'more', reducedMotion: 'reduce' });
  await page.goto('/settings.html');
  const root = page.locator('html');

  await expect(root).toHaveAttribute('data-contrast', 'system');
  await expect(root).toHaveAttribute('data-contrast-mode', 'high');
  await expect(root).toHaveAttribute('data-motion', 'system');
  await expect(root).toHaveAttribute('data-motion-mode', 'reduced');

  await page.emulateMedia({ contrast: 'no-preference', reducedMotion: 'no-preference' });
  await expect(root).toHaveAttribute('data-contrast-mode', 'default');
  await expect(root).toHaveAttribute('data-motion-mode', 'default');

  await page.emulateMedia({ forcedColors: 'active' });
  await expect(root).toHaveAttribute('data-contrast-mode', 'high');
  await page.locator('#poolVisitSettings summary').click();
  await expect(page.getByRole('link', { name: 'View weather source details.' })).toHaveCSS('text-decoration-line', 'underline');
});

test('[WF-SETTINGS-010] extra-large text reflows without page-level horizontal overflow', async ({ page }) => {
  await page.setViewportSize(MOBILE_VIEWPORT);
  await seedPreferences(page, { textSize: 'extra-large' });

  for (const path of ['/index.html', '/pools.html', '/teams.html', '/meets.html', '/settings.html']) {
    await page.goto(path);
    await expect(page.locator('html')).toHaveAttribute('data-text-size', 'extra-large');
    await expect.poll(() => page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth)).toBe(true);
  }
});

test('[WF-SETTINGS-005] weather safety alerts show the most recent check after updates are turned off', async ({ page }) => {
  await seedPreferences(page, { weatherRefreshMinutes: 0 });
  await page.addInitScript(updatedAt => {
    localStorage.setItem('cnsl_weather_alert_last_successful_check', JSON.stringify({ updatedAt }));
  }, WEATHER_CHECKED_AT);
  await page.goto('/settings.html');
  await page.locator('#poolVisitSettings summary').click();

  const weatherCheckStatus = page.locator('#weatherCheckStatus');
  await expect(weatherCheckStatus).toHaveText(`Most recent successful weather check: ${WEATHER_CHECKED_LABEL}. Weather safety alerts are currently off.`);
  await expect(weatherCheckStatus.locator('time')).toHaveAttribute('datetime', WEATHER_CHECKED_AT);
  await expect(weatherCheckStatus.locator('time')).toHaveCSS('display', 'block');
  await expect(weatherCheckStatus).toHaveCSS('border-left-style', 'solid');
});

test('[WF-SETTINGS-006] weather safety alerts retain the last successful check when the weather service is unavailable', async ({ page }) => {
  await page.unroute('https://api.weather.gov/**');
  await page.route('https://api.weather.gov/**', route => route.abort());
  await page.addInitScript(updatedAt => {
    localStorage.setItem('cnsl_weather_alert_last_successful_check', JSON.stringify({ updatedAt }));
  }, WEATHER_CHECKED_AT);
  await page.goto('/settings.html');
  await page.locator('#poolVisitSettings summary').click();
  await page.evaluate(async year => {
    const poolData = { pools: [{ schedules: [{
      startDate: `${year}-01-01`,
      endDate: `${year}-12-31`,
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
  }, ACTIVE_SEASON_YEAR);

  const weatherCheckStatus = page.locator('#weatherCheckStatus');
  await expect(weatherCheckStatus).toHaveText(`Weather service is temporarily unavailable. Most recent successful weather check: ${WEATHER_CHECKED_LABEL}`);
  await expect(weatherCheckStatus.locator('time')).toHaveAttribute('datetime', WEATHER_CHECKED_AT);
  await expect(page.locator('#weatherAlert')).toBeHidden();
});

test('[WF-SETTINGS-007] weather source details expose fixed Columbia-area National Weather Service requests in a new tab', async ({ page }) => {
  await page.goto('/settings.html');
  await page.locator('#poolVisitSettings summary').click();
  const sourceDetailsLink = page.getByRole('link', { name: 'View weather source details.' });

  await expect(sourceDetailsLink).toHaveAttribute('href', 'faq.html#weather-safety-location');
  await expect(sourceDetailsLink).toHaveAttribute('target', '_blank');
  await expect(sourceDetailsLink).toHaveAttribute('rel', 'noopener');

  await page.goto('/faq.html#weather-safety-location');
  const weatherDetails = page.locator('#weather-safety-location');
  const nwsLinks = weatherDetails.getByRole('link');

  await expect(weatherDetails).toContainText('does not track, save, or send your location');
  await expect(nwsLinks.nth(0)).toHaveText('Active weather alerts (data only)');
  await expect(nwsLinks.nth(1)).toHaveText('Local forecast information (data only)');
  await expect(nwsLinks.nth(2)).toHaveText('Local weather information (web)');
  await expect(nwsLinks.nth(0)).toHaveAttribute('href', 'https://api.weather.gov/alerts/active?point=39.2014%2C-76.8610');
  await expect(nwsLinks.nth(1)).toHaveAttribute('href', 'https://api.weather.gov/points/39.2014,-76.8610');
  await expect(nwsLinks.nth(2)).toHaveAttribute('href', 'https://forecast.weather.gov/MapClick.php?lat=39.2014&lon=-76.8610');
  await expect(nwsLinks.nth(0)).toHaveAttribute('target', '_blank');
  await expect(nwsLinks.nth(1)).toHaveAttribute('target', '_blank');
  await expect(nwsLinks.nth(2)).toHaveAttribute('target', '_blank');
  await expect(nwsLinks.nth(0)).toHaveAttribute('rel', 'noopener');
  await expect(nwsLinks.nth(1)).toHaveAttribute('rel', 'noopener');
  await expect(nwsLinks.nth(2)).toHaveAttribute('rel', 'noopener');
  await page.setViewportSize(MOBILE_VIEWPORT);
  await expect(weatherDetails.locator('ul')).toHaveCSS('padding-left', '24px');
});
