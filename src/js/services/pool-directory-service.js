/**
 * Reusable presentation calculations for the pool directory route.
 */
if (typeof globalThis.PoolDirectoryService === 'undefined') {
  /** Calculates pool directory filtering, distance, and feature presentation state. */
  class PoolDirectoryService {
    static AVAILABILITY_DAY_FILTERS = Object.freeze([
      Object.freeze({ value: 'open-today', dayOffset: 0 }),
      Object.freeze({ value: 'open-tomorrow', dayOffset: 1 }),
      Object.freeze({ value: 'open-day-2', dayOffset: 2 }),
      Object.freeze({ value: 'open-day-3', dayOffset: 3 }),
      Object.freeze({ value: 'open-day-4', dayOffset: 4 }),
      Object.freeze({ value: 'open-day-5', dayOffset: 5 }),
      Object.freeze({ value: 'open-day-6', dayOffset: 6 })
    ]);
    static AVAILABILITY_FILTERS = Object.freeze([
      'all', 'open-now', 'opens-soon', 'open-next-two-hours',
      ...PoolDirectoryService.AVAILABILITY_DAY_FILTERS.map(filter => filter.value)
    ]);
    static NEXT_TWO_HOURS_MINUTES = 120;
    static OPENING_SOON_MINUTES = 60;

    /**
     * Check whether a value is a supported availability filter.
     * @param {*} value - Candidate filter
     * @returns {boolean} Whether the filter is supported
     */
    static isAvailabilityFilter(value) {
      return PoolDirectoryService.AVAILABILITY_FILTERS.includes(value);
    }

    /**
     * Resolve a future calendar-day filter to its day offset.
     * @param {string} filter - Supported directory availability filter
     * @returns {number|null} Positive day offset, or null for live and current-day filters
     */
    static getFutureAvailabilityDayOffset(filter) {
      const dayFilter = PoolDirectoryService.AVAILABILITY_DAY_FILTERS.find(candidate => candidate.value === filter);
      return dayFilter && dayFilter.dayOffset > 0 ? dayFilter.dayOffset : null;
    }

    /**
     * Build the rolling weekday choices shown after today and tomorrow.
     * @param {string} currentDate - Current Eastern date in YYYY-MM-DD format
     * @returns {Array<{ value: string, dayOffset: number, dayName: string, label: string }>} Future-day options
     */
    static getUpcomingDayAvailabilityOptions(currentDate) {
      const dateParts = typeof currentDate === 'string' && currentDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!dateParts) return [];

      const easternDate = new Date(Date.UTC(Number(dateParts[1]), Number(dateParts[2]) - 1, Number(dateParts[3])));
      if (easternDate.toISOString().slice(0, 10) !== currentDate) return [];

      return PoolDirectoryService.AVAILABILITY_DAY_FILTERS
        .filter(filter => filter.dayOffset > 1)
        .map(filter => {
          const optionDate = new Date(easternDate);
          optionDate.setUTCDate(easternDate.getUTCDate() + filter.dayOffset);
          const dayName = optionDate.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
          return { ...filter, dayName, label: dayName };
        });
    }

    /**
     * Describe a supported filter for live-region feedback.
     * @param {string} filter - Supported directory availability filter
     * @param {string} currentDate - Current Eastern date in YYYY-MM-DD format
     * @returns {string} Visitor-facing description of matching pools
     */
    static getAvailabilityFilterDescription(filter, currentDate) {
      const descriptions = {
        all: 'all pools',
        'open-now': 'pools open now',
        'opens-soon': 'pools opening within the hour',
        'open-today': 'pools with general-use hours today',
        'open-tomorrow': 'pools with general-use hours tomorrow',
        'open-next-two-hours': 'pools open for the next 2 hours'
      };
      if (descriptions[filter]) return descriptions[filter];

      const option = PoolDirectoryService.getUpcomingDayAvailabilityOptions(currentDate)
        .find(candidate => candidate.value === filter);
      return option ? `pools with general-use hours ${option.dayName}` : descriptions.all;
    }

    /**
     * Format effective future-day general-use hours for a collapsed pool card.
     * @param {Object|null} schedule - General-use schedule from the pool model
     * @param {Object} timeUtils - Time parsing dependency
     * @returns {{ text: string, label: string }} Visible and accessible summaries
     */
    static formatGeneralUseScheduleSummary(schedule, timeUtils) {
      if (!schedule || !Array.isArray(schedule.timeSlots) || schedule.timeSlots.length === 0 || !timeUtils) {
        return { text: '', label: '' };
      }

      const ranges = schedule.timeSlots.map(slot => {
        try {
          const startMinutes = timeUtils.timeStringToMinutes(slot.startTime);
          const endMinutes = timeUtils.timeStringToMinutes(slot.endTime);
          return endMinutes > startMinutes ? { startMinutes, endMinutes } : null;
        } catch (_error) {
          return null;
        }
      }).filter(Boolean).sort((first, second) => first.startMinutes - second.startMinutes)
        .reduce((merged, range) => {
          const previous = merged[merged.length - 1];
          if (previous && range.startMinutes <= previous.endMinutes) {
            previous.endMinutes = Math.max(previous.endMinutes, range.endMinutes);
          } else {
            merged.push({ ...range });
          }
          return merged;
        }, []);
      if (ranges.length === 0) return { text: '', label: '' };
      const compactRanges = ranges.map(range => (
        `${PoolDirectoryService.formatCompactClockTime(range.startMinutes)} - ${PoolDirectoryService.formatCompactClockTime(range.endMinutes)}`
      ));
      const accessibleRanges = ranges.map(range => (
        `${PoolDirectoryService.formatAccessibleClockTime(range.startMinutes)} to ${PoolDirectoryService.formatAccessibleClockTime(range.endMinutes)}`
      ));
      return {
        text: `${schedule.shortDay} ${compactRanges.join('; ')}`,
        label: `${schedule.dayName} general-use hours: ${accessibleRanges.join('; ')}`
      };
    }

    /**
     * Format minutes after midnight as compact pool-card time.
     * @param {number} minutes - Minutes after midnight
     * @returns {string} Compact lowercase time
     */
    static formatCompactClockTime(minutes) {
      const hour = Math.floor(minutes / 60);
      const minute = minutes % 60;
      const displayHour = hour % 12 || 12;
      return `${displayHour}${minute > 0 ? `:${String(minute).padStart(2, '0')}` : ''}${hour < 12 ? 'am' : 'pm'}`;
    }

    /**
     * Format minutes after midnight for an accessible schedule label.
     * @param {number} minutes - Minutes after midnight
     * @returns {string} Expanded clock time
     */
    static formatAccessibleClockTime(minutes) {
      const hour = Math.floor(minutes / 60);
      const minute = minutes % 60;
      const displayHour = hour % 12 || 12;
      return `${displayHour}:${String(minute).padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'}`;
    }

    /**
     * Check whether a pool's semantic public-use state satisfies one directory filter.
     * @param {Pool|null} poolModel - Pool model with current public-use schedule state
     * @param {string} filter - Supported directory availability filter
     * @returns {boolean} Whether the model matches the requested availability condition
     */
    static matchesAvailabilityFilter(poolModel, filter) {
      if (!poolModel) return false;
      if (filter === 'opens-soon') return poolModel.opensWithinNextMinutes(PoolDirectoryService.OPENING_SOON_MINUTES);
      if (filter === 'open-today') return poolModel.hasPublicUseToday();
      if (filter === 'open-tomorrow') return poolModel.hasPublicUseTomorrow();
      const futureDayFilter = PoolDirectoryService.AVAILABILITY_DAY_FILTERS.find(candidate => candidate.value === filter);
      if (futureDayFilter) return poolModel.hasPublicUseOnDayOffset(futureDayFilter.dayOffset);
      if (filter === 'open-next-two-hours') {
        return poolModel.isOpenForNextMinutes(PoolDirectoryService.NEXT_TWO_HOURS_MINUTES);
      }
      return filter === 'all' || (filter === 'open-now' && poolModel.isOpenForNextMinutes());
    }

    /**
     * Apply a live availability requirement to pool models.
     * @param {Pool[]} pools - Pool models already matched by other directory filters
     * @param {string} filter - Supported directory availability filter
     * @returns {Pool[]} Models matching the requested availability condition
     */
    static filterByAvailability(pools, filter) {
      if (filter === 'all') return pools;

      return pools.filter(pool => PoolDirectoryService.matchesAvailabilityFilter(pool, filter));
    }

    /**
     * Build a stable live-status signature for pool models and active availability filtering.
     * @param {Pool[]} pools - Available pool models
     * @param {string} filter - Active directory availability filter
     * @returns {string} State signature for detecting schedule transitions
     */
    static getLiveStatusSignature(pools, filter) {
      if (!Array.isArray(pools)) return '';

      const includesAvailability = filter !== 'all';
      return pools.map(pool => {
        if (!pool || typeof pool.getCurrentStatus !== 'function') return `${pool?.id || pool?.name}:unavailable`;
        const status = pool.getCurrentStatus();
        const availability = includesAvailability ? PoolDirectoryService.matchesAvailabilityFilter(pool, filter) : '';
        return `${pool.id || pool.name}:${status.kind}:${String(availability)}`;
      }).join('|');
    }

    /**
     * Calculate great-circle distance between two coordinates.
     * @param {Object} firstCoordinates - First latitude and longitude
     * @param {Object} secondCoordinates - Second latitude and longitude
     * @returns {number} Distance in miles
     */
    static calculateDistance(firstCoordinates, secondCoordinates) {
      const earthRadiusMiles = 3958.8;
      const firstLatitude = firstCoordinates.lat * Math.PI / 180;
      const secondLatitude = secondCoordinates.lat * Math.PI / 180;
      const latitudeDelta = (secondCoordinates.lat - firstCoordinates.lat) * Math.PI / 180;
      const longitudeDelta = (secondCoordinates.lng - firstCoordinates.lng) * Math.PI / 180;
      const arc = Math.sin(latitudeDelta / 2) * Math.sin(latitudeDelta / 2)
        + Math.cos(firstLatitude) * Math.cos(secondLatitude)
        * Math.sin(longitudeDelta / 2) * Math.sin(longitudeDelta / 2);

      return earthRadiusMiles * (2 * Math.atan2(Math.sqrt(arc), Math.sqrt(1 - arc)));
    }

    /**
     * Format a normalized feature for display.
     * @param {string} feature - Normalized feature label
     * @returns {string} Display label
     */
    static formatFeatureLabel(feature) {
      const labels = {
        'ada compliant': 'ADA compliant',
        shallow: 'Shallow area',
        splash: 'Splash pad',
        wading: 'Wading pool',
        'wading pool slide': "Kids' slide (wading pool)",
        wifi: 'Wi-Fi'
      };
      if (labels[feature]) return labels[feature];
      return feature.charAt(0).toUpperCase() + feature.slice(1);
    }

    /**
     * Sort features within their visitor-oriented groups.
     * @param {Array} features - Feature labels
     * @param {Function} groupFeatures - Feature grouping callback
     * @returns {Array} Ordered feature labels
     */
    static sortFeaturesForDisplay(features, groupFeatures) {
      return groupFeatures(features).flatMap(group => [...group.features].sort((first, second) => (
        PoolDirectoryService.formatFeatureLabel(first).localeCompare(PoolDirectoryService.formatFeatureLabel(second))
      )));
    }

  }

  globalThis.PoolDirectoryService = PoolDirectoryService;
}
