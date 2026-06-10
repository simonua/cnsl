/**
 * Semantic state constants for time-based meet, pool, and practice schedules.
 */

/** @typedef {'upcoming'|'ongoing'|'concluded'} MeetLiveStatusValue */
/** @typedef {'opens'|'closes'} PoolTransitionActionValue */
/** @typedef {'upcoming'|'current'|'past'} PracticeRangeStatusValue */

if (typeof globalThis.MeetLiveStatus === 'undefined') {
  /** Defines live-state values for regular meets with known timing windows. */
  class MeetLiveStatus {
    /** @type {MeetLiveStatusValue} */
    static UPCOMING = 'upcoming';
    /** @type {MeetLiveStatusValue} */
    static ONGOING = 'ongoing';
    /** @type {MeetLiveStatusValue} */
    static CONCLUDED = 'concluded';

    /**
     * Checks whether a value is a supported meet live state.
     * @param {*} value - Value to validate
     * @returns {boolean} Whether the value is a meet live state
     */
    static isValid(value) {
      return value === MeetLiveStatus.UPCOMING
        || value === MeetLiveStatus.ONGOING
        || value === MeetLiveStatus.CONCLUDED;
    }
  }

  /** Defines actions for the next public pool-access transition. */
  class PoolTransitionAction {
    /** @type {PoolTransitionActionValue} */
    static OPENS = 'opens';
    /** @type {PoolTransitionActionValue} */
    static CLOSES = 'closes';

    /**
     * Checks whether a value is a supported pool transition action.
     * @param {*} value - Value to validate
     * @returns {boolean} Whether the value is a pool transition action
     */
    static isValid(value) {
      return value === PoolTransitionAction.OPENS || value === PoolTransitionAction.CLOSES;
    }
  }

  /** Defines temporal states for a published practice date range. */
  class PracticeRangeStatus {
    /** @type {PracticeRangeStatusValue} */
    static UPCOMING = 'upcoming';
    /** @type {PracticeRangeStatusValue} */
    static CURRENT = 'current';
    /** @type {PracticeRangeStatusValue} */
    static PAST = 'past';

    /**
     * Checks whether a value is a supported practice-range state.
     * @param {*} value - Value to validate
     * @returns {boolean} Whether the value is a practice-range state
     */
    static isValid(value) {
      return value === PracticeRangeStatus.UPCOMING
        || value === PracticeRangeStatus.CURRENT
        || value === PracticeRangeStatus.PAST;
    }
  }

  Object.freeze(MeetLiveStatus);
  Object.freeze(PoolTransitionAction);
  Object.freeze(PracticeRangeStatus);

  globalThis.MeetLiveStatus = MeetLiveStatus;
  globalThis.PoolTransitionAction = PoolTransitionAction;
  globalThis.PracticeRangeStatus = PracticeRangeStatus;
}
