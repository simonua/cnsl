const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createClassicScriptLoader } = require('../../scripts/lib/classic-script-loader.js');
const { createLocalStorageMock } = require('../helpers/test-helpers.js');
const weatherAlertModule = require('../helpers/browser-module-loader.js').loadBrowserModule('weather-alert-service');
const { WeatherAlertService, WeatherAlertSource, context: weatherAlertContext } = weatherAlertModule;

const now = new Date('2026-05-24T12:00:00-04:00');
const poolData = {
  pools: [{
    schedules: [{
      startDate: '2026-05-23',
      endDate: '2026-05-25',
      hours: [{ weekDays: ['Sun'], types: ['Laps', 'Rec Swim'], startTime: '12:00pm', endTime: '7:00pm' }]
    }]
  }]
};

describe('WeatherAlertService', () => {
  describe('evaluateStatus', () => {
    it('should not show an alert for a rain-only forecast', () => {
      const status = WeatherAlertService.evaluateStatus([], [{
        name: 'This Afternoon',
        startTime: '2026-05-24T12:00:00-04:00',
        endTime: '2026-05-24T18:00:00-04:00',
        shortForecast: 'Light Rain Likely'
      }], now);

      assert.deepEqual(status, { isInclement: false });
    });

    it('should show an alert for thunderstorms later today', () => {
      const status = WeatherAlertService.evaluateStatus([], [{
        name: 'Tonight',
        startTime: '2026-05-24T18:00:00-04:00',
        endTime: '2026-05-25T06:00:00-04:00',
        shortForecast: 'Showers And Thunderstorms'
      }], now);

      assert.equal(status.isInclement, true);
      assert.equal(status.source, WeatherAlertSource.FORECAST);
      assert.equal(status.hazardLabel, 'thunderstorms');
      assert.deepEqual(status.hazards, ['thunderstorms']);
      assert.equal(status.message, "Tonight's forecast includes thunderstorms.");
      assert.equal(status.guidance, WeatherAlertService.OFFICIAL_STATUS_GUIDANCE);
    });

    it('should name the storm risk when it appears only in detailed forecast text', () => {
      const status = WeatherAlertService.evaluateStatus([], [{
        name: 'Tonight',
        startTime: '2026-05-24T18:00:00-04:00',
        endTime: '2026-05-25T06:00:00-04:00',
        shortForecast: 'Patchy Fog',
        detailedForecast: 'Patchy fog before midnight, with a chance of thunderstorms later.'
      }], now);

      assert.equal(status.isInclement, true);
      assert.match(status.message, /includes thunderstorms/i);
      assert.doesNotMatch(status.message, /Patchy Fog/);
    });

    it('should name each recognized forecast hazard without echoing forecast prose', () => {
      const cases = [
        ['Lightning is possible near the pools.', 'lightning', ['lightning']],
        ['A tornado may develop this afternoon.', 'tornadoes', ['tornadoes']],
        ['Severe storms may produce hail.', 'hail', ['hail']],
        ['Thunderstorms may produce frequent lightning and hail.', 'thunderstorms, lightning and hail', ['thunderstorms', 'lightning', 'hail']]
      ];

      cases.forEach(([detailedForecast, expectedHazardLabel, expectedHazards]) => {
        const status = WeatherAlertService.evaluateStatus([], [{
          name: 'This Afternoon',
          startTime: now.toISOString(),
          detailedForecast
        }], now);

        assert.equal(status.hazardLabel, expectedHazardLabel);
        assert.deepEqual(status.hazards, expectedHazards);
        assert.equal(status.message, `This afternoon's forecast includes ${expectedHazardLabel}.`);
        assert.equal(status.guidance, WeatherAlertService.OFFICIAL_STATUS_GUIDANCE);
      });
    });

    it('should sentence-case compound forecast period names', () => {
      const cases = [
        ['This Morning', 'This morning'],
        ['This Afternoon', 'This afternoon'],
        ['This Evening', 'This evening'],
        ['Thursday Night', 'Thursday night'],
        ['Morning', 'Morning'],
        ['Evening', 'Evening'],
        ['Night', 'Night'],
        ['Today', 'Today'],
        ['Tonight', 'Tonight'],
        ['Overnight', 'Overnight']
      ];

      cases.forEach(([name, expectedName]) => {
        const status = WeatherAlertService.evaluateStatus([], [{
          name,
          startTime: now.toISOString(),
          detailedForecast: 'Thunderstorms are possible.'
        }], now);

        assert.equal(status.message, `${expectedName}'s forecast includes thunderstorms.`);
      });
    });

    it('should prioritize an active dangerous weather alert', () => {
      const status = WeatherAlertService.evaluateStatus([{
        properties: { event: 'Severe Thunderstorm Warning' }
      }], [], now);

      assert.equal(status.isInclement, true);
      assert.equal(status.source, WeatherAlertSource.ALERT);
      assert.equal(status.alertLabel, 'Severe Thunderstorm Warning');
      assert.equal(status.guidance, WeatherAlertService.OFFICIAL_STATUS_GUIDANCE);
      assert.match(status.message, /Severe Thunderstorm Warning/);
    });

    it('should ignore an active dangerous weather alert that begins tomorrow', () => {
      const status = WeatherAlertService.evaluateStatus([{
        properties: {
          event: 'Severe Thunderstorm Watch',
          onset: '2026-05-25T08:00:00-04:00',
          expires: '2026-05-25T18:00:00-04:00'
        }
      }], [], now);

      assert.deepEqual(status, { isInclement: false });
    });

    it('should include an active dangerous weather alert spanning the current pool day', () => {
      const status = WeatherAlertService.evaluateStatus([{
        properties: {
          event: 'Severe Thunderstorm Watch',
          onset: '2026-05-23T22:00:00-04:00',
          expires: '2026-05-25T02:00:00-04:00'
        }
      }], [], now);

      assert.equal(status.isInclement, true);
      assert.equal(status.source, WeatherAlertSource.ALERT);
    });

    it('should ignore storm forecasts for tomorrow', () => {
      const status = WeatherAlertService.evaluateStatus([], [{
        name: 'Tomorrow',
        startTime: '2026-05-25T08:00:00-04:00',
        endTime: '2026-05-25T18:00:00-04:00',
        shortForecast: 'Thunderstorms Likely'
      }], now);

      assert.deepEqual(status, { isInclement: false });
    });

    it('handles malformed feeds and fallback alert and forecast names', () => {
      assert.deepEqual(WeatherAlertService.evaluateStatus(null, null, now), { isInclement: false });
      assert.deepEqual(WeatherAlertService.evaluateStatus([null, {}], [null, { startTime: 'bad', shortForecast: 'Thunderstorms' }], now), { isInclement: false });
      const alert = WeatherAlertService.evaluateStatus([{ properties: { headline: 'Lightning expected' } }], [], now);
      assert.match(alert.message, /hazardous weather/);
      const forecast = WeatherAlertService.evaluateStatus([], [{
        startTime: now.toISOString(),
        shortForecast: 'Lightning'
      }], now);
      assert.match(forecast.message, /The near-term forecast/);
      const detailedOnly = WeatherAlertService.evaluateStatus([], [{
        startTime: now.toISOString(),
        detailedForecast: 'Lightning is possible.'
      }], now);
      assert.equal(detailedOnly.isInclement, true);
    });
  });

  describe('getForecastHazardLabel', () => {
    it('should return an empty label when no recognized hazard is present', () => {
      assert.equal(WeatherAlertService.getForecastHazardLabel('Light rain and patchy fog'), '');
    });

    it('should normalize every accepted forecast hazard token', () => {
      const cases = [
        ['thunderstorm', 'thunderstorms'],
        ['thunderstorms', 'thunderstorms'],
        ['tstorm', 'thunderstorms'],
        ['tstorms', 'thunderstorms'],
        ['t-storm', 'thunderstorms'],
        ['t-storms', 'thunderstorms'],
        ['LIGHTNING', 'lightning'],
        ['tornado', 'tornadoes'],
        ['tornadoes', 'tornadoes'],
        ['Hail', 'hail']
      ];

      cases.forEach(([forecastText, expectedLabel]) => {
        assert.equal(WeatherAlertService.getForecastHazardLabel(forecastText), expectedLabel);
      });
    });

    it('should format every multi-hazard list condition in semantic order', () => {
      const cases = [
        ['Thunderstorms with lightning', 'thunderstorms and lightning'],
        ['Hail and tornadoes with thunderstorms', 'thunderstorms, tornadoes and hail'],
        ['Hail, tornado, lightning, and t-storms', 'thunderstorms, lightning, tornadoes and hail']
      ];

      cases.forEach(([forecastText, expectedLabel]) => {
        assert.equal(WeatherAlertService.getForecastHazardLabel(forecastText), expectedLabel);
      });
    });

    it('should include each hazard only once when forecast sections repeat it', () => {
      assert.equal(
        WeatherAlertService.getForecastHazardLabel('Thunderstorms likely. Detailed forecast: thunderstorms possible.'),
        'thunderstorms'
      );
    });
  });

  describe('getCurrentStatus', () => {
    it('uses default dependencies when options are omitted', async () => {
      assert.deepEqual(await WeatherAlertService.getCurrentStatus({ refreshMinutes: 0 }), {
        isInclement: false,
        reason: 'updates-disabled'
      });
      assert.deepEqual(await WeatherAlertService.getCurrentStatus({ latestCheckedStorage: null, refreshMinutes: 0 }), {
        isInclement: false,
        reason: 'updates-disabled'
      });
    });
    it('should retrieve the forecast used to identify storm conditions', async () => {
      const urls = [];
      const fetchImplementation = async (url) => {
        urls.push(url);
        if (url.includes('/alerts/active')) return { ok: true, json: async () => ({ features: [] }) };
        if (url.includes('/points/')) return { ok: true, json: async () => ({ properties: { forecast: 'https://forecast.test/current' } }) };
        return {
          ok: true,
          json: async () => ({
            properties: {
              periods: [{
                name: 'Today',
                startTime: now.toISOString(),
                endTime: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
                shortForecast: 'Chance Thunderstorms'
              }]
            }
          })
        };
      };

      const status = await WeatherAlertService.getCurrentStatus({ fetchImplementation, now, poolData, storage: null });

      assert.equal(status.isInclement, true);
      assert.equal(status.source, WeatherAlertSource.FORECAST);
      assert.equal(status.updatedAt, now.toISOString());
      assert.equal(urls.length, 3);
    });

    it('should skip weather requests when updates are turned off', async () => {
      let requestCount = 0;
      const status = await WeatherAlertService.getCurrentStatus({
        fetchImplementation: async () => {
          requestCount += 1;
          return { ok: true, json: async () => ({}) };
        },
        now,
        poolData,
        refreshMinutes: 0,
        storage: null
      });

      assert.deepEqual(status, { isInclement: false, reason: 'updates-disabled' });
      assert.equal(requestCount, 0);
    });

    it('should retain cached update timestamps only for the configured interval', async () => {
      const storage = createLocalStorageMock();
      let requestCount = 0;
      const fetchImplementation = async url => {
        requestCount += 1;
        if (url.includes('/alerts/active')) {
          return { ok: true, json: async () => ({ features: [{ properties: { event: 'Severe Thunderstorm Warning' } }] }) };
        }
        return { ok: true, json: async () => ({ properties: {} }) };
      };

      const firstStatus = await WeatherAlertService.getCurrentStatus({ fetchImplementation, now, poolData, refreshMinutes: 10, storage });
      const cachedStatus = await WeatherAlertService.getCurrentStatus({ fetchImplementation, now: new Date(now.getTime() + 60 * 1000), poolData, refreshMinutes: 10, storage });
      const differentIntervalStatus = await WeatherAlertService.getCurrentStatus({ fetchImplementation, now: new Date(now.getTime() + 2 * 60 * 1000), poolData, refreshMinutes: 5, storage });

      assert.equal(firstStatus.updatedAt, now.toISOString());
      assert.equal(cachedStatus.updatedAt, firstStatus.updatedAt);
      assert.notEqual(differentIntervalStatus.updatedAt, firstStatus.updatedAt);
      assert.equal(requestCount, 4);
    });

    it('should expose the expiry for a still-valid cached status', () => {
      const storage = createLocalStorageMock();
      const latestCheckedStorage = createLocalStorageMock();
      const status = WeatherAlertService.withUpdatedAt({ isInclement: true, message: 'Storm warning.' }, now);
      WeatherAlertService.cacheStatus(storage, status, 10, now, latestCheckedStorage);

      const cached = WeatherAlertService.readCachedStatusEntry(storage, 10, new Date(now.getTime() + 60 * 1000));

      assert.deepEqual(cached.status, status);
      assert.equal(cached.expiresAt, now.getTime() + 10 * 60 * 1000);
      assert.deepEqual(WeatherAlertService.readLatestCheckedStatus(latestCheckedStorage), { updatedAt: status.updatedAt });
    });

    it('should avoid requesting weather before the one-hour pre-opening period', async () => {
      let requestCount = 0;
      const status = await WeatherAlertService.getCurrentStatus({
        fetchImplementation: async () => {
          requestCount += 1;
          return { ok: true, json: async () => ({}) };
        },
        now: new Date('2026-05-24T10:59:00-04:00'),
        poolData,
        storage: null
      });

      assert.deepEqual(status, { isInclement: false, reason: 'outside-pool-operating-window' });
      assert.equal(requestCount, 0);
    });

    it('should avoid requesting weather after the final pool activity closes', async () => {
      let requestCount = 0;
      const status = await WeatherAlertService.getCurrentStatus({
        fetchImplementation: async () => {
          requestCount += 1;
          return { ok: true, json: async () => ({}) };
        },
        now: new Date('2026-05-24T19:00:00-04:00'),
        poolData,
        storage: null
      });

      assert.deepEqual(status, { isInclement: false, reason: 'outside-pool-operating-window' });
      assert.equal(requestCount, 0);
    });

    it('should load operating data by URL and tolerate weather request failures', async () => {
      const urls = [];
      const storage = createLocalStorageMock();
      const latestCheckedStorage = createLocalStorageMock();
      const previousStatus = WeatherAlertService.withUpdatedAt({ isInclement: false }, new Date(now.getTime() - 10 * 60 * 1000));
      storage.setItem(WeatherAlertService.CACHE_KEY, JSON.stringify({ expiresAt: 1, refreshMinutes: 5, status: previousStatus }));
      WeatherAlertService.rememberLatestCheckedStatus(previousStatus, latestCheckedStorage);
      const status = await WeatherAlertService.getCurrentStatus({
        poolDataUrl: '/pools.json',
        now,
        storage,
        fetchImplementation: async url => {
          urls.push(url);
          if (url === '/pools.json') return { ok: true, json: async () => poolData };
          throw new Error('offline');
        }
      });
      assert.deepEqual(status, { isInclement: false, reason: 'weather-service-unavailable' });
      assert.deepEqual(WeatherAlertService.readLatestCheckedStatus(latestCheckedStorage), { updatedAt: previousStatus.updatedAt });
      assert.ok(urls.includes('/pools.json'));
    });

    it('returns an unavailable status when point data has no forecast endpoint', async () => {
      const status = await WeatherAlertService.getCurrentStatus({
        now,
        poolData,
        storage: null,
        fetchImplementation: async url => url.includes('/alerts/active')
          ? { ok: true, json: async () => ({ features: [] }) }
          : { ok: false, json: async () => ({}) }
      });
      assert.deepEqual(status, { isInclement: false, reason: 'weather-service-unavailable' });
      assert.equal(await WeatherAlertService.fetchJson('/bad', async () => ({ ok: false })), null);
    });

    it('returns an unavailable status when forecast periods are malformed', async () => {
      const status = await WeatherAlertService.getCurrentStatus({
        now,
        poolData,
        storage: null,
        fetchImplementation: async url => {
          if (url.includes('/alerts/active')) return { ok: true, json: async () => ({ features: [] }) };
          if (url.includes('/points/')) return { ok: true, json: async () => ({ properties: { forecast: 'https://forecast.test/current' } }) };
          return { ok: true, json: async () => ({ properties: { periods: null } }) };
        }
      });

      assert.deepEqual(status, { isInclement: false, reason: 'weather-service-unavailable' });
      const missingForecast = await WeatherAlertService.getCurrentStatus({
        now,
        poolData,
        storage: null,
        fetchImplementation: async url => {
          if (url.includes('/alerts/active')) return { ok: true, json: async () => ({ features: [] }) };
          if (url.includes('/points/')) return { ok: true, json: async () => ({ properties: { forecast: 'https://forecast.test/current' } }) };
          return { ok: false };
        }
      });
      assert.deepEqual(missingForecast, { isInclement: false, reason: 'weather-service-unavailable' });
    });

    it('uses absent pool data as outside the operating window', async () => {
      const status = await WeatherAlertService.getCurrentStatus({ now, storage: null, fetchImplementation: async () => ({ ok: true, json: async () => ({}) }) });
      assert.deepEqual(status, { isInclement: false, reason: 'outside-pool-operating-window' });
    });
  });

  describe('getPoolOperatingWindow', () => {
    it('should include override activity and begin notifications one hour early', () => {
      const dataWithOverride = {
        pools: [{
          ...poolData.pools[0],
          scheduleOverrides: [{
            startDate: '2026-05-24',
            endDate: '2026-05-24',
            hours: [{ weekDays: ['Sun'], types: ['Swim Meet'], startTime: '7:00am', endTime: '10:00am' }]
          }]
        }]
      };

      const window = WeatherAlertService.getPoolOperatingWindow(dataWithOverride, now);

      assert.equal(window.openMinutes, 420);
      assert.equal(window.notificationStartMinutes, 360);
      assert.equal(window.closeMinutes, 1140);
    });

    it('returns no window for absent or unscheduled data and validates daily hours', () => {
      assert.equal(WeatherAlertService.getPoolOperatingWindow(null, now), null);
      assert.equal(WeatherAlertService.getPoolOperatingWindow({ pools: [] }, now), null);
      assert.equal(WeatherAlertService.isActivityScheduledForDay(null, 'Sun'), false);
      assert.equal(WeatherAlertService.isActivityScheduledForDay({ weekDays: ['Sun'], types: ['Maintenance'], startTime: '1:00pm', endTime: '2:00pm' }, 'Sun'), false);
      assert.equal(WeatherAlertService.isActivityScheduledForDay({ weekDays: ['Mon'], startTime: '1:00pm', endTime: '2:00pm' }, 'Sun'), false);
      assert.equal(WeatherAlertService.isActivityScheduledForDay({ weekDays: ['Sun'], startTime: 1, endTime: '2:00pm' }, 'Sun'), false);
      assert.equal(WeatherAlertService.isActivityScheduledForDay({ weekDays: ['Sun'], startTime: '1:00pm', endTime: '2:00pm' }, 'Sun'), true);
      assert.equal(WeatherAlertService.isActivityScheduledForDay({ weekDays: ['Sun'], types: ['Maintenance', 'Rec Swim'], startTime: '1:00pm', endTime: '2:00pm' }, 'Sun'), true);
      assert.equal(WeatherAlertService.timeStringToMinutes('bad'), Number.NaN);
      assert.equal(WeatherAlertService.timeStringToMinutes('12:05am'), 5);
      assert.equal(WeatherAlertService.timeStringToMinutes('12:05pm'), 725);
    });

    it('ignores unscheduled shapes and dates outside the current operating day', () => {
      assert.equal(WeatherAlertService.getPoolOperatingWindow({ pools: [{ schedules: [{ startDate: '2026-05-25', endDate: '2026-05-26', hours: [] }] }] }, now), null);
      assert.equal(WeatherAlertService.getPoolOperatingWindow({ pools: [{ schedules: null, scheduleOverrides: null }] }, now), null);
      assert.equal(WeatherAlertService.isWithinPoolOperatingWindow(null, now), false);
      assert.equal(WeatherAlertService.isWithinPoolOperatingWindow(poolData, now), true);
      assert.equal(WeatherAlertService.getPoolOperatingWindow({ pools: [{ schedules: [{ startDate: '2026-05-24', endDate: '2026-05-24', hours: null }] }] }, now), null);
    });

    it('derives a compact daily schedule equivalent to the full pool document', () => {
      const seasonalPoolData = {
        ...poolData,
        seasonStartDate: '2026-05-23',
        seasonEndDate: '2026-05-25'
      };
      const operatingWindows = WeatherAlertService.createOperatingWindowSchedule(seasonalPoolData);

      assert.deepEqual(operatingWindows.dailyOperatingWindows, { '2026-05-24': [720, 1140] });
      assert.deepEqual(
        WeatherAlertService.getPoolOperatingWindow(operatingWindows, now),
        WeatherAlertService.getPoolOperatingWindow(seasonalPoolData, now)
      );
      assert.throws(() => WeatherAlertService.createOperatingWindowSchedule({}), /valid season date range/);
      assert.throws(() => WeatherAlertService.createOperatingWindowSchedule({ seasonStartDate: '2026-05-24' }), /valid season date range/);
      assert.throws(() => WeatherAlertService.createOperatingWindowSchedule({ seasonEndDate: '2026-02-28', seasonStartDate: '2026-02-30' }), /valid season date range/);
    });
  });

  describe('cache and browser fallbacks', () => {
    it('handles invalid cache storage and missing session storage', () => {
      const blocked = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
      assert.equal(WeatherAlertService.readCachedStatusEntry(blocked, 5, now), null);
      assert.doesNotThrow(() => WeatherAlertService.cacheStatus(blocked, { isInclement: false }, 5, now));
      const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
      const originalLocalStorageDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
      Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, get: () => { throw new Error('blocked'); } });
      Object.defineProperty(globalThis, 'localStorage', { configurable: true, get: () => { throw new Error('blocked'); } });
      try {
        assert.equal(WeatherAlertService.getSessionStorage(), null);
        assert.equal(WeatherAlertService.getLocalStorage(), null);
      } finally {
        if (originalDescriptor) Object.defineProperty(globalThis, 'sessionStorage', originalDescriptor);
        else delete globalThis.sessionStorage;
        if (originalLocalStorageDescriptor) Object.defineProperty(globalThis, 'localStorage', originalLocalStorageDescriptor);
        else delete globalThis.localStorage;
      }
    });

    it('handles absent, expired, and accessible session cache state', () => {
      assert.equal(WeatherAlertService.readCachedStatusEntry(null, 5, now), null);
      const storage = createLocalStorageMock();
      storage.setItem(WeatherAlertService.CACHE_KEY, JSON.stringify({ refreshMinutes: 5, expiresAt: now.getTime() - 1, status: { isInclement: true } }));
      assert.equal(WeatherAlertService.readCachedStatus(storage, 5, now), null);
      assert.doesNotThrow(() => WeatherAlertService.cacheStatus(null, { isInclement: false }, 5, now));
      const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
      delete globalThis.sessionStorage;
      assert.equal(WeatherAlertService.getSessionStorage(), null);
      if (originalDescriptor) Object.defineProperty(globalThis, 'sessionStorage', originalDescriptor);
      const originalSessionStorage = globalThis.sessionStorage;
      globalThis.sessionStorage = storage;
      try {
        assert.equal(WeatherAlertService.getSessionStorage(), storage);
      } finally {
        if (originalSessionStorage === undefined) delete globalThis.sessionStorage;
        else globalThis.sessionStorage = originalSessionStorage;
      }
    });

    it('reports the durable latest checked timestamp after freshness expires or the interval changes', () => {
      const storage = createLocalStorageMock();
      const latestCheckedStorage = createLocalStorageMock();
      const status = WeatherAlertService.withUpdatedAt({ isInclement: false }, now);
      WeatherAlertService.cacheStatus(storage, status, 5, now, latestCheckedStorage);

      assert.deepEqual(WeatherAlertService.readLatestCheckedStatus(latestCheckedStorage), { updatedAt: status.updatedAt });
      assert.equal(WeatherAlertService.readCachedStatus(storage, 10, now), null);
      assert.equal(WeatherAlertService.readCachedStatus(storage, 5, new Date(now.getTime() + 6 * 60 * 1000)), null);
      storage.setItem(WeatherAlertService.CACHE_KEY, JSON.stringify({ status: { isInclement: false, updatedAt: 'invalid' } }));
      assert.deepEqual(WeatherAlertService.readLatestCheckedStatus(latestCheckedStorage), { updatedAt: status.updatedAt });
      latestCheckedStorage.setItem(WeatherAlertService.LAST_SUCCESSFUL_CHECK_KEY, JSON.stringify({ updatedAt: 'invalid' }));
      assert.equal(WeatherAlertService.readLatestCheckedStatus(latestCheckedStorage), null);
    });

    it('tracks the latest in-memory status and preserves the newest durable check', () => {
      const storage = createLocalStorageMock();
      const latestStatus = WeatherAlertService.withUpdatedAt({ isInclement: false }, now);
      const olderStatus = WeatherAlertService.withUpdatedAt({ isInclement: true }, new Date(now.getTime() - 60 * 1000));

      WeatherAlertService.setLatestStatus(latestStatus);
      WeatherAlertService.rememberLatestCheckedStatus(latestStatus, storage);
      WeatherAlertService.rememberLatestCheckedStatus(olderStatus, storage);
      WeatherAlertService.rememberLatestCheckedStatus({ isInclement: false, updatedAt: 'invalid' }, storage);

      assert.deepEqual(WeatherAlertService.getLatestStatus(), latestStatus);
      assert.deepEqual(WeatherAlertService.readLatestCheckedStatus(storage), { updatedAt: latestStatus.updatedAt });
    });

    it('handles failures while reading and storing the latest durable check', () => {
      const blockedRead = { getItem: () => { throw new Error('blocked'); } };
      const blockedWrite = {
        getItem: () => null,
        setItem: () => { throw new Error('blocked'); }
      };
      const status = WeatherAlertService.withUpdatedAt({ isInclement: false }, now);

      assert.equal(WeatherAlertService.readLatestCheckedStatus(blockedRead), null);
      assert.equal(WeatherAlertService.readLatestCheckedStatus(), null);
      assert.doesNotThrow(() => WeatherAlertService.rememberLatestCheckedStatus(status, blockedWrite));
    });

    it('returns accessible local storage', () => {
      const storage = createLocalStorageMock();
      const originalLocalStorage = globalThis.localStorage;
      globalThis.localStorage = storage;
      try {
        assert.equal(WeatherAlertService.getLocalStorage(), storage);
      } finally {
        if (originalLocalStorage === undefined) delete globalThis.localStorage;
        else globalThis.localStorage = originalLocalStorage;
      }
    });

    it('returns null when browser storage access throws', () => {
      const originalSessionDescriptor = Object.getOwnPropertyDescriptor(weatherAlertContext, 'sessionStorage');
      const originalLocalDescriptor = Object.getOwnPropertyDescriptor(weatherAlertContext, 'localStorage');
      Object.defineProperty(weatherAlertContext, 'sessionStorage', { configurable: true, get: () => { throw new Error('blocked'); } });
      Object.defineProperty(weatherAlertContext, 'localStorage', { configurable: true, get: () => { throw new Error('blocked'); } });
      try {
        assert.equal(WeatherAlertService.getSessionStorage(), null);
        assert.equal(WeatherAlertService.getLocalStorage(), null);
      } finally {
        if (originalSessionDescriptor) Object.defineProperty(weatherAlertContext, 'sessionStorage', originalSessionDescriptor);
        else delete weatherAlertContext.sessionStorage;
        if (originalLocalDescriptor) Object.defineProperty(weatherAlertContext, 'localStorage', originalLocalDescriptor);
        else delete weatherAlertContext.localStorage;
      }
    });

    it('installs weather evaluation as a browser script global', () => {
      const sourcePath = path.join(__dirname, '..', '..', 'src', 'js', 'services', 'weather-alert-service.js');
      const source = fs.readFileSync(sourcePath, 'utf8');
      const context = {};
      context.globalThis = context;
      context.self = context;
      context.window = context;
      vm.runInNewContext(source, context, { filename: sourcePath });
      assert.equal(typeof context.window.WeatherAlertService, 'function');
    });

    it('handles throwing storage getters in its browser realm', () => {
      const loader = createClassicScriptLoader({ name: 'test:weather-alert-throwing-getters' });
      const { context } = loader;
      Object.defineProperty(context, 'sessionStorage', { configurable: true, get: () => { throw new Error('blocked'); } });
      Object.defineProperty(context, 'localStorage', { configurable: true, get: () => { throw new Error('blocked'); } });
      loader.load('services/weather-freshness-service.js');
      loader.load('services/weather-alert-service.js');

      assert.equal(context.WeatherAlertService.getSessionStorage(), null);
      assert.equal(context.WeatherAlertService.getLocalStorage(), null);
    });

      it('normalizes configured refresh intervals and default values', () => {
        assert.equal(WeatherAlertService.normalizeRefreshMinutes('10'), 10);
        assert.equal(WeatherAlertService.normalizeRefreshMinutes('unknown'), WeatherAlertService.DEFAULT_REFRESH_MINUTES);
      });
  });
});
