const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { createSampleTeamsData } = require('../helpers/test-helpers.js');
const TeamsManager = require('../../src/js/teams-manager.js');

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
  });

  describe('getTeamsByPool', () => {
    it('finds teams by pool name', () => {
      manager.loadData(createSampleTeamsData());
      const teams = manager.getTeamsByPool('Bryant Woods');
      assert.ok(teams.length > 0);
      assert.equal(teams[0].poolName, 'Bryant Woods');
    });
  });

  describe('getStatistics', () => {
    it('returns statistics object', () => {
      manager.loadData(createSampleTeamsData());
      const stats = manager.getStatistics();
      assert.equal(typeof stats, 'object');
      assert.equal(stats.totalTeams, 2);
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
