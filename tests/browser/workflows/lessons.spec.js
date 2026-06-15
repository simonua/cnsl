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
  await expect(page.locator('#lessonProviderStatus')).toHaveText('1 lesson provider listed.');
  const caCard = page.locator('.lesson-provider-card--featured');
  await expect(caCard.getByRole('heading', { name: 'Columbia Association' })).toBeVisible();
  await expect(caCard.getByRole('heading', { name: 'Outdoor lessons at CA pools' })).toBeVisible();
  await expect(caCard.getByRole('heading', { name: 'Morning lesson camps' })).toBeVisible();
  await expect(caCard.getByText('Dorsey Hall: Monday - Friday')).toBeVisible();
  await expect(caCard.getByRole('heading', { name: 'Evening lesson series' })).toBeVisible();
  await expect(caCard.getByText('Talbott Springs: Tuesday or Thursday')).toBeVisible();
  await expect(caCard.getByText('Please bring: Sunscreen, Goggles, Towel')).toBeVisible();
  await expect(caCard.getByText('Lessons continue in light rain.', { exact: false })).toBeVisible();
  await expect(caCard.getByRole('link', { name: 'View current outdoor classes (opens in new tab)' })).toHaveAttribute('href', /clubautomation\.com/);
  await expect(caCard.getByRole('link', { name: 'Explore Personal Swim Training (opens in new tab)' })).toHaveAttribute('href', /personal-swim-training/);
  await expect(page.getByRole('heading', { name: 'Class types' })).toBeVisible();
  await expect(page.getByText('Program contact: Swim Lesson Program Supervisor')).toBeVisible();
  await expect(page.getByRole('link', { name: 'swim.lessons@columbiaassociation.org' })).toHaveAttribute('href', 'mailto:swim.lessons@columbiaassociation.org');
  await expect(page.locator('.lesson-provider-card__details').first().locator('p')).toHaveText([
    'Program contact: Swim Lesson Program Supervisor',
    'Email: swim.lessons@columbiaassociation.org',
    'Phone: 410-715-3000'
  ]);
  await expect(page.getByText('Swim team preparation')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Year-round swimming' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Columbia Clippers' })).toBeVisible();
  await expect(page.getByText('new-swimmer tryouts are limited to swimmers age 10 and under', { exact: false })).toBeVisible();
  await expect(page.getByText('indoor pools at Columbia Swim Center and Supreme Sports Club', { exact: false })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Program highlights' })).toBeVisible();
  await expect(page.getByText('can complement outdoor summer-league swimming', { exact: false })).toBeVisible();
  await expect(page.locator('.lesson-provider-card__logo img')).toHaveCount(2);
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

  const lessonInformationLink = page.getByRole('link', { name: 'View lesson information (opens in new tab)' });
  await lessonInformationLink.focus();
  await expect(lessonInformationLink).toHaveCSS('color', 'rgb(255, 255, 255)');

  const clickWithoutNavigation = locator => locator.evaluate(element => {
    element.addEventListener('click', event => event.preventDefault(), { once: true });
    element.click();
  });

  await clickWithoutNavigation(lessonInformationLink);
  await clickWithoutNavigation(caCard.getByRole('link', { name: 'View current outdoor classes (opens in new tab)' }));
  await clickWithoutNavigation(caCard.getByRole('link', { name: 'Explore Personal Swim Training (opens in new tab)' }));
  await clickWithoutNavigation(caCard.getByRole('link', { name: 'Review CA outdoor lesson details (opens in new tab)' }));
  await clickWithoutNavigation(page.getByRole('link', { name: 'swim.lessons@columbiaassociation.org' }));
  await clickWithoutNavigation(page.getByRole('link', { name: 'Visit official website (opens in new tab)' }));
  await clickWithoutNavigation(page.getByRole('link', { name: 'Review current eligibility (opens in new tab)' }));
  await clickWithoutNavigation(page.getByRole('link', { name: 'please send me the details' }));

  await expect.poll(() => page.evaluate(() => globalThis.recordedAnalyticsEvents.filter(eventArguments => (
    eventArguments[1] === 'ca_external_link'
  )))).toEqual([
    ['event', 'ca_external_link', { link_context: 'lesson_resources', link_purpose: 'provider_website', link_destination: 'columbia_association' }],
    ['event', 'ca_external_link', { link_context: 'lesson_resources', link_purpose: 'provider_website', link_destination: 'columbia_association_registration' }],
    ['event', 'ca_external_link', { link_context: 'lesson_resources', link_purpose: 'provider_website', link_destination: 'columbia_association' }],
    ['event', 'ca_external_link', { link_context: 'lesson_resources', link_purpose: 'provider_website', link_destination: 'columbia_association' }],
    ['event', 'ca_external_link', { link_context: 'lesson_resources', link_purpose: 'provider_contact', link_destination: 'email' }],
    ['event', 'ca_external_link', { link_context: 'lesson_resources', link_purpose: 'related_program', link_destination: 'team_unify' }],
    ['event', 'ca_external_link', { link_context: 'lesson_resources', link_purpose: 'related_program', link_destination: 'go_motion' }],
    ['event', 'ca_external_link', { link_context: 'lesson_resources', link_purpose: 'provider_recommendation', link_destination: 'email' }]
  ]);
});
