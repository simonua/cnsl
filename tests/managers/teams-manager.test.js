const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { createSampleTeamsData } = require('../helpers/test-helpers.js');
const TeamsManager = require('../../src/js/teams-manager.js');
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

    it('finds teams by practice pool', () => {
      manager.loadData(createSampleTeamsData());
      const results = manager.searchTeams('Running Brook');
      assert.deepEqual(results.map(team => team.name), ['Bryant Woods Barracudas']);
    });
  });

  describe('getTeamsByPool', () => {
    it('finds teams by pool name', () => {
      manager.loadData(createSampleTeamsData());
      const teams = manager.getTeamsByPool('Bryant Woods');
      assert.ok(teams.length > 0);
      assert.equal(teams[0].homePools[0], 'Bryant Woods');
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

    it('keeps a public source and verification date for every active team', () => {
      manager.loadData(activeTeamsData);
      const teams = manager.getAllTeams();

      assert.equal(teams.length, 14);
      teams.forEach(team => {
        assert.match(team.staff.sourceUrl, /^https:\/\//);
        assert.match(team.staff.verifiedOn, /^\d{4}-\d{2}-\d{2}$/);
        assert.ok(Array.isArray(team.staff.coaches));
        assert.ok(Array.isArray(team.staff.managers));
      });
    });
  });

  describe('getStatistics', () => {
    it('returns statistics object', () => {
      manager.loadData(createSampleTeamsData());
      const stats = manager.getStatistics();
      assert.equal(typeof stats, 'object');
      assert.equal(stats.totalTeams, 2);
      assert.equal(stats.totalCoaches, 2);
      assert.equal(stats.totalManagers, 1);
      assert.equal(stats.poolDistribution['Bryant Woods'], 1);
    });
  });

  describe('getTeamContact', () => {
    it('returns structured staff and the primary home pool', () => {
      manager.loadData(createSampleTeamsData());
      const contact = manager.getTeamContact('Bryant Woods Barracudas');

      assert.equal(contact.poolName, 'Bryant Woods');
      assert.equal(contact.coach, 'Jane Smith');
      assert.deepEqual(contact.coaches, [{ name: 'Jane Smith', role: 'Head Coach' }]);
      assert.deepEqual(contact.managers, [{ name: 'Alex Rivera', role: 'Team Manager' }]);
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
});
