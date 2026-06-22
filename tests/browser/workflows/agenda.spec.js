const { test, expect } = require('../browser-test');
const AxeBuilder = require('@axe-core/playwright').default;
const AppConfig = require('../../../scripts/adapters/app-config.js');
const {
  AUDIENCE_VIEWPORTS,
  getAnnualDataRoute,
  prepareStableWeatherResponses,
  readAnnualData,
  seedPreferences,
  setAgendaReferenceTime
} = require('../browser-test-helpers');

const ANNUAL_TEAMS = readAnnualData('teams').teams;
const REGULAR_MEETS = readAnnualData('meets').regular_meets;
const AGENDA_TEAM = ANNUAL_TEAMS.find(team => team.practice?.preseason?.length && team.practice?.regular);
const FILTER_TEAM = ANNUAL_TEAMS.find(team => {
  const practice = JSON.stringify(team.practice || {});
  return practice.includes('First Splash') && practice.includes('8 & Under');
}) || AGENDA_TEAM;
const MEET_DAY_TEAM = ANNUAL_TEAMS.find(team => team.homeMeetGuides?.some(guide => {
  const paymentMethods = guide.general?.concessions?.paymentMethods || [];
  return paymentMethods.includes('paypal') && paymentMethods.includes('venmo');
}));
const MEET_DAY_MEETS = REGULAR_MEETS.filter(meet => {
  const names = [meet.home_team, meet.visiting_team].map(name => name.toLowerCase());
  return MEET_DAY_TEAM.keywords.some(keyword => names.includes(keyword.toLowerCase()));
});
const LINKED_AGENDA_MEET = REGULAR_MEETS.find(meet => meet.date && meet.home_team && meet.visiting_team && meet.location);
const LINKED_AGENDA_TEAM = ANNUAL_TEAMS.find(team => {
  const meetTeams = [LINKED_AGENDA_MEET.home_team, LINKED_AGENDA_MEET.visiting_team]
    .map(name => name.toLowerCase());
  return team.keywords.some(keyword => meetTeams.includes(keyword.toLowerCase()));
});

function getMeetReferenceTime(meetIndex, dayOffset, time = '12:00:00') {
  const referenceTime = new Date(`${MEET_DAY_MEETS[meetIndex].date}T${time}-04:00`);
  referenceTime.setDate(referenceTime.getDate() + dayOffset);
  return referenceTime;
}

async function pauseFirstAgendaDependency(page) {
  let releaseFirstDependency;
  let reportLastDependencyRequest;
  const firstDependencyReleased = new Promise(resolve => { releaseFirstDependency = resolve; });
  const lastDependencyRequested = new Promise(resolve => { reportLastDependencyRequest = resolve; });
  await page.route('**/js/services/html-safety.js*', async route => {
    await firstDependencyReleased;
    await route.continue();
  });
  await page.route('**/js/services/meet-day-guide-service.js*', async route => {
    reportLastDependencyRequest();
    await route.continue();
  });
  return { lastDependencyRequested, releaseFirstDependency };
}

test.beforeEach(async ({ page }) => {
  await prepareStableWeatherResponses(page);
});

test('[WF-AGENDA-001] team directory shows the same next practices and swim event agenda as home', async ({ page }) => {
  await setAgendaReferenceTime(page);
  await page.goto('/teams.html');
  await expect(page.locator('#teamListStatus')).toContainText('Team directory loaded.');

  const teamCard = page.locator(`.team-card[data-team-id="${AGENDA_TEAM.id}"]`);
  await teamCard.locator('.team-header__toggle').click();
  const agenda = teamCard.locator('.favorite-week');
  await expect(agenda.getByRole('heading', { name: 'Upcoming Events' })).toBeVisible();
  await expect(agenda.locator('.favorite-week__status')).toHaveCount(0);
  const teamEvents = await agenda.locator('.favorite-week__events li').allTextContents();
  expect(teamEvents.length).toBeGreaterThan(0);
  await expect(agenda.locator('.favorite-week__day-relative.upcoming-day-pill').first()).toBeVisible();
  await expect.poll(() => agenda.locator('.favorite-week__day').first().evaluate(day => {
    const dayHeading = day.querySelector('h4');
    const events = day.querySelector('.favorite-week__events');
    return Math.round(events.getBoundingClientRect().left - dayHeading.getBoundingClientRect().left);
  })).toBe(0);
  await expect.poll(() => agenda.locator('.favorite-week__day').first().evaluate(day => {
    const heading = day.querySelector('h4');
    const date = heading.querySelector('span');
    const relativeDay = heading.querySelector('.favorite-week__day-relative');
    const headingBox = heading.getBoundingClientRect();
    const dateBox = date.getBoundingClientRect();
    const relativeDayBox = relativeDay.getBoundingClientRect();
    return {
      alignedRight: Math.abs(headingBox.right - relativeDayBox.right) <= 1,
      sameLine: relativeDayBox.top < dateBox.bottom && relativeDayBox.bottom > dateBox.top
    };
  })).toEqual({ alignedRight: true, sameLine: true });
  await page.evaluate(teamId => {
    globalThis.PreferencesService.save({ favoriteTeamId: teamId });
  }, AGENDA_TEAM.id);
  await page.goto('/index.html');
  await expect(page.locator('#favoriteWeek')).toBeVisible();
  await expect(page.locator('#favoriteWeek .favorite-week__events li')).toHaveText(teamEvents);
});

