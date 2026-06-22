const { test, expect } = require('../browser-test');
const {
  ACTIVE_SEASON_YEAR,
  MOBILE_VIEWPORT,
  activeSeasonDate,
  getAnnualDataRoute,
  initializeAnalyticsRecorder,
  prepareStableWeatherResponses,
  readAnnualData,
  routeAnnualData,
  seedPreferences
} = require('../browser-test-helpers');

const ANNUAL_POOLS = readAnnualData('pools').pools;
const ANNUAL_TEAMS = readAnnualData('teams').teams;
const ANNUAL_MEETS = readAnnualData('meets');
const CONTACT_POOL = ANNUAL_POOLS.find(pool => pool.phone && pool.location && pool.caUrl);
const TIME_TRIALS_MEET = ANNUAL_MEETS.special_meets.find(meet => meet.timeWindowKey === 'timeTrials');
const MEET_CALENDAR_POOL = ANNUAL_POOLS.find(pool => (
  ANNUAL_TEAMS.some(team => team.timeTrialsPool === pool.name)
  && ANNUAL_MEETS.regular_meets.some(meet => meet.location === `${pool.name} Pool`)
));
const HOSTED_REGULAR_MEET = ANNUAL_MEETS.regular_meets.find(meet => meet.location === `${MEET_CALENDAR_POOL.name} Pool`);
const SPECIAL_EVENT_POOL = ANNUAL_POOLS.find(pool => pool.scheduleOverrides?.some(override => (
  override.hours.some(hours => hours.accessStatus === 'special-event')
)));
const SPECIAL_EVENT_OVERRIDE = SPECIAL_EVENT_POOL.scheduleOverrides.find(override => (
  override.hours.some(hours => hours.accessStatus === 'special-event')
));
const ENRICHED_PRACTICE_TEAM = ANNUAL_TEAMS.find(team => team.practice?.regular?.morning?.[0]?.location);
const ENRICHED_PRACTICE_POOL = ANNUAL_POOLS.find(pool => (
  ENRICHED_PRACTICE_TEAM.practice.regular.morning[0].location === `${pool.name} Pool`
));
const OFFICIAL_SCHEDULE_FIXTURE_URL = 'https://official-pools.example/schedules/current-pool.pdf';

function getRelativeDate(date, dayOffset) {
  const relativeDate = new Date(`${date}T12:00:00-04:00`);
  relativeDate.setDate(relativeDate.getDate() + dayOffset);
  return relativeDate;
}

function getMonthDay(date) {
  return new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'long', timeZone: 'America/New_York' })
    .format(new Date(`${date}T12:00:00-04:00`));
}

test.beforeEach(async ({ page }) => {
  await prepareStableWeatherResponses(page);
});

test('[WF-POOLS-029] pool status guide explains every public-access status on hover and focus', async ({ page }) => {
  await page.setViewportSize(MOBILE_VIEWPORT);
  await page.goto('/pools.html');
  await expect(page.locator('#poolList')).toHaveAttribute('aria-busy', 'false');

  const guide = page.locator('#poolStatusLegend');
  const criteria = [
    {
      label: 'Open for public use',
      description: /General public use is available now.*shared schedules/
    },
    {
      label: 'Special schedule or restrictions',
      description: /class or program, swim-team practice, special event, or swim meet/
    },
    {
      label: 'Currently closed',
      description: /No published public-use period is active now.*practice.*earlier or later today/
    },
    {
      label: 'Schedule not available or applicable',
      description: /schedule is not published or available.*future-day availability filter/
    }
  ];

  await expect(guide.getByRole('button')).toHaveCount(criteria.length);
  await expect(guide.locator('[role="tooltip"]')).toHaveCount(criteria.length);

  const hoverButton = guide.getByRole('button', { name: criteria[0].label });
  const hoverTooltip = page.locator(`#${await hoverButton.getAttribute('aria-describedby')}`);
  await expect(hoverTooltip).toBeHidden();
  await hoverButton.hover();
  await expect(hoverTooltip).toBeVisible();

  for (const criterion of criteria) {
    const button = guide.getByRole('button', { name: criterion.label });
    const tooltip = page.locator(`#${await button.getAttribute('aria-describedby')}`);
    await button.focus();
    await expect(button).toBeFocused();
    await expect(button).toHaveAccessibleDescription(criterion.description);
    await expect(tooltip).toBeVisible();
    expect(await tooltip.evaluate(element => {
      const bounds = element.getBoundingClientRect();
      return bounds.left >= 0 && bounds.right <= globalThis.document.documentElement.clientWidth;
    })).toBe(true);
  }
});

