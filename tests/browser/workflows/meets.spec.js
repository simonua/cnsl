const { test, expect } = require('../browser-test');
const {
  MOBILE_VIEWPORT,
  prepareStableWeatherResponses,
  readAnnualData,
  seedPreferences
} = require('../browser-test-helpers');

const ANNUAL_MEETS = readAnnualData('meets');
const REGULAR_MEET_DATES = [...new Set(ANNUAL_MEETS.regular_meets.map(meet => meet.date))].sort();
const TIME_TRIALS_MEET = ANNUAL_MEETS.special_meets.find(meet => meet.timeWindowKey === 'timeTrials');
const FAVORITE_TEAM = readAnnualData('teams').teams.find(team => ANNUAL_MEETS.regular_meets.filter(meet => (
  team.keywords.some(keyword => [meet.home_team, meet.visiting_team].some(name => name.toLowerCase() === keyword.toLowerCase()))
)).length > 1);

function getMeetTime(date, time) {
  return new Date(`${date}T${time}-04:00`);
}

function getPreviousDay(date) {
  const previousDay = getMeetTime(date, '12:00:00');
  previousDay.setDate(previousDay.getDate() - 1);
  return previousDay;
}

test.beforeEach(async ({ page }) => {
  await prepareStableWeatherResponses(page);
});

test('[WF-MEETS-001] meet pool links open the expanded destination without moving the page', async ({ page }) => {
  await page.setViewportSize(MOBILE_VIEWPORT);
  await page.context().grantPermissions(['geolocation']);
  await page.context().setGeolocation({ latitude: 39.2105, longitude: -76.8721 });
  await page.addInitScript(() => {
    localStorage.setItem('cnsl_preferences', JSON.stringify({ locationAwarenessEnabled: true }));
  });
  await page.goto('/meets.html');
  await expect(page.locator('#meetListStatus')).toContainText('Meet schedule loaded.');
  await expect(page.locator('#meetList .meet-details').first()).toBeVisible();

  const poolLink = page.locator('.pool-link').last();
  const targetPoolId = await poolLink.evaluate(link => new URL(link.href).searchParams.get('pool'));
  await poolLink.evaluate(link => {
    const card = link.closest('.meet-date-card');
    const toggle = card.querySelector('.meet-date-header__toggle');
    if (toggle.getAttribute('aria-expanded') !== 'true') toggle.click();
  });
  await expect(poolLink).toBeVisible();
  await poolLink.click();

  const targetCard = page.locator(`.pool-card[data-pool-id="${targetPoolId}"]`);
  await expect(page.locator('#poolListStatus')).toContainText('Pool directory loaded.');
  await expect(page.locator('.distance-badge').first()).toBeVisible();
  await expect.poll(() => page.evaluate(() => new URL(globalThis.location.href).searchParams.get('pool'))).toBe(targetPoolId);
  await expect(targetCard.locator('.pool-header__toggle')).toHaveAttribute('aria-expanded', 'true');
  await expect.poll(() => page.evaluate(() => globalThis.scrollY)).toBe(0);
});

test('[WF-MEETS-002] favorite team matchups appear first on every meet day they compete', async ({ page }) => {
  await seedPreferences(page, { favoriteTeamId: FAVORITE_TEAM.id });
  await page.goto('/meets.html');
  await expect(page.locator('#meetListStatus')).toContainText('Meet schedule loaded.');

  const dateCards = page.locator('.meet-date-card');
  for (let index = 0; index < await dateCards.count(); index += 1) {
    const card = dateCards.nth(index);
    const toggle = card.locator('.meet-date-header__toggle');
    if (await toggle.getAttribute('aria-expanded') !== 'true') await toggle.click();
    await expect(card.locator('.meet-date-details')).toHaveAttribute('data-meet-details-hydrated', 'true');
  }

  const favoriteDayPlacement = await page.locator('.meet-date-card').evaluateAll(cards => cards
    .filter(card => card.querySelector('.favorite-meet'))
    .map(card => card.querySelector('.meet-date-details > .meet-details').classList.contains('favorite-meet')));

  expect(favoriteDayPlacement.length).toBeGreaterThan(1);
  expect(favoriteDayPlacement.every(firstIsFavorite => firstIsFavorite)).toBe(true);

  const favoriteMeet = page.locator('.favorite-meet:visible').first();
  const favoriteMarker = favoriteMeet.getByRole('img', { name: 'Favorite team' });
  const favoriteTeam = favoriteMarker.locator('..');
  const otherTeam = favoriteMeet.locator('.home-team:not(:has(.favorite-marker)), .visiting-team:not(:has(.favorite-marker))');
  await expect(favoriteMarker).toHaveText('★');
  await expect.poll(async () => ({
    color: await favoriteTeam.evaluate(element => element.ownerDocument.defaultView.getComputedStyle(element).color),
    fontWeight: await favoriteTeam.evaluate(element => element.ownerDocument.defaultView.getComputedStyle(element).fontWeight)
  })).toEqual({
    color: await otherTeam.evaluate(element => element.ownerDocument.defaultView.getComputedStyle(element).color),
    fontWeight: await otherTeam.evaluate(element => element.ownerDocument.defaultView.getComputedStyle(element).fontWeight)
  });
});

