const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { describe, it } = require('node:test');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');
const AppConfig = require('../../scripts/adapters/app-config.js');
const {
  TEST_IDENTITIES,
  createTestDataFixture
} = require('../browser/fixtures/test-data.js');

const DATA_ROOT = path.join(__dirname, '..', '..', 'src', 'assets', 'data', String(AppConfig.YEAR));

function readSchema(domain) {
  return JSON.parse(fs.readFileSync(path.join(DATA_ROOT, domain, `${domain}.schema.json`), 'utf8'));
}

describe('shared browser test data', () => {
  it('should satisfy every active annual schema', () => {
    const fixture = createTestDataFixture();
    const ajv = new Ajv({ allErrors: true, strict: false });
    addFormats(ajv);

    for (const domain of ['pools', 'teams', 'meets']) {
      const validate = ajv.compile(readSchema(domain));
      assert.equal(validate(fixture[domain]), true, JSON.stringify(validate.errors, null, 2));
    }
  });

  it('should preserve explicit cross-domain relationships', () => {
    const fixture = createTestDataFixture();
    const primaryTeam = fixture.teams.teams.find(team => team.id === TEST_IDENTITIES.teams.primary.id);
    const contactPool = fixture.pools.pools.find(pool => pool.id === TEST_IDENTITIES.pools.contact.id);
    const primaryMeets = fixture.meets.regular_meets.filter(meet => (
      [meet.home_team, meet.visiting_team].includes(primaryTeam.name)
    ));

    assert.equal(primaryTeam.practice.regular.morning[0].location, `${contactPool.name} Pool`);
    assert.equal(primaryTeam.timeTrialsPool, contactPool.name);
    assert.equal(primaryMeets.length, 3);
    assert.ok(primaryMeets.some(meet => meet.location === `${contactPool.name} Pool`));
  });

  it('should return an isolated document graph for each scenario', () => {
    const firstFixture = createTestDataFixture();
    const secondFixture = createTestDataFixture();

    firstFixture.pools.pools[0].name = 'Changed by one test';
    firstFixture.teams.teams[0].practice.preseason[0].sessions[0].group = 'Changed group';

    assert.equal(secondFixture.pools.pools[0].name, TEST_IDENTITIES.pools.contact.name);
    assert.equal(secondFixture.teams.teams[0].practice.preseason[0].sessions[0].group, 'First Splash');
  });
});
