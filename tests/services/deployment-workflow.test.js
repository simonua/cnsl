const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repositoryRoot = path.join(__dirname, '..', '..');
const workflowPath = path.join(repositoryRoot, '.github', 'workflows', 'build-deploy.yml');

describe('deployment workflow', () => {
  it('should run for every dependency policy file', () => {
    const workflow = fs.readFileSync(workflowPath, 'utf8');

    [
      'package.json',
      'pnpm-lock.yaml',
      'pnpm-workspace.yaml',
      'scripts/lib/pwa-resource-policy.js'
    ].forEach(policyFile => {
      const escapedPolicyFile = policyFile.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      assert.match(workflow, new RegExp(`^      - '${escapedPolicyFile}'$`, 'm'));
    });
  });

  it('should enable analytics only for the production build and artifact verification', () => {
    const workflow = fs.readFileSync(workflowPath, 'utf8');
    const analyticsDeploymentBlocks = workflow.match(/env:\n\s+CNSL_ANALYTICS_DEPLOYMENT: production/g) || [];

    assert.equal(analyticsDeploymentBlocks.length, 2);
    assert.match(workflow, /- name: Build project\n\s+env:\n\s+CNSL_ANALYTICS_DEPLOYMENT: production\n\s+run: pnpm run build/);
    assert.match(workflow, /- name: Verify PWA artifact contract\n\s+env:\n\s+CNSL_ANALYTICS_DEPLOYMENT: production\n\s+run: pnpm run verify:pwa/);
  });
});