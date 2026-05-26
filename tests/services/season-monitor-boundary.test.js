const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { findUnexpectedChanges, isAllowedEvidencePath } = require('../../scripts/validate-season-monitor-boundary');

describe('season monitor evidence boundary', () => {
  describe('isAllowedEvidencePath', () => {
    it('should accept only active-season official evidence PDF paths', () => {
      assert.equal(isAllowedEvidencePath('src/assets/data/2026/pools/pool-schedules/pool schedule.pdf', '2026'), true);
      assert.equal(isAllowedEvidencePath('src/assets/data/2026/meets/meet-schedules/meets.pdf', '2026'), true);
      assert.equal(isAllowedEvidencePath('src/assets/data/2026/teams/team-schedules/practice.pdf', '2026'), true);
      assert.equal(isAllowedEvidencePath('src/assets/data/2026/teams/teams.json', '2026'), false);
      assert.equal(isAllowedEvidencePath('src/assets/data/2025/teams/team-schedules/practice.pdf', '2026'), false);
      assert.equal(isAllowedEvidencePath('src/assets/data/2026/teams/team-schedules/nested/practice.pdf', '2026'), false);
    });
  });

  describe('findUnexpectedChanges', () => {
    it('should report protected annual paths and reject invalid season input', () => {
      assert.deepEqual(findUnexpectedChanges([
        'src/assets/data/2026/teams/team-schedules/practice.pdf',
        'src/assets/data/2026/teams/teams.json'
      ], '2026'), ['src/assets/data/2026/teams/teams.json']);
      assert.throws(() => findUnexpectedChanges([], '../2026'), /Invalid season output/);
    });
  });
});