test('[WF-POOLS-001] pool feature filters expose their state and resulting count', async ({ page }) => {
  await initializeAnalyticsRecorder(page);
  await seedPreferences(page, { contrast: 'high', textSize: 'extra-large' });
  await page.goto('/pools.html');
  await expect(page.locator('#poolListStatus')).toContainText('Pool directory loaded.');
  const totalPoolCount = await page.locator('#poolList .pool-card').count();
  expect(totalPoolCount).toBeGreaterThan(0);

  const filters = page.locator('#togglePoolFeatureFilters');
  const indicator = filters.locator('.pool-filter__indicator');
  await expect(indicator).toHaveAttribute('aria-hidden', 'true');
  await expect(filters).toHaveAccessibleName('Features');
  await expect.poll(() => indicator.evaluate(element => globalThis.getComputedStyle(element).transform)).not.toBe('none');
  await filters.press('Enter');
  await expect(filters).toHaveAttribute('aria-expanded', 'true');
  await expect.poll(() => indicator.evaluate(element => globalThis.getComputedStyle(element).transform)).toBe('none');
  await expect.poll(() => indicator.evaluate(element => globalThis.getComputedStyle(element).transitionDuration)).toBe('0s');
  await filters.press('Space');
  await expect(filters).toHaveAttribute('aria-expanded', 'false');
  await filters.click();
  await expect(filters).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('.pool-filter__group--accessibility')).toBeVisible();
  await expect(page.locator('.pool-filter__option--young-swimmers').first()).toBeVisible();
  await expect(page.locator('.pool-filter__option--water-play').first()).toBeVisible();
  await expect(page.getByLabel('Meter lanes')).toBeVisible();
  await expect(page.getByLabel('Yard lanes')).toBeVisible();
  await expect(page.getByLabel('Heated pool')).toBeVisible();
  await expect(page.locator('.pool-filter__column')).toHaveCount(2);
  await expect(page.locator('.pool-filter__column').nth(0).locator('legend')).toHaveText([
    'Swimming & water play', 'Young swimmers & non-swimmers'
  ]);
  await expect(page.locator('.pool-filter__column').nth(1).locator('legend')).toHaveText([
    'Amenities', 'Sports & recreation', 'Accessibility & inclusion'
  ]);
  await expect(page.locator('.pool-filter__data-marker')).toHaveCount(0);
  await expect(page.locator('#poolLaneUnitsNote')).toHaveCount(0);
  const chipColors = await Promise.all([
    page.locator('.pool-filter__option--accessibility > span').first().evaluate(chip => globalThis.getComputedStyle(chip).backgroundColor),
    page.locator('.pool-filter__option--young-swimmers > span').first().evaluate(chip => globalThis.getComputedStyle(chip).backgroundColor),
    page.locator('.pool-filter__option--water-play > span').first().evaluate(chip => globalThis.getComputedStyle(chip).backgroundColor)
  ]);
  expect(new Set(chipColors).size).toBe(3);
  await page.locator('input[name="poolFeature"]').first().check();

  await expect(page.locator('#poolFilterSummary')).toHaveText(new RegExp(`\\d+ \\/ ${totalPoolCount} pools`));
  await expect(page.locator('#poolFeatureFilterCount')).toHaveText('1 selected');

  await page.locator('#clearPoolFeatureFilters').click();
  await expect(filters).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#poolFilterSummary')).toHaveText(`${totalPoolCount} pools`);
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
  await routeAnnualData(page, 'pools', poolData => {
    poolData.pools.forEach((pool, index) => {
      pool.features = pool.features.filter(feature => feature !== 'yoga');
      if (index < 2) pool.features.push('yoga');
    });
  });
  await page.goto('/pools.html');
  await expect(page.locator('#poolListStatus')).toContainText('Pool directory loaded.');
  const totalPoolCount = await page.locator('#poolList .pool-card').count();

  await page.locator('#togglePoolFeatureFilters').click();
  await expect(page.getByLabel('Yoga')).toBeVisible();
  await page.getByLabel('Yoga').check();

  await expect(page.locator('#poolFilterSummary')).toHaveText(`2 / ${totalPoolCount} pools`);
  await expect(page.locator('#poolList .pool-card')).toHaveCount(2);
});

test('[WF-POOLS-018] lessons feature identifies CA outdoor lesson pools and links with the shared icon', async ({ page }) => {
  await routeAnnualData(page, 'pools', poolData => {
    poolData.pools.forEach((pool, index) => {
      pool.features = pool.features.filter(feature => feature !== 'lessons');
      if (index < 3) pool.features.push('lessons');
    });
  });
  await page.goto('/pools.html');
  await expect(page.locator('#poolListStatus')).toContainText('Pool directory loaded.');
  const totalPoolCount = await page.locator('#poolList .pool-card').count();

  await page.locator('#togglePoolFeatureFilters').click();
  await page.getByLabel('Lessons').check();

  await expect(page.locator('#poolFilterSummary')).toHaveText(`3 / ${totalPoolCount} pools`);
  await expect(page.locator('#poolList .pool-card')).toHaveCount(3);

  const firstPool = page.locator('#poolList .pool-card').first();
  await firstPool.locator('.pool-header__toggle').click();
  const lessonsPill = firstPool.getByRole('link', { name: 'Lessons' });
  const lessonsLinkIcon = lessonsPill.locator('.feature-pill__link-icon');
  await expect(lessonsPill).toHaveAttribute('href', 'lessons.html');
  await expect(lessonsLinkIcon).toBeVisible();
  await expect(lessonsLinkIcon.locator('use')).toHaveAttribute('href', '#icon-link');
});

test('[WF-POOLS-019] main-pool and kids slide filters remain distinct', async ({ page }) => {
  await routeAnnualData(page, 'pools', poolData => {
    poolData.pools.forEach((pool, index) => {
      pool.features = pool.features.filter(feature => !['main pool slide', 'wading pool slide'].includes(feature));
      if (index < 2) pool.features.push('main pool slide');
      if (index >= 2 && index < 5) pool.features.push('wading pool slide');
    });
  });
  await page.goto('/pools.html');
  await expect(page.locator('#poolListStatus')).toContainText('Pool directory loaded.');
  const totalPoolCount = await page.locator('#poolList .pool-card').count();

  await page.locator('#togglePoolFeatureFilters').click();
  await expect(page.getByLabel('Main pool slide')).toBeVisible();
  await expect(page.getByLabel("Kids' slide (wading pool)")).toBeVisible();

  await page.getByLabel('Main pool slide').check();
  await expect(page.locator('#poolFilterSummary')).toHaveText(`2 / ${totalPoolCount} pools`);
  await expect(page.locator('#poolList .pool-card')).toHaveCount(2);

  await page.getByLabel('Main pool slide').uncheck();
  await page.getByLabel("Kids' slide (wading pool)").check();
  await expect(page.locator('#poolFilterSummary')).toHaveText(`3 / ${totalPoolCount} pools`);
  await expect(page.locator('#poolList .pool-card')).toHaveCount(3);
});

