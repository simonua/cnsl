/**
 * Time utility functions for Eastern Time zone handling
 * Enhanced with comprehensive error handling and validation
 */

if (typeof module !== 'undefined' && module.exports && typeof globalThis.APP_TIMEZONE === 'undefined') {
  require('../config/app-config.js');
}

// Prevent multiple declarations
if (typeof window === 'undefined' || !window.TimeUtils) {
  class TimeUtils {
  // ------------------------------
  //    CONSTANTS
  // ------------------------------

  static TIMEZONE = globalThis.APP_TIMEZONE;
  static MINUTES_PER_DAY = 1440;
  static MINUTES_PER_HOUR = 60;
  static DEFAULT_TIME = '12:00am';
  static TIME_REGEX = /^(\d{1,2}):?(\d{0,2})(AM|PM)$/i;
  static DATE_ONLY_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;

  // Cache for timezone offset calculations to improve performance
  static _timezoneOffsetCache = new Map();
  static _lastCacheCleanup = 0;
  static CACHE_CLEANUP_INTERVAL = 300000; // 5 minutes

  // ------------------------------
  //    PRIVATE HELPER METHODS
  // ------------------------------

  /**
   * Logs debug information with consistent formatting
   * @private
   * @param {string} message - Log message
   * @param {string} level - Log level (info, warn, error)
   * @param {Object} data - Additional data to log
   */
  static _log(message, level = 'info', data = null) {
    const TimeIcons = typeof module !== 'undefined' && module.exports ? require('./icon-catalog.js') : IconCatalog;
    const prefix = level === 'error' ? TimeIcons.getTextGlyph('error') : level === 'warn' ? TimeIcons.getTextGlyph('warning') : TimeIcons.getTextGlyph('time');

    if (data) {
      console[level](`${prefix} [TimeUtils] ${message}`, data);
    } else {
      console[level](`${prefix} [TimeUtils] ${message}`);
    }
  }

  /**
   * Validates input parameters and throws descriptive errors
   * @private
   * @param {*} value - Value to validate
   * @param {string} paramName - Parameter name for error messages
   * @param {string} expectedType - Expected type
   * @param {boolean} allowNull - Whether null values are allowed
   * @throws {Error} If validation fails
   */
  static _validateInput(value, paramName, expectedType, allowNull = false) {
    if (value === null || value === undefined) {
      if (allowNull) return;
      throw new Error(`TimeUtils: ${paramName} is required but was ${value}`);
    }

    const actualType = typeof value;
    if (actualType !== expectedType) {
      throw new Error(`TimeUtils: ${paramName} must be a ${expectedType}, got ${actualType}`);
    }
  }

  /**
   * Validates time string format
   * @private
   * @param {string} timeStr - Time string to validate
   * @throws {Error} If time string is invalid
   */
  static _validateTimeString(timeStr) {
    this._validateInput(timeStr, 'timeStr', 'string');

    if (!this.TIME_REGEX.test(timeStr.trim())) {
      throw new Error(`TimeUtils: Invalid time format "${timeStr}". Expected format: "H:MMAM/PM" (e.g., "9:30AM", "11:00PM")`);
    }
  }

  /**
   * Cleans up timezone offset cache periodically
   * @private
   */
  static _cleanupCache() {
    const now = Date.now();
    if (now - this._lastCacheCleanup > this.CACHE_CLEANUP_INTERVAL) {
      this._timezoneOffsetCache.clear();
      this._lastCacheCleanup = now;
      this._log('Timezone offset cache cleared');
    }
  }

  /**
   * Gets timezone offset with caching for performance
   * @private
   * @param {Date} date - Date to get offset for
   * @returns {number} Timezone offset in milliseconds
   */
  static _getTimezoneOffset(date) {
    this._cleanupCache();

    const dateKey = date.toDateString();
    if (this._timezoneOffsetCache.has(dateKey)) {
      return this._timezoneOffsetCache.get(dateKey);
    }

    try {
      const utcTime = date.getTime() + (date.getTimezoneOffset() * 60000);
      const easternDate = new Date(utcTime + this._getEasternOffsetMs(date));
      const offset = easternDate.getTime() - date.getTime();

      this._timezoneOffsetCache.set(dateKey, offset);
      return offset;
    } catch (error) {
      this._log(`Failed to calculate timezone offset: ${error.message}`, 'error');
      return 0; // Fallback to no offset
    }
  }

  /**
   * Gets Eastern timezone offset in milliseconds
   * @private
   * @param {Date} date - Date to check
   * @returns {number} Offset in milliseconds
   */
  static _getEasternOffsetMs(date) {
    // Eastern Time is UTC-5 (EST) or UTC-4 (EDT)
    // DST typically starts second Sunday in March, ends first Sunday in November
    const month = date.getMonth();
    const day = date.getDate();

    // Rough DST calculation (this could be more precise but covers most cases)
    const isDST = (month > 2 && month < 10) ||
                  (month === 2 && day >= 8) ||
                  (month === 10 && day < 7);

    return isDST ? -4 * 3600000 : -5 * 3600000; // -4 or -5 hours in milliseconds
  }

  // ------------------------------
  //    PUBLIC METHODS
  // ------------------------------

  /**
   * Gets the current Eastern Time (EDT/EST) as a Date object
   * Enhanced with error handling and fallback mechanisms
   * @returns {Date} Current time in Eastern timezone
   * @throws {Error} If timezone conversion fails critically
   */
  static getEasternTime() {
    try {
      const now = new Date();

      // Primary method: Use Intl API for accurate timezone conversion
      try {
        // Use a more compatible approach for timezone conversion
        const formatter = new Intl.DateTimeFormat('en-US', {
          timeZone: this.TIMEZONE,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        });

        const parts = formatter.formatToParts(now);
        const dateObj = {};
        parts.forEach(part => {
          dateObj[part.type] = part.value;
        });

        // Construct date string in ISO-like format
        const easternTimeString = `${dateObj.year}-${dateObj.month}-${dateObj.day}T${dateObj.hour}:${dateObj.minute}:${dateObj.second}`;
        const easternTime = new Date(easternTimeString);

        // Validate the result
        if (isNaN(easternTime.getTime())) {
          throw new Error('Invalid date from timezone conversion');
        }

        return easternTime;
      } catch (intlError) {
        this._log(`Intl API timezone conversion failed: ${intlError.message}`, 'warn');

        // Fallback method: Manual offset calculation
        const offset = this._getTimezoneOffset(now);
        const easternTime = new Date(now.getTime() + offset);

        if (isNaN(easternTime.getTime())) {
          throw new Error('Manual timezone conversion also failed', { cause: intlError });
        }

        this._log('Using fallback timezone conversion method', 'warn');
        return easternTime;
      }
    } catch (error) {
      this._log(`Critical timezone conversion failure: ${error.message}`, 'error');
      // Last resort: return current time with warning
      this._log('Returning local time as fallback', 'error');
      return new Date();
    }
  }

  /**
   * Converts time string (e.g., "6:00AM", "10:30PM") to minutes since midnight
   * Enhanced with comprehensive validation and error handling
   * @param {string} timeStr - Time string in format "H:MMAM/PM"
   * @returns {number} Minutes since midnight (0-1439)
   * @throws {Error} If timeStr is invalid format
   */
  static timeStringToMinutes(timeStr) {
    try {
      this._validateTimeString(timeStr);

      const normalizedTime = timeStr.trim().toUpperCase();
      const match = normalizedTime.match(this.TIME_REGEX);

      if (!match) {
        throw new Error(`Invalid time format: "${timeStr}"`);
      }

      const hours = parseInt(match[1], 10);
      const minutes = parseInt(match[2] || '0', 10);
      const period = match[3];

      // Validate hour range
      if (hours < 1 || hours > 12) {
        throw new Error(`Invalid hour value: ${hours}. Must be between 1-12`);
      }

      // Validate minute range
      if (minutes < 0 || minutes > 59) {
        throw new Error(`Invalid minute value: ${minutes}. Must be between 0-59`);
      }

      // Convert to 24-hour format
      let adjustedHours = hours;
      if (period === 'PM' && hours !== 12) {
        adjustedHours += 12;
      } else if (period === 'AM' && hours === 12) {
        adjustedHours = 0;
      }

      const result = adjustedHours * this.MINUTES_PER_HOUR + minutes;

      // Validate result is within valid range
      if (result < 0 || result >= this.MINUTES_PER_DAY) {
        throw new Error(`Calculated minutes ${result} is outside valid range (0-${this.MINUTES_PER_DAY - 1})`);
      }

      return result;
    } catch (error) {
      this._log(`Time string conversion failed for "${timeStr}": ${error.message}`, 'error');
      throw error; // Re-throw to let caller handle
    }
  }

  /**
   * Converts minutes since midnight to time string format (e.g., "6:00am", "10:30pm")
   * Enhanced with validation and error handling
   * @param {number} minutes - Minutes since midnight (0-1439)
   * @returns {string} Time string in format "H:MMam/pm"
   * @throws {Error} If minutes is invalid
   */
  static minutesToTimeString(minutes) {
    try {
      this._validateInput(minutes, 'minutes', 'number');

      // Normalize negative values and values >= 1440 by wrapping
      let normalizedMinutes = minutes;
      if (minutes < 0) {
        normalizedMinutes = this.MINUTES_PER_DAY + (minutes % this.MINUTES_PER_DAY);
        this._log(`Normalized negative minutes ${minutes} to ${normalizedMinutes}`, 'warn');
      } else if (minutes >= this.MINUTES_PER_DAY) {
        normalizedMinutes = minutes % this.MINUTES_PER_DAY;
        this._log(`Normalized overflow minutes ${minutes} to ${normalizedMinutes}`, 'warn');
      }

      const hours = Math.floor(normalizedMinutes / this.MINUTES_PER_HOUR);
      const mins = normalizedMinutes % this.MINUTES_PER_HOUR;

      let displayHours = hours;
      let period = 'am';

      if (hours === 0) {
        displayHours = 12;
        period = 'am';
      } else if (hours === 12) {
        displayHours = 12;
        period = 'pm';
      } else if (hours > 12) {
        displayHours = hours - 12;
        period = 'pm';
      }

      const minutePart = mins.toString().padStart(2, '0');
      const result = `${displayHours}:${minutePart}${period}`;

      return result;
    } catch (error) {
      this._log(`Minutes to time string conversion failed for ${minutes}: ${error.message}`, 'error');
      return this.DEFAULT_TIME; // Safe fallback
    }
  }

  /**
   * Formats activity types for display with validation
   * @param {string|Array|null} types - Single type string, array of types, or null
   * @returns {string} Formatted types string
   */
  static formatActivityTypes(types) {
    try {
      if (types === null || types === undefined) {
        return '';
      }

      if (typeof types === 'string') {
        return types.trim();
      }

      if (Array.isArray(types)) {
        return types
          .filter(type => type && typeof type === 'string') // Filter out invalid entries
          .map(type => type.trim())
          .filter(type => type.length > 0) // Remove empty strings
          .join(', ');
      }

      // Handle other types by converting to string
      this._log(`Unexpected activity types format: ${typeof types}`, 'warn', types);
      return String(types);
    } catch (error) {
      this._log(`Activity types formatting failed: ${error.message}`, 'error', types);
      return '';
    }
  }

  /**
   * Gets current Eastern Time components with enhanced error handling
   * @returns {Object} Object with date, day, time info, and error status
   */
  static getCurrentEasternTimeInfo() {
    try {
      const easternTime = this.getEasternTime();
      if (isNaN(easternTime.getTime())) {
        throw new Error('Invalid Eastern date');
      }

      // Get timezone name with fallback
      let timezone = 'ET'; // Default fallback
      try {
        const timezoneName = easternTime.toLocaleDateString('en-US', {
          timeZoneName: 'short',
          timeZone: this.TIMEZONE
        });
        const extractedTimezone = timezoneName.split(', ')[1];
        if (extractedTimezone) {
          timezone = extractedTimezone;
        }
      } catch (tzError) {
        this._log(`Timezone name extraction failed: ${tzError.message}`, 'warn');
      }

      const result = {
        date: `${easternTime.getFullYear()}-${String(easternTime.getMonth() + 1).padStart(2, '0')}-${String(easternTime.getDate()).padStart(2, '0')}`, // YYYY-MM-DD in Eastern wall-clock time
        day: easternTime.toLocaleDateString('en-US', {
          weekday: 'short'
        }),
        minutes: easternTime.getHours() * this.MINUTES_PER_HOUR + easternTime.getMinutes(),
        timezone: timezone,
        timestamp: easternTime.getTime(),
        isValid: true
      };

      // Validate the result
      if (result.minutes < 0 || result.minutes >= this.MINUTES_PER_DAY) {
        throw new Error(`Invalid minutes calculated: ${result.minutes}`);
      }

      return result;
    } catch (error) {
      this._log(`Failed to get current Eastern time info: ${error.message}`, 'error');

      // Return safe fallback values
      const now = new Date();
      return {
        date: now.toISOString().split('T')[0],
        day: now.toLocaleDateString('en-US', { weekday: 'short' }),
        minutes: now.getHours() * this.MINUTES_PER_HOUR + now.getMinutes(),
        timezone: 'Local',
        timestamp: now.getTime(),
        isValid: false,
        error: error.message
      };
    }
  }

  /**
   * Gets day name from a Date object with validation
   * @param {Date} date - Date object
   * @returns {string} Full day name (e.g., 'Monday')
   * @throws {Error} If date is invalid
   */
  static getDayName(date) {
    try {
      if (!(date instanceof Date)) {
        throw new Error('Input must be a Date object');
      }

      if (isNaN(date.getTime())) {
        throw new Error('Invalid Date object provided');
      }

      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        timeZone: this.TIMEZONE
      });
    } catch (error) {
      this._log(`Day name extraction failed: ${error.message}`, 'error');
      return 'Unknown';
    }
  }

  /**
   * Parses an ISO calendar date without allowing UTC conversion to move it to the prior day.
   * @param {string} dateString - Date in YYYY-MM-DD format
   * @returns {Date} Date positioned at local midday on the requested calendar day
   * @throws {Error} If dateString is invalid
   */
  static parseDateOnly(dateString) {
    this._validateInput(dateString, 'dateString', 'string');
    const match = dateString.match(this.DATE_ONLY_REGEX);
    if (!match) {
      throw new Error(`TimeUtils: Invalid date format "${dateString}". Expected format: "YYYY-MM-DD"`);
    }

    const year = Number(match[1]);
    const month = Number(match[2]) - 1;
    const day = Number(match[3]);
    const date = new Date(year, month, day, 12);
    if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) {
      throw new Error(`TimeUtils: Invalid calendar date "${dateString}"`);
    }

    return date;
  }

  /**
   * Returns the non-negative calendar-day offset for a forward-looking date.
   * @param {Date} date - Calendar date to compare
   * @param {Date} referenceDate - Calendar date to compare against
   * @returns {number|null} Day offset, or null for past or invalid dates
   */
  static getRelativeFutureDayOffset(date, referenceDate = new Date()) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())
      || !(referenceDate instanceof Date) || Number.isNaN(referenceDate.getTime())) return null;

    const getCalendarDay = value => Date.UTC(value.getFullYear(), value.getMonth(), value.getDate());
    const dayOffset = Math.round((getCalendarDay(date) - getCalendarDay(referenceDate)) / (24 * 60 * 60 * 1000));
    return dayOffset >= 0 ? dayOffset : null;
  }

  /**
   * Formats a calendar date as a concise forward-looking relative day label.
   * @param {Date} date - Calendar date to label
   * @param {Date} referenceDate - Calendar date to compare against
   * @returns {string} Relative day label, or an empty string for past or invalid dates
   */
  static formatRelativeFutureDay(date, referenceDate = new Date()) {
    const dayOffset = this.getRelativeFutureDayOffset(date, referenceDate);
    if (dayOffset === null) return '';
    if (dayOffset === 0) return 'today';
    if (dayOffset === 1) return 'tomorrow';
    return `in ${dayOffset} days`;
  }

  /**
   * Formats a date as YYYY-MM-DD with validation
   * @param {Date} date - Date object
   * @returns {string} Formatted date string
   * @throws {Error} If date is invalid
   */
  static formatDate(date) {
    try {
      if (!(date instanceof Date)) {
        throw new Error('Input must be a Date object');
      }

      if (isNaN(date.getTime())) {
        throw new Error('Invalid Date object provided');
      }

      return date.toISOString().split('T')[0];
    } catch (error) {
      this._log(`Date formatting failed: ${error.message}`, 'error');
      return new Date().toISOString().split('T')[0]; // Fallback to today
    }
  }

  /**
   * Formats time for display with validation
   * @param {string} timeString - Time string
   * @returns {string} Formatted time (currently passthrough with validation)
   */
  static formatTime(timeString) {
    try {
      this._validateInput(timeString, 'timeString', 'string');
      return timeString.trim();
    } catch (error) {
      this._log(`Time formatting failed: ${error.message}`, 'error');
      return this.DEFAULT_TIME;
    }
  }

  /**
   * Formats time for comparison (converts to minutes) with validation
   * @param {Date} date - Date object
   * @returns {number} Minutes since midnight
   * @throws {Error} If date is invalid
   */
  static formatTimeForComparison(date) {
    try {
      if (!(date instanceof Date)) {
        throw new Error('Input must be a Date object');
      }

      if (isNaN(date.getTime())) {
        throw new Error('Invalid Date object provided');
      }

      const minutes = date.getHours() * this.MINUTES_PER_HOUR + date.getMinutes();

      if (minutes < 0 || minutes >= this.MINUTES_PER_DAY) {
        throw new Error(`Calculated minutes ${minutes} is outside valid range`);
      }

      return minutes;
    } catch (error) {
      this._log(`Time comparison formatting failed: ${error.message}`, 'error');
      return 0; // Fallback to midnight
    }
  }

  /**
   * Parses time string to hour number with enhanced validation
   * @param {string} timeString - Time string like "9:00AM"
   * @returns {number} Hour number (24-hour format, 0-23)
   * @throws {Error} If timeString is invalid
   */
  static parseTimeString(timeString) {
    try {
      const minutes = this.timeStringToMinutes(timeString);
      const hour = Math.floor(minutes / this.MINUTES_PER_HOUR);

      if (hour < 0 || hour > 23) {
        throw new Error(`Calculated hour ${hour} is outside valid range (0-23)`);
      }

      return hour;
    } catch (error) {
      this._log(`Time string parsing failed for "${timeString}": ${error.message}`, 'error');
      throw error; // Re-throw to let caller handle
    }
  }

  /**
   * Checks whether the current time falls within the given time slot
   * Enhanced with comprehensive validation and error handling
   * @param {string} startTime - Start time in format "H:MMAM/PM" (e.g., "9:00AM")
   * @param {string} endTime - End time in format "H:MMAM/PM" (e.g., "5:00PM")
   * @param {number|null} currentMinutes - Current time in minutes since midnight (null = auto-calculate)
   * @param {boolean} isCurrentDay - Whether this is the current day
   * @returns {boolean} True if the current time falls within the time slot and it's the current day
   */
  static isCurrentTimeSlot(startTime, endTime, currentMinutes = null, isCurrentDay = false) {
    try {
      // Validate inputs
      this._validateInput(startTime, 'startTime', 'string');
      this._validateInput(endTime, 'endTime', 'string');
      this._validateInput(isCurrentDay, 'isCurrentDay', 'boolean');

      if (currentMinutes !== null) {
        this._validateInput(currentMinutes, 'currentMinutes', 'number');
        if (currentMinutes < 0 || currentMinutes >= this.MINUTES_PER_DAY) {
          throw new Error(`currentMinutes ${currentMinutes} is outside valid range (0-${this.MINUTES_PER_DAY - 1})`);
        }
      }

      // Only highlight if it's the current day
      if (!isCurrentDay) {
        return false;
      }

      // Convert time strings to minutes with error handling
      let startMinutes, endMinutes;
      try {
        startMinutes = this.timeStringToMinutes(startTime);
        endMinutes = this.timeStringToMinutes(endTime);
      } catch (conversionError) {
        this._log(`Time conversion failed in isCurrentTimeSlot: ${conversionError.message}`, 'error');
        return false; // Safe fallback
      }

      // Validate time range logic
      if (startMinutes >= endMinutes) {
        // Handle overnight time slots (e.g., "11:00PM" to "6:00AM")
        this._log(`Detected overnight time slot: ${startTime}-${endTime}`, 'info');

        if (currentMinutes === null) {
          const easternTimeInfo = this.getCurrentEasternTimeInfo();
          if (!easternTimeInfo.isValid) {
            this._log('Cannot determine current time for overnight slot check', 'warn');
            return false;
          }
          currentMinutes = easternTimeInfo.minutes;
        }

        // For overnight slots: current time >= start OR current time < end
        const result = currentMinutes >= startMinutes || currentMinutes < endMinutes;

        if (result) {
          this._log(`OVERNIGHT TIME SLOT MATCH! ${startTime}-${endTime} contains ${currentMinutes} minutes`);
        }

        return result;
      }

      // If currentMinutes is not provided, get current time
      if (currentMinutes === null) {
        const easternTimeInfo = this.getCurrentEasternTimeInfo();
        if (!easternTimeInfo.isValid) {
          this._log('Cannot determine current time for time slot check', 'warn');
          return false;
        }
        currentMinutes = easternTimeInfo.minutes;
      }

      // Normal time slot: start < end, check if current time is within range
      const result = currentMinutes >= startMinutes && currentMinutes < endMinutes;

      if (result) {
        this._log(`TIME SLOT MATCH! ${startTime}-${endTime} contains ${currentMinutes} minutes`);
      }

      return result;
    } catch (error) {
      this._log(`Time slot check failed for ${startTime}-${endTime}: ${error.message}`, 'error');
      return false; // Safe fallback
    }
  }

  /**
   * Checks if any time slot in an array contains the current time
   * Enhanced with validation and error handling
   * @param {Array} timeSlots - Array of time slot objects with startTime and endTime
   * @param {boolean} isCurrentDay - Whether this is the current day
   * @returns {boolean} True if current time falls within any slot and it's the current day
   */
  static hasCurrentTimeSlot(timeSlots, isCurrentDay = false) {
    try {
      // Validate inputs
      if (!Array.isArray(timeSlots)) {
        this._log(`timeSlots must be an array, got ${typeof timeSlots}`, 'warn');
        return false;
      }

      this._validateInput(isCurrentDay, 'isCurrentDay', 'boolean');

      if (timeSlots.length === 0) {
        return false;
      }

      // Get current time once for efficiency
      let currentMinutes;
      try {
        const easternTimeInfo = this.getCurrentEasternTimeInfo();
        if (!easternTimeInfo.isValid) {
          this._log('Cannot determine current time for time slot array check', 'warn');
          return false;
        }
        currentMinutes = easternTimeInfo.minutes;
      } catch (timeError) {
        this._log(`Failed to get current time: ${timeError.message}`, 'error');
        return false;
      }

      // Check each time slot with validation
      for (let i = 0; i < timeSlots.length; i++) {
        const slot = timeSlots[i];

        // Validate slot structure
        if (!slot || typeof slot !== 'object') {
          this._log(`Invalid slot at index ${i}: not an object`, 'warn');
          continue;
        }

        if (!slot.startTime || !slot.endTime) {
          this._log(`Invalid slot at index ${i}: missing startTime or endTime`, 'warn');
          continue;
        }

        try {
          if (this.isCurrentTimeSlot(slot.startTime, slot.endTime, currentMinutes, isCurrentDay)) {
            return true;
          }
        } catch (slotError) {
          this._log(`Error checking slot ${i} (${slot.startTime}-${slot.endTime}): ${slotError.message}`, 'warn');
          continue; // Skip this slot but continue checking others
        }
      }

      return false;
    } catch (error) {
      this._log(`Time slot array check failed: ${error.message}`, 'error');
      return false;
    }
  }

  // ------------------------------
  //    UTILITY AND DEBUG METHODS
  // ------------------------------

  /**
   * Validates the TimeUtils class functionality
   * @returns {Object} Validation results with success status and any errors
   */
  static validateSelf() {
    const results = {
      success: true,
      errors: [],
      warnings: [],
      tests: []
    };

    try {
      // Test timezone handling
      const easternTime = this.getEasternTime();
      results.tests.push({
        name: 'getEasternTime',
        success: easternTime instanceof Date && !isNaN(easternTime.getTime()),
        result: easternTime
      });

      // Test time string conversion
      const testTimes = ['9:00AM', '12:00PM', '11:59PM', '12:01AM'];
      for (const timeStr of testTimes) {
        try {
          const minutes = this.timeStringToMinutes(timeStr);
          const backToString = this.minutesToTimeString(minutes);
          results.tests.push({
            name: `timeString conversion: ${timeStr}`,
            success: minutes >= 0 && minutes < this.MINUTES_PER_DAY,
            result: { input: timeStr, minutes, backToString }
          });
        } catch (testError) {
          results.errors.push(`Time conversion test failed for ${timeStr}: ${testError.message}`);
          results.success = false;
        }
      }

      // Test current time info
      const timeInfo = this.getCurrentEasternTimeInfo();
      results.tests.push({
        name: 'getCurrentEasternTimeInfo',
        success: timeInfo && typeof timeInfo === 'object' && Object.prototype.hasOwnProperty.call(timeInfo, 'isValid'),
        result: timeInfo
      });

      this._log('Self-validation completed', 'info', results);
      return results;
    } catch (error) {
      results.success = false;
      results.errors.push(`Self-validation failed: ${error.message}`);
      this._log('Self-validation failed', 'error', error);
      return results;
    }
  }
}

// Register the class globally
if (typeof window !== 'undefined') {
  window.TimeUtils = TimeUtils;
}

// Export for Node.js compatibility
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TimeUtils;
}
}
