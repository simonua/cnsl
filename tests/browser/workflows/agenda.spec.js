const { test, expect } = require('../browser-test');
const {
  prepareStableWeatherResponses,
  seedPreferences,
  setAgendaReferenceTime
} = require('../browser-test-helpers');

test.beforeEach(async ({ page }) => {
  await prepareStableWeatherResponses(page);
});

test('[WF-AGENDA-001] team directory shows the same next practices and swim event agenda as home', async ({ page }) => {
  await setAgendaReferenceTime(page);
  await page.goto('/teams.html');
  await expect(page.locator('#teamListStatus')).toContainText('Team directory loaded.');

  const snappers = page.locator('.team-card[data-team-id="pls"]');
  await snappers.locator('.team-header__toggle').click();
  const agenda = snappers.locator('.favorite-week');
  await expect(agenda.getByRole('heading', { name: 'Upcoming events' })).toBeVisible();
  await expect(agenda.locator('.favorite-week__status')).toHaveCount(0);
  await expect(agenda.locator('.favorite-week__events li')).toHaveCount(3);
  await expect(agenda.locator('.favorite-week__day-relative')).toHaveText(['today', 'in 11 days', 'in 24 days']);
  await expect(agenda.locator('.favorite-week__day-relative.upcoming-day-pill')).toHaveCount(3);
  await expect(agenda.locator('.favorite-week__day-relative.upcoming-day-pill--today')).toHaveText('today');
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
  await expect(agenda).toContainText('Next morning practice');
  await expect(agenda).toContainText('Next evening practice');
  await expect(agenda).toContainText('Next swim event: Time Trials for returning / experienced swimmers');
  await expect(agenda).toContainText('7:00 AM - 12:00 PM');
  await expect(agenda).not.toContainText("Each Team's Home Pool");
  await expect(agenda).not.toContainText('Jeffers Hill Pool');
});

