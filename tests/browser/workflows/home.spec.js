const { test, expect } = require('../browser-test');
const AppConfig = require('../../../scripts/adapters/app-config.js');
const {
  MOBILE_VIEWPORT,
  initializeAnalyticsRecorder,
  prepareStableWeatherResponses,
  readAnnualData
} = require('../browser-test-helpers');

const { seasonEndDate, seasonStartDate } = readAnnualData('pools');
const seasonDateFormatter = new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'long', timeZone: AppConfig.APP_TIMEZONE });
const seasonStartLabel = seasonDateFormatter.format(new Date(`${seasonStartDate}T12:00:00-04:00`));
const seasonEndLabel = seasonDateFormatter.format(new Date(`${seasonEndDate}T12:00:00-04:00`));

test.beforeEach(async ({ page }) => {
  await prepareStableWeatherResponses(page);
});

test('[WF-HOME-001] season summary and sharing actions appear only on the home page', async ({ page }) => {
  await initializeAnalyticsRecorder(page);
  await page.goto('/');

  await expect(page.locator('.season-text')).toHaveText(`The ${AppConfig.YEAR} season runs from ${seasonStartLabel} to ${seasonEndLabel}.`);
  await expect(page.getByRole('link', { name: `CA's ${AppConfig.YEAR} Pool Season` })).toBeVisible();
  await expect(page.getByRole('button', { name: 'QR Code' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Text' })).toHaveAttribute('href', AppConfig.EXTERNAL_LINKS.SMS_SHARE);
  await expect(page.getByRole('link', { name: 'Email' })).toHaveAttribute('href', AppConfig.EXTERNAL_LINKS.EMAIL_SHARE);
  await expect(page.getByRole('link', { name: 'Facebook (opens in new tab)' })).toHaveAttribute('href', AppConfig.EXTERNAL_LINKS.FACEBOOK_SHARE);
  await expect(page.locator('[data-analytics-share-method="x"]')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Send Feedback' })).toHaveAttribute('href', 'about.html#contact');
  await page.getByRole('link', { name: 'Swim Meets' }).focus();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'QR Code' })).toBeFocused();
  await page.keyboard.press('Enter');
  const qrDialog = page.getByRole('dialog', { name: 'Scan to open site' });
  await expect(qrDialog).toBeVisible();
  await expect(qrDialog.getByRole('img', { name: `QR code for ${AppConfig.HOME_PAGE_URL}` })).toHaveAttribute('src', /assets\/images\/share-site-qr\.svg\?v=/);
  await expect(qrDialog.getByRole('link', { name: AppConfig.HOME_PAGE_URL })).toHaveAttribute('href', `${AppConfig.HOME_PAGE_URL}/`);
  await expect(page.getByRole('button', { name: 'Close QR code' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(qrDialog).toBeHidden();
  await expect(page.getByRole('button', { name: 'QR Code' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Text' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Email' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Facebook (opens in new tab)' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.locator('.share-site__install').getByRole('link', { name: 'Install app' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Send Feedback' })).toBeFocused();

  for (const method of ['text', 'email', 'facebook']) {
    await page.locator(`[data-analytics-share-method="${method}"] .share-site__icon`).evaluate(icon => {
      icon.parentElement.addEventListener('click', event => event.preventDefault(), { once: true });
      icon.dispatchEvent(new globalThis.MouseEvent('click', { bubbles: true, cancelable: true }));
    });
  }
  await expect.poll(() => page.evaluate(() => globalThis.recordedAnalyticsEvents.filter(eventArguments => eventArguments[1] === 'ca_share' || eventArguments[1] === 'ca_external_link'))).toEqual([
    ['event', 'ca_share', { method: 'qr_code', content_type: 'website', item_id: 'home_page' }],
    ['event', 'ca_share', { method: 'text', content_type: 'website', item_id: 'home_page' }],
    ['event', 'ca_share', { method: 'email', content_type: 'website', item_id: 'home_page' }],
    ['event', 'ca_share', { method: 'facebook', content_type: 'website', item_id: 'home_page' }]
  ]);

  await expect.poll(() => page.locator('.share-site__links .share-site__link').evaluateAll(elements => (
    new Set(elements.map(element => Math.round(element.getBoundingClientRect().top))).size
  ))).toBe(1);

  await page.locator('a.directory-link').evaluate(link => {
    link.addEventListener('click', event => event.preventDefault(), { once: true });
    link.dispatchEvent(new globalThis.MouseEvent('click', { bubbles: true, cancelable: true }));
  });
  await expect.poll(() => page.evaluate(() => globalThis.recordedAnalyticsEvents.at(-1))).toEqual(['event', 'ca_external_link', { link_context: 'official_information', link_purpose: 'general', link_destination: 'columbia_association' }]);

  await page.setViewportSize(MOBILE_VIEWPORT);
  const compactLinkLayout = await page.locator('.quick-link-card').evaluateAll(cards => cards
    .filter(card => card.getClientRects().length > 0)
    .map(card => {
      const bounds = card.getBoundingClientRect();
      return { left: bounds.left, top: bounds.top, right: bounds.right, height: bounds.height };
    }));
  expect(new Set(compactLinkLayout.map(card => Math.round(card.top))).size).toBe(1);
  expect(compactLinkLayout.every(card => card.left >= 0 && card.right <= MOBILE_VIEWPORT.width && card.height >= 44 && card.height < 80)).toBe(true);

  const compactShareLayout = await page.locator('.share-site__links .share-site__link').evaluateAll(links => links.map(link => {
    const bounds = link.getBoundingClientRect();
    return { top: bounds.top, right: bounds.right, height: bounds.height };
  }));
  expect(new Set(compactShareLayout.map(link => link.top)).size).toBe(2);
  expect(compactShareLayout.every(link => link.right <= MOBILE_VIEWPORT.width && link.height >= 44)).toBe(true);

  await page.goto('/pools.html');
  await expect(page.locator('.season-text')).toHaveCount(0);
  await expect(page.getByRole('link', { name: `CA's ${AppConfig.YEAR} Pool Season` })).toHaveCount(0);
  await expect(page.locator('.share-site')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Interactive CA Pool Directory' })).toBeVisible();
  await expect.poll(() => page.locator('#poolList, #seasonInfo').evaluateAll(elements => elements.map(element => element.id))).toEqual(['poolList', 'seasonInfo']);
});

test('[WF-HOME-002] home page keeps compact link actions readable on narrow phones', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto('/index.html');

  await expect.poll(() => page.locator('.quick-links-grid .quick-link-card').evaluateAll(elements => {
    const visibleElements = elements.filter(element => element.getClientRects().length > 0);
    const iconDimensions = visibleElements.map(element => {
      const bounds = element.querySelector('.quick-link-icon .icon').getBoundingClientRect();
      return `${bounds.width.toFixed(2)}x${bounds.height.toFixed(2)}`;
    });
    return {
      fits: visibleElements.every(element => {
        const bounds = element.getBoundingClientRect();
        return bounds.left >= 0 && bounds.right <= globalThis.innerWidth && bounds.height >= 44;
      }),
      iconsMatch: new Set(iconDimensions).size === 1,
      labelsFitOneLine: visibleElements.every(element => {
        const label = element.querySelector('.quick-link-label');
        return label.getBoundingClientRect().height <= Number.parseFloat(globalThis.getComputedStyle(label).lineHeight) + 0.5;
      }),
      rows: new Set(visibleElements.map(element => Math.round(element.getBoundingClientRect().top))).size
    };
  })).toEqual({ fits: true, iconsMatch: true, labelsFitOneLine: true, rows: 1 });
  await expect.poll(() => page.locator('.share-site__links .share-site__link').evaluateAll(elements => (
    new Set(elements.map(element => Math.round(element.getBoundingClientRect().top))).size
  ))).toBe(2);
  await expect.poll(() => page.evaluate(() => {
    const qrLabel = globalThis.document.querySelector('#shareQrButton span');
    const shareLinks = [...globalThis.document.querySelectorAll('.share-site__links .share-site__link')];
    const updatedTime = globalThis.document.querySelector('.footer__data-freshness time:last-of-type');
    const lineCount = element => new Set([...element.getClientRects()].map(rect => Math.round(rect.top))).size;

    return {
      shareLinkWidthsMatch: new Set(shareLinks.map(link => link.getBoundingClientRect().width.toFixed(2))).size === 1,
      fitsViewport: globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth,
      qrLabelLines: lineCount(qrLabel),
      updatedDateLines: lineCount(updatedTime)
    };
  })).toEqual({
    shareLinkWidthsMatch: true,
    fitsViewport: true,
    qrLabelLines: 1,
    updatedDateLines: 1
  });

  await page.setViewportSize(MOBILE_VIEWPORT);
  await expect.poll(() => page.locator('.season-text').evaluate(element => (
    element.getBoundingClientRect().height <= Number.parseFloat(globalThis.getComputedStyle(element).lineHeight) + 0.5
  ))).toBe(true);
});
