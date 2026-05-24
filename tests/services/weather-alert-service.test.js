const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
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
      assert.equal(urls.length, 3);
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
  });
});