test('[WF-AGENDA-006] desktop team agendas align to the centered team-details measure', async ({ page }) => {
  await setAgendaReferenceTime(page);
  await page.goto('/teams.html');
  await expect(page.locator('#teamListStatus')).toContainText('Team directory loaded.');

  const snappers = page.locator('.team-card[data-team-id="pls"]');
  await snappers.locator('.team-header__toggle').click();
  await expect.poll(() => snappers.locator('.favorite-week__days').evaluate(days => {
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
  await seedPreferences(page, { favoriteTeamId: 'pls' });
  let resolveTeamRequest;
  let confirmTeamRequest;
  const teamRequestAllowed = new Promise(resolve => { resolveTeamRequest = resolve; });
  const teamRequestStarted = new Promise(resolve => { confirmTeamRequest = resolve; });
  await page.route('**/assets/data/2026/teams/teams.json*', async route => {
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
  await expect(agenda.getByRole('heading', { name: /Upcoming Snappers events/ })).toBeVisible();
  await expect(agenda.locator('.favorite-badge')).toHaveCount(0);
  await expect(agenda.getByRole('link', { name: 'Team details' })).toHaveCount(0);
  await expect(page.locator('#favoriteWeekStatus')).toBeHidden();
  await expect(agenda.locator('.favorite-week__events li')).toHaveCount(3);
  await expect(agenda).toContainText('Tuesday, May 26');
  await expect(agenda).toContainText('Next morning practice');
  await expect(agenda).toContainText('Next evening practice');
  await expect(agenda).toContainText('Next swim event: Time Trials for returning / experienced swimmers');
  await expect(agenda).toContainText('7:00 AM - 12:00 PM');
  await expect(agenda).toContainText('Phelps Luck');
  await expect(agenda).not.toContainText('Phelps Luck Pool');
  await expect(agenda.getByRole('link', { name: 'Phelps Luck' }).first()).toHaveAttribute('href', 'pools.html?pool=plp');
  await expect(agenda).not.toContainText("Each Team's Home Pool");
  await expect(agenda).not.toContainText('Jeffers Hill Pool');
  await expect(agenda).toContainText('5:00 - 5:30pm First Splash');
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
  await page.clock.setFixedTime(new Date('2026-06-12T12:00:00-04:00'));
  await seedPreferences(page, { experimentalFeatures: ['my-meet-day'], favoriteTeamId: 'lrm' });
  await page.goto('/index.html');

  const meetDay = page.locator('#myMeetDay');
  await expect(meetDay).toBeVisible();
  await expect(meetDay.getByRole('heading', { name: /My Meet Day/ })).toBeVisible();
  await expect(meetDay.locator('.experimental-badge')).toHaveText('Experimental');
  await expect(meetDay).toContainText('Away meet');
  await expect(meetDay).toContainText('Marlins @ Watercats');
  await expect(meetDay).toContainText('tomorrow');
  await expect(meetDay).toContainText('Faulkner Ridge Pool');
  await expect(meetDay).toContainText('10518 Marble Faun Court, Columbia, MD 21044');
  await expect(meetDay).toContainText('6-lane / 25-meter (may mean more heats & longer meet time)');
  await expect(meetDay).toContainText('Arrive by 7:15 AM');
  await expect(meetDay).toContainText('Start at 7:25 AM');
  await expect(meetDay).toContainText('By 7:55 AM');
  await expect(meetDay).toContainText('Starts at 8:00 AM');
  await expect(meetDay).toContainText('Please park by the neighborhood center behind the pool.');
  await expect(meetDay).toContainText('The six spaces near the pool entrance are reserved for coaches and managers.');
  await expect(meetDay).toContainText('Please set up behind the wading pool, just to the right of the entrance. If more space is needed, please use the area outside the side gates.');
  await expect(meetDay).toContainText('The host team did not provide a check-in location.');
  await expect(meetDay).toContainText("Your team's clerk of course will have a table behind the wading pool.");
  await expect(meetDay).toContainText('We accept cash and prefer small bills (no $100 bills).');
  await expect(meetDay.getByText('Meals', { exact: true })).toBeVisible();
  await expect(meetDay.getByText('Snacks', { exact: true })).toBeVisible();
  await expect(meetDay.getByText('Drinks', { exact: true })).toBeVisible();
  await expect(meetDay).toContainText('a variety of drinks');
  await expect(meetDay).toContainText('Starbucks coffee');
  await expect(meetDay).toContainText('vegan by request');
  await expect(meetDay).toContainText('volunteers from both teams');
  const agenda = page.locator('#favoriteWeek');
  await expect(agenda).toBeVisible();
  await expect.poll(() => page.evaluate(() => {
    const concessionsBounds = globalThis.document.querySelector('.my-meet-day__fact--concessions').getBoundingClientRect();
    const agendaDay = globalThis.document.querySelector('#favoriteWeek .favorite-week__day');
    const agendaHeadingBounds = agendaDay.querySelector('h3').getBoundingClientRect();
    const agendaEventBounds = agendaDay.querySelector('.favorite-week__event-heading').getBoundingClientRect();
    const agendaSessionBounds = agendaDay.querySelector('.sessions').getBoundingClientRect();
    const matchesConcessions = bounds => (
      Math.abs(bounds.left - concessionsBounds.left) <= 1
      && Math.abs(bounds.width - concessionsBounds.width) <= 1
    );

    return {
      eventMatches: matchesConcessions(agendaEventBounds),
      headingMatches: matchesConcessions(agendaHeadingBounds),
      sessionMatches: matchesConcessions(agendaSessionBounds)
    };
  })).toEqual({ eventMatches: true, headingMatches: true, sessionMatches: true });
  const poolLinks = meetDay.getByRole('link', { name: 'Faulkner Ridge Pool', exact: true });
  await expect(poolLinks).toHaveCount(2);
  await expect(poolLinks.first()).toHaveAttribute('href', 'pools.html?pool=frp');
  const directionsLink = meetDay.getByRole('link', { name: 'Get directions to Faulkner Ridge Pool in Google Maps' });
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
  await page.clock.setFixedTime(new Date('2026-06-11T12:00:00-04:00'));
  await page.goto('/my-meet-day.html');

  await expect(page.getByRole('heading', { name: /My Meet Day/ })).toBeVisible();
  await expect(page.locator('#myMeetDayDisabled')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open Experimental Features' })).toHaveAttribute('href', 'settings.html');
  await expect(page.locator('script[data-my-meet-day-dependency]')).toHaveCount(0);
  const navigationLink = page.locator('#navMenu [data-experimental-feature="my-meet-day"]');
  await page.getByRole('button', { name: 'Open navigation menu' }).click();
  await expect(navigationLink).toBeHidden();
  await page.getByRole('button', { name: 'Close navigation menu' }).click();

  await page.evaluate(() => {
    globalThis.PreferencesService.save({ experimentalFeatures: ['my-meet-day'], favoriteTeamId: 'lrm' });
    globalThis.dispatchEvent(new globalThis.CustomEvent('cnsl:preferences-changed'));
  });

  await expect(page.locator('#myMeetDay')).toBeVisible();
  await expect(page.locator('#myMeetDay')).toContainText('Marlins @ Watercats');
  await expect(page.locator('#myMeetDay')).toContainText('in 2 days');
  await expect(page.locator('#myMeetDay')).toContainText('Arrive by 7:15 AM');
  await expect(page.locator('#myMeetDay')).toContainText('Start at 7:25 AM');
  await expect(page.locator('#myMeetDay')).toContainText('By 7:55 AM');
  await expect(page.locator('#myMeetDay')).toContainText('Starts at 8:00 AM');
  await expect(page.locator('#myMeetDay')).toContainText('Please park by the neighborhood center behind the pool.');
  await expect(page.locator('#myMeetDay')).toContainText('The six spaces near the pool entrance are reserved for coaches and managers.');
  await expect(page.locator('#myMeetDay')).toContainText('Please set up behind the wading pool, just to the right of the entrance. If more space is needed, please use the area outside the side gates.');
  await expect(page.locator('#myMeetDay').getByRole('link', { name: 'Faulkner Ridge Pool', exact: true })).toHaveCount(2);
  await expect(page.locator('#myMeetDay').getByRole('heading', { name: 'Key times' })).toHaveCount(0);
  await expect(page.locator('#myMeetDay')).toContainText('The host team did not provide a check-in location.');
  await expect(page.locator('#myMeetDay')).toContainText("Your team's clerk of course will have a table behind the wading pool.");
  await expect(page.locator('#myMeetDay')).toContainText('We accept cash and prefer small bills (no $100 bills).');
  await expect(page.locator('#myMeetDay').getByText('Meals', { exact: true })).toBeVisible();
  await expect(page.locator('#myMeetDay').getByText('Snacks', { exact: true })).toBeVisible();
  await expect(page.locator('#myMeetDay').getByText('Drinks', { exact: true })).toBeVisible();
  await expect(page.locator('#myMeetDayStatus')).toHaveText('Meet-day details loaded.');
  await expect(page.locator('script[data-my-meet-day-dependency]')).toHaveCount(21);
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
  await page.clock.setFixedTime(new Date('2026-06-13T12:01:00-04:00'));
  await seedPreferences(page, { experimentalFeatures: ['my-meet-day'], favoriteTeamId: 'lrm' });

  await page.goto('/index.html');
  await expect(page.locator('#favoriteWeek')).toBeVisible();
  await expect(page.locator('#myMeetDay')).toBeHidden();

  await page.getByRole('button', { name: 'Open navigation menu' }).click();
  await page.getByRole('link', { name: /My Meet Day/ }).click();

  await expect(page.locator('#myMeetDay')).toBeVisible();
  await expect(page.locator('#myMeetDay')).toContainText('Piranhas @ Marlins');
  await expect(page.locator('#myMeetDay')).toContainText('in 7 days');
  const paymentMethods = page.locator('#myMeetDay .my-meet-day__payment-methods');
  await expect(paymentMethods).toBeVisible();
  await expect(paymentMethods.locator('use[href="#icon-banknote"]')).toHaveCount(1);
  await expect(paymentMethods.locator('img[src*="paypal-monogram-full-color.png"]')).toBeVisible();
  await expect(paymentMethods.locator('img[src*="venmo-wordmark-blue.png"]')).toBeVisible();
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
  await page.setViewportSize({ width: 360, height: 780 });
  await expect.poll(() => paymentMethods.evaluate(element => ({
    pageOverflow: globalThis.document.documentElement.scrollWidth > globalThis.document.documentElement.clientWidth,
    rowOverflow: element.scrollWidth > element.clientWidth
  }))).toEqual({ pageOverflow: false, rowOverflow: false });
});

test('[WF-AGENDA-003] shared team agenda filters published practice times by selected group', async ({ page }) => {
  await setAgendaReferenceTime(page);
  await seedPreferences(page, { favoriteTeamId: 'pls', practiceGroups: ['8-under'] });
  await page.goto('/index.html');

  const agenda = page.locator('#favoriteWeek');
  await expect(agenda.locator('.session-item:has(.session-group)')).toHaveText([
    /5:30 - 6:00pm\s+8 and under/,
    /8:00 - 8:30am\s+8 and under/
  ]);
  await expect(agenda).not.toContainText('First Splash');
  await expect(agenda).not.toContainText('9 - 12');
  await expect(agenda).not.toContainText('13 and over');
});

test('[WF-AGENDA-004] home page loads agenda dependencies only after a favorite team is selected', async ({ page }) => {
  await setAgendaReferenceTime(page);
  await page.goto('/index.html');

  await expect(page.locator('#favoriteWeek')).toBeHidden();
  await expect(page.locator('#shareSite')).toBeVisible();
  await expect(page.locator('script[data-home-schedule-dependency]')).toHaveCount(0);

  await page.evaluate(() => {
    globalThis.PreferencesService.save({ favoriteTeamId: 'pls' });
    globalThis.dispatchEvent(new globalThis.CustomEvent('cnsl:preferences-changed'));
  });

  await expect(page.locator('#favoriteWeek')).toBeVisible();
  await expect(page.locator('script[data-home-schedule-dependency]')).toHaveCount(21);
  const homeScheduleVersion = await page.locator('script[src*="js/home-schedule.js"]').evaluate(script => new URL(script.src).searchParams.get('v'));
  const dependencyVersions = await page.locator('script[data-home-schedule-dependency]').evaluateAll(scripts => (
    scripts.map(script => new URL(script.src).searchParams.get('v'))
  ));
  expect(homeScheduleVersion).toBeTruthy();
  expect(dependencyVersions.every(version => version === homeScheduleVersion)).toBe(true);
  await expect(page.locator('#favoriteWeek')).toContainText('Phelps Luck');
  await expect(page.locator('#favoriteWeek')).not.toContainText('Phelps Luck Pool');
});

test('[WF-AGENDA-005] changing to an unavailable favorite does not display the prior team heading', async ({ page }) => {
  await setAgendaReferenceTime(page);
  await seedPreferences(page, { favoriteTeamId: 'pls' });
  await page.goto('/index.html');

  await expect(page.locator('#favoriteWeekTitle')).toHaveText('Upcoming Snappers events');

  await page.evaluate(() => {
    localStorage.setItem('cnsl_preferences', JSON.stringify({ favoriteTeamId: 'former-team' }));
    globalThis.dispatchEvent(new globalThis.Event('cnsl:preferences-changed'));
  });

  await expect(page.locator('#favoriteWeek')).toBeVisible();
  await expect(page.locator('#favoriteWeekTitle')).toHaveText('Favorite team not found');
  await expect(page.locator('#favoriteWeekStatus')).toHaveText('That team is not listed this season. Please choose another favorite on the Teams page.');
  await expect(page.locator('#favoriteWeek')).not.toContainText('Upcoming Snappers events');
});
