const { test, expect } = require('../browser-test');
const {
  MOBILE_VIEWPORT,
  PLAYWRIGHT_SERVER_URL,
  activeSeasonDate,
  initializeAnalyticsRecorder,
  prepareStableWeatherResponses,
  routeAnnualDataFixture,
  seedPreferences,
  setAgendaReferenceTime
} = require('../browser-test-helpers');
const { createTestDataScenario } = require('../fixtures/test-data.js');

const { meets, teams } = createTestDataScenario();
const PRACTICE_TEAM = teams.primaryTeam;
const EXTERNAL_ACTION_TEAM = teams.externalActionTeam;
const TEAM_WITHOUT_EXTERNAL_ACTIONS = teams.teamWithoutActions;

test.beforeEach(async ({ page }) => {
  await prepareStableWeatherResponses(page);
  await routeAnnualDataFixture(page, ['meets', 'pools', 'teams']);
});

test('[WF-TEAMS-001] collapsed favorite team stays collapsed after returning to the directory', async ({ page }) => {
  await initializeAnalyticsRecorder(page);
  await page.goto('/teams.html');
  await page.evaluate(teamId => {
    localStorage.setItem('cnsl_preferences', JSON.stringify({ favoriteTeamId: teamId }));
  }, PRACTICE_TEAM.id);
  await page.reload();
  await expect(page.locator('#teamList')).toHaveAttribute('aria-busy', 'false');

  const favoriteToggle = page.locator('.favorite-card .team-header__toggle');
  await expect(favoriteToggle).toHaveAttribute('aria-expanded', 'true');
  await favoriteToggle.evaluate(toggle => {
    toggle.closest('[data-team-card]').classList.remove('favorite-card');
    toggle.click();
  });
  const stableFavoriteToggle = page.locator(`[data-team-id="${PRACTICE_TEAM.id}"] [data-team-card-action="toggle"]`);
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
  await expect(page.locator('#teamList')).toHaveAttribute('aria-busy', 'false');

  const teamCard = page.locator(`.team-card[data-team-id="${PRACTICE_TEAM.id}"]`);
  await teamCard.locator('.team-header__toggle').click();
  const schedules = teamCard.locator('.practice-schedule');
  const scheduleRows = schedules.locator(':scope > .practice-schedule__phase');
  await expect(schedules.getByRole('heading', { name: 'Schedules' })).toBeVisible();
  await expect(scheduleRows).toHaveCount(3);
  await expect(scheduleRows.locator('.practice-schedule__title')).toHaveText(['Pre-season practices', 'In-season practices', 'Meets']);
  const collapsedGaps = await scheduleRows.evaluateAll(rows => rows.slice(1).map((row, index) => (
    Math.round(row.getBoundingClientRect().top - rows[index].getBoundingClientRect().bottom)
  )));
  expect(collapsedGaps[0]).toBe(collapsedGaps[1]);
  const preSeason = teamCard.locator('.practice-schedule__phase').filter({ hasText: 'Pre-season practices' });
  const inSeason = teamCard.locator('.practice-schedule__phase').filter({ hasText: 'In-season practices' });
  await expect(preSeason).toHaveCount(1);
  await expect(inSeason).toHaveCount(1);
  await expect(preSeason).not.toHaveAttribute('open', '');
  await expect(inSeason).not.toHaveAttribute('open', '');
  await expect(preSeason).toHaveClass(/practice-schedule__phase--current/);
  await expect(preSeason.locator('.practice-schedule__badge')).toHaveText('Current schedule');
  await preSeason.locator('summary').click();
  await expect(preSeason.locator('.practice-period--current')).toHaveCount(1);
  await expect(preSeason.locator('.practice-period--current')).not.toBeEmpty();
  await expect(preSeason.locator('.practice-period__badge')).toHaveText('Current period');
  await expect(preSeason.locator('.practice-period--upcoming')).toHaveCount(0);
  const practicePanelWidth = await teamCard.locator('.practice-schedule').evaluate(element => element.getBoundingClientRect().width);
  const teamCardWidth = await teamCard.evaluate(element => element.getBoundingClientRect().width);
  expect(practicePanelWidth).toBeLessThan(teamCardWidth);
  expect(practicePanelWidth).toBeGreaterThan(608);
  expect(practicePanelWidth).toBeLessThanOrEqual(704);
  await expect(inSeason).not.toHaveClass(/practice-schedule__phase--current/);
  await inSeason.locator('summary').click();
  await expect(inSeason.locator('.practice-schedule__body')).toBeVisible();
  await expect(inSeason.locator('.session-item:visible')).not.toHaveCount(0);
  const meetSchedule = schedules.locator('.team-meets__phase');
  await expect(meetSchedule).not.toHaveAttribute('open', '');
  await expect(meetSchedule.getByText('Home meet')).toBeVisible();
  await expect(meetSchedule.locator('.team-meets__table')).not.toBeVisible();
  await meetSchedule.locator('summary').focus();
  await page.keyboard.press('Enter');
  await expect(meetSchedule).toHaveAttribute('open', '');
  await expect(meetSchedule.locator('.team-meets__body > .team-meets__table')).toBeVisible();
  await expect(meetSchedule.locator('thead th')).toHaveText(['Date', 'Meet', 'Matchup', 'Pool']);
  expect(await meetSchedule.locator('tbody tr').count()).toBeGreaterThan(0);
  const timeTrials = meetSchedule.locator('tbody tr').filter({ hasText: meets.timeTrialsMeet.name });
  await expect(timeTrials).toHaveCount(1);
  await expect(timeTrials.locator('td')).toHaveCount(4);
  await expect(timeTrials.locator('.team-meets__time')).not.toBeEmpty();
  await expect(meetSchedule.locator('tbody tr .team-meets__matchup strong:visible')).not.toHaveCount(0);
  await expect(meetSchedule.locator('tbody tr a[href^="pools.html?pool="]:visible')).not.toHaveCount(0);
  const primaryActions = teamCard.locator('.team-actions--website');
  const calendarActions = teamCard.locator('.team-actions--calendar');
  await expect(teamCard.locator('.practice-schedule + .team-actions--website')).toHaveCount(1);
  await expect(primaryActions.locator('a')).toHaveText(['Team Website', 'Practice Schedule']);
  await expect(primaryActions.getByRole('link', { name: 'Team Website' })).toBeVisible();
  await expect(primaryActions.getByRole('link', { name: 'Practice Schedule' })).toHaveAttribute('href', /practice-schedule/);
  await expect(calendarActions.locator('a')).toHaveText(['Team Calendar']);
  await expect(calendarActions.getByRole('link', { name: 'Team Calendar' })).toHaveAttribute('href', /\/page\/calendar$/);
  await expect(calendarActions.getByRole('link', { name: 'Subscribe to team events calendar' })).toHaveCount(0);
});

