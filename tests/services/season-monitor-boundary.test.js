const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');

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

  describe('retired review automation', () => {
    it('should keep automatic review workflows absent while preserving the browser schedule', async () => {
      const repositoryRoot = path.resolve(__dirname, '..', '..');
      const workflowsRoot = path.join(repositoryRoot, '.github', 'workflows');
      const workflowFiles = (await fs.readdir(workflowsRoot)).filter((fileName) => fileName.endsWith('.yml'));
      const workflowDefinitions = await Promise.all(workflowFiles.map(async (fileName) => {
        return fs.readFile(path.join(workflowsRoot, fileName), 'utf8');
      }));
      const browser = await fs.readFile(path.join(workflowsRoot, 'nightly-browser-verification.yml'), 'utf8');

      await Promise.all([
        assert.rejects(fs.access(path.join(workflowsRoot, 'season-data-monitor.yml')), { code: 'ENOENT' }),
        assert.rejects(fs.access(path.join(workflowsRoot, 'refactoring-audit.yml')), { code: 'ENOENT' })
      ]);

      const recurringSchedules = workflowDefinitions.flatMap((workflow) => {
        return [...workflow.matchAll(/cron: '([^']+)'/g)].map((match) => match[1]);
      });
      assert.ok(recurringSchedules.length > 0);
      recurringSchedules.forEach((schedule) => {
        assert.strictEqual(schedule.split(/\s+/)[3], '5-7');
      });

      assert.match(browser, /Runs daily at 05:47 UTC during May, June, and July only/);
      assert.match(browser, /cron: '47 5 \* 5-7 \*'/);
      assert.match(browser, /workflow_dispatch:/);
      assert.match(browser, /Running browser verification requested through workflow dispatch/);
      assert.match(browser, /date --utc --date='24 hours ago'/);
      assert.match(browser, /actions\/workflows\/build-deploy\.yml\/runs/);
      assert.match(browser, /-f event='push'/);
      assert.match(browser, /-f branch='main'/);
      assert.doesNotMatch(workflowFiles.join('\n'), /season-data-monitor|refactoring-audit/);
    });

    it('should require categorized property-level descriptions for material data pull requests', async () => {
      const repositoryRoot = path.resolve(__dirname, '..', '..');
      const reviewer = await fs.readFile(path.join(repositoryRoot, '.github', 'agents', 'season-data-reviewer.agent.md'), 'utf8');

      assert.match(reviewer, /## Data Changes/);
      assert.match(reviewer, /### Pools/);
      assert.match(reviewer, /### Teams/);
      assert.match(reviewer, /### Meets/);
      assert.match(reviewer, /\*\*Practice times:\*\*/);
      assert.match(reviewer, /Do not list raw page fingerprint changes as data changes/);
    });
  });
});