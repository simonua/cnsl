const { test, expect } = require('../browser-test');
const {
  MOBILE_VIEWPORT,
  initializeAnalyticsRecorder,
  prepareStableWeatherResponses,
  seedPreferences,
  setAgendaReferenceTime
} = require('../browser-test-helpers');

test.beforeEach(async ({ page }) => {
  await prepareStableWeatherResponses(page);
});

test('[WF-TEAMS-001] collapsed favorite team stays collapsed after returning to the directory', async ({ page }) => {
  await initializeAnalyticsRecorder(page);
  await page.goto('/teams.html');
  await page.evaluate(() => {
    localStorage.setItem('cnsl_preferences', JSON.stringify({ favoriteTeamId: 'cfhss' }));
  });
  await page.reload();
  await expect(page.locator('#teamListStatus')).toContainText('Team directory loaded.');

  const favoriteToggle = page.locator('.favorite-card .team-header__toggle');
  await expect(favoriteToggle).toHaveAttribute('aria-expanded', 'true');
  await favoriteToggle.evaluate(toggle => {
    toggle.closest('[data-team-card]').classList.remove('favorite-card');
    toggle.click();
  });
  const stableFavoriteToggle = page.locator('[data-team-id="cfhss"] [data-team-card-action="toggle"]');
  await expect(stableFavoriteToggle).toHaveAttribute('aria-expanded', 'false');
  await expect.poll(() => page.evaluate(() => globalThis.recordedAnalyticsEvents.filter(eventArguments => eventArguments[1] === 'ca_setting_change'))).toEqual([
    ['event', 'ca_setting_change', { setting_name: 'favorite_team_expanded' }]
  ]);

  await page.reload();
  await expect(page.locator('.favorite-card .team-header__toggle')).toHaveAttribute('aria-expanded', 'false');
});

