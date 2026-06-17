const { test, expect } = require('../browser-test');
const {
  initializeAnalyticsRecorder,
  prepareStableWeatherResponses
} = require('../browser-test-helpers');

test.beforeEach(async ({ page }) => {
  await prepareStableWeatherResponses(page);
});

test('[WF-LESSONS-001] lesson provider actions publish only reviewed categories', async ({ page }) => {
  await initializeAnalyticsRecorder(page);
  await page.goto('/lessons.html');
  await expect(page.locator('#lessonProviderStatus')).toHaveText(/^\d+ lesson providers? listed\.$/);
  expect(await page.locator('.lesson-provider-card').count()).toBeGreaterThan(0);
  const caCard = page.locator('.lesson-provider-card--featured');
  await expect(caCard.getByRole('heading').first()).toBeVisible();
  expect(await caCard.locator('.lesson-provider-card__outdoor-option').count()).toBeGreaterThan(0);
  await expect(page.getByRole('heading', { name: 'Class types' })).toBeVisible();
  const publishedDestinations = await page.locator('.lesson-provider-card a[href]').evaluateAll(links => links.map(link => link.href));
  expect(publishedDestinations.length).toBeGreaterThan(0);
  expect(publishedDestinations.every(destination => ['http:', 'https:', 'mailto:', 'tel:'].includes(new URL(destination).protocol))).toBe(true);
  expect(await page.locator('.lesson-provider-card__logo img').count()).toBeGreaterThan(0);
  await expect(page.getByText('Service area:', { exact: false })).toHaveCount(0);
  const cardLayout = await page.locator('.lesson-provider-card').evaluateAll(cards => cards.map(card => {
    const bounds = card.getBoundingClientRect();
    const logoBounds = card.querySelector('.lesson-provider-card__logo').getBoundingClientRect();
    return { width: bounds.width, height: bounds.height, logoHeight: logoBounds.height };
  }));
  expect(cardLayout[0].width).toBeLessThanOrEqual(832);
  expect(cardLayout.slice(1).every(card => card.width <= 448)).toBe(true);
  expect(cardLayout.every(card => card.height >= 512)).toBe(true);
  expect(new Set(cardLayout.map(card => Math.round(card.logoHeight))).size).toBe(1);

  const lessonInformationLink = page.locator('[data-analytics-link-purpose="provider_website"]').first();
  await lessonInformationLink.focus();
  await expect(lessonInformationLink).toHaveCSS('color', 'rgb(255, 255, 255)');

  const clickWithoutNavigation = locator => locator.evaluate(element => {
    element.addEventListener('click', event => event.preventDefault(), { once: true });
    element.click();
  });

  for (const trackedLink of await page.locator('[data-analytics-link-purpose]').all()) {
    await clickWithoutNavigation(trackedLink);
  }

  const expectedEvents = [
    ['event', 'ca_external_link', { link_context: 'lesson_resources', link_purpose: 'provider_website', link_destination: 'columbia_association' }],
    ['event', 'ca_external_link', { link_context: 'lesson_resources', link_purpose: 'provider_website', link_destination: 'columbia_association_registration' }],
    ['event', 'ca_external_link', { link_context: 'lesson_resources', link_purpose: 'provider_website', link_destination: 'columbia_association' }],
    ['event', 'ca_external_link', { link_context: 'lesson_resources', link_purpose: 'provider_website', link_destination: 'columbia_association' }],
    ['event', 'ca_external_link', { link_context: 'lesson_resources', link_purpose: 'provider_contact', link_destination: 'email' }],
    ['event', 'ca_external_link', { link_context: 'lesson_resources', link_purpose: 'related_program', link_destination: 'team_unify' }],
    ['event', 'ca_external_link', { link_context: 'lesson_resources', link_purpose: 'related_program', link_destination: 'go_motion' }],
    ['event', 'ca_external_link', { link_context: 'lesson_resources', link_purpose: 'provider_recommendation', link_destination: 'email' }]
  ];
  const sortEvents = events => events.toSorted((first, second) => (
    JSON.stringify(first).localeCompare(JSON.stringify(second))
  ));
  await expect.poll(async () => sortEvents(await page.evaluate(() => globalThis.recordedAnalyticsEvents.filter(eventArguments => (
    eventArguments[1] === 'ca_external_link'
  ))))).toEqual(sortEvents(expectedEvents));
});
