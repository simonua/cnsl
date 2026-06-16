const { test, expect } = require('../browser-test');
const {
  MOBILE_VIEWPORT,
  initializeAnalyticsRecorder,
  prepareStableWeatherResponses,
  seedPreferences
} = require('../browser-test-helpers');

test.beforeEach(async ({ page }) => {
  await prepareStableWeatherResponses(page);
});

test('[WF-POOLS-001] pool feature filters expose their state and resulting count', async ({ page }) => {
  await initializeAnalyticsRecorder(page);
  await page.goto('/pools.html');
  await expect(page.locator('#poolListStatus')).toContainText('Pool directory loaded.');

  const filters = page.locator('#togglePoolFeatureFilters');
  await page.locator('#poolFeatureFilter').click({ position: { x: 4, y: 4 } });
  await expect(filters).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('.pool-filter__group--accessibility')).toBeVisible();
  await expect(page.locator('.pool-filter__option--young-swimmers').first()).toBeVisible();
  await expect(page.locator('.pool-filter__option--water-play').first()).toBeVisible();
  await expect(page.getByLabel('Meter lanes')).toBeVisible();
  await expect(page.getByLabel('Yard lanes')).toBeVisible();
  await expect(page.locator('.pool-filter__data-marker')).toHaveCount(0);
  await expect(page.locator('#poolLaneUnitsNote')).toHaveCount(0);
  const chipColors = await Promise.all([
    page.locator('.pool-filter__option--accessibility > span').first().evaluate(chip => globalThis.getComputedStyle(chip).backgroundColor),
    page.locator('.pool-filter__option--young-swimmers > span').first().evaluate(chip => globalThis.getComputedStyle(chip).backgroundColor),
    page.locator('.pool-filter__option--water-play > span').first().evaluate(chip => globalThis.getComputedStyle(chip).backgroundColor)
  ]);
  expect(new Set(chipColors).size).toBe(3);
  await page.locator('input[name="poolFeature"]').first().check();

  await expect(page.locator('#poolFilterSummary')).toHaveText(/\d+ \/ 23 pools/);
  await expect(page.locator('#poolFeatureFilterCount')).toHaveText('1 selected');

  await page.locator('#clearPoolFeatureFilters').click();
  await expect(filters).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#poolFilterSummary')).toHaveText('23 pools');
  await expect.poll(() => page.evaluate(() => globalThis.recordedAnalyticsEvents.filter(eventArguments => eventArguments[1] === 'ca_setting_change'))).toEqual([
    ['event', 'ca_setting_change', { setting_name: 'pool_feature_filters' }],
    ['event', 'ca_setting_change', { setting_name: 'pool_feature_filters' }]
  ]);

  await page.locator('#poolFeatureFilterOptions').evaluate(options => {
    const untrustedInput = options.ownerDocument.createElement('input');
    untrustedInput.type = 'checkbox';
    untrustedInput.name = 'poolFeature';
    untrustedInput.value = 'person@example.com';
    untrustedInput.checked = true;
    options.appendChild(untrustedInput);
    untrustedInput.dispatchEvent(new options.ownerDocument.defaultView.Event('change', { bubbles: true }));
  });
  await expect.poll(() => page.evaluate(() => globalThis.recordedAnalyticsEvents.filter(eventArguments => eventArguments[1] === 'ca_setting_change'))).toHaveLength(2);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('cnsl_preferences')).poolFeatureFilters)).toEqual([]);
});

test('[WF-POOLS-014] yoga feature filter finds the pool with published yoga programming', async ({ page }) => {
  await page.goto('/pools.html');
  await expect(page.locator('#poolListStatus')).toContainText('Pool directory loaded.');

  await page.locator('#togglePoolFeatureFilters').click();
  await expect(page.getByLabel('Yoga')).toBeVisible();
  await page.getByLabel('Yoga').check();

  await expect(page.locator('#poolFilterSummary')).toHaveText('1 / 23 pools');
  await expect(page.locator('#poolList .pool-card')).toHaveCount(1);
  await expect(page.locator('#poolList .pool-card')).toContainText('Stevens Forest');
});

test('[WF-POOLS-018] lessons feature identifies CA outdoor lesson pools and links with the shared icon', async ({ page }) => {
  await page.goto('/pools.html');
  await expect(page.locator('#poolListStatus')).toContainText('Pool directory loaded.');

  await page.locator('#togglePoolFeatureFilters').click();
  await page.getByLabel('Lessons').check();

  await expect(page.locator('#poolFilterSummary')).toHaveText('7 / 23 pools');
  await expect(page.locator('#poolList .pool-card')).toHaveCount(7);
  await expect.poll(() => page.locator('#poolList .pool-card').evaluateAll(cards => cards.map(card => card.dataset.poolName))).toEqual([
    'Dorsey Hall',
    'Faulkner Ridge',
    'Hawthorn',
    'Kendall Ridge',
    'River Hill',
    'Running Brook',
    'Talbott Springs'
  ]);

  const firstPool = page.locator('#poolList .pool-card').first();
  await firstPool.locator('.pool-header__toggle').click();
  const lessonsPill = firstPool.getByRole('link', { name: 'Lessons' });
  const lessonsLinkIcon = lessonsPill.locator('.feature-pill__link-icon');
  await expect(lessonsPill).toHaveAttribute('href', 'lessons.html');
  await expect(lessonsLinkIcon).toBeVisible();
  await expect(lessonsLinkIcon.locator('use')).toHaveAttribute('href', '#icon-link');
});

