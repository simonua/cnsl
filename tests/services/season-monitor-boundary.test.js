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

  describe('review delegation workflow', () => {
    it('should start issue-free review tasks without forcing a pull request', async () => {
      const repositoryRoot = path.resolve(__dirname, '..', '..');
      const workflow = await fs.readFile(path.join(repositoryRoot, '.github', 'workflows', 'season-data-monitor.yml'), 'utf8');

      assert.match(workflow, /\/agents\/repos\/\$\{GITHUB_REPOSITORY\}\/tasks/);
      assert.match(workflow, /create_pull_request: false/);
      assert.match(workflow, /no review task or pull request was created/);
      assert.doesNotMatch(workflow, /\/repos\/\$\{GITHUB_REPOSITORY\}\/issues/);
    });

    it('should schedule recurring workflows only during May through July with stated cadence', async () => {
      const repositoryRoot = path.resolve(__dirname, '..', '..');
      const workflowsRoot = path.join(repositoryRoot, '.github', 'workflows');
      const workflowFiles = (await fs.readdir(workflowsRoot)).filter((fileName) => fileName.endsWith('.yml'));
      const workflowDefinitions = await Promise.all(workflowFiles.map(async (fileName) => {
        return fs.readFile(path.join(workflowsRoot, fileName), 'utf8');
      }));
      const [monitor, browser, audit] = await Promise.all([
        fs.readFile(path.join(workflowsRoot, 'season-data-monitor.yml'), 'utf8'),
        fs.readFile(path.join(workflowsRoot, 'nightly-browser-verification.yml'), 'utf8'),
        fs.readFile(path.join(workflowsRoot, 'refactoring-audit.yml'), 'utf8')
      ]);

      const recurringSchedules = workflowDefinitions.flatMap((workflow) => {
        return [...workflow.matchAll(/cron: '([^']+)'/g)].map((match) => match[1]);
      });
      assert.ok(recurringSchedules.length > 0);
      recurringSchedules.forEach((schedule) => {
        assert.strictEqual(schedule.split(/\s+/)[3], '5-7');
      });

      assert.match(monitor, /Runs daily at 05:17 UTC during May, June, and July only/);
      assert.match(monitor, /cron: '17 5 \* 5-7 \*'/);
      assert.match(browser, /Runs daily at 05:47 UTC during May, June, and July only/);
      assert.match(browser, /cron: '47 5 \* 5-7 \*'/);
      assert.match(audit, /Runs monthly at 06:41 UTC on the first day of May, June, and July only/);
      assert.match(audit, /cron: '41 6 1 5-7 \*'/);
    });

    it('should prepare a new calendar-year data folder before monitoring prior active data', async () => {
      const repositoryRoot = path.resolve(__dirname, '..', '..');
      const workflow = await fs.readFile(path.join(repositoryRoot, '.github', 'workflows', 'season-data-monitor.yml'), 'utf8');

      assert.match(workflow, /if: steps\.season\.outputs\.ready == 'true'/);
      assert.match(workflow, /CNSL season rollover \[\$\{TARGET_YEAR\}\]/);
      assert.match(workflow, /do not modify `src\/assets\/data\/" \+ \$active_year \+ "`/);
      assert.match(workflow, /create `src\/assets\/data\/" \+ \$target_year \+ "`/);
      assert.match(workflow, /select\(\.state == "open"\)/);
      assert.match(workflow, /No \$\{ACTIVE_YEAR\} annual data was inspected or modified by this scheduled run/);
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