test('[WF-MEETS-003] regular meet-day labels advance from upcoming through ongoing to completed', async ({ page }) => {
  await page.setViewportSize(MOBILE_VIEWPORT);
  await page.clock.install({ time: getMeetTime(REGULAR_MEET_DATES[0], '06:59:30') });
  await page.goto('/meets.html');
  await expect(page.locator('#meetListStatus')).toContainText('Meet schedule loaded.');

  const firstDualMeet = page.locator(`.meet-date-card[data-meet-date="${REGULAR_MEET_DATES[0]}"]`);
  const secondDualMeet = page.locator(`.meet-date-card[data-meet-date="${REGULAR_MEET_DATES[1]}"]`);
  await expect(firstDualMeet.locator('.meet-live-badge')).toHaveText('Upcoming');
  await expect(firstDualMeet.locator('.meet-date-header__relative')).toHaveText('today');
  await expect(firstDualMeet.locator('.meet-date-header__relative.upcoming-day-pill--today')).toHaveText('today');
  const daysUntilSecondMeet = Math.round((new Date(REGULAR_MEET_DATES[1]) - new Date(REGULAR_MEET_DATES[0])) / 86400000);
  await expect(secondDualMeet.locator('.meet-date-header__relative')).toHaveText(`in ${daysUntilSecondMeet} days`);
  await expect(page.locator(`.meet-date-card[data-meet-date="${TIME_TRIALS_MEET.date}"] .meet-date-header__relative`)).toHaveCount(0);
  await expect(page.locator('.meet-status-indicator')).toHaveCount(0);
  const mobileHeaderLayout = await firstDualMeet.locator('.meet-date-header').evaluate(header => {
    const meetNameBounds = header.querySelector('.meet-name-header').getBoundingClientRect();
    const badgeBounds = header.querySelector('.meet-live-badge').getBoundingClientRect();
    return {
      badgeGap: badgeBounds.left - meetNameBounds.right,
      topOffset: Math.abs(badgeBounds.top - meetNameBounds.top)
    };
  });
  expect(mobileHeaderLayout.badgeGap).toBeGreaterThanOrEqual(7);
  expect(mobileHeaderLayout.topOffset).toBeLessThanOrEqual(1);
  const completedTimeTrials = page.locator(`.meet-date-card[data-meet-date="${TIME_TRIALS_MEET.date}"] .meet-live-badge--completed`);
  await expect(completedTimeTrials).toHaveText('✓ Completed');
  await expect(completedTimeTrials.locator('.meet-live-badge__check')).toHaveAttribute('aria-hidden', 'true');

  await firstDualMeet.locator('.meet-date-header__toggle').focus();
  await page.clock.fastForward(31 * 1000);
  await expect(firstDualMeet.locator('.meet-live-badge')).toHaveText('Ongoing');
  await expect(firstDualMeet.locator('.meet-date-header__toggle')).toBeFocused();

  await page.clock.fastForward((5 * 60 * 60 * 1000));
  await expect(firstDualMeet.locator('.meet-live-badge--completed')).toHaveText('✓ Completed');
  await expect(secondDualMeet.locator('.meet-live-badge')).toHaveText('Upcoming');
  await expect(page.locator('#meetListStatus')).toHaveText('Meet status updated for the current date and time.');
});

test('[WF-MEETS-004] Time Trials advances from upcoming to ongoing using its published hours', async ({ page }) => {
  const trialWindow = ANNUAL_MEETS.meetTimes[TIME_TRIALS_MEET.timeWindowKey];
  const beforeStart = getMeetTime(TIME_TRIALS_MEET.date, `${trialWindow.start}:00`);
  beforeStart.setSeconds(beforeStart.getSeconds() - 30);
  await page.clock.install({ time: beforeStart });
  await page.goto('/meets.html');
  await expect(page.locator('#meetListStatus')).toContainText('Meet schedule loaded.');

  const timeTrials = page.locator(`.meet-date-card[data-meet-date="${TIME_TRIALS_MEET.date}"]`);
  await expect(timeTrials.locator('.meet-live-badge')).toHaveText('Upcoming');
  await expect(timeTrials.locator('.meet-time')).not.toBeEmpty();
  await expect(page.locator(`.meet-date-card[data-meet-date="${REGULAR_MEET_DATES[0]}"] .meet-live-badge`)).toHaveCount(0);

  await page.clock.fastForward(31 * 1000);
  await expect(timeTrials.locator('.meet-live-badge')).toHaveText('Ongoing');
});

test('[WF-MEETS-005] next-day meet labels emphasize tomorrow separately from later dates', async ({ page }) => {
  await page.clock.install({ time: getPreviousDay(TIME_TRIALS_MEET.date) });
  await page.goto('/meets.html');
  await expect(page.locator('#meetListStatus')).toContainText('Meet schedule loaded.');

  const timeTrialsRelativeDay = page.locator(`.meet-date-card[data-meet-date="${TIME_TRIALS_MEET.date}"] .meet-date-header__relative`);
  await expect(timeTrialsRelativeDay).toHaveText('tomorrow');
  await expect(timeTrialsRelativeDay).toHaveClass(/upcoming-day-pill--tomorrow/);
  await expect(page.locator(`.meet-date-card[data-meet-date="${REGULAR_MEET_DATES[0]}"] .meet-date-header__relative`)).not.toHaveClass(/upcoming-day-pill--tomorrow/);
});
