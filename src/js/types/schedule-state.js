/**
 * Semantic state constants for time-based meet, pool, and practice schedules.
 */

/** @typedef {'upcoming'|'ongoing'|'concluded'} MeetLiveStatusValue */
/** @typedef {'opens'|'closes'} PoolTransitionActionValue */
/** @typedef {'upcoming'|'current'|'past'} PracticeRangeStatusValue */

if (typeof globalThis.MeetLiveStatus === 'undefined') {
  class MeetLiveStatus {
    /** @type {MeetLiveStatusValue} */
    static UPCOMING = 'upcoming';
    /** @type {MeetLiveStatusValue} */
    static ONGOING = 'ongoing';
    /** @type {MeetLiveStatusValue} */
    static CONCLUDED = 'concluded';

    static isValid(value) {
      return value === MeetLiveStatus.UPCOMING
        || value === MeetLiveStatus.ONGOING
        || value === MeetLiveStatus.CONCLUDED;
    }
  }

  class PoolTransitionAction {
    /** @type {PoolTransitionActionValue} */
    static OPENS = 'opens';
    /** @type {PoolTransitionActionValue} */
    static CLOSES = 'closes';

    static isValid(value) {
      return value === PoolTransitionAction.OPENS || value === PoolTransitionAction.CLOSES;
    }
  }

  class PracticeRangeStatus {
    /** @type {PracticeRangeStatusValue} */
    static UPCOMING = 'upcoming';
    /** @type {PracticeRangeStatusValue} */
    static CURRENT = 'current';
    /** @type {PracticeRangeStatusValue} */
    static PAST = 'past';

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