test('[WF-POOLS-019] main-pool and kids slide filters remain distinct', async ({ page }) => {
  await page.goto('/pools.html');
  await expect(page.locator('#poolListStatus')).toContainText('Pool directory loaded.');

  await page.locator('#togglePoolFeatureFilters').click();
  await expect(page.getByLabel('Main pool slide')).toBeVisible();
  await expect(page.getByLabel("Kids' slide (wading pool)")).toBeVisible();

  await page.getByLabel('Main pool slide').check();
  await expect(page.locator('#poolFilterSummary')).toHaveText('6 / 23 pools');
  await expect.poll(() => page.locator('#poolList .pool-card').evaluateAll(cards => cards.map(card => card.dataset.poolName))).toEqual([
    'Clemens Crossing', 'Dickinson', 'Hopewell', 'Locust Park', 'Swansfield', 'Talbott Springs'
  ]);

  await page.getByLabel('Main pool slide').uncheck();
  await page.getByLabel("Kids' slide (wading pool)").check();
  await expect(page.locator('#poolFilterSummary')).toHaveText('9 / 23 pools');
  await expect.poll(() => page.locator('#poolList .pool-card').evaluateAll(cards => cards.map(card => card.dataset.poolName))).toEqual([
    'Dasher Green', 'Dorsey Hall', 'Faulkner Ridge', 'Hawthorn', 'Huntington',
    'Jeffers Hill', 'Kendall Ridge', 'Longfellow', 'River Hill'
  ]);
});

test('[WF-POOLS-002] pool availability filters cover live status and the upcoming seven days', async ({ page }) => {
  await page.route('**/assets/data/2026/pools/pools.json*', async route => {
    const response = await route.fetch();
    const poolData = await response.json();
    poolData.pools.forEach((pool, index) => {
      pool.schedules = [{
        startDate: '2026-05-23',
        endDate: '2026-09-07',
        hours: [
          {
            weekDays: index === 2 ? ['Tue', 'Wed'] : ['Tue'],
            startTime: index === 1 ? '3:45PM' : '1:00PM',
            endTime: index < 2 ? '6:00PM' : '4:00PM',
            types: ['Rec Swim'],
            accessStatus: 'public'
          },
          ...(['Thu', 'Fri', 'Sat', 'Sun', 'Mon'][index - 3] ? [{
            weekDays: [['Thu', 'Fri', 'Sat', 'Sun', 'Mon'][index - 3]],
            startTime: '1:00PM',
            endTime: '4:00PM',
            types: ['Rec Swim'],
            accessStatus: 'public'
          }] : []),
          ...(index === 4 ? [{
            weekDays: ['Thu'],
            startTime: '6:00PM',
            endTime: '9:00PM',
            types: ['Registration-required event'],
            accessStatus: 'public',
            isSpecialEvent: true
          }] : [])
        ]
      }];
      pool.scheduleOverrides = [];
    });
    await route.fulfill({ response, json: poolData });
  });
  await page.goto('/pools.html');
  await page.evaluate(() => {
    globalThis.TimeUtils.getCurrentEasternTimeInfo = () => ({
      date: '2026-05-26', day: 'Tue', minutes: 15 * 60, isValid: true
    });
    globalThis.dispatchEvent(new globalThis.Event('cnsl:preferences-changed'));
  });
  await page.locator('#togglePoolFeatureFilters').click();
  await expect(page.getByLabel('When pools are open for general use')).toBeVisible();

  await expect(page.locator('#poolAvailabilityFilter option')).toHaveText([
    'All pools',
    'Now',
    'Within the hour',
    'For next 2 hours',
    'Today',
    'Tomorrow',
    'Thursday',
    'Friday',
    'Saturday',
    'Sunday',
    'Monday'
  ]);

  await page.selectOption('#poolAvailabilityFilter', 'open-now');
  await expect(page.locator('#poolFilterSummary')).toHaveText('22 / 23 pools');

  await page.locator('#poolAvailabilityFilter').focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('#poolAvailabilityFilter')).toHaveValue('opens-soon');
  await expect(page.locator('#poolFilterSummary')).toHaveText('1 / 23 pools');
  await expect(page.locator('#poolListStatus')).toHaveText('Pool directory filtered to pools opening within the hour.');

  await page.keyboard.press('ArrowDown');
  await expect(page.locator('#poolAvailabilityFilter')).toHaveValue('open-next-two-hours');

  await page.keyboard.press('ArrowDown');
  await expect(page.locator('#poolAvailabilityFilter')).toHaveValue('open-today');
  await expect(page.locator('#poolFilterSummary')).toHaveText('23 / 23 pools');
  await expect(page.locator('#poolListStatus')).toHaveText('Pool directory filtered to pools with general-use hours today.');
  await expect(page.locator('#poolList .pool-status-indicator.gray')).toHaveCount(0);

  await page.keyboard.press('ArrowDown');
  await expect(page.locator('#poolAvailabilityFilter')).toHaveValue('open-tomorrow');
  await expect(page.locator('#poolFilterSummary')).toHaveText('1 / 23 pools');
  await expect(page.locator('#poolListStatus')).toHaveText('Pool directory filtered to pools with general-use hours tomorrow.');
  await expect(page.locator('#poolList .pool-transition-summary')).toHaveText('Wed 1pm - 4pm');
  await expect(page.locator('#poolList .pool-transition-summary')).toHaveAttribute(
    'aria-label',
    'Wednesday general-use hours: 1:00 PM to 4:00 PM'
  );
  await expect(page.locator('#poolList .pool-status-indicator.gray')).toHaveCount(1);
  await expect(page.locator('#poolList .pool-header__toggle')).toHaveAccessibleName(/Current status not applicable/);
  await expect(page.locator('#poolList')).not.toContainText(/Opens in|Closes in/);

  await page.selectOption('#poolAvailabilityFilter', 'open-day-2');
  await expect(page.locator('#poolFilterSummary')).toHaveText('1 / 23 pools');
  await expect(page.locator('#poolListStatus')).toHaveText('Pool directory filtered to pools with general-use hours Thursday.');
  await expect(page.locator('#poolList .pool-transition-summary')).toHaveText('Thu 1pm - 4pm');
  await expect(page.locator('#poolList .pool-status-indicator.gray')).toHaveCount(1);

  await page.selectOption('#poolAvailabilityFilter', 'open-next-two-hours');
  await expect(page.locator('#poolFilterSummary')).toHaveText('1 / 23 pools');
  await expect(page.locator('#poolList .pool-card')).toHaveCount(1);
  await expect(page.locator('#poolFeatureFilterCount')).toHaveText('1 selected');

  await page.locator('#clearPoolFeatureFilters').click();
  await expect(page.locator('#poolAvailabilityFilter')).toHaveValue('all');
  await expect(page.locator('#poolFilterSummary')).toHaveText('23 pools');
});