test('[WF-POOLS-002] pool availability filters cover live status and the upcoming seven days', async ({ page }) => {
  await page.route(getAnnualDataRoute('pools'), async route => {
    const response = await route.fetch();
    const poolData = await response.json();
    poolData.pools.forEach((pool, index) => {
      pool.schedules = [{
        startDate: `${ACTIVE_SEASON_YEAR}-05-23`,
        endDate: `${ACTIVE_SEASON_YEAR}-09-07`,
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
  const totalPoolCount = await page.locator('#poolList .pool-card').count();
  await page.evaluate(() => {
    globalThis.TimeUtils.getCurrentEasternTimeInfo = () => ({
      date: `${globalThis.YEAR}-05-26`, day: 'Tue', minutes: 15 * 60, isValid: true
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
  await expect(page.locator('#poolFilterSummary')).toHaveText(`${totalPoolCount - 1} / ${totalPoolCount} pools`);

  await page.locator('#poolAvailabilityFilter').focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('#poolAvailabilityFilter')).toHaveValue('opens-soon');
  await expect(page.locator('#poolFilterSummary')).toHaveText(`1 / ${totalPoolCount} pools`);
  await expect(page.locator('#poolListStatus')).toHaveText('Pool directory filtered to pools opening within the hour.');

  await page.keyboard.press('ArrowDown');
  await expect(page.locator('#poolAvailabilityFilter')).toHaveValue('open-next-two-hours');

  await page.keyboard.press('ArrowDown');
  await expect(page.locator('#poolAvailabilityFilter')).toHaveValue('open-today');
  await expect(page.locator('#poolFilterSummary')).toHaveText(`${totalPoolCount} / ${totalPoolCount} pools`);
  await expect(page.locator('#poolListStatus')).toHaveText('Pool directory filtered to pools with general-use hours today.');
  await expect(page.locator('#poolList .pool-status-indicator.gray')).toHaveCount(0);

  await page.keyboard.press('ArrowDown');
  await expect(page.locator('#poolAvailabilityFilter')).toHaveValue('open-tomorrow');
  await expect(page.locator('#poolFilterSummary')).toHaveText(`1 / ${totalPoolCount} pools`);
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
  await expect(page.locator('#poolFilterSummary')).toHaveText(`1 / ${totalPoolCount} pools`);
  await expect(page.locator('#poolListStatus')).toHaveText('Pool directory filtered to pools with general-use hours Thursday.');
  await expect(page.locator('#poolList .pool-transition-summary')).toHaveText('Thu 1pm - 4pm');
  await expect(page.locator('#poolList .pool-status-indicator.gray')).toHaveCount(1);

  await page.selectOption('#poolAvailabilityFilter', 'open-next-two-hours');
  await expect(page.locator('#poolFilterSummary')).toHaveText(`1 / ${totalPoolCount} pools`);
  await expect(page.locator('#poolList .pool-card')).toHaveCount(1);
  await expect(page.locator('#poolFeatureFilterCount')).toHaveText('1 selected');

  await page.locator('#clearPoolFeatureFilters').click();
  await expect(page.locator('#poolAvailabilityFilter')).toHaveValue('all');
  await expect(page.locator('#poolFilterSummary')).toHaveText(`${totalPoolCount} pools`);
});

test('[WF-POOLS-003] pool tile features are ordered by category then alphabetically', async ({ page }) => {
  await page.route(getAnnualDataRoute('pools'), async route => {
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

test('[WF-POOLS-028] overridden feature lists explain their documented corrections in numbered notes', async ({ page }) => {
  const [overriddenPool, baselinePool] = ANNUAL_POOLS;
  await routeAnnualData(page, 'pools', poolData => {
    const overriddenRecord = poolData.pools.find(pool => pool.id === overriddenPool.id);
    const baselineRecord = poolData.pools.find(pool => pool.id === baselinePool.id);
    overriddenRecord.features = ['lap'];
    overriddenRecord.featureOverrides = [{
      action: 'add',
      feature: 'yoga',
      evidence: {
        type: 'maintainer',
        observedOn: `${ACTIVE_SEASON_YEAR}-06-15`,
        officialSourceCheckedOn: `${ACTIVE_SEASON_YEAR}-06-16`,
        note: 'Deterministic browser fixture.'
      }
    }, {
      action: 'remove',
      feature: 'lap',
      evidence: {
        type: 'official-source',
        officialSourceCheckedOn: `${ACTIVE_SEASON_YEAR}-06-16`,
        sourceUrl: 'https://example.com/pool-source',
        note: 'Deterministic browser fixture.'
      }
    }];
    delete baselineRecord.featureOverrides;
  });
  await page.goto('/pools.html');
  await expect(page.locator('#poolListStatus')).toContainText('Pool directory loaded.');

  const overriddenCard = page.locator(`[data-pool-id="${overriddenPool.id}"]`);
  const baselineCard = page.locator(`[data-pool-id="${baselinePool.id}"]`);
  await overriddenCard.locator('.pool-header__toggle').click();
  await baselineCard.locator('.pool-header__toggle').click();

  const overriddenFeatures = overriddenCard.locator('.pool-features');
  const footnotes = overriddenFeatures.locator('.pool-features__footnotes li');
  const addedMarker = overriddenFeatures.locator('.feature-pill--add .feature-pill__footnote-marker');
  const removedMarker = overriddenFeatures.locator('.feature-pill--remove .feature-pill__footnote-marker');
  const addedFootnoteNumber = Number(await addedMarker.locator('[aria-hidden="true"]').textContent());
  const removedFootnoteNumber = Number(await removedMarker.locator('[aria-hidden="true"]').textContent());
  await expect(addedMarker).toContainText(`(footnote ${addedFootnoteNumber})`);
  await expect(removedMarker).toContainText(`(footnote ${removedFootnoteNumber})`);
  await expect(footnotes.nth(addedFootnoteNumber - 1)).toHaveText('Yoga was added to this list based on current facility information that differs from the CA facility page.');
  await expect(footnotes.nth(removedFootnoteNumber - 1)).toHaveText('Lap was removed from this list based on current facility information that differs from the CA facility page.');
  await expect(baselineCard.locator('.feature-pill--corrected')).toHaveCount(0);
  await expect(baselineCard.locator('.pool-features__footnotes')).toHaveCount(0);
});

test('[WF-POOLS-004] collapsed favorite pool stays collapsed after filters redraw the directory', async ({ page }) => {
  await initializeAnalyticsRecorder(page);
  await page.goto('/pools.html');
  await page.evaluate(poolName => {
    localStorage.setItem('cnsl_preferences', JSON.stringify({ favoritePoolName: poolName }));
  }, CONTACT_POOL.name);
  await page.reload();
  await expect(page.locator('#poolListStatus')).toContainText('Pool directory loaded.');

  let favoriteToggle = page.locator('.favorite-card .pool-header__toggle');
  await expect(favoriteToggle).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('.favorite-card .pool-details'))
    .toHaveAttribute('data-pool-details-hydrated', 'true');
  await favoriteToggle.evaluate(toggle => {
    toggle.closest('[data-pool-card]').classList.remove('favorite-card');
    toggle.click();
  });
  favoriteToggle = page.locator(`[data-pool-id="${CONTACT_POOL.id}"] [data-pool-card-action="toggle"]`);
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

test('[WF-POOLS-023] desktop expanded pool details group official links and fit the weekly calendar', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await routeAnnualData(page, 'pools', poolData => {
    const contactPool = poolData.pools.find(pool => pool.id === CONTACT_POOL.id);
    contactPool.scheduleUrl = OFFICIAL_SCHEDULE_FIXTURE_URL;
  });
  await seedPreferences(page, {
    favoritePoolName: CONTACT_POOL.name,
    poolScheduleLayout: 'calendar'
  });
  await page.goto('/pools.html');
  await expect(page.locator('#poolListStatus')).toContainText('Pool directory loaded.');

  const favoriteCard = page.locator('.favorite-card');
  const calendar = favoriteCard.locator('.schedule-calendar');
  await expect(calendar).toBeVisible();
  await expect(favoriteCard.locator('.address-section__phone')).not.toContainText('Pool Desk');
  await expect(favoriteCard.locator('.phone-link')).toHaveAttribute('aria-label', /^Call .+ pool desk at .+/);
  await expect(favoriteCard.getByRole('link', { name: /^Get directions to .+ in Google Maps$/ })).toBeVisible();
  const poolPageLink = favoriteCard.getByRole('link', { name: 'Visit CA Pool Page' });
  const scheduleLink = favoriteCard.getByRole('link', { name: 'CA Pool Schedule' });
  await expect(scheduleLink).toHaveAttribute('href', OFFICIAL_SCHEDULE_FIXTURE_URL);
  await expect(scheduleLink).toHaveAttribute('target', '_blank');
  await expect(scheduleLink).toHaveAttribute('rel', 'noopener');
  await expect.poll(async () => {
    const [poolPageBox, scheduleBox] = await Promise.all([
      poolPageLink.boundingBox(),
      scheduleLink.boundingBox()
    ]);
    return [poolPageBox?.width, scheduleBox?.width];
  }).toEqual([192, 192]);
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

test('[WF-POOLS-022] mobile expanded pool details keep directions in the compact action stack', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedPreferences(page, { favoritePoolName: CONTACT_POOL.name });
  await page.goto('/pools.html');
  await expect(page.locator('#poolListStatus')).toContainText('Pool directory loaded.');

  const favoriteCard = page.locator('.favorite-card');
  const officialLinks = favoriteCard.locator('.ca-link');
  await expect(officialLinks).toHaveCount(2);
  await expect(officialLinks.first()).toBeVisible();
  await expect(officialLinks.last()).toBeVisible();
  const officialLinkWidths = await officialLinks.evaluateAll(links => (
    links.map(link => link.getBoundingClientRect().width)
  ));
  expect(officialLinkWidths).toEqual([172, 172]);
  const layout = await favoriteCard.evaluate(card => {
    const addressLinkBox = card.querySelector('.address-link').getBoundingClientRect();
    const directionsBox = card.querySelector('.directions-link').getBoundingClientRect();
    const phoneBox = card.querySelector('.address-section__phone').getBoundingClientRect();
    const caWebsiteBox = card.querySelector('.ca-website-section').getBoundingClientRect();
    return {
      directionsIsBesideAddress: directionsBox.left >= addressLinkBox.right,
      phoneIsUnderDirections: phoneBox.top >= directionsBox.bottom,
      caWebsiteIsUnderPhone: caWebsiteBox.top >= phoneBox.bottom
    };
  });

  expect(layout.directionsIsBesideAddress).toBe(true);
  expect(layout.phoneIsUnderDirections).toBe(true);
  expect(layout.caWebsiteIsUnderPhone).toBe(true);
});

test('[WF-POOLS-020] linked pool expands without moving the page and keeps a clear directions action', async ({ page }) => {
  await page.goto(`/pools.html?pool=${CONTACT_POOL.id}`);
  await expect(page.locator('#poolListStatus')).toContainText('Pool directory loaded.');

  const linkedPool = page.locator(`.pool-card[data-pool-id="${CONTACT_POOL.id}"]`);
  await expect(linkedPool).toHaveClass(/highlighted/);
  await expect(linkedPool.locator('.pool-header__toggle')).toHaveAttribute('aria-expanded', 'true');
  await expect(linkedPool.getByRole('link', { name: /^Get directions to .+ in Google Maps$/ })).toBeVisible();
  await expect.poll(() => page.evaluate(() => globalThis.scrollY)).toBe(0);
});

test('[WF-POOLS-007] mobile calendar schedules reveal today when a pool is expanded', async ({ page }) => {
  await page.setViewportSize({ ...MOBILE_VIEWPORT, height: 900 });
  await page.clock.setFixedTime(activeSeasonDate('06-24T12:00:00-04:00'));
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
  await page.clock.setFixedTime(getRelativeDate(TIME_TRIALS_MEET.date, -4));
  await seedPreferences(page, { favoritePoolName: MEET_CALENDAR_POOL.name, poolScheduleLayout: 'calendar' });
  await page.goto('/pools.html');
  await expect(page.locator('#poolListStatus')).toContainText('Pool directory loaded.');

  const calendar = page.locator('.favorite-card .schedule-calendar');
  const timeTrials = calendar.locator('.schedule-calendar__day').filter({ hasText: getMonthDay(TIME_TRIALS_MEET.date) });
  await expect(timeTrials).toHaveClass(/has-swim-meet/);
  await expect(timeTrials.locator('.schedule-calendar__meet')).toHaveText('Swim League');
  await expect(timeTrials.locator('.schedule-activity--event')).toContainText('Swim Meet');

  let hostedDualMeet = calendar.locator('.schedule-calendar__day').filter({ hasText: getMonthDay(HOSTED_REGULAR_MEET.date) });
  for (let week = 0; week < 10 && await hostedDualMeet.count() === 0; week += 1) {
    await page.locator('.favorite-card .next-week').click();
    hostedDualMeet = calendar.locator('.schedule-calendar__day').filter({ hasText: getMonthDay(HOSTED_REGULAR_MEET.date) });
  }
  await expect(hostedDualMeet).toHaveClass(/has-swim-meet/);
  await expect(hostedDualMeet.locator('.schedule-calendar__meet')).toHaveText('Swim League');
  await expect(hostedDualMeet.locator('.override-notice')).toHaveCount(0);
  const hostedDualMeetLink = hostedDualMeet.locator('.schedule-activity__link');
  await expect(hostedDualMeetLink).not.toBeEmpty();
  await expect(hostedDualMeetLink).toHaveAttribute('href', `meets.html?date=${HOSTED_REGULAR_MEET.date}&pool=${MEET_CALENDAR_POOL.id}`);
  await hostedDualMeetLink.click();

  const linkedMeet = page.locator(`.meet-date-card[data-meet-date="${HOSTED_REGULAR_MEET.date}"] .meet-details[data-meet-pool-id="${MEET_CALENDAR_POOL.id}"]`);
  await expect(page).toHaveURL(new RegExp(`meets\\.html\\?date=${HOSTED_REGULAR_MEET.date}&pool=${MEET_CALENDAR_POOL.id}$`));
  await expect(linkedMeet).toBeVisible();
  await expect(linkedMeet).toHaveClass(/highlighted/);
  await expect(linkedMeet.locator('.home-team, .visiting-team')).toHaveCount(2);
});

test('[WF-POOLS-017] weekly calendars highlight public pool-party overrides as events', async ({ page }) => {
  await page.clock.setFixedTime(getRelativeDate(SPECIAL_EVENT_OVERRIDE.startDate, -3));
  await seedPreferences(page, { favoritePoolName: SPECIAL_EVENT_POOL.name, poolScheduleLayout: 'calendar' });
  await page.goto('/pools.html');
  await expect(page.locator('#poolListStatus')).toContainText('Pool directory loaded.');

  const specialEvent = page.locator('.favorite-card .schedule-calendar__day').filter({ hasText: getMonthDay(SPECIAL_EVENT_OVERRIDE.startDate) });
  await expect(specialEvent.locator('.schedule-activity--event.override-slot')).toBeVisible();
  await expect(specialEvent.locator('.override-notice')).toBeVisible();
});

test('[WF-POOLS-021] Aqua Fitness schedules link to official class details', async ({ page }) => {
  await page.clock.setFixedTime(activeSeasonDate('06-22T12:00:00-04:00'));
  await seedPreferences(page, { poolScheduleLayout: 'list' });
  await page.goto('/pools.html');
  await expect(page.locator('#poolListStatus')).toContainText('Pool directory loaded.');

  const poolCards = page.locator('.pool-card');
  const poolIds = await poolCards.evaluateAll(cards => cards.map(card => card.dataset.poolId));
  let sourcePoolId;
  let nonSourcePoolId;
  for (const poolId of poolIds) {
    const poolCard = page.locator(`.pool-card[data-pool-id="${poolId}"]`);
    await poolCard.locator('.pool-header__toggle').click();
    await expect(poolCard.locator('.pool-details')).toHaveAttribute('data-pool-details-hydrated', 'true');
    const sourceLinks = poolCard.getByRole('link', { name: 'Aqua Fitness official details (opens in new tab)' });
    if (await sourceLinks.count()) {
      sourcePoolId ??= poolId;
    } else {
      nonSourcePoolId ??= poolId;
    }
    if (sourcePoolId && nonSourcePoolId) break;
  }

  expect(sourcePoolId).toBeTruthy();
  expect(nonSourcePoolId).toBeTruthy();
  const sourcePool = page.locator(`.pool-card[data-pool-id="${sourcePoolId}"]`);
  const nonSourcePool = page.locator(`.pool-card[data-pool-id="${nonSourcePoolId}"]`);
  const sourceLink = sourcePool.getByRole('link', { name: 'Aqua Fitness official details (opens in new tab)' }).first();
  await expect(sourceLink).toHaveAttribute('href', /^https:\/\//);
  await expect(sourceLink).toHaveAttribute('target', '_blank');
  await expect(sourceLink).toHaveAttribute('rel', 'noopener');
  await expect(nonSourcePool.getByRole('link', { name: 'Aqua Fitness official details (opens in new tab)' })).toHaveCount(0);

  const sourcePoolName = await sourcePool.getAttribute('data-pool-name');
  await seedPreferences(page, { favoritePoolName: sourcePoolName, poolScheduleLayout: 'calendar' });
  await page.reload();
  await expect(page.locator('#poolListStatus')).toContainText('Pool directory loaded.');
  await expect(page.locator('.favorite-card .schedule-calendar .schedule-activity__source-link').first()).toBeVisible();
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
  await page.clock.setFixedTime(activeSeasonDate('06-25T12:00:00-04:00'));
  await page.goto('/pools.html');
  await expect(page.locator('#poolListStatus')).toContainText('Pool directory loaded.');

  const poolCard = page.locator(`.pool-card[data-pool-id="${ENRICHED_PRACTICE_POOL.id}"]`);
  await poolCard.locator('.pool-header__toggle').click();
  const enrichedTeamNames = poolCard.locator('.schedule-activity__team-names').first();
  await expect(enrichedTeamNames).not.toBeEmpty();
  expect(await enrichedTeamNames.evaluate(element => (
    element.getBoundingClientRect().top >= element.previousElementSibling.getBoundingClientRect().bottom
  ))).toBe(true);
});

test('[WF-POOLS-010] practice-only schedules do not infer a team from pool association alone', async ({ page }) => {
  await page.clock.setFixedTime(activeSeasonDate('06-25T12:00:00-04:00'));
  await routeAnnualData(page, 'pools', poolData => {
    poolData.pools.forEach(pool => {
      pool.schedules = [{
        startDate: `${ACTIVE_SEASON_YEAR}-06-01`,
        endDate: `${ACTIVE_SEASON_YEAR}-07-31`,
        hours: [{ weekDays: ['Thu'], startTime: '11:00AM', endTime: '1:00PM', types: ['CNSL Practice Only'], accessStatus: 'practice-only' }]
      }];
      pool.scheduleOverrides = [];
    });
  });
  await routeAnnualData(page, 'teams', teamData => {
    teamData.teams.forEach(team => delete team.practice);
  });
  await page.goto('/pools.html');
  await expect(page.locator('#poolListStatus')).toContainText('Pool directory loaded.');

  const firstPool = page.locator('.pool-card').first();
  await firstPool.locator('.pool-header__toggle').click();
  await expect(firstPool).toContainText('CNSL Practice Only');
  await expect(firstPool.locator('.schedule-activity__team-names')).toHaveCount(0);
});

test('[WF-POOLS-011] team-only practice uses restricted live status and public availability filtering', async ({ page }) => {
  await page.clock.setFixedTime(activeSeasonDate('05-26T15:30:00-04:00'));
  await routeAnnualData(page, 'pools', poolData => {
    poolData.pools.forEach((pool, index) => {
      pool.schedules = index === 0 ? [{
        startDate: `${ACTIVE_SEASON_YEAR}-05-01`,
        endDate: `${ACTIVE_SEASON_YEAR}-05-31`,
        hours: [{ weekDays: ['Tue'], startTime: '3:00PM', endTime: '7:00PM', types: ['Team Practice Only'], accessStatus: 'practice-only' }]
      }] : [];
      pool.scheduleOverrides = [];
    });
  });
  await page.goto('/pools.html');
  await expect(page.locator('#poolListStatus')).toContainText('Pool directory loaded.');

  const fixturePoolId = await page.locator('.pool-card').first().getAttribute('data-pool-id');
  let fixturePool = page.locator(`.pool-card[data-pool-id="${fixturePoolId}"]`);
  await fixturePool.locator('.pool-header__toggle').click();
  await expect(fixturePool).toContainText('Team Practice Only');
  await expect(fixturePool.locator('.open-status')).toContainText('Closed to the public');
  await expect(fixturePool.locator('.open-status')).toHaveClass(/status-yellow/);

  await page.locator('#togglePoolFeatureFilters').click();
  await page.selectOption('#poolAvailabilityFilter', 'open-now');
  fixturePool = page.locator(`.pool-card[data-pool-id="${fixturePoolId}"]`);
  await expect(fixturePool).toHaveCount(0);
});

test('[WF-POOLS-012] live status updates after a team-only practice period ends without a reload', async ({ page }) => {
  await page.clock.install({ time: activeSeasonDate('05-26T18:59:30-04:00') });
  await routeAnnualData(page, 'pools', poolData => {
    poolData.pools.forEach((pool, index) => {
      pool.schedules = index === 0 ? [{
        startDate: `${ACTIVE_SEASON_YEAR}-05-01`,
        endDate: `${ACTIVE_SEASON_YEAR}-05-31`,
        hours: [{ weekDays: ['Tue'], startTime: '3:00PM', endTime: '7:00PM', types: ['Team Practice Only'], accessStatus: 'practice-only' }]
      }] : [];
      pool.scheduleOverrides = [];
    });
  });
  await page.goto('/pools.html');
  await expect(page.locator('#poolListStatus')).toContainText('Pool directory loaded.');

  const fixturePool = page.locator('.pool-card').first();
  const toggle = fixturePool.locator('.pool-header__toggle');
  await toggle.evaluate(button => button.click());
  await expect(fixturePool.locator('.open-status')).toContainText('Closed to the public');
  await expect(fixturePool.locator('.open-status')).toHaveClass(/status-yellow/);

  await toggle.focus();
  await page.clock.fastForward(31 * 1000);
  await expect(fixturePool.locator('.open-status')).toContainText('Closed');
  await expect(fixturePool.locator('.open-status')).toHaveClass(/status-red/);
  await expect(fixturePool.locator('.pool-header__toggle')).toBeFocused();
  await expect(page.locator('#poolListStatus')).toHaveText('Pool availability updated for the current time.');
});

test('[WF-POOLS-013] open-now results update after a public-use period ends without a reload', async ({ page }) => {
  await page.clock.install({ time: activeSeasonDate('05-26T18:59:30-04:00') });
  await routeAnnualData(page, 'pools', poolData => {
    poolData.pools.forEach((pool, index) => {
      pool.schedules = [{
        startDate: `${ACTIVE_SEASON_YEAR}-05-01`,
        endDate: `${ACTIVE_SEASON_YEAR}-05-31`,
        hours: [{ weekDays: ['Tue'], startTime: '1:00PM', endTime: index === 0 ? '7:00PM' : '8:00PM', types: ['Rec Swim'], accessStatus: 'public' }]
      }];
      pool.scheduleOverrides = [];
    });
  });
  await page.goto('/pools.html');
  await expect(page.locator('#poolListStatus')).toContainText('Pool directory loaded.');

  const fixturePoolId = await page.locator('.pool-card').first().getAttribute('data-pool-id');
  await page.locator('#togglePoolFeatureFilters').evaluate(button => button.click());
  await page.selectOption('#poolAvailabilityFilter', 'open-now');
  const fixturePool = page.locator(`.pool-card[data-pool-id="${fixturePoolId}"]`);
  await expect(fixturePool).toHaveCount(1);

  await page.clock.fastForward(31 * 1000);
  await expect(fixturePool).toHaveCount(0);
  await expect(page.locator('#poolListStatus')).toHaveText('Pool availability updated for the current time.');
});

test('[WF-POOLS-030] meet enrichment immediately reconciles live status and open-now results', async ({ page }) => {
  await page.clock.setFixedTime(activeSeasonDate('06-20T08:00:00-04:00'));
  let fixturePoolId = '';
  let fixturePoolName = '';
  await routeAnnualData(page, 'pools', poolData => {
    poolData.pools.forEach((pool, index) => {
      pool.schedules = [{
        startDate: `${ACTIVE_SEASON_YEAR}-05-01`,
        endDate: `${ACTIVE_SEASON_YEAR}-09-07`,
        hours: [{
          weekDays: ['Sat'],
          startTime: '6:00AM',
          endTime: '8:00PM',
          types: ['Fixture Public Use'],
          accessStatus: 'public'
        }]
      }];
      pool.scheduleOverrides = [];
      if (index === 0) {
        fixturePoolId = pool.id;
        fixturePoolName = pool.name;
      }
    });
  });

  let releaseMeetRequest;
  const meetRequestPaused = new Promise(resolve => {
    releaseMeetRequest = resolve;
  });
  await page.route(getAnnualDataRoute('meets'), async route => {
    const response = await route.fetch();
    const meetData = await response.json();
    await meetRequestPaused;
    meetData.regular_meets = [{
      date: `${ACTIVE_SEASON_YEAR}-06-20`,
      name: 'Fixture Dual Meet',
      visiting_team: 'Fixture Visitors',
      home_team: 'Fixture Hosts',
      location: `${fixturePoolName} Pool`
    }];
    meetData.special_meets = [];
    await route.fulfill({ response, json: meetData });
  });

  let initialVisiblePoolCount;
  try {
    await page.goto('/pools.html', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#poolList')).toHaveAttribute('aria-busy', 'false');
    const availabilityFilter = page.locator('#poolAvailabilityFilter');
    await page.locator('#togglePoolFeatureFilters').click();
    await availabilityFilter.selectOption('open-now');
    initialVisiblePoolCount = await page.locator('#poolList .pool-card').count();
    const fixturePool = page.locator(`.pool-card[data-pool-id="${fixturePoolId}"]`);
    await expect(fixturePool).toHaveCount(1);
    await expect(fixturePool.locator('.pool-status-indicator')).toHaveClass(/green/);
    await expect(fixturePool.locator('.pool-transition-summary')).toHaveCount(1);
    await availabilityFilter.focus();
    await expect(availabilityFilter).toBeFocused();
  } finally {
    releaseMeetRequest();
  }

  await expect.poll(() => page.evaluate(id => {
    const pool = globalThis.getDataManager().getPools().getAllPools().find(candidate => candidate.id === id);
    return pool?.getCurrentStatus().kind;
  }, fixturePoolId)).toBe('swim-meet');
  await expect(page.locator(`.pool-card[data-pool-id="${fixturePoolId}"]`)).toHaveCount(0);
  await expect(page.locator('#poolAvailabilityFilter')).toBeFocused();
  await expect(page.locator('#poolList .pool-card')).toHaveCount(initialVisiblePoolCount - 1);
  await expect(page.locator('#poolFilterSummary'))
    .toContainText(`${initialVisiblePoolCount - 1} / ${initialVisiblePoolCount}`);

  await page.locator('#poolAvailabilityFilter').selectOption('all');
  const enrichedFixturePool = page.locator(`.pool-card[data-pool-id="${fixturePoolId}"]`);
  await expect(enrichedFixturePool).toHaveCount(1);
  await expect(enrichedFixturePool.locator('.pool-status-indicator')).toHaveClass(/yellow/);
});

test('[WF-POOLS-024] semantic practice status drives detail and calendar styling when its label changes', async ({ page }) => {
  await page.clock.setFixedTime(activeSeasonDate('06-25T12:00:00-04:00'));
  await seedPreferences(page, { poolScheduleLayout: 'calendar' });
  await routeAnnualData(page, 'pools', poolData => {
    poolData.pools.forEach(pool => {
      pool.schedules.forEach(schedule => {
        schedule.hours.forEach(hours => {
          if (hours.accessStatus === 'practice-only') hours.types = ['Published Team Session'];
        });
      });
    });
  });
  await page.goto('/pools.html');
  await expect(page.locator('#poolListStatus')).toContainText('Pool directory loaded.');

  let publishedSession;
  for (const poolCard of await page.locator('.pool-card').all()) {
    await poolCard.locator('.pool-header__toggle').click();
    const session = poolCard.locator('.schedule-activity--event').filter({ hasText: 'Published Team Session' }).first();
    if (await session.count()) {
      publishedSession = session;
      break;
    }
  }
  expect(publishedSession).toBeTruthy();
  await expect(publishedSession).toHaveClass(/schedule-activity--event/);
});

test('[WF-POOLS-015] opens-soon results update when a public opening enters the next hour', async ({ page }) => {
  await page.clock.install({ time: activeSeasonDate('05-26T13:59:30-04:00') });
  await page.route(getAnnualDataRoute('pools'), async route => {
    const response = await route.fetch();
    const poolData = await response.json();
    poolData.pools.forEach(pool => {
      pool.schedules = [{
        startDate: `${ACTIVE_SEASON_YEAR}-05-23`,
        endDate: `${ACTIVE_SEASON_YEAR}-09-07`,
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
  const totalPoolCount = await page.locator('#poolList .pool-card').count();

  await page.locator('#togglePoolFeatureFilters').click();
  await page.selectOption('#poolAvailabilityFilter', 'opens-soon');
  await expect(page.locator('#poolList .pool-card')).toHaveCount(0);

  await page.clock.fastForward(31 * 1000);
  await expect(page.locator('#poolList .pool-card')).toHaveCount(totalPoolCount);
  await expect(page.locator('#poolListStatus')).toHaveText('Pool availability updated for the current time.');
});

test('[WF-POOLS-026] Masters-only hours are restricted program access instead of a public opening', async ({ page }) => {
  await page.clock.setFixedTime(activeSeasonDate('06-10T06:30:00-04:00'));
  await seedPreferences(page, { poolScheduleLayout: 'list' });
  await routeAnnualData(page, 'pools', poolData => {
    poolData.pools.forEach((pool, index) => {
      pool.schedules = index === 0 ? [{
        startDate: `${ACTIVE_SEASON_YEAR}-06-01`,
        endDate: `${ACTIVE_SEASON_YEAR}-06-30`,
        hours: [{ weekDays: ['Wed'], startTime: '6:00AM', endTime: '7:00AM', types: ['Masters Swim'], accessStatus: 'restricted' }]
      }] : [];
      pool.scheduleOverrides = [];
    });
  });
  await page.goto('/pools.html');
  await expect(page.locator('#poolList')).toHaveAttribute('aria-busy', 'false');

  const fixturePoolId = await page.locator('.pool-card').first().getAttribute('data-pool-id');
  let fixturePool = page.locator(`.pool-card[data-pool-id="${fixturePoolId}"]`);
  await fixturePool.locator('.pool-header__toggle').click();
  await expect(fixturePool.locator('.open-status')).toContainText('Restricted Access');
  await expect(fixturePool.locator('.open-status')).toHaveClass(/status-yellow/);
  await expect(fixturePool.locator('.pool-hours')).toContainText('Masters Swim');

  await page.locator('#togglePoolFeatureFilters').click();
  await page.selectOption('#poolAvailabilityFilter', 'open-now');
  fixturePool = page.locator(`.pool-card[data-pool-id="${fixturePoolId}"]`);
  await expect(fixturePool).toHaveCount(0);
});

test('[WF-POOLS-027] replacement-day hours remove the recurring schedule tail', async ({ page }) => {
  await page.clock.setFixedTime(activeSeasonDate('06-19T18:30:00-04:00'));
  await seedPreferences(page, { poolScheduleLayout: 'list' });
  await routeAnnualData(page, 'pools', poolData => {
    poolData.pools.forEach((pool, index) => {
      pool.schedules = index === 0 ? [{
        startDate: `${ACTIVE_SEASON_YEAR}-06-01`,
        endDate: `${ACTIVE_SEASON_YEAR}-06-30`,
        hours: [{
          weekDays: ['Fri'], startTime: '12:00PM', endTime: '8:30PM',
          types: ['Laps', 'Rec Swim'], accessStatus: 'public'
        }]
      }] : [];
      pool.scheduleOverrides = index === 0 ? [{
        startDate: `${ACTIVE_SEASON_YEAR}-06-19`,
        endDate: `${ACTIVE_SEASON_YEAR}-06-19`,
        overrideMode: 'replace-day',
        reason: 'Fixture holiday hours',
        hours: [{
          weekDays: ['Fri'], startTime: '12:00PM', endTime: '7:00PM',
          types: ['Laps', 'Rec Swim'], accessStatus: 'public'
        }]
      }] : [];
    });
  });
  await page.goto('/pools.html');
  await expect(page.locator('#poolList')).toHaveAttribute('aria-busy', 'false');

  const fixturePool = page.locator('.pool-card').first();
  await fixturePool.locator('.pool-header__toggle').click();
  await expect(fixturePool.locator('.open-status')).toContainText('Open Now');
  await expect(fixturePool.locator('.pool-transition-summary')).toContainText('Closes in 30 mins');
  await expect(fixturePool.locator('.pool-hours')).toContainText('Fixture holiday hours');
  await expect(fixturePool.locator('.pool-hours')).not.toContainText('8:30');
  await expect(fixturePool.locator('.pool-hours .time-slot').filter({ hasText: 'Laps, Rec Swim' })).toHaveCount(1);
});

test('[WF-POOLS-025] collapsed and expanded countdowns update without interaction', async ({ page }) => {
  await page.clock.install({ time: activeSeasonDate('05-26T14:58:30-04:00') });
  const closingPool = ANNUAL_POOLS[0];
  const openingPool = ANNUAL_POOLS[1];
  const meetPool = ANNUAL_POOLS[2];
  await seedPreferences(page, { favoritePoolExpanded: false, favoritePoolName: meetPool.name });
  await page.route(getAnnualDataRoute('pools'), async route => {
    const response = await route.fetch();
    const poolData = await response.json();
    poolData.pools.forEach((pool, index) => {
      pool.schedules = [{
        startDate: `${ACTIVE_SEASON_YEAR}-05-23`,
        endDate: `${ACTIVE_SEASON_YEAR}-09-07`,
        hours: index === 2 ? [{
          weekDays: ['Tue'], startTime: '1:00PM', endTime: '3:00PM',
          types: ['Swim Meet'], accessStatus: 'swim-meet'
        }, {
          weekDays: ['Tue'], startTime: '3:00PM', endTime: '6:00PM',
          types: ['Rec Swim'], accessStatus: 'public'
        }] : [{
          weekDays: ['Tue'], startTime: index === 0 ? '1:00PM' : '3:00PM',
          endTime: index === 0 ? '3:00PM' : '6:00PM',
          types: ['Rec Swim'], accessStatus: 'public'
        }]
      }];
      pool.scheduleOverrides = [];
    });
    await route.fulfill({ response, json: poolData });
  });
  await page.goto('/pools.html');
  await expect(page.locator('#poolList')).toHaveAttribute('aria-busy', 'false');

  const closingCard = page.locator(`.pool-card[data-pool-id="${closingPool.id}"]`);
  const openingCard = page.locator(`.pool-card[data-pool-id="${openingPool.id}"]`);
  const meetCard = page.locator(`.pool-card[data-pool-id="${meetPool.id}"]`);
  await expect(closingCard).toHaveClass(/collapsed/);
  await expect(openingCard).toHaveClass(/collapsed/);
  await expect(meetCard).toHaveClass(/collapsed/);
  await expect(closingCard.locator('.pool-transition-summary')).toHaveText('Closes in 2 mins');
  await expect(openingCard.locator('.pool-transition-summary')).toHaveText('Opens in 2 mins');
  await expect(meetCard.locator('.pool-transition-summary')).toHaveText('Opens in 2 mins');

  await closingCard.locator('.pool-header__toggle').click();
  const expandedCountdown = closingCard.locator('.pool-status-countdown');
  const todayButton = closingCard.locator('.today-btn');
  await expect(expandedCountdown).toHaveText('Closes in 2 mins');
  await todayButton.focus();

  await page.clock.fastForward(31 * 1000);
  await expect(closingCard.locator('.pool-transition-summary')).toHaveText('Closes in 1 min');
  await expect(openingCard.locator('.pool-transition-summary')).toHaveText('Opens in 1 min');
  await expect(meetCard.locator('.pool-transition-summary')).toHaveText('Opens in 1 min');
  await expect(expandedCountdown).toHaveText('Closes in 1 min');
  await expect(todayButton).toBeFocused();
});

test('[WF-POOLS-031] closing countdown remains red across the one-hour boundary', async ({ page }) => {
  await page.clock.install({ time: activeSeasonDate('05-26T14:59:00-04:00') });
  const closingPool = ANNUAL_POOLS[0];
  await routeAnnualData(page, 'pools', poolData => {
    poolData.pools.forEach((pool, index) => {
      pool.schedules = index === 0 ? [{
        startDate: `${ACTIVE_SEASON_YEAR}-05-23`,
        endDate: `${ACTIVE_SEASON_YEAR}-09-07`,
        hours: [{
          weekDays: ['Tue'], startTime: '1:00PM', endTime: '4:00PM',
          types: ['Rec Swim'], accessStatus: 'public'
        }]
      }] : [];
      pool.scheduleOverrides = [];
    });
  });
  await page.goto('/pools.html');
  await expect(page.locator('#poolList')).toHaveAttribute('aria-busy', 'false');

  const countdown = page.locator(`.pool-card[data-pool-id="${closingPool.id}"] .pool-transition-summary`);
  await expect(countdown).toHaveText('Closes in 1 hr 1 min');
  await expect.poll(() => countdown.evaluate((element, colorToken) => {
    const probe = globalThis.document.createElement('span');
    probe.style.color = `var(${colorToken})`;
    globalThis.document.body.append(probe);
    const matches = globalThis.getComputedStyle(element).color === globalThis.getComputedStyle(probe).color;
    probe.remove();
    return matches;
  }, '--error-text-color')).toBe(true);

  await page.clock.fastForward(60 * 1000);
  await expect(countdown).toHaveText('Closes in 1 hr 0 mins');
  await expect.poll(() => countdown.evaluate((element, colorToken) => {
    const probe = globalThis.document.createElement('span');
    probe.style.color = `var(${colorToken})`;
    globalThis.document.body.append(probe);
    const matches = globalThis.getComputedStyle(element).color === globalThis.getComputedStyle(probe).color;
    probe.remove();
    return matches;
  }, '--error-text-color')).toBe(true);
});
