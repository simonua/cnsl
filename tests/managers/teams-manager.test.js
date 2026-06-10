const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createSampleTeamsData } = require('../helpers/test-helpers.js');
const { Team, TeamsManager } = require('../helpers/browser-module-loader.js').loadBrowserModule('teams-manager');
const activeTeamsData = require('../../src/assets/data/2026/teams/teams.json');

describe('TeamsManager', () => {
  let manager;

  beforeEach(() => {
    manager = new TeamsManager();
  });

  describe('constructor', () => {
    it('initializes with empty teams map', () => {
      assert.equal(manager.isDataLoaded(), false);
    });
  });

  describe('loadData', () => {
    it('loads teams from array', () => {
      manager.loadData(createSampleTeamsData());
      assert.equal(manager.isDataLoaded(), true);
    });

    it('remains unloaded for documents without a teams collection', () => {
      manager.loadData(null);
      assert.equal(manager.isDataLoaded(), false);
      assert.deepEqual(manager.getAllTeams(), []);
    });
  });

  describe('getAllTeams', () => {
    it('returns empty array before loading', () => {
      const teams = manager.getAllTeams();
      assert.ok(Array.isArray(teams));
      assert.equal(teams.length, 0);
    });

    it('returns all loaded teams', () => {
      manager.loadData(createSampleTeamsData());
      const teams = manager.getAllTeams();
      assert.equal(teams.length, 2);
      assert.equal(teams[0] instanceof Team, true);
    });
  });

  describe('getTeam', () => {
    it('finds team by name', () => {
      manager.loadData(createSampleTeamsData());
      const team = manager.getTeam('Bryant Woods Barracudas');
      assert.ok(team);
      assert.equal(team.name, 'Bryant Woods Barracudas');
    });

    it('returns null for unknown team', () => {
      manager.loadData(createSampleTeamsData());
      assert.equal(manager.getTeam('Nonexistent Team'), null);
    });

    it('reports names and count for loaded teams', () => {
      manager.loadData(createSampleTeamsData());
      assert.deepEqual(manager.getTeamNames(), ['Bryant Woods Barracudas', 'Kendall Ridge Krakens']);
      assert.equal(manager.getTeamCount(), 2);
    });
  });

  describe('searchTeams', () => {
    it('finds teams by partial name', () => {
      manager.loadData(createSampleTeamsData());
      const results = manager.searchTeams('Bryant');
      assert.ok(results.length > 0);
    });

    it('returns empty for no match', () => {
      manager.loadData(createSampleTeamsData());
      const results = manager.searchTeams('zzz_nonexistent');
      assert.equal(results.length, 0);
    });

    it('finds teams by publicly listed staff name', () => {
      manager.loadData(createSampleTeamsData());
      const results = manager.searchTeams('Rivera');
      assert.deepEqual(results.map(team => team.name), ['Bryant Woods Barracudas']);
    });

    it('finds teams by publicly listed staff email', () => {
      manager.loadData(createSampleTeamsData());
      const results = manager.searchTeams('managers@example.com');
      assert.deepEqual(results.map(team => team.name), ['Bryant Woods Barracudas']);
    });

    it('finds teams by practice pool', () => {
      manager.loadData(createSampleTeamsData());
      const results = manager.searchTeams('Running Brook');
      assert.deepEqual(results.map(team => team.name), ['Bryant Woods Barracudas']);
    });

    it('returns all teams for an empty search term', () => {
      manager.loadData(createSampleTeamsData());
      assert.equal(manager.searchTeams('  ').length, 2);
    });
  });

  describe('getTeamsByPool', () => {
    it('finds teams by pool name', () => {
      manager.loadData(createSampleTeamsData());
      const teams = manager.getTeamsByPool('Bryant Woods');
      assert.ok(teams.length > 0);
      assert.equal(teams[0].homePools[0], 'Bryant Woods');
    });

    it('finds only teams explicitly listing a pool as a practice location', () => {
      const data = createSampleTeamsData();
      data.teams[1].homePools.push('Running Brook');
      manager.loadData(data);

      assert.deepEqual(manager.getPracticeTeamsByPool('Running Brook').map(team => team.name), ['Bryant Woods Barracudas']);
    });

    it('keeps the practice-pool index synchronized through mutations', () => {
      manager.addOrUpdateTeam({ name: 'First Team', practicePools: ['Known Pool'] });
      manager.addOrUpdateTeam({ name: 'Second Team', practicePools: ['Known Pool'] });
      assert.deepEqual(manager.getPracticeTeamsByPool('Known Pool').map(team => team.name), ['First Team', 'Second Team']);

      manager.removeTeam('First Team');
      assert.deepEqual(manager.getPracticeTeamsByPool('Known Pool').map(team => team.name), ['Second Team']);
      manager.clearData();
      assert.deepEqual(manager.getPracticeTeamsByPool('Known Pool'), []);
    });
  });

  describe('public staff', () => {
    it('finds teams by structured coach record', () => {
      manager.loadData(createSampleTeamsData());
      const teams = manager.getTeamsByCoach('Jane');
      assert.deepEqual(teams.map(team => team.name), ['Bryant Woods Barracudas']);
    });

    it('returns unique published coach and manager names', () => {
      manager.loadData(createSampleTeamsData());
      assert.deepEqual(manager.getAllCoaches(), ['Jane Smith', 'John Doe']);
      assert.deepEqual(manager.getAllManagers(), ['Alex Rivera']);
    });

    it('returns direct staff projections, divisions, and retained legacy coaches', () => {
      const data = createSampleTeamsData();
      data.teams[0].division = 'Division 1';
      data.teams[1].division = 'Division 2';
      data.teams[1].coach = 'Legacy Coach';
      manager.loadData(data);
      const firstTeam = manager.getTeam('Bryant Woods Barracudas');

      assert.deepEqual(manager.getTeamCoaches(firstTeam), firstTeam.getCoaches());
      assert.deepEqual(manager.getTeamManagers(firstTeam), firstTeam.getManagers());
      assert.deepEqual(manager.getTeamContacts(firstTeam), firstTeam.getContacts());
      assert.deepEqual(manager.getTeamsByDivision('Division 1').map(team => team.name), ['Bryant Woods Barracudas']);
      assert.deepEqual(manager.getAllDivisions(), ['Division 1', 'Division 2']);
      assert.deepEqual(manager.getAllCoaches(), ['Jane Smith', 'John Doe', 'Legacy Coach']);
    });

    it('keeps a public source and verification date for every active team', () => {
      manager.loadData(activeTeamsData);
      const teams = manager.getAllTeams();

      assert.equal(teams.length, 14);
      teams.forEach(team => {
        assert.match(team.staff.sourceUrl, /^https:\/\//);
        assert.match(team.staff.verifiedOn, /^\d{4}-\d{2}-\d{2}$/);
        assert.ok(Array.isArray(team.staff.coaches));
        assert.ok(Array.isArray(team.staff.managers));
        assert.ok(Array.isArray(team.staff.contacts));
      });
    });
  });

  describe('getStatistics', () => {
    it('returns statistics object', () => {
      const data = createSampleTeamsData();
      data.teams[0].division = 'Division 1';
      manager.loadData(data);
      const stats = manager.getStatistics();
      assert.equal(typeof stats, 'object');
      assert.equal(stats.totalTeams, 2);
      assert.equal(stats.totalCoaches, 2);
      assert.equal(stats.totalManagers, 1);
      assert.equal(stats.poolDistribution['Bryant Woods'], 1);
      assert.equal(stats.divisionDistribution['Division 1'], 1);
    });
  });

  describe('getTeamContact', () => {
    it('returns structured staff and the primary home pool', () => {
      manager.loadData(createSampleTeamsData());
      const contact = manager.getTeamContact('Bryant Woods Barracudas');

      assert.equal(contact.poolName, 'Bryant Woods');
      assert.equal(contact.coach, 'Jane Smith');
      assert.equal(contact.email, 'jane@example.com');
      assert.deepEqual(contact.coaches, [{ name: 'Jane Smith', role: 'Head Coach', email: 'jane@example.com' }]);
      assert.deepEqual(contact.managers, [{ name: 'Alex Rivera', role: 'Team Manager' }]);
      assert.deepEqual(contact.contacts, [{ audience: 'managers', label: 'Team managers', email: 'managers@example.com' }]);
    });

    it('returns null for an unpublished team', () => {
      assert.equal(manager.getTeamContact('Unknown Team'), null);
    });
  });

  describe('rosters, schedules, exports, and mutations', () => {
    it('returns optional roster and schedule collections with absent-data fallbacks', () => {
      const data = createSampleTeamsData();
      data.teams[0].roster = [{ name: 'Swimmer' }];
      data.teams[0].schedule = [{ date: '2026-06-20' }];
      manager.loadData(data);

      assert.deepEqual(manager.getTeamRoster('Bryant Woods Barracudas'), [{ name: 'Swimmer' }]);
      assert.deepEqual(manager.getTeamSchedule('Bryant Woods Barracudas'), [{ date: '2026-06-20' }]);
      assert.equal(manager.getTeamRoster('Unknown Team'), null);
      assert.deepEqual(manager.getTeamSchedule('Unknown Team'), []);
    });

    it('adds, updates, removes, and exports model-backed teams', () => {
      manager.addOrUpdateTeam({ name: 'Added Team', homePools: ['New Pool'] });
      const existing = new Team({ name: 'Existing Team' });
      manager.addOrUpdateTeam(existing);
      manager.addOrUpdateTeam(null);

      assert.equal(manager.getTeam('Added Team') instanceof Team, true);
      assert.equal(manager.getTeam('Existing Team'), existing);
      assert.equal(manager.exportData().teams.length, 2);
      assert.equal(manager.removeTeam('Added Team'), true);
      assert.equal(manager.removeTeam('Missing Team'), false);
    });
  });

  describe('getTeamsSummary', () => {
    it('returns summary array with expected fields', () => {
      manager.loadData(createSampleTeamsData());
      const summaries = manager.getTeamsSummary();
      assert.equal(summaries.length, 2);
      assert.ok('name' in summaries[0]);
      assert.ok('poolName' in summaries[0]);
      assert.ok('division' in summaries[0]);
      assert.equal(summaries[0].coach, 'Jane Smith');
      assert.deepEqual(summaries[0].managers, [{ name: 'Alex Rivera', role: 'Team Manager' }]);
      assert.deepEqual(summaries[0].contacts, [{ audience: 'managers', label: 'Team managers', email: 'managers@example.com' }]);
    });
  });

  describe('clearData', () => {
    it('clears all loaded data', () => {
      manager.loadData(createSampleTeamsData());
      assert.equal(manager.isDataLoaded(), true);
      manager.clearData();
      assert.equal(manager.isDataLoaded(), false);
    });
  });

  describe('browser registration', () => {
    it('installs the manager as a browser script global', () => {
      const sourcePath = path.join(__dirname, '..', '..', 'src', 'js', 'managers', 'teams-manager.js');
      const source = fs.readFileSync(sourcePath, 'utf8');
      const context = { window: {}, Team };
      Object.assign(context, context.globalThis || {}, context.window || {});
      context.globalThis = context; context.self = context; context.window = context;
      vm.runInNewContext(source, context, { filename: sourcePath });

      assert.equal(typeof context.window.TeamsManager, 'function');
      assert.equal(new context.window.TeamsManager().getTeamCount(), 0);
    });
  });
});
