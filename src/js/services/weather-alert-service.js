/**
 * Evaluates National Weather Service data for outdoor pool safety notices.
 */
if (typeof window === 'undefined' || !window.WeatherAlertService) {
  class WeatherAlertService {
    static BASE_URL = 'https://api.weather.gov';
    static COLUMBIA_MD_POINT = '39.2014,-76.8610';
    static CACHE_KEY = 'cnsl_weather_alert_status';
    static DEFAULT_REFRESH_MINUTES = 5;
    static FORECAST_WINDOW_HOURS = 24;
    static POOL_OPENING_LEAD_MINUTES = 60;
    static EASTERN_TIMEZONE = 'America/New_York';
    static ALERT_PATTERN = /\b(?:thunderstorms?|t-?storms?|lightning|tornado(?:es)?|flash flood|flood warning|hurricane|tropical storm|extreme wind|high wind warning|hail)\b/i;
    static FORECAST_PATTERN = /\b(?:thunderstorms?|t-?storms?|lightning|tornado(?:es)?|hail)\b/i;

    /**
     * Determine whether current NWS alerts or the near-term forecast require a pool safety reminder.
     * @param {Array} alertFeatures - NWS alert GeoJSON features
     * @param {Array} forecastPeriods - NWS forecast periods
     * @param {Date} now - Evaluation time
     * @returns {Object} Banner status
     */
    static evaluateStatus(alertFeatures = [], forecastPeriods = [], now = new Date()) {
      const alerts = Array.isArray(alertFeatures) ? alertFeatures : [];
      const periods = Array.isArray(forecastPeriods) ? forecastPeriods : [];
      const activeAlert = alerts.find(feature => {
        const properties = feature && feature.properties ? feature.properties : {};
        const alertText = `${properties.event || ''} ${properties.headline || ''} ${properties.description || ''}`;
        return WeatherAlertService.ALERT_PATTERN.test(alertText);
      });

      if (activeAlert) {
        const eventName = activeAlert.properties.event || 'hazardous weather';
        return {
          isInclement: true,
          source: 'alert',
          message: `Active National Weather Service alert: ${eventName}. Check official pool status before leaving.`
        };
      }

      const forecastWindowEnd = new Date(now.getTime() + WeatherAlertService.FORECAST_WINDOW_HOURS * 60 * 60 * 1000);
      const unsafeForecast = periods.find(period => {
        if (!period) return false;
        const startsAt = new Date(period.startTime);
        const endsAt = new Date(period.endTime || period.startTime);
        const isNearTerm = !Number.isNaN(startsAt.getTime())
          && !Number.isNaN(endsAt.getTime())
          && startsAt <= forecastWindowEnd
          && endsAt >= now;
        const forecastText = `${period.shortForecast || ''} ${period.detailedForecast || ''}`;
        return isNearTerm && WeatherAlertService.FORECAST_PATTERN.test(forecastText);
      });

      if (unsafeForecast) {
        const periodName = unsafeForecast.name || 'Near-term';
        return {
          isInclement: true,
          source: 'forecast',
          message: `${periodName} forecast includes thunderstorms or lightning. Check official pool status before leaving.`
        };
      }

      return { isInclement: false };
    }

    /**
     * Fetch and evaluate current Columbia-area NWS information.
     * @param {Object} options - Optional testable dependencies
     * @returns {Promise<Object>} Banner status
     */
    static async getCurrentStatus(options = {}) {
      const fetchImplementation = options.fetchImplementation || fetch;
      const storage = Object.prototype.hasOwnProperty.call(options, 'storage')
        ? options.storage
        : WeatherAlertService.getSessionStorage();
      const now = options.now || new Date();
      const refreshMinutes = WeatherAlertService.normalizeRefreshMinutes(options.refreshMinutes);
      if (refreshMinutes === 0) {
        return { isInclement: false, reason: 'updates-disabled' };
      }

      const poolData = options.poolData || (options.poolDataUrl
        ? await WeatherAlertService.fetchJson(options.poolDataUrl, fetchImplementation)
        : null);
      if (!WeatherAlertService.isWithinPoolOperatingWindow(poolData, now)) {
        return { isInclement: false, reason: 'outside-pool-operating-window' };
      }

      const cachedStatus = WeatherAlertService.readCachedStatus(storage, refreshMinutes, now);
      if (cachedStatus) return cachedStatus;

      const alertUrl = `${WeatherAlertService.BASE_URL}/alerts/active?point=${WeatherAlertService.COLUMBIA_MD_POINT}`;
      const pointUrl = `${WeatherAlertService.BASE_URL}/points/${WeatherAlertService.COLUMBIA_MD_POINT}`;
      const [alertData, pointData] = await Promise.all([
        WeatherAlertService.fetchJson(alertUrl, fetchImplementation),
        WeatherAlertService.fetchJson(pointUrl, fetchImplementation)
      ]);
      const activeAlertStatus = WeatherAlertService.evaluateStatus(alertData && alertData.features, [], now);
      if (activeAlertStatus.isInclement) {
        const currentStatus = WeatherAlertService.withUpdatedAt(activeAlertStatus, now);
        WeatherAlertService.cacheStatus(storage, currentStatus, refreshMinutes, now);
        return currentStatus;
      }

      const forecastUrl = pointData && pointData.properties ? pointData.properties.forecast : null;
      const forecastData = forecastUrl
        ? await WeatherAlertService.fetchJson(forecastUrl, fetchImplementation)
        : null;
      const forecastPeriods = forecastData && forecastData.properties ? forecastData.properties.periods : [];
      const status = WeatherAlertService.withUpdatedAt(WeatherAlertService.evaluateStatus([], forecastPeriods, now), now);
      WeatherAlertService.cacheStatus(storage, status, refreshMinutes, now);
      return status;
    }

    static normalizeRefreshMinutes(value) {
      const refreshMinutes = Number(value);
      return [0, 5, 10].includes(refreshMinutes) ? refreshMinutes : WeatherAlertService.DEFAULT_REFRESH_MINUTES;
    }

    static withUpdatedAt(status, now) {
      return { ...status, updatedAt: now.toISOString() };
    }

    /**
     * Check whether an outdoor pool has published activity now or within the lead-in period.
     * @param {Object} poolData - Active annual pools data
     * @param {Date} now - Instant to evaluate
     * @returns {boolean} Whether the notification can be useful right now
     */
    static isWithinPoolOperatingWindow(poolData, now = new Date()) {
      const window = WeatherAlertService.getPoolOperatingWindow(poolData, now);
      if (!window) return false;

      return window.currentMinutes >= window.notificationStartMinutes
        && window.currentMinutes < window.closeMinutes;
    }

    /**
     * Get the first and last published pool activity times for the current Eastern day.
     * @param {Object} poolData - Active annual pools data
     * @param {Date} now - Instant used to identify the Eastern calendar day
     * @returns {Object|null} Daily operating window in minutes after midnight
     */
    static getPoolOperatingWindow(poolData, now = new Date()) {
      if (!poolData || !Array.isArray(poolData.pools)) return null;

      const context = WeatherAlertService.getEasternDateContext(now);
      const times = [];
      poolData.pools.forEach(pool => {
        const schedules = [...(Array.isArray(pool.schedules) ? pool.schedules : []),
          ...(Array.isArray(pool.scheduleOverrides) ? pool.scheduleOverrides : [])];
        schedules
          .filter(schedule => schedule.startDate <= context.date && schedule.endDate >= context.date)
          .forEach(schedule => {
            (Array.isArray(schedule.hours) ? schedule.hours : [])
              .filter(hours => WeatherAlertService.isActivityScheduledForDay(hours, context.day))
              .forEach(hours => {
                times.push({
                  close: WeatherAlertService.timeStringToMinutes(hours.endTime),
                  open: WeatherAlertService.timeStringToMinutes(hours.startTime)
                });
              });
          });
      });

      if (times.length === 0) return null;
      const openMinutes = Math.min(...times.map(time => time.open));
      const closeMinutes = Math.max(...times.map(time => time.close));

      return {
        closeMinutes,
        currentMinutes: context.minutes,
        notificationStartMinutes: Math.max(0, openMinutes - WeatherAlertService.POOL_OPENING_LEAD_MINUTES),
        openMinutes
      };
    }

    static isActivityScheduledForDay(hours, day) {
      if (!hours || !Array.isArray(hours.weekDays) || !hours.weekDays.includes(day)
        || typeof hours.startTime !== 'string' || typeof hours.endTime !== 'string') {
        return false;
      }

      const activities = (Array.isArray(hours.types) ? hours.types : [hours.types]).filter(Boolean);
      return activities.length === 0 || !activities.every(activity => /closed|maintenance/i.test(activity));
    }

    static getEasternDateContext(now) {
      const parts = new Intl.DateTimeFormat('en-US', {
        day: '2-digit',
        hour: '2-digit',
        hourCycle: 'h23',
        minute: '2-digit',
        month: '2-digit',
        timeZone: WeatherAlertService.EASTERN_TIMEZONE,
        weekday: 'short',
        year: 'numeric'
      }).formatToParts(now).reduce((values, part) => ({ ...values, [part.type]: part.value }), {});

      return {
        date: `${parts.year}-${parts.month}-${parts.day}`,
        day: parts.weekday,
        minutes: Number(parts.hour) * 60 + Number(parts.minute)
      };
    }

    static timeStringToMinutes(timeString) {
      const match = timeString.trim().match(/^(\d{1,2}):(\d{2})(am|pm)$/i);
      if (!match) return NaN;

      const periodOffset = match[3].toLowerCase() === 'pm' ? 12 : 0;
      const hour = Number(match[1]) % 12 + periodOffset;
      return hour * 60 + Number(match[2]);
    }

    static async fetchJson(url, fetchImplementation) {
      try {
        const response = await fetchImplementation(url, { headers: { Accept: 'application/geo+json' } });
        return response.ok ? await response.json() : null;
      } catch (_error) {
        return null;
      }
    }

    static getSessionStorage() {
      try {
        return typeof sessionStorage === 'undefined' ? null : sessionStorage;
      } catch (_error) {
        return null;
      }
    }

    static readCachedStatus(storage, refreshMinutes, now = new Date()) {
      const cached = WeatherAlertService.readCachedStatusEntry(storage, refreshMinutes, now);
      return cached ? cached.status : null;
    }

    static readCachedStatusEntry(storage, refreshMinutes, now = new Date()) {
      if (!storage) return null;
      try {
        const cached = JSON.parse(storage.getItem(WeatherAlertService.CACHE_KEY));
        return cached && cached.refreshMinutes === refreshMinutes && cached.expiresAt > now.getTime() ? cached : null;
      } catch (_error) {
        return null;
      }
    }

    static cacheStatus(storage, status, refreshMinutes, now = new Date()) {
      if (!storage) return;
      try {
        storage.setItem(WeatherAlertService.CACHE_KEY, JSON.stringify({
          expiresAt: now.getTime() + refreshMinutes * 60 * 1000,
          refreshMinutes,
          status
        }));
      } catch (_error) {
        return;
      }
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = WeatherAlertService;
  }

  if (typeof window !== 'undefined') {
    window.WeatherAlertService = WeatherAlertService;
  }
}
