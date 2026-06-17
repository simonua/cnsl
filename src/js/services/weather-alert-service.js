/**
 * Evaluates National Weather Service data for outdoor pool safety notices.
 */
if (typeof globalThis.WeatherAlertService === 'undefined') {
  /** Evaluates, fetches, and caches weather safety status for pool operating hours. */
  class WeatherAlertService {
    static OFFICIAL_STATUS_GUIDANCE = 'Check live pool status before leaving.';
    static BASE_URL = globalThis.WEATHER_API_BASE_URL;
    static COLUMBIA_MD_POINT = globalThis.WEATHER_LOCATION_POINT;
    static CACHE_KEY = globalThis.WEATHER_ALERT_STATUS_STORAGE_KEY;
    static LAST_SUCCESSFUL_CHECK_KEY = globalThis.WEATHER_ALERT_LAST_SUCCESSFUL_CHECK_STORAGE_KEY;
    static DEFAULT_REFRESH_MINUTES = globalThis.WEATHER_ALERT_DEFAULT_REFRESH_MINUTES;
    static POOL_OPENING_LEAD_MINUTES = globalThis.WEATHER_ALERT_OPENING_LEAD_MINUTES;
    static EASTERN_TIMEZONE = globalThis.APP_TIMEZONE;
    static latestStatus = null;
    static ALERT_PATTERN = /\b(?:thunderstorms?|t-?storms?|lightning|tornado(?:es)?|flash flood|flood warning|hurricane|tropical storm|extreme wind|high wind warning|hail)\b/i;

    /**
    * Determine whether current NWS alerts or today's forecast require a pool safety reminder.
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
        return WeatherAlertService.ALERT_PATTERN.test(alertText)
          && WeatherAlertService.isRelevantToday(
            properties.onset || properties.effective || properties.sent,
            properties.ends || properties.expires,
            now,
            false
          );
      });

      if (activeAlert) {
        const eventName = activeAlert.properties.event || 'hazardous weather';
        return {
          alertLabel: eventName,
          guidance: WeatherAlertService.OFFICIAL_STATUS_GUIDANCE,
          isInclement: true,
          source: WeatherAlertSource.ALERT,
          message: `Active National Weather Service alert: ${eventName}.`
        };
      }

      const unsafeForecast = periods.find(period => {
        if (!period) return false;
        const forecastText = `${period.shortForecast || ''} ${period.detailedForecast || ''}`;
        return WeatherAlertService.isRelevantToday(period.startTime, period.endTime || period.startTime, now)
          && WeatherHazard.findAll(forecastText).length > 0;
      });

      if (unsafeForecast) {
        const forecastPeriodName = unsafeForecast.name?.replace(
          /(?<=\s)(Morning|Afternoon|Evening|Night)\b/g,
          periodPart => periodPart.toLowerCase()
        );
        const forecastLabel = forecastPeriodName ? `${forecastPeriodName}'s forecast` : 'The near-term forecast';
        const forecastText = `${unsafeForecast.shortForecast || ''} ${unsafeForecast.detailedForecast || ''}`;
        const hazardLabel = WeatherAlertService.getForecastHazardLabel(forecastText);
        return {
          guidance: WeatherAlertService.OFFICIAL_STATUS_GUIDANCE,
          hazardLabel,
          hazards: WeatherHazard.findAll(forecastText),
          isInclement: true,
          source: WeatherAlertSource.FORECAST,
          message: `${forecastLabel} includes ${hazardLabel}.`
        };
      }

      return { isInclement: false };
    }

    /**
     * Describe the recognized hazards present in forecast text.
     * @param {string} forecastText - Combined short and detailed forecast text
     * @returns {string} Human-readable hazard list
     * @private
     */
    static getForecastHazardLabel(forecastText) {
      const hazards = WeatherHazard.findAll(forecastText);

      if (hazards.length === 0) return '';
      if (hazards.length === 1) return hazards[0];
      return `${hazards.slice(0, -1).join(', ')} and ${hazards.at(-1)}`;
    }

    /**
     * Check whether a weather interval is relevant to the current Eastern date.
     * @param {*} startTime - Candidate interval start
     * @param {*} endTime - Candidate interval end
     * @param {Date} now - Evaluation instant
     * @param {boolean} requireValidStart - Whether an invalid start rejects the interval
     * @returns {boolean} Whether the interval remains relevant
     */
    static isRelevantToday(startTime, endTime, now = new Date(), requireValidStart = true) {
      const startsAt = new Date(startTime);
      const endsAt = new Date(endTime);
      const hasValidStart = !Number.isNaN(startsAt.getTime());
      const hasValidEnd = !Number.isNaN(endsAt.getTime());
      if (requireValidStart && !hasValidStart) return false;

      const currentEasternDate = WeatherAlertService.getEasternDateContext(now).date;
      return (!hasValidStart || WeatherAlertService.getEasternDateContext(startsAt).date <= currentEasternDate)
        && (!hasValidEnd || endsAt >= now);
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
      const latestCheckedStorage = Object.prototype.hasOwnProperty.call(options, 'latestCheckedStorage')
        ? options.latestCheckedStorage
        : WeatherAlertService.getLocalStorage();
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
      if (cachedStatus) {
        WeatherAlertService.rememberLatestCheckedStatus(cachedStatus, latestCheckedStorage);
        return cachedStatus;
      }

      const alertUrl = globalThis.WEATHER_ACTIVE_ALERTS_URL;
      const pointUrl = globalThis.WEATHER_POINT_URL;
      const [alertData, pointData] = await Promise.all([
        WeatherAlertService.fetchJson(alertUrl, fetchImplementation),
        WeatherAlertService.fetchJson(pointUrl, fetchImplementation)
      ]);
      const activeAlertStatus = WeatherAlertService.evaluateStatus(alertData && alertData.features, [], now);
      if (activeAlertStatus.isInclement) {
        const currentStatus = WeatherAlertService.withUpdatedAt(activeAlertStatus, now);
        WeatherAlertService.cacheStatus(storage, currentStatus, refreshMinutes, now, latestCheckedStorage);
        return currentStatus;
      }

      const forecastUrl = pointData && pointData.properties ? pointData.properties.forecast : null;
      if (!alertData || !Array.isArray(alertData.features) || !forecastUrl) {
        return { isInclement: false, reason: 'weather-service-unavailable' };
      }

      const forecastData = await WeatherAlertService.fetchJson(forecastUrl, fetchImplementation);
      const forecastPeriods = forecastData && forecastData.properties ? forecastData.properties.periods : null;
      if (!Array.isArray(forecastPeriods)) {
        return { isInclement: false, reason: 'weather-service-unavailable' };
      }

      const status = WeatherAlertService.withUpdatedAt(WeatherAlertService.evaluateStatus([], forecastPeriods, now), now);
      WeatherAlertService.cacheStatus(storage, status, refreshMinutes, now, latestCheckedStorage);
      return status;
    }

    /**
     * Store the latest weather status in memory.
     * @param {Object|null} status - Latest weather status
     * @returns {void}
     */
    static setLatestStatus(status) {
      WeatherAlertService.latestStatus = status;
    }

    /** @returns {Object|null} Latest in-memory weather status */
    static getLatestStatus() {
      return WeatherAlertService.latestStatus;
    }

    /**
     * Normalize a requested weather refresh interval.
     * @param {*} value - Candidate refresh interval
     * @returns {number} Supported interval in minutes
     */
    static normalizeRefreshMinutes(value) {
      const refreshMinutes = Number(value);
      return globalThis.WEATHER_ALERT_REFRESH_MINUTES_OPTIONS.includes(refreshMinutes) ? refreshMinutes : WeatherAlertService.DEFAULT_REFRESH_MINUTES;
    }

    /**
     * Attach an update timestamp to a weather status.
     * @param {Object} status - Weather status
     * @param {Date} now - Update instant
     * @returns {Object} Status with timestamp
     */
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
      const context = WeatherAlertService.getEasternDateContext(now);
      const dailyWindow = poolData && poolData.dailyOperatingWindows && poolData.dailyOperatingWindows[context.date];
      if (Array.isArray(dailyWindow) && dailyWindow.length === 2
        && dailyWindow.every(minutes => Number.isFinite(minutes))) {
        const [openMinutes, closeMinutes] = dailyWindow;
        return {
          closeMinutes,
          currentMinutes: context.minutes,
          notificationStartMinutes: Math.max(0, openMinutes - WeatherAlertService.POOL_OPENING_LEAD_MINUTES),
          openMinutes
        };
      }
      return WeatherAlertService.getPoolOperatingWindowForContext(poolData, context);
    }

    /**
     * Derive a daily operating window from published pool schedules.
     * @param {Object} poolData - Active annual pools data
     * @param {Object} context - Eastern date, weekday, and minute context
     * @returns {Object|null} Daily operating window
     * @private
     */
    static getPoolOperatingWindowForContext(poolData, context) {
      if (!poolData || !Array.isArray(poolData.pools)) return null;

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

    /**
     * Precompute daily operating windows for a full pool season.
     * @param {Object} poolData - Active annual pools data
     * @returns {Object} Daily operating windows keyed by date
     * @throws {Error} When the season date range is invalid
     */
    static createOperatingWindowSchedule(poolData) {
      const startDate = poolData && poolData.seasonStartDate;
      const endDate = poolData && poolData.seasonEndDate;
      const date = new Date(`${startDate}T00:00:00Z`);
      const finalDate = new Date(`${endDate}T00:00:00Z`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate || '') || !/^\d{4}-\d{2}-\d{2}$/.test(endDate || '')
        || Number.isNaN(date.getTime()) || Number.isNaN(finalDate.getTime())
        || date.toISOString().slice(0, 10) !== startDate || finalDate.toISOString().slice(0, 10) !== endDate
        || startDate > endDate) {
        throw new Error('Pool operating-window schedule requires a valid season date range.');
      }

      const dailyOperatingWindows = {};
      while (date <= finalDate) {
        const dateString = date.toISOString().slice(0, 10);
        const day = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'short' }).format(date);
        const window = WeatherAlertService.getPoolOperatingWindowForContext(poolData, { date: dateString, day, minutes: 0 });
        if (window) dailyOperatingWindows[dateString] = [window.openMinutes, window.closeMinutes];
        date.setUTCDate(date.getUTCDate() + 1);
      }
      return { dailyOperatingWindows };
    }

    /**
     * Check whether an hours record contains pool activity on a weekday.
     * @param {Object} hours - Published pool hours record
     * @param {string} day - Short weekday name
     * @returns {boolean} Whether activity is scheduled
     * @private
     */
    static isActivityScheduledForDay(hours, day) {
      if (!hours || !Array.isArray(hours.weekDays) || !hours.weekDays.includes(day)
        || typeof hours.startTime !== 'string' || typeof hours.endTime !== 'string') {
        return false;
      }

      const activities = (Array.isArray(hours.types) ? hours.types : [hours.types]).filter(Boolean);
      return activities.length === 0 || !activities.every(activity => /closed|maintenance/i.test(activity));
    }

    /**
     * Convert an instant to Eastern calendar and minute context.
     * @param {Date} now - Instant to convert
     * @returns {Object} Eastern date, weekday, and minutes after midnight
     * @private
     */
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

    /**
     * Convert a schedule time to minutes after midnight.
     * @param {string} timeString - Time in h:mmam or h:mmpm format
     * @returns {number} Minutes after midnight, or NaN when invalid
     * @private
     */
    static timeStringToMinutes(timeString) {
      const match = timeString.trim().match(/^(\d{1,2}):(\d{2})(am|pm)$/i);
      if (!match) return NaN;

      const periodOffset = match[3].toLowerCase() === 'pm' ? 12 : 0;
      const hour = Number(match[1]) % 12 + periodOffset;
      return hour * 60 + Number(match[2]);
    }

    /**
     * Fetch and parse a JSON resource without propagating request failures.
     * @param {string} url - Resource URL
     * @param {Function} fetchImplementation - Fetch-compatible function
     * @returns {Promise<Object|null>} Parsed data, or null when unavailable
     * @private
     */
    static async fetchJson(url, fetchImplementation) {
      try {
        const response = await fetchImplementation(url, { headers: { Accept: 'application/geo+json' } });
        return response.ok ? await response.json() : null;
      } catch (_error) {
        return null;
      }
    }

    /**
     * Get session storage when browser access is available.
     * @returns {Storage|null} Session storage or null
     * @private
     */
    static getSessionStorage() {
      let storage = null;
      try {
        storage = typeof sessionStorage === 'undefined' ? null : sessionStorage;
      /* node:coverage ignore next */
      } catch (_error) {} // eslint-disable-line no-empty
      return storage;
    }

    /**
     * Get local storage when browser access is available.
     * @returns {Storage|null} Local storage or null
     * @private
     */
    static getLocalStorage() {
      return globalThis.WeatherFreshnessService.getStorage();
    }

    /**
     * Read a fresh cached weather status.
     * @param {Storage|null} storage - Browser storage or a compatible substitute
     * @param {number} refreshMinutes - Expected refresh interval
     * @param {Date} now - Cache evaluation time
     * @returns {Object|null} Cached status
     */
    static readCachedStatus(storage, refreshMinutes, now = new Date()) {
      const cached = WeatherAlertService.readCachedStatusEntry(storage, refreshMinutes, now);
      return cached ? cached.status : null;
    }

    /**
     * Read the latest successful weather-check timestamp.
     * @param {Storage|null} storage - Browser storage or a compatible substitute
     * @returns {Object|null} Latest timestamp record
     */
    static readLatestCheckedStatus(storage = WeatherAlertService.getLocalStorage()) {
      return globalThis.WeatherFreshnessService.read(storage);
    }

    /**
     * Persist a newer successful weather-check timestamp.
     * @param {Object} status - Weather status with update timestamp
     * @param {Storage|null} storage - Browser storage or a compatible substitute
     * @returns {void}
     * @private
     */
    static rememberLatestCheckedStatus(status, storage = WeatherAlertService.getLocalStorage()) {
      globalThis.WeatherFreshnessService.remember(status, storage);
    }

    /**
     * Read and validate a complete weather cache entry.
     * @param {Storage|null} storage - Browser storage or a compatible substitute
     * @param {number} refreshMinutes - Expected refresh interval
     * @param {Date} now - Cache evaluation time
     * @returns {Object|null} Fresh cache entry
     * @private
     */
    static readCachedStatusEntry(storage, refreshMinutes, now = new Date()) {
      if (!storage) return null;
      try {
        const cached = JSON.parse(storage.getItem(WeatherAlertService.CACHE_KEY));
        return cached && cached.refreshMinutes === refreshMinutes && cached.expiresAt > now.getTime() ? cached : null;
      } catch (_error) {
        return null;
      }
    }

    /**
     * Persist a weather status and its latest successful check time.
     * @param {Storage|null} storage - Session storage or a compatible substitute
     * @param {Object} status - Weather status to cache
     * @param {number} refreshMinutes - Cache lifetime in minutes
     * @param {Date} now - Cache write time
     * @param {Storage|null} latestCheckedStorage - Storage for latest-check metadata
     * @returns {void}
     * @private
     */
    static cacheStatus(storage, status, refreshMinutes, now = new Date(), latestCheckedStorage = WeatherAlertService.getLocalStorage()) {
      WeatherAlertService.rememberLatestCheckedStatus(status, latestCheckedStorage);
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

  globalThis.WeatherAlertService = WeatherAlertService;
}