test('[WF-TEAMS-009] next pre-season practice period is marked upcoming between published ranges', async ({ page }) => {
  await page.clock.setFixedTime(activeSeasonDate('05-30T12:00:00'));
  await page.goto('/teams.html');
  await expect(page.locator('#teamList')).toHaveAttribute('aria-busy', 'false');

  const teamCard = page.locator(`.team-card[data-team-id="${PRACTICE_TEAM.id}"]`);
  await teamCard.locator('.team-header__toggle').click();
  const preSeason = teamCard.locator('.practice-schedule__phase').filter({ hasText: 'Pre-season practices' });
  await preSeason.locator('summary').click();

  const upcomingPeriod = preSeason.locator('.practice-period--upcoming');
  await expect(preSeason).not.toHaveClass(/practice-schedule__phase--current/);
  await expect(upcomingPeriod).toHaveCount(1);
  await expect(upcomingPeriod).not.toBeEmpty();
  await expect(upcomingPeriod.locator('.practice-period__badge')).toHaveText('Upcoming period');
});

test('[WF-TEAMS-010] staff email actions distinguish personal and shared addresses', async ({ page }) => {
  await page.goto('/teams.html');
  await expect(page.locator('#teamList')).toHaveAttribute('aria-busy', 'false');

  const teamCard = page.locator(`.team-card[data-team-id="${PRACTICE_TEAM.id}"]`);
  await teamCard.locator('.team-header__toggle').click();
  const staffSection = teamCard.locator('.team-staff');

  await expect(staffSection.getByRole('link', { name: 'Email Fixture Head Coach' })).toHaveAttribute('href', 'mailto:head.coach@fixtures.example');
  await expect(staffSection.getByRole('link', { name: 'Email Fixture Assistant Coach' })).toHaveCount(0);
  await expect(staffSection.getByRole('link', { name: 'Email Fixture Team Manager' })).toHaveAttribute('href', 'mailto:manager@fixtures.example');
  await expect(staffSection.getByRole('link', { name: 'Email all coaches' })).toHaveAttribute('href', 'mailto:coaches@fixtures.example');
  await expect(staffSection.getByRole('link', { name: 'Email all managers' })).toHaveAttribute('href', 'mailto:managers@fixtures.example');
  await expect(staffSection.locator('.team-staff__group-email')).toHaveCount(2);
  await expect(staffSection.getByRole('link', { name: / via / })).toHaveCount(0);
  await expect(staffSection.locator('.team-staff__columns > div > :first-child')).toHaveClass(['team-staff__group-emails', 'team-staff__group-emails']);

  const groupEmail = staffSection.getByRole('link', { name: 'Email all coaches' });
  await expect(groupEmail).toHaveCSS('text-decoration-line', 'none');
  await groupEmail.focus();
  await expect(groupEmail).toBeFocused();
  await expect(groupEmail).toHaveCSS('text-decoration-line', 'none');

  const sparseTeamCard = page.locator(`.team-card[data-team-id="${teams.opponentTeam.id}"]`);
  await sparseTeamCard.locator('.team-header__toggle').click();
  const sparseStaffColumns = sparseTeamCard.locator('.team-staff__columns > div');
  await expect(sparseTeamCard.getByRole('link', { name: 'Email all managers' })).toHaveCount(1);
  await expect(sparseTeamCard.getByRole('link', { name: 'Email all coaches' })).toHaveCount(0);
  const staffListTops = await sparseStaffColumns.locator('.team-staff__list').evaluateAll(lists => (
    lists.map(list => list.getBoundingClientRect().top)
  ));
  expect(Math.abs(staffListTops[0] - staffListTops[1])).toBeLessThan(1);

  await page.setViewportSize(MOBILE_VIEWPORT);
  const mobileStaffColumnBoxes = await sparseStaffColumns.evaluateAll(columns => (
    columns.map(column => column.getBoundingClientRect()).map(({ top, bottom }) => ({ top, bottom }))
  ));
  expect(mobileStaffColumnBoxes[1].top).toBeGreaterThan(mobileStaffColumnBoxes[0].bottom);
});

