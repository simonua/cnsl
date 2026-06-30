const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');

const {
  findUnexpectedChanges,
  isAllowedBaselinePath,
  isAllowedEvidencePath
} = require('../../scripts/validate-season-monitor-boundary');

describe('season monitor evidence boundary', () => {
  describe('isAllowedEvidencePath', () => {
    it('should accept only active-season official evidence PDF paths', () => {
      assert.equal(isAllowedEvidencePath('src/assets/data/2026/pools/pool-schedules/bwp/2026-06-19/Bryant Woods.pdf', '2026'), true);
      assert.equal(isAllowedEvidencePath('src/assets/data/2026/meets/meet-schedules/meets.pdf', '2026'), true);
      assert.equal(isAllowedEvidencePath('src/assets/data/2026/teams/team-schedules/practice.pdf', '2026'), true);
      assert.equal(isAllowedEvidencePath('src/assets/data/2026/teams/teams.json', '2026'), false);
      assert.equal(isAllowedEvidencePath('src/assets/data/2025/teams/team-schedules/practice.pdf', '2026'), false);
      assert.equal(isAllowedEvidencePath('src/assets/data/2026/pools/pool-schedules/Bryant Woods.pdf', '2026'), false);
      assert.equal(isAllowedEvidencePath('src/assets/data/2026/pools/pool-schedules/bwp/not-a-date/Bryant Woods.pdf', '2026'), false);
      assert.equal(isAllowedEvidencePath('src/assets/data/2026/pools/pool-schedules/bwp/2026-02-30/Bryant Woods.pdf', '2026'), false);
      assert.equal(isAllowedEvidencePath('src/assets/data/2026/teams/team-schedules/nested/practice.pdf', '2026'), false);
    });
  });

  describe('findUnexpectedChanges', () => {
    it('should report protected annual paths and reject invalid season input', () => {
      assert.deepEqual(findUnexpectedChanges([
        'src/assets/data/2026/teams/team-schedules/practice.pdf',
        'src/assets/data/2026/teams/teams.json'
      ], '2026'), ['src/assets/data/2026/teams/teams.json']);
      assert.throws(() => findUnexpectedChanges([], '../2026'));
    });

    it('should allow only the reviewed source baseline in automatic pull requests', () => {
      assert.equal(isAllowedBaselinePath('.github/automation/season-data-monitor/source-state.json'), true);
      assert.equal(isAllowedBaselinePath('src/assets/data/2026/pools/pools.json'), false);
      assert.deepEqual(findUnexpectedChanges([
        '.github/automation/season-data-monitor/source-state.json',
        'src/assets/data/2026/pools/pools.json'
      ], '2026', 'baseline'), ['src/assets/data/2026/pools/pools.json']);
      assert.throws(() => findUnexpectedChanges([], '2026', 'unknown'));
    });
  });

  describe('scheduled deterministic automation', () => {
    it('should schedule seasonal checks and preserve the manual refactoring audit', async () => {
      const repositoryRoot = path.resolve(__dirname, '..', '..');
      const workflowsRoot = path.join(repositoryRoot, '.github', 'workflows');
      const workflowFiles = (await fs.readdir(workflowsRoot)).filter((fileName) => fileName.endsWith('.yml'));
      const workflowDefinitions = await Promise.all(workflowFiles.map(async (fileName) => {
        return fs.readFile(path.join(workflowsRoot, fileName), 'utf8');
      }));
      const packageDefinition = JSON.parse(await fs.readFile(path.join(repositoryRoot, 'package.json'), 'utf8'));
      const browser = await fs.readFile(path.join(workflowsRoot, 'browser-verification.yml'), 'utf8');
      const refactoringAudit = await fs.readFile(path.join(workflowsRoot, 'refactoring-audit.yml'), 'utf8');
      const seasonMonitor = await fs.readFile(path.join(workflowsRoot, 'season-data-monitor.yml'), 'utf8');

      assert.match(browser, /^name: Scheduled Test Verification$/m);
      assert.match(browser, /pnpm run test:coverage/);
      assert.match(browser, /pnpm run test:browser:complete/);
      assert.match(packageDefinition.scripts['test:coverage'], /--test-coverage-lines=100/);
      assert.match(packageDefinition.scripts['test:coverage'], /--test-coverage-functions=100/);
      assert.match(packageDefinition.scripts['test:coverage'], /--test-coverage-branches=100/);
      assert.match(browser, /issues: write/);
      assert.match(browser, /id: unit_coverage[\s\S]*?continue-on-error: true/);
      assert.match(browser, /id: browser_tests[\s\S]*?continue-on-error: true/);
      assert.match(browser, /steps\.unit_coverage\.outcome == 'failure'/);
      assert.match(browser, /steps\.browser_tests\.outcome == 'failure'/);
      assert.match(browser, /Scheduled test verification failure/);
      assert.match(browser, /TEST_VERIFICATION_RECIPIENT: simonua/);
      assert.match(browser, /gh issue create/);
      assert.match(browser, /gh issue comment/);
      assert.match(browser, /gh issue edit "\$issue_url" --add-assignee "\$TEST_VERIFICATION_RECIPIENT"/);
      assert.match(browser, /gh issue close/);
      assert.match(browser, /name: Fail scheduled test verification/);
      assert.deepEqual(workflowFiles.filter((fileName) => fileName.endsWith('browser-verification.yml')), ['browser-verification.yml']);

      const seasonalSchedules = [browser, seasonMonitor].flatMap((workflow) => {
        return [...workflow.matchAll(/cron: '([^']+)'/g)].map((match) => match[1]);
      });
      assert.ok(seasonalSchedules.length > 0);
      seasonalSchedules.forEach((schedule) => {
        assert.strictEqual(schedule.split(/\s+/)[3], '5-7');
      });

      assert.match(browser, /Runs nightly at 05:47 UTC during May, June, and July only/);
      assert.match(browser, /cron: '47 5 \* 5-7 \*'/);
      assert.match(browser, /workflow_dispatch:/);
      assert.match(browser, /Running browser verification requested through workflow dispatch/);
      assert.match(browser, /date --utc --date='7 days ago'/);
      assert.match(browser, /actions\/workflows\/build-deploy\.yml\/runs/);
      assert.match(browser, /-f event='push'/);
      assert.match(browser, /-f branch='main'/);
      assert.match(seasonMonitor, /cron: '17 5 \* 5-7 \*'/);
      assert.match(seasonMonitor, /workflow_dispatch:/);
      assert.match(seasonMonitor, /--season-only --report --refresh-baseline/);
      assert.match(seasonMonitor, /validate-season-monitor-boundary\.js "\$SEASON" baseline/);
      assert.match(seasonMonitor, /source-state\.json/);
      assert.match(seasonMonitor, /gh issue create/);
      assert.match(seasonMonitor, /SEASON_MONITOR_RECIPIENT: simonua/);
      assert.match(seasonMonitor, /gh issue edit "\$issue_url" --add-assignee "\$SEASON_MONITOR_RECIPIENT"/);
      assert.match(seasonMonitor, /gh pr create/);
      assert.match(seasonMonitor, /--assignee "\$SEASON_MONITOR_RECIPIENT"/);
      assert.match(seasonMonitor, /--reviewer "\$SEASON_MONITOR_RECIPIENT"/);
      assert.match(seasonMonitor, /if: always\(\)/);
      assert.match(seasonMonitor, /name: Summarize monitor result/);
      assert.match(seasonMonitor, /GITHUB_STEP_SUMMARY/);
      assert.doesNotMatch(seasonMonitor, /SMTP_|SEASON_MONITOR_EMAIL|--mail-from|--mail-rcpt/);
      assert.doesNotMatch(seasonMonitor, /copilot-swe-agent|season-data-reviewer\.agent/);
      assert.match(refactoringAudit, /^name: Weekly Refactoring Audit$/m);
      assert.match(refactoringAudit, /workflow_dispatch:/);
      assert.doesNotMatch(refactoringAudit, /^\s+schedule:/m);
      assert.doesNotMatch(refactoringAudit, /cron:/);
      assert.match(refactoringAudit, /COPILOT_AGENT_TOKEN/);
      assert.match(refactoringAudit, /Scheduled refactoring audit/);
      assert.match(refactoringAudit, /REFACTORING_AUDIT_RECIPIENT: simonua/);
      assert.match(refactoringAudit, /copilot-swe-agent\[bot\]/);
      assert.match(refactoringAudit, /custom_agent: "refactoring-auditor"/);
      assert.match(refactoringAudit, /gh issue edit "\$issue_url" --add-assignee "\$REFACTORING_AUDIT_RECIPIENT"/);
      assert.ok(refactoringAudit.includes('Assign the pull request to \\($recipient) and request review from \\($recipient).'));
      assert.match(refactoringAudit, /steps\.pending\.outputs\.exists != 'true'/);
      assert.deepEqual(workflowFiles.filter((fileName) => fileName === 'refactoring-audit.yml'), ['refactoring-audit.yml']);
      assert.ok(workflowDefinitions.includes(refactoringAudit));
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
