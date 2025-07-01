/**
 * Time utility functions for Eastern Time zone handling
 */
class TimeUtils {
  /**
   * Gets the current Eastern Time (EDT/EST) as a Date object
   * @returns {Date} - Current time in Eastern timezone
   */
  static getEasternTime() {
    const now = new Date();
    //console.log(`🌍 Browser local time: ${now.toLocaleString()}`);

    // Convert to Eastern Time using proper timezone handling
    const easternTime = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
    //console.log(`🗽 Eastern time: ${easternTime.toLocaleString()}`);

    // Verify timezone conversion
    const easternTimeString = now.toLocaleString("en-US", { timeZone: "America/New_York" });
    const timezone = now.toLocaleDateString('en-US', { timeZoneName: 'short', timeZone: 'America/New_York' }).split(', ')[1] || 'ET';
    //console.log(`🕐 Eastern time string: ${easternTimeString} (${timezone})`);

    return easternTime;
  }

  /**
   * Converts time string (e.g., "6:00AM", "10:30PM") to minutes since midnight
   * @param {string} timeStr - Time string in format "H:MMAM/PM"
   * @returns {number} - Minutes since midnight
   */
  static timeStringToMinutes(timeStr) {
    const match = timeStr.match(/(\d{1,2}):?(\d{0,2})(AM|PM)/i);
    if (!match) {
      console.log(`❌ Time parse failed for: "${timeStr}"`);
      return 0;
    }

    const hours = parseInt(match[1]);
    const minutes = parseInt(match[2] || '0');
    const period = match[3].toUpperCase();

    let adjustedHours = hours;
    if (period === 'PM' && hours !== 12) {
      adjustedHours += 12;
    } else if (period === 'AM' && hours === 12) {
      adjustedHours = 0;
    }

    return adjustedHours * 60 + minutes;
  }

  /**
   * Converts minutes since midnight to time string format (e.g., "6:00am", "10:30pm")
   * @param {number} minutes - Minutes since midnight
   * @returns {string} - Time string in format "H:MMam/pm"
   */
  static minutesToTimeString(minutes) {
    if (minutes < 0 || minutes >= 1440) { // 1440 minutes in a day
      return '12:00am'; // Default fallback
    }

    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;

    let displayHours = hours;
    let period = 'am';

    if (hours === 0) {
      displayHours = 12;
    } else if (hours === 12) {
      period = 'pm';
    } else if (hours > 12) {
      displayHours = hours - 12;
      period = 'pm';
    }

    const minutePart = mins === 0 ? '00' : mins.toString().padStart(2, '0');
    return `${displayHours}:${minutePart}${period}`;
  }

  /**
   * Formats activity types for display
   * @param {string|Array} types - Single type string or array of types
   * @returns {string} - Formatted types string
   */
  static formatActivityTypes(types) {
    if (!types) return '';
    if (typeof types === 'string') return types;
    if (Array.isArray(types)) return types.join(', ');
    return '';
  }