test('[WF-TEAMS-002] team directory groups practice and meet disclosures in one readable schedule list', async ({ page }) => {
  await setAgendaReferenceTime(page);
  await page.goto('/teams.html');
  await expect(page.locator('#teamListStatus')).toContainText('Team directory loaded.');

  const sundevils = page.locator('.team-card[data-team-id="cfhss"]');
  await sundevils.locator('.team-header__toggle').click();
  const schedules = sundevils.locator('.practice-schedule');
  const scheduleRows = schedules.locator(':scope > .practice-schedule__phase');
  await expect(schedules.getByRole('heading', { name: 'Schedules' })).toBeVisible();
  await expect(scheduleRows).toHaveCount(3);
  await expect(scheduleRows.locator('.practice-schedule__title')).toHaveText(['Pre-season practices', 'In-season practices', 'Meets']);
  const collapsedGaps = await scheduleRows.evaluateAll(rows => rows.slice(1).map((row, index) => (
    Math.round(row.getBoundingClientRect().top - rows[index].getBoundingClientRect().bottom)
  )));
  expect(collapsedGaps[0]).toBe(collapsedGaps[1]);
  const preSeason = sundevils.locator('.practice-schedule__phase').filter({ hasText: 'Pre-season practices' });
  const inSeason = sundevils.locator('.practice-schedule__phase').filter({ hasText: 'In-season practices' });
  await expect(preSeason).toHaveCount(1);
  await expect(inSeason).toHaveCount(1);
  await expect(preSeason).not.toHaveAttribute('open', '');
  await expect(inSeason).not.toHaveAttribute('open', '');
  await expect(preSeason).toHaveClass(/practice-schedule__phase--current/);
  await expect(preSeason.locator('.practice-schedule__badge')).toHaveText('Current schedule');
  await preSeason.locator('summary').click();
  await expect(preSeason.locator('.practice-period--current')).toHaveCount(1);
  await expect(preSeason.locator('.practice-period--current')).toContainText('May 26 - May 29');
  await expect(preSeason.locator('.practice-period__badge')).toHaveText('Current period');
  await expect(preSeason.locator('.practice-period--upcoming')).toHaveCount(0);
  const practicePanelWidth = await sundevils.locator('.practice-schedule').evaluate(element => element.getBoundingClientRect().width);
  const teamCardWidth = await sundevils.evaluate(element => element.getBoundingClientRect().width);
  expect(practicePanelWidth).toBeLessThan(teamCardWidth);
  expect(practicePanelWidth).toBeGreaterThan(608);
  expect(practicePanelWidth).toBeLessThanOrEqual(704);
  await expect(inSeason).not.toHaveClass(/practice-schedule__phase--current/);
  await inSeason.locator('summary').click();
  await expect(inSeason.locator('.practice-schedule__body')).toBeVisible();
  await expect(inSeason).toContainText('Swansfield Pool');
  await expect(inSeason).toContainText('8:00 - 8:30am');
  const meetSchedule = schedules.locator('.team-meets__phase');
  await expect(meetSchedule).not.toHaveAttribute('open', '');
  await expect(meetSchedule.getByText('Home meet')).toBeVisible();
  await expect(meetSchedule.locator('.team-meets__table')).not.toBeVisible();
  await meetSchedule.locator('summary').focus();
  await page.keyboard.press('Enter');
  await expect(meetSchedule).toHaveAttribute('open', '');
  await expect(meetSchedule.locator('.team-meets__body > .team-meets__table')).toBeVisible();
  await expect(meetSchedule.locator('thead th')).toHaveText(['Date', 'Meet', 'Matchup', 'Pool']);
  await expect(meetSchedule.locator('tbody tr')).toHaveCount(8);
  const timeTrials = meetSchedule.locator('tbody tr').first();
  await expect(timeTrials.locator('td').nth(0)).toContainText('June 6');
  await expect(timeTrials.locator('.team-meets__time')).toHaveText('7:00 AM - 12:00 PM');
  await expect(timeTrials.locator('td').nth(1)).toHaveText('Time Trials for returning / experienced swimmers');
  const firstMeet = meetSchedule.locator('tbody tr').nth(1);
  await expect(firstMeet.locator('td').nth(0)).toContainText('June 13');
  await expect(firstMeet.locator('.team-meets__time')).toHaveText('7:00 AM - 12:00 PM');
  await expect(firstMeet.locator('td').nth(1)).toHaveText('Dual #1');
  await expect(firstMeet).toHaveClass(/team-meets__row--home/);
  await expect(firstMeet.locator('.team-meets__matchup')).toHaveText("Clary's Forest, Hawthorn, Swansfield vs. Oakland Mills");
  await expect(firstMeet.locator('.team-meets__matchup strong')).toHaveText("Clary's Forest, Hawthorn, Swansfield");
  await expect(firstMeet.locator('.team-meets__course--nonstandard')).toHaveText('6-lane / 25-meter');
  const awayMeet = meetSchedule.locator('tbody tr').nth(2);
  await expect(awayMeet).not.toHaveClass(/team-meets__row--home/);
  await expect(awayMeet.locator('.team-meets__matchup')).toHaveText("Owen Brown vs. Clary's Forest, Hawthorn, Swansfield");
  await expect(awayMeet.locator('.team-meets__matchup strong')).toHaveText("Clary's Forest, Hawthorn, Swansfield");
  await expect(awayMeet.locator('.team-meets__course')).toHaveText('8-lane / 25-yard');
  await expect(awayMeet.locator('.team-meets__course--nonstandard')).toHaveCount(0);
  await expect(firstMeet.locator('.team-meets__matchup-team')).toHaveText(["Clary's Forest, Hawthorn, Swansfield", 'vs. Oakland Mills']);
  await expect(firstMeet.getByRole('link', { name: 'Swansfield' })).toHaveAttribute('href', /pools\.html\?pool=/);
  await expect(firstMeet).not.toContainText('Swansfield Pool');
  const primaryActions = sundevils.locator('.team-actions--website');
  const calendarActions = sundevils.locator('.team-actions--calendar');
  await expect(sundevils.locator('.practice-schedule + .team-actions--website')).toHaveCount(1);
  await expect(primaryActions.locator('a')).toHaveText(['Team Website', 'Practice Schedule']);
  await expect(primaryActions.getByRole('link', { name: 'Team Website' })).toBeVisible();
  await expect(primaryActions.getByRole('link', { name: 'Practice Schedule' })).toHaveAttribute('href', /practice-schedule/);
  await expect(calendarActions.locator('a')).toHaveText(['Team Calendar']);
  await expect(calendarActions.getByRole('link', { name: 'Team Calendar' })).toHaveAttribute('href', /\/page\/calendar$/);
  await expect(calendarActions.getByRole('link', { name: 'Subscribe to team events calendar' })).toHaveCount(0);
});