test('[WF-POOLS-003] pool tile features are ordered by category then alphabetically', async ({ page }) => {
  await page.route('**/assets/data/2026/pools/pools.json*', async route => {
    const response = await route.fetch();
    const poolData = await response.json();
    const scrambledFeatures = [
      'wifi', 'main pool slide', 'wading pool slide', 'wading', 'lap',
      'ada compliant', 'bathhouse', 'family changing room', 'main pool beach entry'
    ];
    poolData.pools.forEach(pool => {
      pool.features = scrambledFeatures;
    });
    await route.fulfill({ response, json: poolData });
  });
  await page.goto('/pools.html');
  await expect(page.locator('#poolListStatus')).toContainText('Pool directory loaded.');

  const firstPoolCard = page.locator('.pool-card').first();
  await firstPoolCard.locator('.pool-header__toggle').click();
  await expect(firstPoolCard.locator('.pool-course')).toHaveCount(0);
  await expect(firstPoolCard.locator('.feature-pill')).toHaveText([
    'ADA compliant',
    'Family changing room',
    "Kids' slide (wading pool)",
    'Main pool beach entry',
    'Wading pool',
    '6 lanes',
    'Lap',
    'Main pool slide',
    'Meter lanes',
    'Bathhouse',
    'Wi-Fi'
  ]);
});

test('[WF-POOLS-004] collapsed favorite pool stays collapsed after filters redraw the directory', async ({ page }) => {
  await initializeAnalyticsRecorder(page);
  await page.goto('/pools.html');
  await page.evaluate(() => {
    localStorage.setItem('cnsl_preferences', JSON.stringify({ favoritePoolName: 'Bryant Woods' }));
  });
  await page.reload();
  await expect(page.locator('#poolListStatus')).toContainText('Pool directory loaded.');

  let favoriteToggle = page.locator('.favorite-card .pool-header__toggle');
  await expect(favoriteToggle).toHaveAttribute('aria-expanded', 'true');
  await favoriteToggle.evaluate(toggle => {
    toggle.closest('[data-pool-card]').classList.remove('favorite-card');
    toggle.click();
  });
  favoriteToggle = page.locator('[data-pool-name="Bryant Woods"] [data-pool-card-action="toggle"]');
  await expect(favoriteToggle).toHaveAttribute('aria-expanded', 'false');
  await expect.poll(() => page.evaluate(() => globalThis.recordedAnalyticsEvents.at(-1))).toEqual([
    'event', 'ca_setting_change', { setting_name: 'favorite_pool_expanded' }
  ]);

  await page.locator('#togglePoolFeatureFilters').click();
  await page.locator('input[name="poolFeature"]').first().check();
  await page.locator('#clearPoolFeatureFilters').click();
  favoriteToggle = page.locator('.favorite-card .pool-header__toggle');
  await expect(favoriteToggle).toHaveAttribute('aria-expanded', 'false');

  await page.reload();
  await expect(page.locator('.favorite-card .pool-header__toggle')).toHaveAttribute('aria-expanded', 'false');
});

