const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createSampleTeamsData } = require('../helpers/test-helpers.js');
const { Team } = require('../helpers/browser-module-loader.js').loadBrowserModule('team');

describe('Team', () => {
  it('copies published collections into one model record', () => {
    const source = createSampleTeamsData().teams[0];
    const team = new Team(source);
    source.homePools.push('Changed Pool');
    source.practicePools.push('Changed Pool');
    source.staff.coaches.push({ name: 'Changed Coach' });

    assert.deepEqual(team.homePools, ['Bryant Woods']);
    assert.deepEqual(team.practicePools, ['Bryant Woods', 'Running Brook']);
    assert.deepEqual(team.staff.coaches, [{ name: 'Jane Smith', role: 'Head Coach', email: 'jane@example.com' }]);
  });

  it('returns a defensive team-specific meet-time override when published', () => {
    const team = new Team({ meetTimeOverrides: { timeTrials: { start: '08:30', end: '11:30' } } });
    const timingWindow = team.getMeetTimeOverride('timeTrials');

    assert.equal(team.getMeetTimeOverride('dualMeets'), null);
    assert.deepEqual(timingWindow, { start: '08:30', end: '11:30' });
    timingWindow.start = '09:00';
    assert.equal(team.getMeetTimeOverride('timeTrials').start, '08:30');
  });

  it('provides stable defaults for optional published fields', () => {
    const team = new Team();
    assert.deepEqual(team.homePools, []);
    assert.deepEqual(team.practicePools, []);
    assert.deepEqual(team.staff.coaches, []);
    assert.deepEqual(team.staff.managers, []);
    assert.deepEqual(team.staff.contacts, []);
  });

  it('installs the model as a browser script global', () => {
    const sourcePath = path.join(__dirname, '..', '..', 'src', 'js', 'models', 'team.js');
    const source = fs.readFileSync(sourcePath, 'utf8');
    const context = { window: {} };
    Object.assign(context, context.globalThis || {}, context.window || {});
    context.globalThis = context; context.self = context; context.window = context;
    vm.runInNewContext(source, context, { filename: sourcePath });

    assert.equal(typeof context.window.Team, 'function');
    assert.equal(new context.window.Team({ name: 'Browser Team' }).name, 'Browser Team');
  });
});