test('[WF-AGENDA-006] desktop team agendas fill the available team-details width', async ({ page }) => {
  await setAgendaReferenceTime(page);
  await page.goto('/teams.html');
  await expect(page.locator('#teamListStatus')).toContainText('Team directory loaded.');

  const teamCard = page.locator(`.team-card[data-team-id="${AGENDA_TEAM.id}"]`);
  await teamCard.locator('.team-header__toggle').press('Enter');
  await expect.poll(() => teamCard.locator('.favorite-week__days').evaluate(days => {
    const firstDay = days.querySelector('.favorite-week__day');
    const heading = firstDay.querySelector('h4');
    const events = firstDay.querySelector('.favorite-week__events');
    const details = days.closest('.team-details');
    return {
      aligned: Math.abs(heading.getBoundingClientRect().left - events.getBoundingClientRect().left) <= 1,
      fillsDetails: Math.abs(days.getBoundingClientRect().width - details.getBoundingClientRect().width) <= 1,
      widerThanCompactMeasure: days.getBoundingClientRect().width > 44 * 16
    };
  })).toEqual({ aligned: true, fillsDetails: true, widerThanCompactMeasure: true });
});

test('[WF-AGENDA-002] home page shows the next practices and swim event for a selected favorite team', async ({ page }) => {
  const referenceTime = new Date(`${LINKED_AGENDA_MEET.date}T12:00:00-04:00`);
  referenceTime.setDate(referenceTime.getDate() - 1);
  await page.clock.setFixedTime(referenceTime);
  await seedPreferences(page, { favoriteTeamId: LINKED_AGENDA_TEAM.id });
  let resolveTeamRequest;
  let confirmTeamRequest;
  const teamRequestAllowed = new Promise(resolve => { resolveTeamRequest = resolve; });
  const teamRequestStarted = new Promise(resolve => { confirmTeamRequest = resolve; });
  await page.route(getAnnualDataRoute('teams'), async route => {
    confirmTeamRequest();
    await teamRequestAllowed;
    await route.continue();
  });
  await page.goto('/index.html');

  const agenda = page.locator('#favoriteWeek');
  await teamRequestStarted;
  await expect(agenda).toBeHidden();
  await expect(page.locator('#shareSite')).toBeHidden();
  await expect(page.locator('html')).toHaveClass(/has-saved-favorite-team/);
  await expect(page.locator('#favoriteWeekTitle')).toBeEmpty();
  await expect(page.locator('#favoriteWeekStatus')).toBeHidden();
  await expect(agenda).not.toContainText("Your team's upcoming events");
  resolveTeamRequest();
  await expect(agenda).toBeVisible();
  await expect(agenda.getByRole('heading', { name: /Upcoming .+ Events/ })).toBeVisible();
  await expect(agenda.locator('.favorite-badge')).toHaveCount(0);
  await expect(agenda.getByRole('link', { name: 'Team details' })).toHaveCount(0);
  await expect(page.locator('#favoriteWeekStatus')).toBeHidden();
  expect(await agenda.locator('.favorite-week__events li').count()).toBeGreaterThan(0);
  await expect(agenda.locator('a[href^="pools.html?pool="]').first()).toBeVisible();
  const calendarLink = agenda.getByRole('link', { name: 'Team Calendar' });
  await expect(calendarLink).toHaveAttribute('href', /^https:\/\//);
  await expect(calendarLink).toHaveAttribute('target', '_blank');
  await expect(calendarLink).toHaveAttribute('rel', 'noopener');
  const subscriptionLink = agenda.getByRole('link', { name: 'Subscribe to team events calendar' });
  if (LINKED_AGENDA_TEAM.eventsSubscriptionUrl) {
    await expect(subscriptionLink).toHaveAttribute('href', /^https:\/\//);
  } else {
    await expect(subscriptionLink).toHaveCount(0);
  }
  await expect(page.locator('#shareSite')).toBeVisible();
  await expect.poll(() => page.locator('#favoriteWeekToggle').evaluate(toggle => {
    const iconBounds = toggle.querySelector('.favorite-week__toggle-icon').getBoundingClientRect();
    const toggleBounds = toggle.getBoundingClientRect();
    return Math.abs(toggleBounds.right - iconBounds.right) <= 1;
  })).toBe(true);
  await expect.poll(() => page.evaluate(() => {
    const agendaBottom = globalThis.document.getElementById('favoriteWeek').getBoundingClientRect().bottom;
    const shareTop = globalThis.document.getElementById('shareSite').getBoundingClientRect().top;
    return shareTop >= agendaBottom;
  })).toBe(true);

  const toggle = page.locator('#favoriteWeekToggle');
  await toggle.press('Enter');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('#favoriteWeekContent')).toBeHidden();
  await toggle.press('Enter');
  await expect(page.locator('#favoriteWeekContent')).toBeVisible();

  const meetLink = agenda.locator('.favorite-week__matchup a[href^="meets.html?date="]');
  await expect(meetLink).toBeVisible();
  await expect.poll(() => meetLink.evaluate(link => {
    const matchup = link.closest('.favorite-week__matchup');
    const eventName = matchup.parentElement.querySelector('.favorite-week__event-name');
    return Math.round(matchup.getBoundingClientRect().left - eventName.getBoundingClientRect().left);
  })).toBe(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => agenda.locator('.team-actions--calendar').evaluate(actions => {
    const actionsBounds = actions.getBoundingClientRect();
    const contentBounds = actions.closest('.favorite-week__content').getBoundingClientRect();
    return {
      contained: actionsBounds.left >= contentBounds.left && actionsBounds.right <= contentBounds.right,
      hasHorizontalOverflow: globalThis.document.documentElement.scrollWidth
        > globalThis.document.documentElement.clientWidth
    };
  })).toEqual({ contained: true, hasHorizontalOverflow: false });
  const accessibilityResults = await new AxeBuilder({ page })
    .include('#favoriteWeek')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(accessibilityResults.violations).toEqual([]);
  const meetHref = await meetLink.getAttribute('href');
  const meetUrl = new URL(meetHref, 'https://cnsl.test/');
  await meetLink.focus();
  await expect(meetLink).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(new RegExp(`meets\\.html\\?date=${meetUrl.searchParams.get('date')}&pool=${meetUrl.searchParams.get('pool')}$`));
  await expect(page.locator(`.meet-date-card[data-meet-date="${meetUrl.searchParams.get('date')}"] .meet-details[data-meet-pool-id="${meetUrl.searchParams.get('pool')}"]`)).toHaveClass(/highlighted/);
});

test('[WF-AGENDA-007] home page follows the My Meet Day experimental opt-in', async ({ page }) => {
  await page.clock.setFixedTime(getMeetReferenceTime(0, -2));
  await seedPreferences(page, { experimentalFeatures: ['my-meet-day'], favoriteTeamId: MEET_DAY_TEAM.id });
  await page.goto('/index.html');

  const meetDay = page.locator('#myMeetDay');
  await expect(meetDay).toBeVisible();
  await expect(meetDay.getByRole('heading', { name: /My Meet Day/ })).toBeVisible();
  await expect(meetDay.locator('.experimental-badge')).toHaveText('Experimental');
  await expect(meetDay).toContainText('Away meet');
  const relativeDayPill = meetDay.locator('.my-meet-day__schedule > .upcoming-day-pill');
  await expect(relativeDayPill).toHaveText('in 2 days');
  await expect.poll(() => meetDay.locator('.my-meet-day__schedule').evaluate(schedule => {
    const dateBounds = schedule.querySelector('time').getBoundingClientRect();
    const timeBounds = schedule.querySelector('.my-meet-day__meet-time').getBoundingClientRect();
    const pillBounds = schedule.querySelector('.upcoming-day-pill').getBoundingClientRect();
    return pillBounds.top >= Math.max(dateBounds.bottom, timeBounds.bottom);
  })).toBe(true);
  expect(await meetDay.locator('.my-meet-day__fact').count()).toBeGreaterThan(0);
  await expect(meetDay.locator('.my-meet-day__fact dt').filter({ hasText: /^Pool$/ })).toHaveCount(0);
  const agenda = page.locator('#favoriteWeek');
  await expect(agenda).toBeVisible();
  await expect.poll(() => page.evaluate(() => {
    const meetDayBounds = globalThis.document.getElementById('myMeetDay').getBoundingClientRect();
    const agendaBounds = globalThis.document.getElementById('favoriteWeek').getBoundingClientRect();
    const home = globalThis.document.querySelector('.home-view');
    const homeStyle = globalThis.getComputedStyle(home);
    const homeContentWidth = home.clientWidth
      - Number.parseFloat(homeStyle.paddingLeft)
      - Number.parseFloat(homeStyle.paddingRight);
    const concessionsBounds = globalThis.document.querySelector('.my-meet-day__fact--concessions').getBoundingClientRect();

    return {
      agendaUsesHomeWidth: Math.abs(agendaBounds.width - homeContentWidth) <= 1,
      concessionsContained: concessionsBounds.left >= meetDayBounds.left
        && concessionsBounds.right <= meetDayBounds.right,
      meetDayUsesHomeWidth: Math.abs(meetDayBounds.width - homeContentWidth) <= 1,
      sameWidth: Math.abs(meetDayBounds.width - agendaBounds.width) <= 1,
      hasHorizontalOverflow: globalThis.document.documentElement.scrollWidth
        > globalThis.document.documentElement.clientWidth
    };
  })).toEqual({
    agendaUsesHomeWidth: true,
    concessionsContained: true,
    meetDayUsesHomeWidth: true,
    sameWidth: true,
    hasHorizontalOverflow: false
  });
  const poolLinks = meetDay.locator('a[href^="pools.html?pool="]');
  expect(await poolLinks.count()).toBeGreaterThan(0);
  const directionsLink = meetDay.locator('a[href*="google.com/maps/dir/"]');
  await expect(directionsLink).toBeVisible();
  await expect(directionsLink.locator('svg')).toHaveCount(1);
  await expect(directionsLink).toContainText('Directions');
  await expect(directionsLink).toHaveAttribute('href', /https:\/\/www\.google\.com\/maps\/dir\//);
  await expect(meetDay.getByRole('heading', { name: 'Key times' })).toHaveCount(0);
  const poolLink = poolLinks.first();
  await poolLink.focus();
  await expect(poolLink).toBeFocused();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => meetDay.locator('.my-meet-day__schedule').evaluate(schedule => {
    const detailsBounds = schedule.querySelector('.my-meet-day__schedule-details').getBoundingClientRect();
    const pillBounds = schedule.querySelector('.upcoming-day-pill').getBoundingClientRect();
    return pillBounds.top >= detailsBounds.bottom;
  })).toBe(true);
  await expect.poll(() => page.evaluate(() => {
    const sectionRect = globalThis.document.getElementById('myMeetDay').getBoundingClientRect();
    const toggle = globalThis.document.getElementById('myMeetDayToggle');
    const badge = toggle.querySelector('.experimental-badge');
    const iconRect = toggle.querySelector('.favorite-week__toggle-icon').getBoundingClientRect();
    const badgeRect = badge.getBoundingClientRect();
    const labelRect = toggle.querySelector('.my-meet-day__toggle-title').getBoundingClientRect();
    const toggleRect = toggle.getBoundingClientRect();
    const sectionCenter = sectionRect.left + (sectionRect.width / 2);
    const labelCenter = labelRect.left + (labelRect.width / 2);
    return {
      badgeBeforeArrow: badgeRect.right < iconRect.left,
      iconAlignedRight: Math.abs(toggleRect.right - iconRect.right) <= 1,
      isCentered: Math.abs(sectionCenter - labelCenter) <= 1,
      titleClearOfBadge: labelRect.right < badgeRect.left,
      hasHorizontalOverflow: globalThis.document.documentElement.scrollWidth > globalThis.document.documentElement.clientWidth
    };
  })).toEqual({ badgeBeforeArrow: true, iconAlignedRight: true, isCentered: true, titleClearOfBadge: true, hasHorizontalOverflow: false });
  const meetDayToggle = page.locator('#myMeetDayToggle');
  await meetDayToggle.press('Enter');
  await expect(meetDayToggle).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('#myMeetDayContent')).toBeHidden();
  await meetDayToggle.press('Enter');
  await expect(page.locator('#myMeetDayContent')).toBeVisible();
});