  /**
   * Gets current Eastern Time components
   * @returns {Object} - Object with date, day, time info
   */
  static getCurrentEasternTimeInfo() {
    const easternTime = this.getEasternTime();
    return {
      date: easternTime.toISOString().split('T')[0], // YYYY-MM-DD
      day: easternTime.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'America/New_York' }), // Mon, Tue, etc.
      minutes: easternTime.getHours() * 60 + easternTime.getMinutes(), // Minutes since midnight
      timezone: easternTime.toLocaleDateString('en-US', { timeZoneName: 'short', timeZone: 'America/New_York' }).split(', ')[1] || 'ET'
    };
  }

  /**
   * Gets day name from a Date object
   * @param {Date} date - Date object
   * @returns {string} - Full day name (e.g., 'Monday')
   */
  static getDayName(date) {
    return date.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'America/New_York' });
  }

  /**
   * Formats a date as YYYY-MM-DD
   * @param {Date} date - Date object
   * @returns {string} - Formatted date string
   */
  static formatDate(date) {
    return date.toISOString().split('T')[0];
  }

  /**
   * Formats time for display
   * @param {string} timeString - Time string
   * @returns {string} - Formatted time
   */
  static formatTime(timeString) {
    return timeString; // Simple passthrough for now
  }

  /**
   * Formats time for comparison (converts to minutes)
   * @param {Date} date - Date object
   * @returns {number} - Minutes since midnight
   */
  static formatTimeForComparison(date) {
    return date.getHours() * 60 + date.getMinutes();
  }

  /**
   * Parses time string to hour number
   * @param {string} timeString - Time string like "9:00AM"
   * @returns {number} - Hour number (24-hour format)
   */
  static parseTimeString(timeString) {
    return Math.floor(this.timeStringToMinutes(timeString) / 60);
  }

  /**
   * Checks whether the current time falls within the given time slot
   * @param {string} startTime - Start time in format "H:MMAM/PM" (e.g., "9:00AM")
   * @param {string} endTime - End time in format "H:MMAM/PM" (e.g., "5:00PM")
   * @param {number} currentMinutes - Current time in minutes since midnight (defaults to now)
   * @param {boolean} isCurrentDay - Whether this is the current day
   * @returns {boolean} - True if the current time falls within the time slot and it's the current day
   */
  static isCurrentTimeSlot(startTime, endTime, currentMinutes = null, isCurrentDay = false) {
    // Only highlight if it's the current day
    if (!isCurrentDay) return false;

    // Convert time strings to minutes
    const startMinutes = this.timeStringToMinutes(startTime);
    const endMinutes = this.timeStringToMinutes(endTime);

    // If currentMinutes is not provided, get current time
    if (currentMinutes === null) {
      const easternTimeInfo = this.getCurrentEasternTimeInfo();
      currentMinutes = easternTimeInfo.minutes;
    }

    // Check if current time falls within the time slot
    const result = currentMinutes >= startMinutes && currentMinutes < endMinutes;

    if (result) {
      console.log(`🎯 TIME SLOT MATCH! ${startTime}-${endTime} contains ${currentMinutes} minutes`);
    }

    return result;
  }

  /**
   * Checks if any time slot in an array contains the current time
   * @param {Array} timeSlots - Array of time slot objects with startTime and endTime
   * @param {boolean} isCurrentDay - Whether this is the current day
   * @returns {boolean} - True if current time falls within any slot and it's the current day
   */
  static hasCurrentTimeSlot(timeSlots, isCurrentDay = false) {
    if (!timeSlots || !Array.isArray(timeSlots)) return false;

    const easternTimeInfo = this.getCurrentEasternTimeInfo();
    const currentMinutes = easternTimeInfo.minutes;

    return timeSlots.some(slot => {
      return this.isCurrentTimeSlot(slot.startTime, slot.endTime, currentMinutes, isCurrentDay);
    });
  }

  /**
   * Formats a time range with highlighting for the current timeslot
   * @param {string} timeRange - Time range in format "startTime-endTime"
   * @param {boolean} isCurrentDay - Whether this day is the current day
   * @param {number|null} currentMinutes - Current time in minutes since midnight (null = auto-calculate)
   * @param {Object} status - Status object with color information
   * @param {boolean} forceHighlight - Force highlighting regardless of time (used for active slots)
   * @returns {string} - HTML with formatted time range spans
   */
  static formatTimeRangeWithHighlight(timeRange, isCurrentDay = false, currentMinutes = null, status = null, forceHighlight = false) {
    // If currentMinutes is not provided, get current time automatically
    if (currentMinutes === null || currentMinutes === undefined) {
      const easternTimeInfo = this.getCurrentEasternTimeInfo();
      currentMinutes = easternTimeInfo.minutes;
    }

    if (!timeRange) return '';

    const parts = timeRange.split('-');
    if (parts.length !== 2) return timeRange;

    const startTime = parts[0].trim();
    const endTime = parts[1].trim();

    // Check if current time falls within this slot (only for current day)
    let highlightClass = '';
    let inlineStyle = '';

    // Determine if this should be highlighted
    let shouldHighlight = false;

    if (forceHighlight) {
      // If forceHighlight is true, we've already determined this slot should be highlighted
      shouldHighlight = true;
      console.log(`🚀 Force highlighting enabled for ${timeRange}`);
    } else if (isCurrentDay) {
      // Check if this is actually the current time slot
      shouldHighlight = this.isCurrentTimeSlot(startTime, endTime, currentMinutes, isCurrentDay);
    }

    // Apply highlighting if this should be highlighted and we have status info
    if (shouldHighlight && status) {
      // Highlight based on pool status color
      if (status.color === 'green') {
        // Pool is fully open
        highlightClass = ' highlighted-time-slot-green';
        inlineStyle = ' style="background-color: #28a745 !important; color: white !important; padding: 0.2rem 0.4rem !important; border-radius: 0.3rem !important; font-weight: bold !important;"';
      } else if (status.color === 'yellow') {
        // Pool has restricted access (practice only, swim meet, etc.)
        highlightClass = ' highlighted-time-slot-yellow';
        inlineStyle = ' style="background-color: #ffc107 !important; color: black !important; padding: 0.2rem 0.4rem !important; border-radius: 0.3rem !important; font-weight: bold !important;"';
      } else if (status.color === 'red') {
        // Pool is closed to public or fully closed - light red highlighting
        highlightClass = ' highlighted-time-slot-red';
        inlineStyle = ' style="background-color: #ffcccb !important; color: #d32f2f !important; padding: 0.2rem 0.4rem !important; border-radius: 0.3rem !important; font-weight: bold !important;"';
      }
      
      if (highlightClass) {
        console.log(`🎯 MATCH FOUND! Highlighting time slot: ${startTime}-${endTime}`);
        console.log(`🎯 Status color: ${status.color || 'unknown'}`);
        console.log(`🎯 Applied highlight class: "${highlightClass.trim()}"`);
      } else {
        console.log(`🚫 Current time slot but unknown status color: ${status.color || 'unknown'}`);
      }
    } else if (shouldHighlight && !status) {
      console.log(`🚫 Should highlight ${timeRange} but no status provided`);
    }
    
    const result = `<span class="time-range-container${highlightClass}"${inlineStyle}><span class="time-start">${startTime}</span><span class="time-dash">-</span><span class="time-end">${endTime}</span></span>`;
    return result;
  }
}
