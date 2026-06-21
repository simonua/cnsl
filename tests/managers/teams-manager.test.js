const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createSampleTeamsData } = require('../helpers/test-helpers.js');
const { Team, TeamsManager } = require('../helpers/browser-module-loader.js').loadBrowserModule('teams-manager');

describe('TeamsManager', () => {
  let manager;

  beforeEach(() => {
    manager = new TeamsManager();
  });

  it('loads the published collection as Team models', () => {
    const source = createSampleTeamsData();
    manager.loadData(source);

    const teams = manager.getAllTeams();
    assert.equal(manager.isDataLoaded(), true);
    assert.equal(teams.length, source.teams.length);
    assert.equal(teams.every(team => team instanceof Team), true);
    assert.deepEqual(teams.map(team => team.name), source.teams.map(team => team.name));
  });

  it('indexes only explicitly published practice pools and returns a collection copy', () => {
    const source = createSampleTeamsData();
    source.teams[1].homePools.push('Running Brook');
    manager.loadData(source);

    const practiceTeams = manager.getPracticeTeamsByPool('Running Brook');
    assert.deepEqual(practiceTeams.map(team => team.name), ['Bryant Woods Barracudas']);
    practiceTeams.length = 0;
    assert.deepEqual(manager.getPracticeTeamsByPool('Running Brook').map(team => team.name), ['Bryant Woods Barracudas']);
  });

  it('returns an empty collection for unusable input and after clearing', () => {
    manager.loadData(null);
    assert.equal(manager.isDataLoaded(), false);
    assert.deepEqual(manager.getAllTeams(), []);

    manager.loadData(createSampleTeamsData());
    manager.clearData();
    assert.equal(manager.isDataLoaded(), false);
    assert.deepEqual(manager.getAllTeams(), []);
    assert.deepEqual(manager.getPracticeTeamsByPool('Bryant Woods'), []);
  });

  it('installs the manager as a browser script global', () => {
    const sourcePath = path.join(__dirname, '..', '..', 'src', 'js', 'managers', 'teams-manager.js');
    const source = fs.readFileSync(sourcePath, 'utf8');
    const context = { window: {}, Team };
    Object.assign(context, context.globalThis || {}, context.window || {});
    context.globalThis = context; context.self = context; context.window = context;
    vm.runInNewContext(source, context, { filename: sourcePath });

    assert.equal(typeof context.window.TeamsManager, 'function');
  });
});