test('[WF-TEAMS-009] next pre-season practice period is marked upcoming between published ranges', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-05-30T12:00:00'));
  await page.goto('/teams.html');
  await expect(page.locator('#teamListStatus')).toContainText('Team directory loaded.');

  const sundevils = page.locator('.team-card[data-team-id="cfhss"]');
  await sundevils.locator('.team-header__toggle').click();
  const preSeason = sundevils.locator('.practice-schedule__phase').filter({ hasText: 'Pre-season practices' });
  await preSeason.locator('summary').click();

  const upcomingPeriod = preSeason.locator('.practice-period--upcoming');
  await expect(preSeason).not.toHaveClass(/practice-schedule__phase--current/);
  await expect(upcomingPeriod).toHaveCount(1);
  await expect(upcomingPeriod).toContainText('June 1 - June 18');
  await expect(upcomingPeriod.locator('.practice-period__badge')).toHaveText('Upcoming period');
});

test('[WF-TEAMS-003] team directory filters regular practice times to selected practice groups', async ({ page }) => {
  await seedPreferences(page, { practiceGroups: ['9-10'] });
  await page.goto('/teams.html');
  await expect(page.locator('#teamListStatus')).toContainText('Team directory loaded.');

  const sundevils = page.locator('.team-card[data-team-id="cfhss"]');
  await sundevils.locator('.team-header__toggle').click();
  const schedule = sundevils.locator('.practice-schedule__phase').filter({ hasText: 'In-season practices' });
  await schedule.locator('summary').click();
  await expect(schedule).toContainText('8:30 - 9:15am');
  await expect(schedule).toContainText('5:00 - 5:45pm');
  await expect(schedule).not.toContainText('8:00 - 8:30am');
  await expect(schedule).not.toContainText('9:15 - 10:00am');
  await expect(schedule).not.toContainText('5:45 - 6:30pm');
});

