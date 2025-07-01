/**
 * Pool enumeration and constants
 */

// Prevent multiple declarations
if (!window.PoolNames) {
  class PoolNames {
  // Current pools (expandable to 23+ as data becomes available)
  static BRYANT_WOODS = 'Bryant Woods';
  static KENDALL_RIDGE = 'Kendall Ridge';
  
  // Future pools (based on typical CNSL pool names - update as data becomes available)
  static CLARYS_FOREST = 'Clarys Forest';
  static CLEMENS_CROSSING = 'Clemens Crossing';
  static DASHER_GREEN = 'Dasher Green';
  static DICKINSON = 'Dickinson';
  static DORSEY_HALL = 'Dorsey Hall';
  static FAULKNER_RIDGE = 'Faulkner Ridge';
  static HAWTHORN = 'Hawthorn';
  static HOBBITS_GLEN = 'Hobbits Glen';
  static HOPEWELL = 'Hopewell';
  static HUNTINGTON = 'Huntington';
  static JEFFERS_HILL = 'Jeffers Hill';
  static LOCUST_PARK = 'Locust Park';
  static LONGFELLOW = 'Longfellow';
  static MACGILLS_COMMON = 'Macgill\'s Common';
  static PHELPS_LUCK = 'Phelps Luck';
  static RIVER_HILL = 'River Hill';
  static RUNNING_BROOK = 'Running Brook';
  static STEVENS_FOREST = 'Stevens Forest';
  static SWANSFIELD = 'Swansfield';
  static TALBOTT_SPRINGS = 'Talbott Springs';
  static THUNDER_HILL = 'Thunder Hill';

  /**
   * Get all pool names as an array
   * @returns {Array} Array of pool name strings
   */
  static getAllPoolNames() {
    return [
      this.BRYANT_WOODS,
      this.KENDALL_RIDGE,
      this.CLARYS_FOREST,
      this.CLEMENS_CROSSING,
      this.DASHER_GREEN,
      this.DICKINSON,
      this.DORSEY_HALL,
      this.FAULKNER_RIDGE,
      this.HAWTHORN,
      this.HOBBITS_GLEN,
      this.HOPEWELL,
      this.HUNTINGTON,
      this.JEFFERS_HILL,
      this.LOCUST_PARK,
      this.LONGFELLOW,
      this.MACGILLS_COMMON,
      this.PHELPS_LUCK,
      this.RIVER_HILL,
      this.RUNNING_BROOK,
      this.STEVENS_FOREST,
      this.SWANSFIELD,
      this.TALBOTT_SPRINGS,
      this.THUNDER_HILL
    ];
  }

  /**
   * Convert pool name to enum-style constant name
   * @param {string} poolName - Human readable pool name
   * @returns {string} - Enum constant name
   */
  static toEnumName(poolName) {
    return poolName.toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z_]/g, '');
  }

  /**
   * Check if a pool name is valid
   * @param {string} poolName - Pool name to validate
   * @returns {boolean} - True if pool name exists
   */
  static isValidPoolName(poolName) {
    return this.getAllPoolNames().includes(poolName);
  }
}

/**
 * Pool status enumeration
 */
class PoolStatus {
  static OPEN = { isOpen: true, status: 'Open Now', color: 'green', icon: '🟢' };
  static CLOSED = { isOpen: false, status: 'Closed', color: 'red', icon: '🔴' };
  static RESTRICTED = { isOpen: true, status: 'Restricted Access', color: 'yellow', icon: '🟡' };
  static PRACTICE_ONLY = { isOpen: true, status: 'CNSL Practice Only', color: 'yellow', icon: '🟡' };
  static CLOSED_TO_PUBLIC = { isOpen: false, status: 'Closed to Public', color: 'red', icon: '🔴' };
  static SWIM_MEET = { isOpen: true, status: 'Swim Meet', color: 'yellow', icon: '🟡' };
  static SCHEDULE_NOT_FOUND = { isOpen: false, status: 'Schedule TBD', color: 'gray', icon: '⚫' };
}

// Node.js compatibility
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PoolNames;
}

// Add to global window if available (browser compatibility)
if (typeof window !== 'undefined') {
    window.PoolNames = PoolNames;
    window.PoolStatus = PoolStatus;
}

}
