const { test, expect } = require('../browser-test');
const AppConfig = require('../../../scripts/adapters/app-config.js');
const {
  AUDIENCE_VIEWPORTS,
  MOBILE_VIEWPORT,
  prepareStableWeatherResponses
} = require('../browser-test-helpers');

const attentionNoticeVisibleAt = new Date(
  (Date.parse(AppConfig.APP_ATTENTION_NOTICE.UPDATED_AT) + Date.parse(AppConfig.APP_ATTENTION_NOTICE.EXPIRES_AT)) / 2
);

test.beforeEach(async ({ page }) => {
  await prepareStableWeatherResponses(page);
});

test('[WF-LAYOUT-001] mobile pages retain the shared viewport gutter', async ({ page }) => {
  await page.setViewportSize(MOBILE_VIEWPORT);
  await page.goto('/swim-meet-resources.html');

  await expect(page.locator('#mainContent')).toHaveCSS('padding-left', '12px');
  await expect(page.locator('#mainContent')).toHaveCSS('padding-right', '12px');
});

for (const [viewportName, viewport] of Object.entries(AUDIENCE_VIEWPORTS)) {
  test(`[WF-LAYOUT-006-${viewportName}] shared layout remains contained at the ${viewportName.toLowerCase().replaceAll('_', ' ')} viewport`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/swim-meet-resources.html');

    await expect.poll(() => page.evaluate(() => {
      const visibleRegions = [
        globalThis.document.querySelector('.header'),
        globalThis.document.getElementById('mainContent'),
        globalThis.document.querySelector('footer')
      ].filter(region => region?.getClientRects().length > 0);

      return {
        documentContained: globalThis.document.documentElement.scrollWidth <= globalThis.document.documentElement.clientWidth,
        regionsContained: visibleRegions.every(region => {
          const bounds = region.getBoundingClientRect();
          return bounds.left >= 0 && bounds.right <= globalThis.innerWidth;
        })
      };
    })).toEqual({ documentContained: true, regionsContained: true });
  });
}

test('[WF-LAYOUT-005] mobile directory page titles remain compact', async ({ page }) => {
  await page.setViewportSize(MOBILE_VIEWPORT);

  for (const { path, title } of [
    { path: '/pools.html', title: 'Pools & Hours' },
    { path: '/teams.html', title: 'Swim Teams' }
  ]) {
    await page.goto(path);
    const heading = page.getByRole('heading', { level: 1, name: title });
    await expect(heading).toBeVisible();
    await expect.poll(() => heading.evaluate(element => {
      const styles = globalThis.getComputedStyle(element);
      return {
        fontSize: Number.parseFloat(styles.fontSize),
        singleLine: element.getBoundingClientRect().height <= Number.parseFloat(styles.lineHeight) + 0.5
      };
    })).toEqual({ fontSize: 24, singleLine: true });
  }
});

test('[WF-LAYOUT-002] shared attention notice appears directly below the header', async ({ page }) => {
  await page.clock.setFixedTime(attentionNoticeVisibleAt);
  await page.setViewportSize(MOBILE_VIEWPORT);
  await page.goto('/pools.html');

  const notice = page.getByRole('alert', { name: 'Pool status notice' });
  const timestamp = notice.locator('time');

  await expect(notice).toBeVisible();
  await expect(notice).not.toContainText('Attention');
  await expect(notice).toContainText(AppConfig.APP_ATTENTION_NOTICE.MESSAGE);
  await expect(timestamp).toHaveAttribute('datetime', AppConfig.APP_ATTENTION_NOTICE.UPDATED_AT);
  await expect(timestamp).toHaveText(AppConfig.APP_ATTENTION_NOTICE.UPDATED_LABEL);

  const positions = await page.locator('.header, #attentionBanner').evaluateAll(elements => elements.map(element => element.getBoundingClientRect()));
  expect(Math.round(positions[1].top)).toBe(Math.round(positions[0].bottom));

  const closeButton = page.getByRole('button', { name: 'Dismiss attention notice' });
  await expect(closeButton).toBeVisible();
  await closeButton.focus();
  await expect(closeButton).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(notice).toBeHidden();
  await expect.poll(() => page.evaluate(() => localStorage.getItem(globalThis.APP_ATTENTION_NOTICE_DISMISSED_STORAGE_KEY)))
    .toBe(AppConfig.APP_ATTENTION_NOTICE.UPDATED_AT);

  await page.reload();
  await expect(notice).toBeHidden();
});

test('[WF-LAYOUT-003] non-dismissible attention notice remains visible without a close control', async ({ page }) => {
  await page.clock.setFixedTime(attentionNoticeVisibleAt);
  await page.route('**/js/config/app-config.js*', async route => {
    const response = await route.fetch();
    const body = (await response.text()).replace('DISMISSIBLE: true', 'DISMISSIBLE: false');
    await route.fulfill({ response, body });
  });
  await page.addInitScript(({ storageKey, updatedAt }) => localStorage.setItem(storageKey, updatedAt), {
    storageKey: AppConfig.APP_ATTENTION_NOTICE_DISMISSED_STORAGE_KEY,
    updatedAt: AppConfig.APP_ATTENTION_NOTICE.UPDATED_AT
  });
  await page.goto('/pools.html');

  await expect(page.locator('#attentionBanner')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Dismiss attention notice' })).toBeHidden();
});

test('[WF-LAYOUT-004] attention notice expires at the configured Eastern deadline', async ({ page }) => {
  const expiryLeadMilliseconds = 30000;
  const beforeExpiration = new Date(AppConfig.APP_ATTENTION_NOTICE.EXPIRES_AT);
  beforeExpiration.setTime(beforeExpiration.getTime() - expiryLeadMilliseconds);
  await page.clock.install({ time: beforeExpiration });
  await page.goto('/pools.html');

  const notice = page.locator('#attentionBanner');
  await expect(notice).toBeVisible();

  await page.clock.fastForward(expiryLeadMilliseconds + 1);
  await expect(notice).toBeHidden();

  await page.reload();
  await expect(notice).toBeHidden();
});
