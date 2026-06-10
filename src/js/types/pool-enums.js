/**
 * Semantic pool status constants.
 */

// Prevent multiple declarations
if (typeof globalThis.PoolStatus === 'undefined') {
  class PoolStatus {
    static OPEN = Object.freeze({ kind: 'open', isOpen: true, status: 'Open Now', color: 'green' });
    static CLOSED = Object.freeze({ kind: 'closed', isOpen: false, status: 'Closed', color: 'red' });
    static RESTRICTED = Object.freeze({ kind: 'restricted', isOpen: true, status: 'Restricted Access', color: 'yellow' });
    static SPECIAL_EVENT = Object.freeze({ kind: 'special-event', isOpen: true, status: 'Special Event', color: 'yellow' });
    static PRACTICE_ONLY = Object.freeze({ kind: 'practice-only', isOpen: true, status: 'Closed to the public', color: 'yellow' });
    static CLOSED_TO_PUBLIC = Object.freeze({ kind: 'closed-to-public', isOpen: false, status: 'Closed to the public', color: 'red' });
    static SWIM_MEET = Object.freeze({ kind: 'swim-meet', isOpen: true, status: 'Swim Meet', color: 'yellow' });
    static SCHEDULE_NOT_FOUND = Object.freeze({ kind: 'schedule-not-found', isOpen: false, status: 'Schedule TBD', color: 'gray' });
  }

  globalThis.PoolStatus = PoolStatus;
}
