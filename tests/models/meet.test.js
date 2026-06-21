const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createSampleMeetsData } = require('../helpers/test-helpers.js');
const { Meet } = require('../helpers/browser-module-loader.js').loadBrowserModule('meet');

describe('Meet', () => {
  const sampleMeetsData = createSampleMeetsData();
  const meet = new Meet(sampleMeetsData.regular_meets[0], sampleMeetsData.meetTimes, 'dualMeets');

  it('exposes the published matchup contract', () => {
    assert.equal(meet.getHomeTeam(), 'Bryant Woods Barracudas');
    assert.equal(meet.getVisitingTeam(), 'Kendall Ridge Krakens');
    assert.equal(meet.isSpecialMeet(), false);
    assert.equal(Object.hasOwn(meet, 'homeTeam'), false);
    assert.equal(Object.hasOwn(meet, 'awayTeam'), false);
    assert.equal(Object.hasOwn(meet, 'homePool'), false);
  });

  it('identifies special meets without a matchup or approved timing window', () => {
    const specialMeet = new Meet({ date: '2026-07-25', name: 'All City', location: 'Columbia' });
    assert.equal(specialMeet.isSpecialMeet(), true);
    assert.equal(specialMeet.getKnownTimingWindow(), null);
    assert.equal(specialMeet.getLiveStatus({ date: '2026-07-25', minutes: 600, isValid: true }), null);
  });

  it('uses the approved standard dual-meet window for live timing status', () => {
    const regularMeet = new Meet({ date: '2026-06-13', home_team: 'Home', visiting_team: 'Away' }, sampleMeetsData.meetTimes, 'dualMeets');
    assert.equal(regularMeet.getDisplayTime(), '7:00 AM - 12:00 PM');
    assert.equal(regularMeet.getRelayCheckInDeadlineDisplayTime(), '7:55 AM');
    assert.equal(regularMeet.getFirstSwimDisplayTime(), '8:00 AM');
    assert.equal(regularMeet.getLiveStatus({ date: '2026-06-13', minutes: 419, isValid: true }), 'upcoming');
    assert.equal(regularMeet.getLiveStatus({ date: '2026-06-13', minutes: 420, isValid: true }), 'ongoing');
    assert.equal(regularMeet.getLiveStatus({ date: '2026-06-13', minutes: 720, isValid: true }), 'concluded');
    assert.equal(regularMeet.getLiveStatus({ date: '2026-06-14', minutes: 0, isValid: true }), 'concluded');
  });

  it('uses published Time Trials timing and accepts a team override window', () => {
    const timeTrials = new Meet({ date: '2026-06-06', timeWindowKey: 'timeTrials' }, sampleMeetsData.meetTimes);
    assert.equal(timeTrials.getDisplayTime(), '7:00 AM - 12:00 PM');
    assert.equal(timeTrials.getDisplayTime({ start: '08:30', end: '11:30' }), '8:30 AM - 11:30 AM');
  });

  it('rejects malformed clock and current-time values safely', () => {
    assert.equal(Meet.formatClockTime('25:00'), '');
    assert.equal(meet.getLiveStatus(null), null);
    assert.equal(meet.getLiveStatus({ date: 'June 13, 2026', minutes: 600, isValid: true }), null);
    assert.equal(meet.getLiveStatus({ date: '2026-06-13', minutes: Number.NaN }), null);
  });

  it('installs the model as a browser script global', () => {
    const sourcePath = path.join(__dirname, '..', '..', 'src', 'js', 'models', 'meet.js');
    const source = fs.readFileSync(sourcePath, 'utf8');
    const context = { window: {} };
    Object.assign(context, context.globalThis || {}, context.window || {});
    context.globalThis = context; context.self = context; context.window = context;
    vm.runInNewContext(source, context, { filename: sourcePath });

    assert.equal(typeof context.window.Meet, 'function');
    assert.equal(new context.window.Meet({ name: 'Browser Meet' }).name, 'Browser Meet');
  });
});
