const { afterEach, describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  acquirePlaywrightLock,
  getDefaultLockDirectory,
  releasePlaywrightLock
} = require('../../scripts/playwright-run-lock.js');

const temporaryDirectories = [];

function createLockDirectory() {
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'cnsl-playwright-lock-test-'));
  temporaryDirectories.push(temporaryDirectory);
  return path.join(temporaryDirectory, 'browser-test.lock');
}

afterEach(() => {
  for (const temporaryDirectory of temporaryDirectories.splice(0)) {
    fs.rmSync(temporaryDirectory, { force: true, recursive: true });
  }
});

describe('PlaywrightRunLock', () => {
  it('should use separate default locks for separate workspaces', () => {
    assert.notEqual(getDefaultLockDirectory('first-workspace'), getDefaultLockDirectory('second-workspace'));
  });

  it('should wait for an active owner before acquiring the lock', () => {
    const lockDirectory = createLockDirectory();
    const firstLock = acquirePlaywrightLock({
      lockDirectory,
      log: () => {},
      processId: 101,
      token: 'first-run'
    });
    const logMessages = [];
    let didWait = false;

    const secondLock = acquirePlaywrightLock({
      isProcessAlive: processId => processId === 101,
      lockDirectory,
      log: message => logMessages.push(message),
      processId: 202,
      sleep: () => {
        didWait = true;
        assert.equal(releasePlaywrightLock(firstLock), true);
      },
      token: 'second-run'
    });

    assert.equal(didWait, true);
    assert.match(logMessages[0], /waiting for it to finish/);
    assert.equal(releasePlaywrightLock(secondLock), true);
  });

  it('should recover a lock whose owner is no longer running', () => {
    const lockDirectory = createLockDirectory();
    const abandonedLock = acquirePlaywrightLock({
      lockDirectory,
      log: () => {},
      processId: 303,
      token: 'abandoned-run'
    });
    const logMessages = [];

    const replacementLock = acquirePlaywrightLock({
      isProcessAlive: () => false,
      lockDirectory,
      log: message => logMessages.push(message),
      processId: 404,
      token: 'replacement-run'
    });

    assert.equal(releasePlaywrightLock(abandonedLock), false);
    assert.match(logMessages[0], /Recovered an abandoned/);
    assert.equal(releasePlaywrightLock(replacementLock), true);
  });
});