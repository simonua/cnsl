/**
 * Semantic pool status constants.
 */

// Prevent multiple declarations
if (typeof window === 'undefined' || !window.PoolStatus) {
  class PoolStatus {
    static OPEN = Object.freeze({ kind: 'open', isOpen: true, status: 'Open Now', color: 'green', icon: '🟢' });
    static CLOSED = Object.freeze({ kind: 'closed', isOpen: false, status: 'Closed', color: 'red', icon: '🔴' });
    static RESTRICTED = Object.freeze({ kind: 'restricted', isOpen: true, status: 'Restricted Access', color: 'yellow', icon: '🟡' });
    static PRACTICE_ONLY = Object.freeze({ kind: 'practice-only', isOpen: true, status: 'Practice Only', color: 'yellow', icon: '🟡' });
    static CLOSED_TO_PUBLIC = Object.freeze({ kind: 'closed-to-public', isOpen: false, status: 'Closed to Public', color: 'red', icon: '🔴' });
    static SWIM_MEET = Object.freeze({ kind: 'swim-meet', isOpen: true, status: 'Swim Meet', color: 'yellow', icon: '🟡' });
    static SCHEDULE_NOT_FOUND = Object.freeze({ kind: 'schedule-not-found', isOpen: false, status: 'Schedule TBD', color: 'gray', icon: '⚫' });
  }

  // Export for Node.js compatibility
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PoolStatus };
  }

  // Add to global window if available (browser compatibility)
  if (typeof window !== 'undefined') {
    window.PoolStatus = PoolStatus;
  }
}