test('[WF-AGENDA-008] dedicated My Meet Day route loads only after the experiment is enabled', async ({ page }) => {
  await page.clock.setFixedTime(getMeetReferenceTime(0, -2));
  const dependencyRequests = await pauseFirstAgendaDependency(page);
  await page.goto('/my-meet-day.html');

  await expect(page.getByRole('heading', { name: /My Meet Day/ })).toBeVisible();
  await expect(page.locator('#myMeetDayDisabled')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open Experimental Features' })).toHaveAttribute('href', 'settings.html');
  await expect(page.locator('script[data-my-meet-day-dependency]')).toHaveCount(0);
  const navigationLink = page.locator('#navMenu [data-experimental-feature="my-meet-day"]');
  await page.getByRole('button', { name: 'Open navigation menu' }).click();
  await expect(navigationLink).toBeHidden();
  await page.getByRole('button', { name: 'Close navigation menu' }).click();

  await page.evaluate(teamId => {
    globalThis.PreferencesService.save({ experimentalFeatures: ['my-meet-day'], favoriteTeamId: teamId });
    globalThis.dispatchEvent(new globalThis.CustomEvent('cnsl:preferences-changed'));
  }, MEET_DAY_TEAM.id);

  await dependencyRequests.lastDependencyRequested;
  await expect(page.locator('#myMeetDay')).toBeHidden();
  dependencyRequests.releaseFirstDependency();
  await expect(page.locator('#myMeetDay')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Team Calendar' })).toHaveAttribute('href', /^https:\/\//);
  expect(await page.locator('#myMeetDay .my-meet-day__fact').count()).toBeGreaterThan(0);
  await expect(page.locator('#myMeetDay a[href^="pools.html?pool="]')).not.toHaveCount(0);
  await expect(page.locator('#myMeetDay').getByRole('link', { name: "how to mark a swimmer's arm" })).toHaveAttribute('href', 'swim-meet-resources.html#arm-markings');
  await expect(page.locator('#myMeetDay').getByRole('heading', { name: 'Key times' })).toHaveCount(0);
  await expect(page.locator('#myMeetDayStatus')).toHaveText('Meet-day details loaded.');
  await expect(page.locator('script[data-my-meet-day-dependency]')).toHaveCount(
    AppConfig.MY_MEET_DAY_PRIMARY_DEPENDENCIES.length + AppConfig.MY_MEET_DAY_OPTIONAL_DEPENDENCIES.length
  );
  const controllerVersion = await page.locator('script[src*="js/my-meet-day.js"]').evaluate(script => new URL(script.src).searchParams.get('v'));
  const dependencyVersions = await page.locator('script[data-my-meet-day-dependency]').evaluateAll(scripts => (
    scripts.map(script => new URL(script.src).searchParams.get('v'))
  ));
  expect(controllerVersion).toBeTruthy();
  expect(dependencyVersions.every(version => version === controllerVersion)).toBe(true);
  await page.getByRole('button', { name: 'Open navigation menu' }).click();
  await expect(navigationLink).toBeVisible();
  await expect(navigationLink).toHaveAttribute('href', 'my-meet-day.html');

  await page.evaluate(() => {
    globalThis.PreferencesService.save({ experimentalFeatures: ['my-meet-day'], favoriteTeamId: '' });
    globalThis.dispatchEvent(new globalThis.CustomEvent('cnsl:preferences-changed'));
  });
  await expect(page.locator('#myMeetDay')).toBeHidden();
  await expect(page.locator('#myMeetDayNoFavorite')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Choose favorite team' })).toHaveAttribute('href', 'settings.html');
});

test('[WF-AGENDA-010] dedicated My Meet Day route is usable before pool enrichment settles', async ({ page }) => {
  await page.clock.setFixedTime(getMeetReferenceTime(0, -2));
  await seedPreferences(page, { experimentalFeatures: ['my-meet-day'], favoriteTeamId: MEET_DAY_TEAM.id });
  let releasePools;
  const poolsPaused = new Promise(resolve => {
    releasePools = resolve;
  });
  await page.route(getAnnualDataRoute('pools'), async route => {
    await poolsPaused;
    await route.continue();
  });

  try {
    await page.goto('/my-meet-day.html', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#myMeetDay')).toBeVisible();
    await expect(page.locator('#myMeetDayStatus')).toHaveText('Meet-day details loaded.');
    await expect(page.getByRole('link', { name: 'Team Calendar' })).toHaveAttribute('href', /^https:\/\//);
    expect(await page.locator('#myMeetDay .my-meet-day__fact').count()).toBeGreaterThan(0);
    await expect(page.locator('#myMeetDay a[href^="pools.html?pool="]')).toHaveCount(0);
  } finally {
    releasePools();
  }

  await expect(page.locator('#myMeetDay a[href^="pools.html?pool="]')).not.toHaveCount(0);
});

test('[WF-AGENDA-009] completed meets advance only the dedicated My Meet Day route beyond two days', async ({ page }) => {
  await page.clock.setFixedTime(getMeetReferenceTime(0, 0, '12:01:00'));
  await seedPreferences(page, { experimentalFeatures: ['my-meet-day'], favoriteTeamId: MEET_DAY_TEAM.id });

  await page.goto('/index.html');
  await expect(page.locator('#favoriteWeek')).toBeVisible();
  await expect(page.locator('#myMeetDay')).toBeHidden();

  await page.getByRole('button', { name: 'Open navigation menu' }).click();
  await page.getByRole('link', { name: /My Meet Day/ }).click();

  await expect(page.locator('#myMeetDay')).toBeVisible();
  await expect.poll(() => page.locator('#myMeetDay').evaluate(element => {
    const panelWidth = element.getBoundingClientRect().width;
    const main = element.closest('main');
    const mainStyle = globalThis.getComputedStyle(main);
    const mainContentWidth = main.clientWidth
      - Number.parseFloat(mainStyle.paddingLeft)
      - Number.parseFloat(mainStyle.paddingRight);
    return Math.round(mainContentWidth - panelWidth);
  })).toBe(0);
  const volunteerReminder = page.locator('#myMeetDay .my-meet-day__fact--volunteer');
  await expect(volunteerReminder.locator('dt')).toHaveText('Volunteer reminder');
  await expect(volunteerReminder.locator('dd')).not.toBeEmpty();
  await expect.poll(() => volunteerReminder.evaluate(element => {
    const concessions = element.parentElement.querySelector('.my-meet-day__fact--concessions');
    const concessionsStyle = globalThis.getComputedStyle(concessions);
    const volunteerStyle = globalThis.getComputedStyle(element);
    return {
      matchingBackground: volunteerStyle.backgroundColor === concessionsStyle.backgroundColor,
      matchingBorder: volunteerStyle.border === concessionsStyle.border,
      matchingColumns: volunteerStyle.gridTemplateColumns === concessionsStyle.gridTemplateColumns
    };
  })).toEqual({
    matchingBackground: true,
    matchingBorder: true,
    matchingColumns: true
  });
  await expect.poll(() => page.locator('#myMeetDay .my-meet-day__facts').evaluate(facts => {
    const ordinaryFact = facts.querySelector('.my-meet-day__fact:not(.my-meet-day__fact--concessions):not(.my-meet-day__fact--volunteer)');
    const blueFact = facts.querySelector('.my-meet-day__fact--concessions');
    const ordinaryLabelLeft = ordinaryFact.querySelector('dt').getBoundingClientRect().left;
    const ordinaryValueLeft = ordinaryFact.querySelector('dd').getBoundingClientRect().left;
    const blueLabelLeft = blueFact.querySelector('dt').getBoundingClientRect().left;
    const blueValueLeft = blueFact.querySelector('dd').getBoundingClientRect().left;
    return {
      labelsAligned: Math.abs(ordinaryLabelLeft - blueLabelLeft) <= 1,
      valuesAligned: Math.abs(ordinaryValueLeft - blueValueLeft) <= 1
    };
  })).toEqual({ labelsAligned: true, valuesAligned: true });
  const guidanceLists = page.locator('#myMeetDay .my-meet-day__guidance-list');
  expect(await guidanceLists.count()).toBeGreaterThan(0);
  await expect.poll(() => guidanceLists.evaluateAll(lists => ({
    allItemsAreListItems: lists.every(list => [...list.children].every(item => item.tagName === 'LI')),
    allListsAreBulleted: lists.every(list => globalThis.getComputedStyle(list.querySelector('li')).listStyleType !== 'none')
  }))).toEqual({ allItemsAreListItems: true, allListsAreBulleted: true });
  await expect(page.locator('#myMeetDay a[href^="pools.html?pool="]').first()).toBeVisible();
  const paymentMethods = page.locator('#myMeetDay .my-meet-day__payment-methods');
  await expect(paymentMethods).toBeVisible();
  await expect(paymentMethods.locator('use[href="#icon-banknote"]')).toHaveCount(1);
  await expect(paymentMethods.locator('img[src*="paypal-monogram-full-color.png"]')).toBeVisible();
  await expect(paymentMethods.locator('img[src*="venmo-wordmark-blue.png"]')).toBeVisible();
  const paymentSummary = paymentMethods.locator('..');
  await expect(paymentSummary).toHaveClass(/my-meet-day__payment-summary/);
  await expect(paymentSummary.locator('.my-meet-day__concessions-details')).toContainText(`${MEET_DAY_TEAM.shortName} accept`);
  await expect.poll(() => paymentSummary.evaluate(element => {
    const summaryBounds = element.getBoundingClientRect();
    const methodsBounds = element.querySelector('.my-meet-day__payment-methods').getBoundingClientRect();
    const introductionBounds = element.querySelector('.my-meet-day__concessions-details').getBoundingClientRect();
    return {
      methodsRightAligned: Math.abs(summaryBounds.right - methodsBounds.right) <= 1,
      sameRow: Math.abs(introductionBounds.top - methodsBounds.top) <= 1
    };
  })).toEqual({ methodsRightAligned: true, sameRow: true });
  const paymentGuidance = paymentSummary.locator('xpath=following-sibling::*[1]');
  await expect(paymentGuidance).toHaveClass(/my-meet-day__concessions-details--supporting/);
  await expect(paymentGuidance).not.toBeEmpty();
  await expect.poll(() => paymentMethods.locator('img').evaluateAll(images => (
    images.every(image => image.complete && image.naturalWidth > 0)
  ))).toBe(true);
  await expect.poll(() => paymentMethods.evaluate(element => {
    const cashIcon = element.querySelector('.my-meet-day__payment-icon').getBoundingClientRect();
    const paypalLogo = element.querySelector('.my-meet-day__payment-logo--paypal').getBoundingClientRect();
    const venmoLogo = element.querySelector('.my-meet-day__payment-logo--venmo').getBoundingClientRect();
    return {
      cashColor: globalThis.getComputedStyle(element.querySelector('.my-meet-day__payment-method')).color,
      cashHeight: Math.round(cashIcon.height),
      paypalHeight: Math.round(paypalLogo.height),
      venmoWidth: Math.round(venmoLogo.width)
    };
  })).toEqual({ cashColor: 'rgb(20, 108, 67)', cashHeight: 24, paypalHeight: 24, venmoWidth: 84 });
  const concessionGroups = page.locator('#myMeetDay .my-meet-day__concessions-group');
  expect(await concessionGroups.count()).toBeGreaterThan(1);
  await expect(concessionGroups.locator('use[href="#icon-utensils"]')).toHaveCount(1);
  await expect(concessionGroups.locator('use[href="#icon-cookie"]')).toHaveCount(1);
  await expect(concessionGroups.locator('use[href="#icon-cup-soda"]')).toHaveCount(1);
  await expect.poll(() => concessionGroups.evaluateAll(groups => {
    const headingTops = groups.map(group => group.querySelector('strong').getBoundingClientRect().top);
    const listTops = groups.map(group => group.querySelector('ul').getBoundingClientRect().top);
    const sharesTopEdge = positions => positions.every(position => Math.abs(position - positions[0]) <= 1);
    const itemsOccupySeparateRows = groups.every(group => {
      const itemTops = [...group.querySelectorAll('li')].map(item => item.getBoundingClientRect().top);
      return new Set(itemTops).size === itemTops.length;
    });
    return {
      headingsTopAligned: sharesTopEdge(headingTops),
      itemsOccupySeparateRows,
      listsTopAligned: sharesTopEdge(listTops)
    };
  })).toEqual({ headingsTopAligned: true, itemsOccupySeparateRows: true, listsTopAligned: true });
  await page.setViewportSize(AUDIENCE_VIEWPORTS.COMPACT_PHONE);
  await expect.poll(() => paymentMethods.evaluate(element => {
    const menu = element.closest('.my-meet-day__fact--concessions').querySelector('.my-meet-day__concessions-menu');
    const groups = [...menu.querySelectorAll('.my-meet-day__concessions-group')];
    const firstGroup = groups[0];
    const headingTextLeft = firstGroup.querySelector('strong').getBoundingClientRect().right
      - firstGroup.querySelector('strong').getBoundingClientRect().width
      + firstGroup.querySelector('svg').getBoundingClientRect().width
      + Number.parseFloat(globalThis.getComputedStyle(firstGroup.querySelector('strong')).columnGap || globalThis.getComputedStyle(firstGroup.querySelector('strong')).gap);
    const firstItemLeft = firstGroup.querySelector('li').getBoundingClientRect().left;
    const groupTops = groups.map(group => Math.round(group.getBoundingClientRect().top));

    return {
      firstRowGroupCount: groupTops.filter(top => top === groupTops[0]).length,
      itemAlignedWithHeadingText: Math.abs(firstItemLeft - headingTextLeft) <= 1,
      pageOverflow: globalThis.document.documentElement.scrollWidth > globalThis.document.documentElement.clientWidth,
      rowOverflow: element.scrollWidth > element.clientWidth
    };
  })).toEqual({
    firstRowGroupCount: 2,
    itemAlignedWithHeadingText: true,
    pageOverflow: false,
    rowOverflow: false
  });
});

test('[WF-AGENDA-003] shared team agenda filters published practice times by selected group', async ({ page }) => {
  await setAgendaReferenceTime(page);
  await seedPreferences(page, { favoriteTeamId: FILTER_TEAM.id, practiceGroups: ['8-under'] });
  await page.goto('/index.html');

  const agenda = page.locator('#favoriteWeek');
  const visibleGroups = await agenda.locator('.session-group').allTextContents();
  expect(visibleGroups.length).toBeGreaterThan(0);
  expect(visibleGroups.every(group => /^(?:New Swimmers|8 (?:&|and) Under)$/i.test(group.trim()))).toBe(true);
});

test('[WF-AGENDA-004] home page loads agenda dependencies only after a favorite team is selected', async ({ page }) => {
  await setAgendaReferenceTime(page);
  const dependencyRequests = await pauseFirstAgendaDependency(page);
  await page.goto('/index.html');

  await expect(page.locator('#favoriteWeek')).toBeHidden();
  await expect(page.locator('#shareSite')).toBeVisible();
  await expect(page.locator('script[data-home-schedule-dependency]')).toHaveCount(0);

  await page.evaluate(teamId => {
    globalThis.PreferencesService.save({ favoriteTeamId: teamId });
    globalThis.dispatchEvent(new globalThis.CustomEvent('cnsl:preferences-changed'));
  }, AGENDA_TEAM.id);

  await dependencyRequests.lastDependencyRequested;
  await expect(page.locator('#favoriteWeek')).toBeHidden();
  dependencyRequests.releaseFirstDependency();
  await expect(page.locator('#favoriteWeek')).toBeVisible();
  await expect(page.locator('script[data-home-schedule-dependency]')).toHaveCount(AppConfig.TEAM_AGENDA_DEPENDENCIES.length);
  const homeScheduleVersion = await page.locator('script[src*="js/home-schedule.js"]').evaluate(script => new URL(script.src).searchParams.get('v'));
  const dependencyVersions = await page.locator('script[data-home-schedule-dependency]').evaluateAll(scripts => (
    scripts.map(script => new URL(script.src).searchParams.get('v'))
  ));
  expect(homeScheduleVersion).toBeTruthy();
  expect(dependencyVersions.every(version => version === homeScheduleVersion)).toBe(true);
  await expect(page.locator('#favoriteWeek a[href^="pools.html?pool="]').first()).toBeVisible();
});

test('[WF-AGENDA-005] changing to an unavailable favorite does not display the prior team heading', async ({ page }) => {
  await setAgendaReferenceTime(page);
  await seedPreferences(page, { favoriteTeamId: AGENDA_TEAM.id });
  await page.goto('/index.html');

  const favoriteWeekTitle = page.locator('#favoriteWeekTitle');
  await expect(favoriteWeekTitle).toHaveText(/^Upcoming .+ Events$/);
  const priorHeading = await favoriteWeekTitle.textContent();

  await page.evaluate(() => {
    localStorage.setItem('cnsl_preferences', JSON.stringify({ favoriteTeamId: 'former-team' }));
    globalThis.dispatchEvent(new globalThis.Event('cnsl:preferences-changed'));
  });

  await expect(page.locator('#favoriteWeek')).toBeVisible();
  await expect(favoriteWeekTitle).toHaveText('Favorite team not found');
  await expect(page.locator('#favoriteWeekStatus')).toHaveText('That team is not listed this season. Please choose another favorite on the Teams page.');
  await expect(page.locator('#favoriteWeek')).not.toContainText(priorHeading);
});
