const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createSampleTeamsData } = require('../helpers/test-helpers.js');
const { Team } = require('../helpers/browser-module-loader.js').loadBrowserModule('team');

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
    const minimalTeam = new Team({ name: 'Minimal Team', homePools: ['Home Pool'] });

    assert.equal(minimalTeam.getPrimaryPoolName(), 'Home Pool');
    assert.equal(minimalTeam.includesPool('Home Pool'), true);
    assert.equal(minimalTeam.includesCoach('missing'), false);
    assert.equal(minimalTeam.matchesSearchTerm('minimal'), true);
    assert.deepEqual(minimalTeam.getManagers(), []);
    assert.deepEqual(minimalTeam.getContacts(), []);
    assert.deepEqual(minimalTeam.getContactInfo(), {
      teamName: 'Minimal Team', coaches: [], managers: [], contacts: [], coach: 'Not specified', email: 'Not available', poolName: 'Home Pool'
    });
    assert.ok(new Team().getContactInfo().poolName.length > 0);
  });

  it('uses shared contacts and default summary values when optional fields are absent', () => {
    const contactTeam = new Team({ name: 'Contacts', staff: { contacts: [{ email: 'shared@example.com' }], managers: [{ name: 'Manager' }] } });
    const blankTeam = new Team({ name: 'Blank', staff: { coaches: [{ name: 'No Email' }], managers: [] } });
    assert.equal(contactTeam.getContactInfo().email, 'shared@example.com');
    assert.equal(contactTeam.matchesSearchTerm('shared@example.com'), true);
    assert.equal(blankTeam.getContactInfo().coach, 'No Email');
    assert.ok(blankTeam.getContactInfo().email.length > 0);
    assert.equal(blankTeam.getSummary().contact.hasEmail, false);
    assert.equal(blankTeam.includesPool('Unknown'), false);
    assert.equal(blankTeam.includesCoach('missing'), false);
    assert.equal(blankTeam.matchesSearchTerm('missing'), false);
  });

  it('ignores unpublished compatibility fields and handles an absent query', () => {
    const compatibilityRecord = new Team({ poolName: 'Legacy Pool', coach: 'Legacy Coach', division: 'Legacy Division' });
    assert.equal(compatibilityRecord.matchesSearchTerm('legacy'), false);
    assert.equal(Object.hasOwn(compatibilityRecord, 'poolName'), false);
    assert.equal(Object.hasOwn(compatibilityRecord, 'coach'), false);
    assert.equal(Object.hasOwn(compatibilityRecord, 'division'), false);
    assert.equal(new Team().includesCoach(), false);
    assert.equal(new Team().matchesSearchTerm(), true);
    assert.ok(new Team().getSummary().poolName.length > 0);
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
