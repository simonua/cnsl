const { test, expect } = require('../browser-test');
const {
  AUDIENCE_VIEWPORTS,
  MOBILE_VIEWPORT,
  prepareStableWeatherResponses
} = require('../browser-test-helpers');

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