test('[WF-POOLS-005] location distances use outlined pills and can sort nearest pools first', async ({ page }) => {
  await page.context().grantPermissions(['geolocation']);
  await page.context().setGeolocation({ latitude: 39.2105, longitude: -76.8721 });
  await seedPreferences(page, { locationAwarenessEnabled: true });
  await page.goto('/pools.html');

  const sortControl = page.locator('#poolSortControls');
  const firstDistance = page.locator('.distance-badge').first();
  await expect(page.locator('#poolListStatus')).toContainText('Pool directory loaded.');
  await expect(firstDistance).toBeVisible();
  await page.locator('#togglePoolFeatureFilters').press('Enter');
  await expect(page.locator('#togglePoolFeatureFilters')).toHaveAttribute('aria-expanded', 'true');
  await expect(sortControl).toBeVisible();
  const distanceStyle = await firstDistance.evaluate(element => {
    const styles = globalThis.getComputedStyle(element);
    return { backgroundColor: styles.backgroundColor, borderStyle: styles.borderStyle };
  });
  expect(distanceStyle).toEqual({ backgroundColor: 'rgba(0, 0, 0, 0)', borderStyle: 'solid' });

  await page.selectOption('#poolSortOrder', 'distance');
  await expect(page.locator('#poolListStatus')).toHaveText('Pool directory sorted by nearest distance.');
  const distances = await page.locator('.distance-badge').evaluateAll(badges => badges.map(badge => Number.parseFloat(badge.textContent.match(/[0-9.]+/)[0])));
  expect(distances).toEqual([...distances].sort((first, second) => first - second));
});

test('[WF-POOLS-006] location distances recover after a transient lookup timeout', async ({ page }) => {
  await seedPreferences(page, { locationAwarenessEnabled: true });
  await page.addInitScript(() => {
    let requestCount = 0;
    Object.defineProperty(globalThis.navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition(success, error) {
          requestCount += 1;
          sessionStorage.setItem('cnsl_location_request_count', String(requestCount));
          if (requestCount === 1) {
            error({ code: 3, message: 'Timed out' });
            return;
          }
          success({ coords: { latitude: 39.2105, longitude: -76.8721 } });
        }
      }
    });
  });

  await page.goto('/pools.html');

  await expect(page.locator('.distance-badge').first()).toBeVisible();
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem('cnsl_location_request_count'))).toBe('2');
});

test('[WF-POOLS-006] desktop expanded pool details group contact links and fit the weekly calendar', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await seedPreferences(page, {
    favoritePoolName: 'Bryant Woods',
    poolScheduleLayout: 'calendar'
  });
  await page.goto('/pools.html');
  await expect(page.locator('#poolListStatus')).toContainText('Pool directory loaded.');

  const favoriteCard = page.locator('.favorite-card');
  const calendar = favoriteCard.locator('.schedule-calendar');
  await expect(calendar).toBeVisible();
  await expect(favoriteCard.locator('.address-section__phone')).not.toContainText('Pool Desk');
  await expect(favoriteCard.locator('.phone-link')).toHaveAttribute('aria-label', /Call Bryant Woods pool desk at 410-730-5326/);
  await expect(favoriteCard.getByRole('link', { name: 'Get directions to Bryant Woods in Google Maps' })).toBeVisible();
  const layout = await favoriteCard.evaluate(card => {
    const contactBox = card.querySelector('.pool-contact').getBoundingClientRect();
    const addressSection = card.querySelector('.address-section');
    const addressBox = addressSection.getBoundingClientRect();
    const addressDetailsBox = card.querySelector('.address-section__details').getBoundingClientRect();
    const addressLinkBox = card.querySelector('.address-link').getBoundingClientRect();
    const directionsBox = card.querySelector('.directions-link').getBoundingClientRect();
    const phoneBox = card.querySelector('.address-section__phone').getBoundingClientRect();
    const caWebsiteBox = card.querySelector('.ca-website-section').getBoundingClientRect();
    const schedule = card.querySelector('.schedule-calendar');
    const hours = card.querySelector('.pool-hours');
    const features = card.querySelector('.pool-features');
    return {
      contactDisplay: card.ownerDocument.defaultView.getComputedStyle(card.querySelector('.pool-contact')).display,
      addressHasAccentBorder: card.ownerDocument.defaultView.getComputedStyle(addressSection).borderLeftWidth === '3px',
      addressIsFullWidth: Math.abs(addressBox.width - contactBox.width) <= 1,
      addressIsIndented: addressLinkBox.left > addressDetailsBox.left,
      directionsIsUnderAddress: directionsBox.top >= addressLinkBox.bottom && directionsBox.left === addressLinkBox.left,
      phoneIsBesideAddress: phoneBox.left >= addressDetailsBox.right && phoneBox.top < addressDetailsBox.bottom,
      caWebsiteIsUnderPhone: caWebsiteBox.top >= phoneBox.bottom && caWebsiteBox.left >= addressDetailsBox.right,
      phoneIsInsideAddress: phoneBox.top > addressBox.top && phoneBox.bottom <= addressBox.bottom,
      caWebsiteIsInsideAddress: caWebsiteBox.bottom <= addressBox.bottom,
      calendarFits: schedule.scrollWidth <= schedule.clientWidth + 1,
      featuresHasAccentBorder: card.ownerDocument.defaultView.getComputedStyle(features).borderLeftWidth === '3px',
      addressToHoursGap: Math.round(hours.getBoundingClientRect().top - contactBox.bottom),
      hoursToFeaturesGap: Math.round(features.getBoundingClientRect().top - hours.getBoundingClientRect().bottom)
    };
  });

  expect(layout.contactDisplay).toBe('flex');
  expect(layout.addressHasAccentBorder).toBe(true);
  expect(layout.addressIsFullWidth).toBe(true);
  expect(layout.addressIsIndented).toBe(true);
  expect(layout.directionsIsUnderAddress).toBe(true);
  expect(layout.phoneIsBesideAddress).toBe(true);
  expect(layout.caWebsiteIsUnderPhone).toBe(true);
  expect(layout.phoneIsInsideAddress).toBe(true);
  expect(layout.caWebsiteIsInsideAddress).toBe(true);
  expect(layout.calendarFits).toBe(true);
  expect(layout.featuresHasAccentBorder).toBe(true);
  expect(layout.addressToHoursGap).toBe(layout.hoursToFeaturesGap);
});

