const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createSampleTeamsData } = require('../helpers/test-helpers.js');
const Team = require('../../src/js/models/team.js');

describe('Team', () => {
  const team = new Team(createSampleTeamsData().teams[0]);

  it('exposes published pools and staff without sharing collection arrays', () => {
    const homePools = team.getHomePools();
    const practicePools = team.getPracticePools();
    const coaches = team.getCoaches();
    homePools.push('Another Pool');
    practicePools.push('Another Pool');
    coaches.push({ name: 'Another Coach' });

    assert.deepEqual(team.getHomePools(), ['Bryant Woods']);
    assert.deepEqual(team.getPracticePools(), ['Bryant Woods', 'Running Brook']);
    assert.deepEqual(team.getCoaches(), [{ name: 'Jane Smith', role: 'Head Coach', email: 'jane@example.com' }]);
  });

  it('matches pool, coach, and searchable public contact information', () => {
    assert.equal(team.includesPool('Running Brook'), true);
    assert.equal(team.includesCoach('Jane'), true);
    assert.equal(team.matchesSearchTerm('managers@example.com'), true);
  });

  it('builds team contact and summary data from published fields', () => {
    assert.equal(team.getContactInfo().poolName, 'Bryant Woods');
    assert.equal(team.getContactInfo().email, 'jane@example.com');
    assert.equal(team.getSummary().contact.hasEmail, true);
  });

  it('returns a team-specific meet-time override when published', () => {
    const configuredTeam = new Team({ meetTimeOverrides: { timeTrials: { start: '08:30', end: '11:30' } } });

    assert.equal(configuredTeam.getMeetTimeOverride('dualMeets'), null);
    assert.deepEqual(configuredTeam.getMeetTimeOverride('timeTrials'), { start: '08:30', end: '11:30' });
  });

  it('provides stable empty/default projections for optional published data', () => {
    const minimalTeam = new Team({ name: 'Minimal Team', poolName: 'Legacy Pool', coach: 'Legacy Coach', email: 'team@example.com', phone: '410-555-0100', roster: [{}], schedule: [{}], division: 'A' });

    assert.equal(minimalTeam.getPrimaryPoolName(), 'Legacy Pool');
    assert.equal(minimalTeam.includesPool('Legacy Pool'), true);
    assert.equal(minimalTeam.includesCoach('legacy'), true);
    assert.equal(minimalTeam.matchesSearchTerm('a'), true);
    assert.deepEqual(minimalTeam.getManagers(), []);
    assert.deepEqual(minimalTeam.getContacts(), []);
    assert.deepEqual(minimalTeam.getContactInfo(), {
      teamName: 'Minimal Team', coaches: [], managers: [], contacts: [], coach: 'Legacy Coach', email: 'team@example.com', phone: '410-555-0100', poolName: 'Legacy Pool'
    });
    assert.equal(minimalTeam.getSummary().memberCount, 1);
    assert.equal(minimalTeam.getSummary().hasSchedule, true);
    assert.equal(minimalTeam.getSummary().contact.hasPhone, true);
    assert.equal(new Team().getContactInfo().poolName, 'Not specified');
  });

  it('uses shared contacts and default summary values when legacy fields are absent', () => {
    const contactTeam = new Team({ name: 'Contacts', staff: { contacts: [{ email: 'shared@example.com' }], managers: [{ name: 'Manager' }] } });
    const blankTeam = new Team({ name: 'Blank', staff: { coaches: [{ name: 'No Email' }], managers: [] } });
    assert.equal(contactTeam.getContactInfo().email, 'shared@example.com');
    assert.equal(contactTeam.matchesSearchTerm('shared@example.com'), true);
    assert.equal(blankTeam.getContactInfo().coach, 'No Email');
    assert.equal(blankTeam.getContactInfo().email, 'Not available');
    assert.equal(blankTeam.getSummary().division, 'Not specified');
    assert.equal(blankTeam.getSummary().memberCount, 0);
    assert.equal(blankTeam.getSummary().hasSchedule, false);
    assert.equal(blankTeam.getSummary().contact.hasEmail, false);
    assert.equal(blankTeam.includesPool('Unknown'), false);
    assert.equal(blankTeam.includesCoach('missing'), false);
    assert.equal(blankTeam.matchesSearchTerm('missing'), false);
  });

  it('installs the model as a browser script global', () => {
    const sourcePath = path.join(__dirname, '..', '..', 'src', 'js', 'models', 'team.js');
    const source = fs.readFileSync(sourcePath, 'utf8');
    const context = { window: {} };
    vm.runInNewContext(source, context, { filename: sourcePath });

    assert.equal(typeof context.window.Team, 'function');
    assert.equal(new context.window.Team({ name: 'Browser Team' }).name, 'Browser Team');
  });
});