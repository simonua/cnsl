/**
 * Semantic pool status constants.
 */

// Prevent multiple declarations
if (typeof globalThis.PoolStatus === 'undefined') {
  /** Defines immutable semantic states for pool access and schedule availability. */
  class PoolStatus {
    /** @type {PoolStatus} */
    static OPEN = Object.freeze({ kind: 'open', isOpen: true, status: 'Open Now', color: 'green' });
    /** @type {PoolStatus} */
    static CLOSED = Object.freeze({ kind: 'closed', isOpen: false, status: 'Closed', color: 'red' });
    /** @type {PoolStatus} */
    static RESTRICTED = Object.freeze({ kind: 'restricted', isOpen: true, status: 'Restricted Access', color: 'yellow' });
    /** @type {PoolStatus} */
    static SPECIAL_EVENT = Object.freeze({ kind: 'special-event', isOpen: true, status: 'Special Event', color: 'yellow' });
    /** @type {PoolStatus} */
    static PRACTICE_ONLY = Object.freeze({ kind: 'practice-only', isOpen: true, status: 'Closed to the public', color: 'yellow' });
    /** @type {PoolStatus} */
    static CLOSED_TO_PUBLIC = Object.freeze({ kind: 'closed-to-public', isOpen: false, status: 'Closed to the public', color: 'red' });
    /** @type {PoolStatus} */
    static SWIM_MEET = Object.freeze({ kind: 'swim-meet', isOpen: true, status: 'Swim Meet', color: 'yellow' });
    /** @type {PoolStatus} */
    static STATUS_NOT_APPLICABLE = Object.freeze({ kind: 'status-not-applicable', isOpen: false, status: 'Current status not applicable', color: 'gray' });
    /** @type {PoolStatus} */
    static SCHEDULE_NOT_FOUND = Object.freeze({ kind: 'schedule-not-found', isOpen: false, status: 'Schedule TBD', color: 'gray' });
  }

  globalThis.PoolStatus = PoolStatus;
}