test('[WF-POOLS-020] linked pool expands without moving the page and keeps a clear directions action', async ({ page }) => {
  await page.goto('/pools.html?pool=frp');
  await expect(page.locator('#poolListStatus')).toContainText('Pool directory loaded.');

  const linkedPool = page.locator('.pool-card[data-pool-id="frp"]');
  await expect(linkedPool).toHaveClass(/highlighted/);
  await expect(linkedPool.locator('.pool-header__toggle')).toHaveAttribute('aria-expanded', 'true');
  await expect(linkedPool.getByRole('link', { name: 'Get directions to Faulkner Ridge in Google Maps' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => globalThis.scrollY)).toBe(0);
});

test('[WF-POOLS-007] mobile calendar schedules reveal today when a pool is expanded', async ({ page }) => {
  await page.setViewportSize({ ...MOBILE_VIEWPORT, height: 900 });
  await page.clock.setFixedTime(new Date('2026-06-24T12:00:00-04:00'));
  await seedPreferences(page, { poolScheduleLayout: 'calendar' });
  await page.goto('/pools.html');
  await expect(page.locator('#poolListStatus')).toContainText('Pool directory loaded.');

  const firstPool = page.locator('.pool-card').first();
  await firstPool.locator('.pool-header__toggle').click();
  expect(await firstPool.locator('.address-section').evaluate(element => ({
    fits: element.scrollWidth <= element.clientWidth + 1,
    actionToRight: element.querySelector('.ca-website-section').getBoundingClientRect().left
      >= element.querySelector('.address-section__details').getBoundingClientRect().right
  }))).toEqual({ fits: true, actionToRight: true });
  const calendar = firstPool.locator('.schedule-calendar');
  await expect(calendar).toBeVisible();
  await expect(firstPool.locator('.week-text')).toContainText('Week of June 22 - June 28');
  await expect(calendar.locator('.schedule-calendar__day.is-today')).toBeVisible();
  await expect(calendar.locator('.schedule-calendar__day.is-today')).toContainText('June 24');
  await expect.poll(() => calendar.evaluate(element => element.scrollLeft)).toBeGreaterThan(0);
  expect(await calendar.evaluate(element => {
    const today = element.querySelector('.schedule-calendar__day.is-today');
    const calendarBounds = element.getBoundingClientRect();
    const todayBounds = today.getBoundingClientRect();
    return todayBounds.left < calendarBounds.right && todayBounds.right > calendarBounds.left;
  })).toBe(true);
});

test('[WF-POOLS-016] weekly calendars highlight modeled swim meets and Time Trials as meet days', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-06-02T12:00:00-04:00'));
  await seedPreferences(page, { favoritePoolName: 'Kendall Ridge', poolScheduleLayout: 'calendar' });
  await page.goto('/pools.html');
  await expect(page.locator('#poolListStatus')).toContainText('Pool directory loaded.');

  const calendar = page.locator('.favorite-card .schedule-calendar');
  const timeTrials = calendar.locator('.schedule-calendar__day').filter({ hasText: 'June 6' });
  await expect(timeTrials).toHaveClass(/has-swim-meet/);
  await expect(timeTrials.locator('.schedule-calendar__meet')).toHaveText('Swim League');
  await expect(timeTrials.locator('.schedule-activity--event')).toContainText('Swim Meet');
  await expect(calendar.locator('.schedule-calendar__day').filter({ hasText: 'June 5' })).not.toHaveClass(/has-swim-meet/);

  await page.locator('.favorite-card .next-week').click();
  await expect(calendar.locator('.schedule-calendar__day').filter({ hasText: 'June 13' })).not.toHaveClass(/has-swim-meet/);
  await page.locator('.favorite-card .next-week').click();
  const hostedDualMeet = calendar.locator('.schedule-calendar__day').filter({ hasText: 'June 20' });
  await expect(hostedDualMeet).toHaveClass(/has-swim-meet/);
  await expect(hostedDualMeet.locator('.schedule-calendar__meet')).toHaveText('Swim League');
  await expect(hostedDualMeet.locator('.override-notice')).toHaveCount(0);
  await expect(hostedDualMeet.locator('.schedule-activity--event')).toContainText('Dual Meet #2');
  const hostedDualMeetLink = hostedDualMeet.locator('.schedule-activity__link');
  await expect(hostedDualMeetLink).toHaveText('Dual Meet #2');
  await expect(hostedDualMeetLink).toHaveAttribute('href', 'meets.html?date=2026-06-20&pool=krp');
  await hostedDualMeetLink.click();

  const linkedMeet = page.locator('.meet-date-card[data-meet-date="2026-06-20"] .meet-details[data-meet-pool-id="krp"]');
  await expect(page).toHaveURL(/meets\.html\?date=2026-06-20&pool=krp$/);
  await expect(linkedMeet).toBeVisible();
  await expect(linkedMeet).toHaveClass(/highlighted/);
  await expect(linkedMeet).toContainText('Pointers Run');
  await expect(linkedMeet).toContainText('Long Reach');
});

