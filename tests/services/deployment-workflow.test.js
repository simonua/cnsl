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
});