/**
 * Identifies whether a selected team hosts or visits for a dual meet.
 */
if (typeof globalThis.MeetTeamRole === 'undefined') {
  /** @typedef {'home'|'away'} MeetTeamRoleValue */
  const MeetTeamRole = Object.freeze({
    AWAY: 'away',
    HOME: 'home'
  });

  globalThis.MeetTeamRole = MeetTeamRole;
}
