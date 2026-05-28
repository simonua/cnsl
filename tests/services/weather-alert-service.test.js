const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createLocalStorageMock } = require('../helpers/test-helpers.js');
const WeatherAlertService = require('../../src/js/services/weather-alert-service.js');

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

    it('should show an alert for thunderstorms in the near-term forecast', () => {
      const status = WeatherAlertService.evaluateStatus([], [{
        name: 'Tonight',
        startTime: '2026-05-24T18:00:00-04:00',
        endTime: '2026-05-25T06:00:00-04:00',
        shortForecast: 'Showers And Thunderstorms'
      }], now);

      assert.equal(status.isInclement, true);
      assert.equal(status.source, 'forecast');
      assert.match(status.message, /thunderstorms or lightning/i);
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
      assert.match(status.message, /thunderstorms or lightning/i);
      assert.doesNotMatch(status.message, /Patchy Fog/);
    });

    it('should prioritize an active dangerous weather alert', () => {
      const status = WeatherAlertService.evaluateStatus([{
        properties: { event: 'Severe Thunderstorm Warning' }
      }], [], now);

      assert.equal(status.isInclement, true);
      assert.equal(status.source, 'alert');
      assert.match(status.message, /Severe Thunderstorm Warning/);
    });

    it('should ignore storm forecasts outside the next day', () => {
      const status = WeatherAlertService.evaluateStatus([], [{
        name: 'Tuesday',
        startTime: '2026-05-26T12:00:00-04:00',
        endTime: '2026-05-26T18:00:00-04:00',
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
      assert.match(forecast.message, /Near-term forecast/);
    });
  });

  describe('getCurrentStatus', () => {
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
      assert.equal(status.source, 'forecast');
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
      const status = WeatherAlertService.withUpdatedAt({ isInclement: true, message: 'Storm warning.' }, now);
      WeatherAlertService.cacheStatus(storage, status, 10, now);

      const cached = WeatherAlertService.readCachedStatusEntry(storage, 10, new Date(now.getTime() + 60 * 1000));

      assert.deepEqual(cached.status, status);
      assert.equal(cached.expiresAt, now.getTime() + 10 * 60 * 1000);
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
      const status = await WeatherAlertService.getCurrentStatus({
        poolDataUrl: '/pools.json',
        now,
        storage: null,
        fetchImplementation: async url => {
          urls.push(url);
          if (url === '/pools.json') return { ok: true, json: async () => poolData };
          throw new Error('offline');
        }
      });
      assert.equal(status.isInclement, false);
      assert.ok(urls.includes('/pools.json'));
    });

    it('returns a clear status when point data has no forecast endpoint', async () => {
      const status = await WeatherAlertService.getCurrentStatus({
        now,
        poolData,
        storage: null,
        fetchImplementation: async url => url.includes('/alerts/active')
          ? { ok: true, json: async () => ({ features: [] }) }
          : { ok: false, json: async () => ({}) }
      });
      assert.equal(status.isInclement, false);
      assert.equal(status.updatedAt, now.toISOString());
      assert.equal(await WeatherAlertService.fetchJson('/bad', async () => ({ ok: false })), null);
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
    });
  });

  describe('cache and browser fallbacks', () => {
    it('handles invalid cache storage and missing session storage', () => {
      const blocked = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
      assert.equal(WeatherAlertService.readCachedStatusEntry(blocked, 5, now), null);
      assert.doesNotThrow(() => WeatherAlertService.cacheStatus(blocked, { isInclement: false }, 5, now));
      const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
      Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, get: () => { throw new Error('blocked'); } });
      try {
        assert.equal(WeatherAlertService.getSessionStorage(), null);
      } finally {
        if (originalDescriptor) Object.defineProperty(globalThis, 'sessionStorage', originalDescriptor);
        else delete globalThis.sessionStorage;
      }
    });

    it('handles absent, expired, and accessible session cache state', () => {
      assert.equal(WeatherAlertService.readCachedStatusEntry(null, 5, now), null);
      const storage = createLocalStorageMock();
      storage.setItem(WeatherAlertService.CACHE_KEY, JSON.stringify({ refreshMinutes: 5, expiresAt: now.getTime() - 1, status: { isInclement: true } }));
      assert.equal(WeatherAlertService.readCachedStatus(storage, 5, now), null);
      assert.doesNotThrow(() => WeatherAlertService.cacheStatus(null, { isInclement: false }, 5, now));
      const originalSessionStorage = globalThis.sessionStorage;
      globalThis.sessionStorage = storage;
      try {
        assert.equal(WeatherAlertService.getSessionStorage(), storage);
      } finally {
        if (originalSessionStorage === undefined) delete globalThis.sessionStorage;
        else globalThis.sessionStorage = originalSessionStorage;
      }
    });

    it('installs weather evaluation as a browser script global', () => {
      const sourcePath = path.join(__dirname, '..', '..', 'src', 'js', 'services', 'weather-alert-service.js');
      const source = fs.readFileSync(sourcePath, 'utf8');
      const context = { window: {}, globalThis: {} };
      vm.runInNewContext(source, context, { filename: sourcePath });
      assert.equal(typeof context.window.WeatherAlertService, 'function');
    });

      it('normalizes configured refresh intervals and default values', () => {
        assert.equal(WeatherAlertService.normalizeRefreshMinutes('10'), 10);
        assert.equal(WeatherAlertService.normalizeRefreshMinutes('unknown'), WeatherAlertService.DEFAULT_REFRESH_MINUTES);
      });
  });
});