test('[WF-POOLS-017] weekly calendars highlight public pool-party overrides as events', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-07-06T12:00:00-04:00'));
  await seedPreferences(page, { favoritePoolName: 'Kendall Ridge', poolScheduleLayout: 'calendar' });
  await page.goto('/pools.html');
  await expect(page.locator('#poolListStatus')).toContainText('Pool directory loaded.');

  const poolParty = page.locator('.favorite-card .schedule-calendar__day').filter({ hasText: 'July 9' });
  await expect(poolParty.locator('.schedule-activity--event.override-slot')).toContainText('Pool Party');
  await expect(poolParty).toContainText('Long Reach Village Pool Party; registration required');
});

test('[WF-POOLS-021] Aqua Fitness schedules link to official class details', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-06-22T12:00:00-04:00'));
  await seedPreferences(page, { poolScheduleLayout: 'list' });
  await page.goto('/pools.html');
  await expect(page.locator('#poolListStatus')).toContainText('Pool directory loaded.');

  const expectedLinks = new Map([
    ['Bryant Woods', 'https://columbiaassn.clubautomation.com/calendar/event-info?id=368278&style=0'],
    ['Locust Park', 'https://columbiaassn.clubautomation.com/calendar/event-info?id=368279&style=0'],
    ['Stevens Forest', 'https://columbiaassn.clubautomation.com/calendar/event-info?id=368280&style=0']
  ]);

  for (const [poolName, sourceUrl] of expectedLinks) {
    const poolCard = page.locator('.pool-card').filter({ hasText: poolName });
    await poolCard.locator('.pool-header__toggle').click();
    const sourceLinks = poolCard.getByRole('link', { name: 'Aqua Fitness official details (opens in new tab)' });
    await expect(sourceLinks.first()).toBeVisible();
    await expect(sourceLinks.first()).toHaveAttribute('href', sourceUrl);
    await expect(sourceLinks.first()).toHaveAttribute('target', '_blank');
    await expect(sourceLinks.first()).toHaveAttribute('rel', 'noopener');
    await poolCard.locator('.pool-header__toggle').click();
  }

  const nonAquaPool = page.locator('.pool-card').filter({ hasText: 'Kendall Ridge' });
  await nonAquaPool.locator('.pool-header__toggle').click();
  await expect(nonAquaPool.locator('.schedule-activity__source-link')).toHaveCount(0);

  await seedPreferences(page, { poolScheduleLayout: 'calendar' });
  await page.reload();
  await expect(page.locator('#poolListStatus')).toContainText('Pool directory loaded.');
  const bryantWoods = page.locator('.pool-card').filter({ hasText: 'Bryant Woods' });
  await bryantWoods.locator('.pool-header__toggle').click();
  await expect(bryantWoods.locator('.schedule-calendar .schedule-activity__source-link').first()).toBeVisible();
});

test('[WF-POOLS-008] desktop site header remains visible while the pool directory scrolls', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/pools.html');
  await expect(page.locator('#poolListStatus')).toContainText('Pool directory loaded.');

  await page.locator('#mainContent').evaluate(main => {
    const scrollSpacer = globalThis.document.createElement('div');
    scrollSpacer.setAttribute('aria-hidden', 'true');
    scrollSpacer.style.height = '100rem';
    main.append(scrollSpacer);
  });

  await page.evaluate(() => {
    globalThis.document.documentElement.style.scrollBehavior = 'auto';
    globalThis.scrollTo(0, globalThis.document.documentElement.scrollHeight);
  });
  const scrollPosition = await page.evaluate(() => globalThis.scrollY);
  const headerTop = await page.locator('.header').evaluate(header => Math.round(header.getBoundingClientRect().top));

  expect(scrollPosition).toBeGreaterThan(0);
  expect(headerTop).toBe(0);
});

