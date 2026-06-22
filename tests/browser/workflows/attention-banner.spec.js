const { test, expect } = require('../browser-test');
const AxeBuilder = require('@axe-core/playwright').default;
const {
  ACTIVE_SEASON_YEAR,
  MOBILE_VIEWPORT,
  activeSeasonDate,
  initializeAnalyticsRecorder,
  prepareStableWeatherResponses,
  seedPreferences
} = require('../browser-test-helpers');

const ATTENTION_BANNER_NAME = 'attention_notice';
const ATTENTION_DISMISSED_STORAGE_KEY = 'cnsl_attention_notice_dismissed';
const NOTICE_REFERENCE_TIME = activeSeasonDate('06-22T10:00:00-04:00');
const NOTICE_UPDATED_AT = activeSeasonDate('06-22T09:00:00-04:00').toISOString();
const NOTICE_UPDATED_LABEL = `June 22, ${ACTIVE_SEASON_YEAR} at 9:00 AM`;
const NOTICE_EXPIRES_AT = activeSeasonDate('06-22T10:01:00-04:00').toISOString();
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

test.setTimeout(90000);

/**
 * Publishes a fixture-owned attention notice through the runtime configuration script.
 * @param {import('@playwright/test').Page} page - Browser page
 * @param {Object} overrides - Attention notice property overrides
 * @returns {Promise<void>} Promise settled when the route is installed
 */
async function configureAttentionNotice(page, overrides = {}) {
  const config = {
    DISMISSIBLE: true,
    EXPIRES_AT: NOTICE_EXPIRES_AT,
    MESSAGE: 'Fixture-owned important notice',
    UPDATED_AT: NOTICE_UPDATED_AT,
    UPDATED_LABEL: NOTICE_UPDATED_LABEL,
    ...overrides
  };
  await page.route('**/js/config/app-config.js*', async route => {
    const response = await route.fetch();
    const source = await response.text();
    const declarationPattern = /const APP_ATTENTION_NOTICE = null;/;
    if (!declarationPattern.test(source)) throw new Error('Attention notice configuration seam was not found.');
    const configuredSource = source.replace(
      declarationPattern,
      `const APP_ATTENTION_NOTICE = Object.freeze(${JSON.stringify(config)});`
    );
    await route.fulfill({ response, body: configuredSource });
  });
}

/**
 * Verifies the rendered page against the supported WCAG A and AA axe rules.
 * @param {import('@playwright/test').Page} page - Browser page
 * @returns {Promise<void>} Promise settled after assertions complete
 */
async function expectNoAccessibilityViolations(page) {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  expect(results.violations.map(violation => ({
    id: violation.id,
    impact: violation.impact,
    targets: violation.nodes.map(node => node.target)
  }))).toEqual([]);
}

test.beforeEach(async ({ page }) => {
  await prepareStableWeatherResponses(page);
});

test('[WF-ATTENTION-001] attention banner remains dormant without an active notice', async ({ page }) => {
  await page.goto('/pools.html');

  await expect(page.getByRole('alert', { name: 'Important notice' })).toBeHidden();
  await expect(page.locator('#attentionBannerMessage')).toBeEmpty();
});

test('[WF-ATTENTION-002] configured attention banner is safe, dismissible, and revision-scoped', async ({ page }) => {
  const fixtureMessage = 'Important <img src=x onerror="globalThis.compromised=true"> notice';
  await initializeAnalyticsRecorder(page);
  await page.clock.setFixedTime(NOTICE_REFERENCE_TIME);
  await configureAttentionNotice(page, { MESSAGE: fixtureMessage });
  await page.setViewportSize(MOBILE_VIEWPORT);
  await page.goto('/pools.html');

  const notice = page.getByRole('alert', { name: 'Important notice' });
  const timestamp = notice.locator('time');
  await expect(notice).toBeVisible();
  await expect(notice.locator('#attentionBannerMessage')).toHaveText(fixtureMessage);
  await expect(notice.locator('img')).toHaveCount(0);
  await expect(timestamp).toHaveAttribute('datetime', NOTICE_UPDATED_AT);
  await expect(timestamp).toHaveText(NOTICE_UPDATED_LABEL);
  expect(await page.evaluate(() => globalThis.compromised)).toBeUndefined();

  const positions = await page.locator('.header, #attentionBanner').evaluateAll(elements => (
    elements.map(element => element.getBoundingClientRect())
  ));
  expect(Math.round(positions[1].top)).toBe(Math.round(positions[0].bottom));

  const closeButton = page.getByRole('button', { name: 'Dismiss important notice' });
  await closeButton.focus();
  await expect(closeButton).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(notice).toBeHidden();
  await expect.poll(() => page.evaluate(() => (
    localStorage.getItem(globalThis.APP_ATTENTION_NOTICE_DISMISSED_STORAGE_KEY)
  ))).toBe(NOTICE_UPDATED_AT);
  await expect.poll(() => page.evaluate(bannerName => globalThis.recordedAnalyticsEvents.filter(eventArguments => (
    eventArguments[1] === 'ca_banner_interaction'
      && eventArguments[2].banner_name === bannerName
  )), ATTENTION_BANNER_NAME)).toEqual([
    ['event', 'ca_banner_interaction', { banner_name: ATTENTION_BANNER_NAME, banner_action: 'dismiss' }]
  ]);

  await page.reload();
  await expect(notice).toBeHidden();
});

test('[WF-ATTENTION-003] non-dismissible attention banner ignores a prior revision dismissal', async ({ page }) => {
  await page.clock.setFixedTime(NOTICE_REFERENCE_TIME);
  await configureAttentionNotice(page, { DISMISSIBLE: false });
  await page.addInitScript(({ storageKey, updatedAt }) => globalThis.localStorage.setItem(storageKey, updatedAt), {
    storageKey: ATTENTION_DISMISSED_STORAGE_KEY,
    updatedAt: NOTICE_UPDATED_AT
  });
  await page.goto('/pools.html');

  await expect(page.getByRole('alert', { name: 'Important notice' })).toBeVisible();
  await expect(page.locator('#closeAttentionBanner')).toBeHidden();
});

test('[WF-ATTENTION-004] attention banner hides at its configured deadline', async ({ page }) => {
  await page.clock.install({ time: NOTICE_REFERENCE_TIME });
  await configureAttentionNotice(page);
  await page.goto('/pools.html');

  const notice = page.getByRole('alert', { name: 'Important notice' });
  await expect(notice).toBeVisible();
  await page.clock.fastForward(60001);
  await expect(notice).toBeHidden();

  await page.reload();
  await expect(notice).toBeHidden();
});

for (const { contrast, reference, theme } of [
  { contrast: 'standard', reference: 'LIGHT', theme: 'light' },
  { contrast: 'standard', reference: 'DARK', theme: 'dark' },
  { contrast: 'high', reference: 'LIGHT-HIGH-CONTRAST', theme: 'light' },
  { contrast: 'high', reference: 'DARK-HIGH-CONTRAST', theme: 'dark' }
]) {
  test(`[AX-ATTENTION-001-${reference}] visible attention banner passes WCAG in ${reference.toLowerCase()}`, async ({ page }) => {
    await page.clock.setFixedTime(NOTICE_REFERENCE_TIME);
    await configureAttentionNotice(page);
    await seedPreferences(page, { contrast, theme });
    await page.goto('/pools.html');

    const notice = page.getByRole('alert', { name: 'Important notice' });
    await expect(notice).toBeVisible();
    await page.getByRole('button', { name: 'Dismiss important notice' }).focus();
    await expectNoAccessibilityViolations(page);
  });
}
