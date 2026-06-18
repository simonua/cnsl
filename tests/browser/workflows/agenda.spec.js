const { test, expect } = require('../browser-test');
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
const AGENDA_TEAM = ANNUAL_TEAMS.find(team => team.practice?.preseason?.length && team.practice?.regular);
const FILTER_TEAM = ANNUAL_TEAMS.find(team => {
  const practice = JSON.stringify(team.practice || {});
  return practice.includes('First Splash') && practice.includes('8 & Under');
}) || AGENDA_TEAM;
const MEET_DAY_TEAM = ANNUAL_TEAMS.find(team => team.homeMeetGuides?.some(guide => {
  const paymentMethods = guide.general?.concessions?.paymentMethods || [];
  return paymentMethods.includes('paypal') && paymentMethods.includes('venmo');
}));
const MEET_DAY_MEETS = readAnnualData('meets').regular_meets.filter(meet => {
  const names = [meet.home_team, meet.visiting_team].map(name => name.toLowerCase());
  return MEET_DAY_TEAM.keywords.some(keyword => names.includes(keyword.toLowerCase()));
});

function getMeetReferenceTime(meetIndex, dayOffset, time = '12:00:00') {
  const referenceTime = new Date(`${MEET_DAY_MEETS[meetIndex].date}T${time}-04:00`);
  referenceTime.setDate(referenceTime.getDate() + dayOffset);
  return referenceTime;
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
  await expect(agenda.getByRole('heading', { name: 'Upcoming events' })).toBeVisible();
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

test('[WF-AGENDA-006] desktop team agendas align to the centered team-details measure', async ({ page }) => {
  await setAgendaReferenceTime(page);
  await page.goto('/teams.html');
  await expect(page.locator('#teamListStatus')).toContainText('Team directory loaded.');

  const teamCard = page.locator(`.team-card[data-team-id="${AGENDA_TEAM.id}"]`);
  await teamCard.locator('.team-header__toggle').click();
  await expect.poll(() => teamCard.locator('.favorite-week__days').evaluate(days => {
    const firstDay = days.querySelector('.favorite-week__day');
    const heading = firstDay.querySelector('h4');
    const events = firstDay.querySelector('.favorite-week__events');
    return {
      aligned: Math.abs(heading.getBoundingClientRect().left - events.getBoundingClientRect().left) <= 1,
      width: Math.round(days.getBoundingClientRect().width)
    };
  })).toEqual({ aligned: true, width: 704 });
});

test('[WF-AGENDA-002] home page shows the next practices and swim event for a selected favorite team', async ({ page }) => {
  await setAgendaReferenceTime(page);
  await seedPreferences(page, { favoriteTeamId: AGENDA_TEAM.id });
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
  await expect(agenda.getByRole('heading', { name: /Upcoming .+ events/ })).toBeVisible();
  await expect(agenda.locator('.favorite-badge')).toHaveCount(0);
  await expect(agenda.getByRole('link', { name: 'Team details' })).toHaveCount(0);
  await expect(page.locator('#favoriteWeekStatus')).toBeHidden();
  expect(await agenda.locator('.favorite-week__events li').count()).toBeGreaterThan(0);
  await expect(agenda.locator('a[href^="pools.html?pool="]').first()).toBeVisible();
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
});

test('[WF-AGENDA-007] home page follows the My Meet Day experimental opt-in', async ({ page }) => {
  await page.clock.setFixedTime(getMeetReferenceTime(0, -1));
  await seedPreferences(page, { experimentalFeatures: ['my-meet-day'], favoriteTeamId: MEET_DAY_TEAM.id });
  await page.goto('/index.html');

  const meetDay = page.locator('#myMeetDay');
  await expect(meetDay).toBeVisible();
  await expect(meetDay.getByRole('heading', { name: /My Meet Day/ })).toBeVisible();
  await expect(meetDay.locator('.experimental-badge')).toHaveText('Experimental');
  await expect(meetDay).toContainText('Away meet');
  expect(await meetDay.locator('.my-meet-day__fact').count()).toBeGreaterThan(0);
  const agenda = page.locator('#favoriteWeek');
  await expect(agenda).toBeVisible();
  await expect.poll(() => page.evaluate(() => {
    const meetDayBounds = globalThis.document.getElementById('myMeetDay').getBoundingClientRect();
    const agendaBounds = globalThis.document.getElementById('favoriteWeek').getBoundingClientRect();
    const concessionsBounds = globalThis.document.querySelector('.my-meet-day__fact--concessions').getBoundingClientRect();

    return {
      aligned: Math.abs(meetDayBounds.left - agendaBounds.left) <= 1,
      concessionsContained: concessionsBounds.left >= meetDayBounds.left
        && concessionsBounds.right <= meetDayBounds.right,
      equalWidth: Math.abs(meetDayBounds.width - agendaBounds.width) <= 1,
      hasHorizontalOverflow: globalThis.document.documentElement.scrollWidth
        > globalThis.document.documentElement.clientWidth
    };
  })).toEqual({
    aligned: true,
    concessionsContained: true,
    equalWidth: true,
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
  await expect.poll(() => page.evaluate(() => {
    const sectionRect = globalThis.document.getElementById('myMeetDay').getBoundingClientRect();
    const toggle = globalThis.document.getElementById('myMeetDayToggle');
    const iconRect = toggle.querySelector('.favorite-week__toggle-icon').getBoundingClientRect();
    const labelRect = toggle.querySelector('.experimental-heading').getBoundingClientRect();
    const toggleRect = toggle.getBoundingClientRect();
    const sectionCenter = sectionRect.left + (sectionRect.width / 2);
    const labelCenter = labelRect.left + (labelRect.width / 2);
    return {
      iconAlignedRight: Math.abs(toggleRect.right - iconRect.right) <= 1,
      isCentered: Math.abs(sectionCenter - labelCenter) <= 1,
      hasHorizontalOverflow: globalThis.document.documentElement.scrollWidth > globalThis.document.documentElement.clientWidth
    };
  })).toEqual({ iconAlignedRight: true, isCentered: true, hasHorizontalOverflow: false });
  const meetDayToggle = page.locator('#myMeetDayToggle');
  await meetDayToggle.press('Enter');
  await expect(meetDayToggle).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('#myMeetDayContent')).toBeHidden();
  await meetDayToggle.press('Enter');
  await expect(page.locator('#myMeetDayContent')).toBeVisible();
});

test('[WF-AGENDA-008] dedicated My Meet Day route loads only after the experiment is enabled', async ({ page }) => {
  await page.clock.setFixedTime(getMeetReferenceTime(0, -2));
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

  await expect(page.locator('#myMeetDay')).toBeVisible();
  expect(await page.locator('#myMeetDay .my-meet-day__fact').count()).toBeGreaterThan(0);
  expect(await page.locator('#myMeetDay a[href^="pools.html?pool="]').count()).toBeGreaterThan(0);
  await expect(page.locator('#myMeetDay').getByRole('heading', { name: 'Key times' })).toHaveCount(0);
  await expect(page.locator('#myMeetDayStatus')).toHaveText('Meet-day details loaded.');
  await expect(page.locator('script[data-my-meet-day-dependency]')).toHaveCount(AppConfig.TEAM_AGENDA_DEPENDENCIES.length);
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
  await expect(paymentMethods.locator('xpath=preceding-sibling::*[1]')).toContainText('We accept');
  await expect(paymentMethods.locator('xpath=following-sibling::*[1]')).toContainText('Please use bills');
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
    const menu = element.parentElement.querySelector('.my-meet-day__concessions-menu');
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
  await page.goto('/index.html');

  await expect(page.locator('#favoriteWeek')).toBeHidden();
  await expect(page.locator('#shareSite')).toBeVisible();
  await expect(page.locator('script[data-home-schedule-dependency]')).toHaveCount(0);

  await page.evaluate(teamId => {
    globalThis.PreferencesService.save({ favoriteTeamId: teamId });
    globalThis.dispatchEvent(new globalThis.CustomEvent('cnsl:preferences-changed'));
  }, AGENDA_TEAM.id);

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

  const priorHeading = await page.locator('#favoriteWeekTitle').textContent();
  expect(priorHeading).toMatch(/^Upcoming .+ events$/);

  await page.evaluate(() => {
    localStorage.setItem('cnsl_preferences', JSON.stringify({ favoriteTeamId: 'former-team' }));
    globalThis.dispatchEvent(new globalThis.Event('cnsl:preferences-changed'));
  });

  await expect(page.locator('#favoriteWeek')).toBeVisible();
  await expect(page.locator('#favoriteWeekTitle')).toHaveText('Favorite team not found');
  await expect(page.locator('#favoriteWeekStatus')).toHaveText('That team is not listed this season. Please choose another favorite on the Teams page.');
  await expect(page.locator('#favoriteWeek')).not.toContainText(priorHeading);
});