test('[WF-POOLS-009] practice-only schedules identify teams from detailed schedule overlap where available', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-06-25T12:00:00-04:00'));
  await page.goto('/pools.html');
  await expect(page.locator('#poolListStatus')).toContainText('Pool directory loaded.');

  const jeffersHill = page.locator('.pool-card').filter({ hasText: 'Jeffers Hill' });
  await jeffersHill.locator('.pool-header__toggle').click();
  await expect(jeffersHill).toContainText('CNSL Practice Only');
  const marlinsName = jeffersHill.locator('.schedule-activity__team-names').filter({ hasText: 'Marlins' }).first();
  await expect(marlinsName).toBeVisible();
  expect(await marlinsName.evaluate(element => (
    element.getBoundingClientRect().top >= element.previousElementSibling.getBoundingClientRect().bottom
  ))).toBe(true);

  const hawthorn = page.locator('.pool-card').filter({ hasText: 'Hawthorn' });
  await hawthorn.locator('.pool-header__toggle').click();
  await expect(hawthorn.locator('.schedule-activity__team-names').filter({ hasText: 'Sundevils' }).first()).toBeVisible();

  const hopewell = page.locator('.pool-card').filter({ hasText: 'Hopewell' });
  await hopewell.locator('.pool-header__toggle').click();
  await expect(hopewell.locator('.schedule-activity__team-names').filter({ hasText: 'Dolphins, Barracudas' }).first()).toBeVisible();

  const faulknerRidge = page.locator('.pool-card').filter({ hasText: 'Faulkner Ridge' });
  await faulknerRidge.locator('.pool-header__toggle').click();
  await expect(faulknerRidge).toContainText('CNSL Practice Only');
  await expect(faulknerRidge.locator('.schedule-activity__team-names').filter({ hasText: 'Challenge' }).first()).toBeVisible();
});

test('[WF-POOLS-010] practice-only schedules do not infer a team from pool association alone', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-06-25T12:00:00-04:00'));
  await page.route('**/assets/data/2026/teams/teams.json*', async route => {
    const response = await route.fetch();
    const data = await response.json();
    const longReach = data.teams.find(team => team.id === 'lrm');
    delete longReach.practice;
    await route.fulfill({ response, json: data });
  });
  await page.goto('/pools.html');
  await expect(page.locator('#poolListStatus')).toContainText('Pool directory loaded.');

  const jeffersHill = page.locator('.pool-card').filter({ hasText: 'Jeffers Hill' });
  await jeffersHill.locator('.pool-header__toggle').click();
  await expect(jeffersHill).toContainText('CNSL Practice Only');
  await expect(jeffersHill.locator('.schedule-activity__team-names')).toHaveCount(0);
});

test('[WF-POOLS-011] team-only practice uses restricted live status and public availability filtering', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-05-26T15:30:00-04:00'));
  await page.goto('/pools.html');
  await expect(page.locator('#poolListStatus')).toContainText('Pool directory loaded.');

  let jeffersHill = page.locator('.pool-card').filter({ hasText: 'Jeffers Hill' });
  await jeffersHill.locator('.pool-header__toggle').click();
  await expect(jeffersHill).toContainText('Clippers Practice Only');
  await expect(jeffersHill.locator('.open-status')).toContainText('Closed to the public');
  await expect(jeffersHill.locator('.open-status')).toHaveClass(/status-yellow/);

  await page.locator('#togglePoolFeatureFilters').click();
  await page.selectOption('#poolAvailabilityFilter', 'open-now');
  jeffersHill = page.locator('.pool-card').filter({ hasText: 'Jeffers Hill' });
  await expect(jeffersHill).toHaveCount(0);
});

test('[WF-POOLS-012] live status updates after a team-only practice period ends without a reload', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-05-26T18:59:30-04:00') });
  await page.goto('/pools.html');
  await expect(page.locator('#poolListStatus')).toContainText('Pool directory loaded.');

  const jeffersHill = page.locator('.pool-card').filter({ hasText: 'Jeffers Hill' });
  const toggle = jeffersHill.locator('.pool-header__toggle');
  await toggle.evaluate(button => button.click());
  await expect(jeffersHill.locator('.open-status')).toContainText('Closed to the public');
  await expect(jeffersHill.locator('.open-status')).toHaveClass(/status-yellow/);

  await toggle.focus();
  await page.clock.fastForward(31 * 1000);
  await expect(jeffersHill.locator('.open-status')).toContainText('Closed');
  await expect(jeffersHill.locator('.open-status')).toHaveClass(/status-red/);
  await expect(jeffersHill.locator('.pool-header__toggle')).toBeFocused();
  await expect(page.locator('#poolListStatus')).toHaveText('Pool availability updated for the current time.');
});

test('[WF-POOLS-013] open-now results update after a public-use period ends without a reload', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-05-26T18:59:30-04:00') });
  await page.goto('/pools.html');
  await expect(page.locator('#poolListStatus')).toContainText('Pool directory loaded.');

  await page.locator('#togglePoolFeatureFilters').evaluate(button => button.click());
  await page.selectOption('#poolAvailabilityFilter', 'open-now');
  const clarysForest = page.locator('.pool-card').filter({ hasText: "Clary's Forest" });
  await expect(clarysForest).toHaveCount(1);

  await page.clock.fastForward(31 * 1000);
  await expect(clarysForest).toHaveCount(0);
  await expect(page.locator('#poolListStatus')).toHaveText('Pool availability updated for the current time.');
});

