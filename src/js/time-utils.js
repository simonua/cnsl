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
    console.log(`🌍 Browser local time: ${now.toLocaleString()}`);
    
    // Convert to Eastern Time using proper timezone handling
    const easternTime = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
    console.log(`🗽 Eastern time: ${easternTime.toLocaleString()}`);
    
    // Verify timezone conversion
    const easternTimeString = now.toLocaleString("en-US", {timeZone: "America/New_York"});
    const timezone = now.toLocaleDateString('en-US', { timeZoneName: 'short', timeZone: 'America/New_York' }).split(', ')[1] || 'ET';
    console.log(`🕐 Eastern time string: ${easternTimeString} (${timezone})`);
    
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
}
