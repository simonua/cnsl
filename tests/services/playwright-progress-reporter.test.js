const { afterEach, describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  acquirePlaywrightLock,
  clearPlaywrightLockEnvironment,
  releasePlaywrightLock,
  setPlaywrightLockEnvironment
} = require('../../scripts/playwright-run-lock.js');
const PlaywrightProgressReporter = require('../../scripts/playwright-progress-reporter.js');

let temporaryDirectory;
let lock;

afterEach(() => {
  if (lock) {
    clearPlaywrightLockEnvironment(lock);
    releasePlaywrightLock(lock);
    lock = null;
  }
  if (temporaryDirectory) {
    fs.rmSync(temporaryDirectory, { force: true, recursive: true });
    temporaryDirectory = null;
  }
});

describe('PlaywrightProgressReporter', () => {
  it('should record each Playwright lifecycle milestone', () => {
    temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'cnsl-playwright-reporter-test-'));
    const lockDirectory = path.join(temporaryDirectory, 'browser-test.lock');
    lock = acquirePlaywrightLock({ lockDirectory, log: () => {} });
    setPlaywrightLockEnvironment(lock);
    const reporter = new PlaywrightProgressReporter();

    for (const callback of ['onBegin', 'onTestBegin', 'onTestEnd', 'onEnd']) {
      reporter[callback]();
    }

    const owner = JSON.parse(fs.readFileSync(path.join(lockDirectory, 'owner.json'), 'utf8'));
    assert.equal(owner.status, 'completed');
  });
});