test('[WF-POOLS-014] semantic practice status drives detail and calendar styling when its label changes', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-06-25T12:00:00-04:00'));
  await seedPreferences(page, { poolScheduleLayout: 'calendar' });
  await page.route('**/assets/data/2026/pools/pools.json*', async route => {
    const response = await route.fetch();
    const poolData = await response.json();
    poolData.pools.forEach(pool => {
      pool.schedules.forEach(schedule => {
        schedule.hours.forEach(hours => {
          if (hours.accessStatus === 'practice-only') hours.types = ['Published Team Session'];
        });
      });
    });
    await route.fulfill({ response, json: poolData });
  });
  await page.goto('/pools.html');
  await expect(page.locator('#poolListStatus')).toContainText('Pool directory loaded.');

  const jeffersHill = page.locator('.pool-card').filter({ hasText: 'Jeffers Hill' });
  await jeffersHill.locator('.pool-header__toggle').click();
  const marlinsName = jeffersHill.locator('.schedule-activity__team-names').filter({ hasText: 'Marlins' }).first();
  await expect(marlinsName).toBeVisible();
  await expect(marlinsName.locator('xpath=..')).toHaveClass(/schedule-activity--event/);
  await expect(marlinsName.locator('xpath=..')).toContainText('Published Team Session');
});

test('[WF-POOLS-015] opens-soon results update when a public opening enters the next hour', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-05-26T13:59:30-04:00') });
  await page.route('**/assets/data/2026/pools/pools.json*', async route => {
    const response = await route.fetch();
    const poolData = await response.json();
    poolData.pools.forEach(pool => {
      pool.schedules = [{
        startDate: '2026-05-23',
        endDate: '2026-09-07',
        hours: [{
          weekDays: ['Tue'],
          startTime: '3:00PM',
          endTime: '6:00PM',
          types: ['Rec Swim'],
          accessStatus: 'public'
        }]
      }];
      pool.scheduleOverrides = [];
    });
    await route.fulfill({ response, json: poolData });
  });
  await page.goto('/pools.html');
  await expect(page.locator('#poolListStatus')).toContainText('Pool directory loaded.');

  await page.locator('#togglePoolFeatureFilters').click();
  await page.selectOption('#poolAvailabilityFilter', 'opens-soon');
  await expect(page.locator('#poolList .pool-card')).toHaveCount(0);

  await page.clock.fastForward(31 * 1000);
  await expect(page.locator('#poolList .pool-card')).toHaveCount(23);
  await expect(page.locator('#poolListStatus')).toHaveText('Pool availability updated for the current time.');
});

test('[WF-POOLS-019] Masters-only hours are restricted program access instead of a public opening', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-06-10T06:30:00-04:00'));
  await seedPreferences(page, { poolScheduleLayout: 'calendar' });
  await page.goto('/pools.html');
  await expect(page.locator('#poolListStatus')).toContainText('Pool directory loaded.');

  let talbottSprings = page.locator('.pool-card').filter({ hasText: 'Talbott Springs' });
  await talbottSprings.locator('.pool-header__toggle').click();
  await expect(talbottSprings.locator('.open-status')).toContainText('Restricted Access');
  await expect(talbottSprings.locator('.open-status')).toHaveClass(/status-yellow/);
  await expect(talbottSprings.locator('.schedule-activity--restricted').filter({ hasText: 'Masters Swim' })).toHaveCount(3);

  await page.locator('#togglePoolFeatureFilters').click();
  await page.selectOption('#poolAvailabilityFilter', 'open-now');
  talbottSprings = page.locator('.pool-card').filter({ hasText: 'Talbott Springs' });
  await expect(talbottSprings).toHaveCount(0);
});

test('[WF-POOLS-016] collapsed opening and closing countdowns update without interaction', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-05-26T14:58:30-04:00') });
  await page.route('**/assets/data/2026/pools/pools.json*', async route => {
    const response = await route.fetch();
    const poolData = await response.json();
    poolData.pools.forEach((pool, index) => {
      pool.schedules = [{
        startDate: '2026-05-23',
        endDate: '2026-09-07',
        hours: [{
          weekDays: ['Tue'],
          startTime: index === 0 ? '1:00PM' : '3:00PM',
          endTime: index === 0 ? '3:00PM' : '6:00PM',
          types: ['Rec Swim'],
          accessStatus: 'public'
        }]
      }];
      pool.scheduleOverrides = [];
    });
    await route.fulfill({ response, json: poolData });
  });
  await page.goto('/pools.html');
  await expect(page.locator('#poolListStatus')).toContainText('Pool directory loaded.');

  const closingCard = page.locator('#poolList .pool-card').first();
  const openingCard = page.locator('#poolList .pool-card').nth(1);
  await expect(closingCard).toHaveClass(/collapsed/);
  await expect(openingCard).toHaveClass(/collapsed/);
  await expect(closingCard.locator('.pool-transition-summary')).toHaveText('Closes in 2 mins');
  await expect(openingCard.locator('.pool-transition-summary')).toHaveText('Opens in 2 mins');

  await page.clock.fastForward(31 * 1000);
  await expect(closingCard.locator('.pool-transition-summary')).toHaveText('Closes in 1 min');
  await expect(openingCard.locator('.pool-transition-summary')).toHaveText('Opens in 1 min');
});