test('[WF-TEAMS-004] published Long Reach merchandise and booster actions appear in team details', async ({ page }) => {
  await page.setViewportSize(MOBILE_VIEWPORT);
  await initializeAnalyticsRecorder(page);
  await page.goto('/teams.html');
  await expect(page.locator('#teamListStatus')).toContainText('Team directory loaded.');

  const marlins = page.locator('.team-card[data-team-id="lrm"]');
  const merchandiseLink = marlins.getByRole('link', { name: 'Get Your Official Marlins Gear! (opens in new tab)' });
  await expect(merchandiseLink).toBeHidden();
  await marlins.locator('.team-header__toggle').click();
  await expect(merchandiseLink).toBeVisible();
  await expect(merchandiseLink)
    .toHaveAttribute('href', 'https://2026-long-marlins-swimseason.spiritsale.com/');
  await expect(marlins.getByRole('link', { name: 'Team Calendar' }))
    .toHaveAttribute('href', 'https://www.gomotionapp.com/team/reccnsllrm/page/events');
  await expect(marlins.getByRole('link', { name: 'Subscribe to team events calendar' }))
    .toHaveAttribute('href', 'https://www.gomotionapp.com/rest/ics/system/5/Events.ics?key=eH0JlshDIHydTEGomF73nQ%3D%3D&enabled=false&tz=America%2FNew_York');
  const calendarActionTops = await marlins.locator('.team-actions--calendar a').evaluateAll(links => (
    links.map(link => link.getBoundingClientRect().top)
  ));
  expect(Math.abs(calendarActionTops[0] - calendarActionTops[1])).toBeLessThan(1);
  await expect(marlins.getByRole('link', { name: 'Booster Club', exact: true }))
    .toHaveAttribute('href', 'https://www.longreachmarlins.org/');
  await marlins.locator('.team-merchandise').evaluate(link => {
    link.addEventListener('click', event => event.preventDefault(), { once: true });
    link.classList.remove('team-merchandise');
    link.click();
  });
  await expect.poll(() => page.evaluate(() => globalThis.recordedAnalyticsEvents.at(-1))).toEqual([
    'event', 'ca_external_link', { link_context: 'team_details', link_purpose: 'merchandise', link_destination: 'spirit_sale' }
  ]);
  await merchandiseLink.evaluate(link => {
    link.closest('[data-team-card]').dataset.analyticsContext = 'injected_context';
    link.dataset.analyticsLinkPurpose = 'injected_purpose';
    link.addEventListener('click', event => event.preventDefault(), { once: true });
    link.click();
  });
  await expect.poll(() => page.evaluate(() => globalThis.recordedAnalyticsEvents.at(-1))).toEqual([
    'event', 'ca_external_link', { link_context: 'other', link_purpose: 'general', link_destination: 'spirit_sale' }
  ]);
  await expect(marlins.locator('.team-header__toggle')).toHaveAttribute('aria-expanded', 'true');

  const sundevils = page.locator('.team-card[data-team-id="cfhss"]');
  await expect(sundevils.locator('.team-merchandise')).toHaveCount(0);
  await expect(sundevils.getByRole('link', { name: /Booster Club/ })).toHaveCount(0);
});

test('[WF-TEAMS-005] unknown team deep links leave the loaded directory stable', async ({ page }) => {
  await page.goto('/teams.html?team=not-a-published-team%22%5D');
  await expect(page.locator('#teamListStatus')).toContainText('Team directory loaded.');
  const teamCards = page.locator('.team-card');
  const renderedTeamCount = await teamCards.count();
  expect(renderedTeamCount).toBeGreaterThan(0);
  await expect(page.locator('.team-card.highlighted')).toHaveCount(0);
  await page.waitForTimeout(300);
  await expect(teamCards).toHaveCount(renderedTeamCount);
  await expect(page.locator('.team-card.highlighted')).toHaveCount(0);
});

test('[WF-TEAMS-006] team meet schedule shows all columns within its phone-width panel', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 900 });
  await setAgendaReferenceTime(page);
  await page.goto('/teams.html');
  await expect(page.locator('#teamListStatus')).toContainText('Team directory loaded.');

  const sundevils = page.locator('.team-card[data-team-id="cfhss"]');
  await sundevils.locator('.team-header__toggle').click();
  const meetSchedule = sundevils.locator('.team-meets__phase');
  await meetSchedule.locator('summary').click();
  const scheduleBody = meetSchedule.locator('.team-meets__body');
  await expect(scheduleBody.locator(':scope > .team-meets__table')).toBeVisible();
  const sizing = await scheduleBody.evaluate(element => ({
    overflow: element.scrollWidth - element.clientWidth,
    bodyWidth: element.getBoundingClientRect().width,
    tableWidth: element.querySelector('.team-meets__table').getBoundingClientRect().width
  }));
  expect(sizing.overflow).toBeLessThanOrEqual(1);
  expect(Math.abs(sizing.tableWidth - sizing.bodyWidth)).toBeLessThanOrEqual(1);
  await expect(meetSchedule.locator('tbody tr').first().locator('td').nth(1)).toHaveText('Time Trials for returning / experienced swimmers');
  await expect(meetSchedule.locator('tbody tr').first().locator('.team-meets__time')).toHaveText('7:00 AM - 12:00 PM');
  await expect(meetSchedule.locator('tbody tr').first().locator('td').nth(2)).toBeEmpty();
  await expect(meetSchedule.locator('tbody tr').first().locator('td').nth(3)).toContainText('Swansfield');
  await expect(meetSchedule.locator('tbody tr').nth(1).locator('td').nth(1)).toHaveText('Dual #1');
  await expect(meetSchedule.locator('tbody tr').nth(1).locator('.team-meets__time')).toHaveText('7:00 AM - 12:00 PM');
  await expect(meetSchedule).toContainText('All-City Championship Meet Part 1');
  await expect(meetSchedule.locator('.team-meets__course--nonstandard').first()).toHaveText('6-lane / 25-meter');
});

