const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { loadBrowserModule } = require('../helpers/browser-module-loader.js');

function loadScheduleState() {
  return loadBrowserModule('schedule-state').context;
}

const { MeetLiveStatus, PoolTransitionAction, PracticeRangeStatus } = loadScheduleState();

describe('schedule state enums', () => {
  it('defines immutable meet live states', () => {
    assert.equal(MeetLiveStatus.UPCOMING, 'upcoming');
    assert.equal(MeetLiveStatus.ONGOING, 'ongoing');
    assert.equal(MeetLiveStatus.CONCLUDED, 'concluded');
    assert.equal(Object.isFrozen(MeetLiveStatus), true);
  });

  it('validates only supported meet live states', () => {
    assert.equal(MeetLiveStatus.isValid(MeetLiveStatus.ONGOING), true);
    assert.equal(MeetLiveStatus.isValid('current'), false);
    assert.equal(MeetLiveStatus.isValid(null), false);
  });

  it('defines and validates immutable pool transition actions', () => {
    assert.equal(PoolTransitionAction.OPENS, 'opens');
    assert.equal(PoolTransitionAction.CLOSES, 'closes');
    assert.equal(PoolTransitionAction.isValid(PoolTransitionAction.OPENS), true);
    assert.equal(PoolTransitionAction.isValid('closed'), false);
    assert.equal(Object.isFrozen(PoolTransitionAction), true);
  });

  it('defines and validates immutable practice range states', () => {
    assert.equal(PracticeRangeStatus.UPCOMING, 'upcoming');
    assert.equal(PracticeRangeStatus.CURRENT, 'current');
    assert.equal(PracticeRangeStatus.PAST, 'past');
    assert.equal(PracticeRangeStatus.isValid(PracticeRangeStatus.PAST), true);
    assert.equal(PracticeRangeStatus.isValid('regular'), false);
    assert.equal(Object.isFrozen(PracticeRangeStatus), true);
  });
});

describe('browser registration', () => {
  it('installs schedule state enums as browser globals', () => {
    const context = loadScheduleState();

    assert.equal(typeof context.window.MeetLiveStatus, 'function');
    assert.equal(typeof context.window.PoolTransitionAction, 'function');
    assert.equal(typeof context.window.PracticeRangeStatus, 'function');
  });
});