test('[WF-TEAMS-003] team directory filters regular practice times to selected practice groups', async ({ page }) => {
  await seedPreferences(page, { practiceGroups: ['9-10'] });
  await page.goto('/teams.html');
  await expect(page.locator('#teamList')).toHaveAttribute('aria-busy', 'false');

  const teamCard = page.locator(`.team-card[data-team-id="${PRACTICE_TEAM.id}"]`);
  await teamCard.locator('.team-header__toggle').click();
  const schedule = teamCard.locator('.practice-schedule__phase').filter({ hasText: 'In-season practices' });
  await schedule.locator('summary').click();
  const visibleGroups = await schedule.locator('.session-group').allTextContents();
  expect(visibleGroups.length).toBeGreaterThan(0);
  expect(visibleGroups.every(group => /9\s*[-&]\s*1[02]|10 & Under/i.test(group))).toBe(true);
});

test('[WF-TEAMS-004] published merchandise and booster actions appear in team details', async ({ page }) => {
  await page.setViewportSize(MOBILE_VIEWPORT);
  await initializeAnalyticsRecorder(page);
  await page.goto('/teams.html');
  await expect(page.locator('#teamList')).toHaveAttribute('aria-busy', 'false');

  const actionTeam = page.locator(`.team-card[data-team-id="${EXTERNAL_ACTION_TEAM.id}"]`);
  const merchandiseLink = actionTeam.locator('[data-analytics-link-purpose="merchandise"]');
  await expect(merchandiseLink).toBeHidden();
  await actionTeam.locator('.team-header__toggle').click();
  await expect(merchandiseLink).toBeVisible();
  await expect(merchandiseLink).toHaveAttribute('href', /^https:\/\//);
  await expect(actionTeam.getByRole('link', { name: 'Team Calendar' })).toHaveAttribute('href', /^https:\/\//);
  await expect(actionTeam.getByRole('link', { name: 'Subscribe to team events calendar' })).toHaveAttribute('href', /^https:\/\//);
  const calendarActionTops = await actionTeam.locator('.team-actions--calendar a').evaluateAll(links => (
    links.map(link => link.getBoundingClientRect().top)
  ));
  expect(Math.abs(calendarActionTops[0] - calendarActionTops[1])).toBeLessThan(1);
  await expect(actionTeam.getByRole('link', { name: 'Booster Club', exact: true })).toHaveAttribute('href', /^https:\/\//);
  await actionTeam.locator('.team-merchandise').evaluate(link => {
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
  await expect(actionTeam.locator('.team-header__toggle')).toHaveAttribute('aria-expanded', 'true');

  const teamWithoutActions = page.locator(`.team-card[data-team-id="${TEAM_WITHOUT_EXTERNAL_ACTIONS.id}"]`);
  await expect(teamWithoutActions.locator('.team-merchandise')).toHaveCount(0);
  await expect(teamWithoutActions.getByRole('link', { name: /Booster Club/ })).toHaveCount(0);
});

test('[WF-TEAMS-005] unknown team deep links leave the loaded directory stable', async ({ page }) => {
  await page.goto('/teams.html?team=not-a-published-team%22%5D');
  await expect(page.locator('#teamList')).toHaveAttribute('aria-busy', 'false');
  const teamCards = page.locator('.team-card');
  const renderedTeamCount = await teamCards.count();
  expect(renderedTeamCount).toBeGreaterThan(0);
  await expect(teamCards).toHaveCount(renderedTeamCount);
  await expect(page.locator('.team-card.highlighted')).toHaveCount(0);
});

test('[WF-TEAMS-006] team meet schedule shows all columns within its phone-width panel', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 900 });
  await setAgendaReferenceTime(page);
  await page.goto('/teams.html');
  await expect(page.locator('#teamList')).toHaveAttribute('aria-busy', 'false');

  const teamCard = page.locator(`.team-card[data-team-id="${PRACTICE_TEAM.id}"]`);
  await teamCard.locator('.team-header__toggle').click();
  const meetSchedule = teamCard.locator('.team-meets__phase');
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
  expect(await meetSchedule.locator('tbody tr').count()).toBeGreaterThan(0);
  await expect(meetSchedule.locator('tbody tr').first().locator('td')).toHaveCount(4);
});

test('[WF-TEAMS-007] phone-width team details expose upcoming and full practice schedules without cramped labels', async ({ page }) => {
  await page.setViewportSize(MOBILE_VIEWPORT);
  await setAgendaReferenceTime(page);
  await page.goto('/teams.html');
  await expect(page.locator('#teamList')).toHaveAttribute('aria-busy', 'false');

  const teamCard = page.locator(`.team-card[data-team-id="${PRACTICE_TEAM.id}"]`);
  await teamCard.locator('.team-header__toggle').click();
  await expect(teamCard.locator('.favorite-week__events li').first()).toBeVisible();

  const preSeason = teamCard.locator('.practice-schedule__phase').filter({ hasText: 'Pre-season practices' });
  const inSeason = teamCard.locator('.practice-schedule__phase').filter({ hasText: 'In-season practices' });
  await expect(preSeason).toHaveAttribute('open', '');
  await expect(inSeason).toHaveAttribute('open', '');
  await expect(preSeason.locator('.practice-schedule__body')).toBeVisible();
  await expect(inSeason.locator('.practice-schedule__body')).toBeVisible();
  await expect(inSeason).toContainText('Morning Practice:');

  const trainingLabel = preSeason.locator('.session-group').first();
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
    baseURL: PLAYWRIGHT_SERVER_URL,
    hasTouch: true,
    isMobile: true,
    viewport: { width: 980, height: 915 }
  });
  const touchPage = await touchContext.newPage();

  try {
    await prepareStableWeatherResponses(touchPage);
    await routeAnnualDataFixture(touchPage, ['meets', 'pools', 'teams']);
    await touchPage.goto('/teams.html');
    await expect(touchPage.locator('#teamList')).toHaveAttribute('aria-busy', 'false');
    await expect.poll(() => touchPage.evaluate(() => ({
      compact: globalThis.matchMedia('(max-width: 48rem)').matches,
      maxTouchPoints: globalThis.navigator.maxTouchPoints
    }))).toEqual({ compact: false, maxTouchPoints: 1 });

    const teamCard = touchPage.locator(`.team-card[data-team-id="${PRACTICE_TEAM.id}"]`);
    await teamCard.locator('.team-header__toggle').click();
    await expect(teamCard.locator('.practice-schedule__phase').filter({ hasText: 'Pre-season practices' })).toHaveAttribute('open', '');
    await expect(teamCard.locator('.practice-schedule__phase').filter({ hasText: 'In-season practices' })).toHaveAttribute('open', '');
  } finally {
    await touchContext.close();
  }
});