test('[WF-TEAMS-007] phone-width team details expose upcoming and full practice schedules without cramped labels', async ({ page }) => {
  await page.setViewportSize(MOBILE_VIEWPORT);
  await setAgendaReferenceTime(page);
  await page.goto('/teams.html');
  await expect(page.locator('#teamListStatus')).toContainText('Team directory loaded.');

  const snappers = page.locator('.team-card[data-team-id="pls"]');
  await snappers.locator('.team-header__toggle').click();
  await expect(snappers.locator('.favorite-week')).toContainText('Next morning practice');

  const preSeason = snappers.locator('.practice-schedule__phase').filter({ hasText: 'Pre-season practices' });
  const inSeason = snappers.locator('.practice-schedule__phase').filter({ hasText: 'In-season practices' });
  await expect(preSeason).toHaveAttribute('open', '');
  await expect(inSeason).toHaveAttribute('open', '');
  await expect(preSeason.locator('.practice-schedule__body')).toBeVisible();
  await expect(inSeason.locator('.practice-schedule__body')).toBeVisible();
  await expect(inSeason).toContainText('Morning Practice:');

  const trainingLabel = preSeason.locator('.session-group', { hasText: 'Lap requirement training' });
  const labelSizing = await trainingLabel.evaluate(label => {
    const styles = label.ownerDocument.defaultView.getComputedStyle(label);
    return {
      height: label.getBoundingClientRect().height,
      lineHeight: Number.parseFloat(styles.lineHeight),
      marginRight: Number.parseFloat(styles.marginRight)
    };
  });
  expect(labelSizing.marginRight).toBe(0);
  expect(labelSizing.height).toBeLessThanOrEqual(labelSizing.lineHeight + 1);
});

test('[WF-TEAMS-008] touch-capable team details expose every published practice phase', async ({ browser }) => {
  const touchContext = await browser.newContext({
    baseURL: 'http://127.0.0.1:4173',
    hasTouch: true,
    isMobile: true,
    viewport: { width: 980, height: 915 }
  });
  const touchPage = await touchContext.newPage();

  try {
    await prepareStableWeatherResponses(touchPage);
    await touchPage.goto('/teams.html');
    await expect(touchPage.locator('#teamListStatus')).toContainText('Team directory loaded.');
    await expect.poll(() => touchPage.evaluate(() => ({
      compact: globalThis.matchMedia('(max-width: 48rem)').matches,
      maxTouchPoints: globalThis.navigator.maxTouchPoints
    }))).toEqual({ compact: false, maxTouchPoints: 1 });

    const marlins = touchPage.locator('.team-card[data-team-id="lrm"]');
    await marlins.locator('.team-header__toggle').click();
    await expect(marlins.locator('.practice-schedule__phase').filter({ hasText: 'Pre-season practices' })).toHaveAttribute('open', '');
    await expect(marlins.locator('.practice-schedule__phase').filter({ hasText: 'In-season practices' })).toHaveAttribute('open', '');
  } finally {
    await touchContext.close();
  }
});
