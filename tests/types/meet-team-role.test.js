const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { MeetTeamRole } = require('../helpers/browser-module-loader.js').loadBrowserModule('meet-team-role');

describe('MeetTeamRole', () => {
  it('publishes immutable home and away roles', () => {
    assert.deepEqual(MeetTeamRole, { AWAY: 'away', HOME: 'home' });
    assert.equal(Object.isFrozen(MeetTeamRole), true);
  });
});
