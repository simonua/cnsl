const { afterEach, describe, it } = require('node:test');
const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  acquirePlaywrightLock,
  clearPlaywrightLockEnvironment,
  getPlaywrightLockFromEnvironment,
  getDefaultLockDirectory,
  ownsPlaywrightLock,
  releasePlaywrightLock,
  setPlaywrightLockEnvironment,
  updatePlaywrightLock
} = require('../../scripts/playwright-run-lock.js');

const temporaryDirectories = [];

function createLockDirectory() {
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'cnsl-playwright-lock-test-'));
  temporaryDirectories.push(temporaryDirectory);
  return path.join(temporaryDirectory, 'browser-test.lock');
}

function waitForChildMessage(child, expectedType) {
  return new Promise((resolve, reject) => {
    function handleMessage(message) {
      if (message.type !== expectedType) return;
      cleanup();
      resolve(message);
    }

    function handleExit(code) {
      cleanup();
      reject(new Error(`Child process exited with code ${code} before sending ${expectedType}.`));
    }

    function cleanup() {
      child.off('message', handleMessage);
      child.off('exit', handleExit);
    }

    child.on('message', handleMessage);
    child.on('exit', handleExit);
  });
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

  it('should verify and wait for the actual owner process before handing off', async () => {
    const lockDirectory = createLockDirectory();
    const lockModulePath = path.resolve(__dirname, '../../scripts/playwright-run-lock.js');
    const ownerScript = `
      const lockService = require(process.argv[1]);
      const lock = lockService.acquirePlaywrightLock({ lockDirectory: process.argv[2], log: () => {} });
      process.send({ type: 'ready' });
      process.on('message', message => {
        if (message.type !== 'release') return;
        lockService.releasePlaywrightLock(lock);
        process.exit(0);
      });
    `;
    const contenderScript = `
      const lockService = require(process.argv[1]);
      const lock = lockService.acquirePlaywrightLock({
        lockDirectory: process.argv[2],
        log: message => process.send({ type: 'waiting', message })
      });
      process.send({ type: 'acquired' });
      lockService.releasePlaywrightLock(lock);
      process.exit(0);
    `;
    const owner = childProcess.spawn(process.execPath, ['-e', ownerScript, lockModulePath, lockDirectory], {
      stdio: ['ignore', 'ignore', 'inherit', 'ipc']
    });
    let contender;

    try {
      await waitForChildMessage(owner, 'ready');
      contender = childProcess.spawn(process.execPath, ['-e', contenderScript, lockModulePath, lockDirectory], {
        stdio: ['ignore', 'ignore', 'inherit', 'ipc']
      });
      const waitingMessage = await waitForChildMessage(contender, 'waiting');
      assert.match(waitingMessage.message, /waiting for it to finish/);

      const acquired = waitForChildMessage(contender, 'acquired');
      owner.send({ type: 'release' });
      await acquired;
    } finally {
      if (!owner.killed) owner.kill();
      if (contender && !contender.killed) contender.kill();
    }
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

  it('should recover immediately when a process ID belongs to a different process instance', () => {
    const lockDirectory = createLockDirectory();
    const abandonedLock = acquirePlaywrightLock({
      lockDirectory,
      log: () => {},
      processId: 505,
      processIdentity: 'original-process',
      token: 'reused-pid-run'
    });
    let didWait = false;

    const replacementLock = acquirePlaywrightLock({
      getProcessIdentity: () => 'replacement-process',
      isProcessAlive: () => true,
      lockDirectory,
      log: () => {},
      processId: 606,
      processIdentity: 'replacement-runner',
      sleep: () => {
        didWait = true;
      },
      token: 'replacement-run'
    });

    assert.equal(didWait, false);
    assert.equal(releasePlaywrightLock(abandonedLock), false);
    assert.equal(releasePlaywrightLock(replacementLock), true);
  });

  it('should terminate a verified Playwright owner after its progress becomes stale', () => {
    const lockDirectory = createLockDirectory();
    let currentTime = Date.parse('2026-06-17T12:00:00.000Z');
    let ownerAlive = true;
    const staleLock = acquirePlaywrightLock({
      lockDirectory,
      log: () => {},
      now: () => currentTime,
      processId: 707,
      processIdentity: 'stale-process',
      token: 'stale-run'
    });
    currentTime += 90000;
    const terminatedProcessIds = [];

    const replacementLock = acquirePlaywrightLock({
      getProcessIdentity: processId => processId === 707 ? 'stale-process' : 'replacement-process',
      isProcessAlive: processId => processId === 707 ? ownerAlive : true,
      lockDirectory,
      log: () => {},
      now: () => currentTime,
      processId: 808,
      processIdentity: 'replacement-process',
      sleep: () => {},
      terminateProcessTree: processId => {
        terminatedProcessIds.push(processId);
        ownerAlive = false;
        return true;
      },
      token: 'replacement-run'
    });

    assert.deepEqual(terminatedProcessIds, [707]);
    assert.equal(releasePlaywrightLock(staleLock), false);
    assert.equal(releasePlaywrightLock(replacementLock), true);
  });

  it('should refresh progress and share lock ownership through the environment', () => {
    const lockDirectory = createLockDirectory();
    const environment = {};
    const lock = acquirePlaywrightLock({
      lockDirectory,
      log: () => {},
      processId: 909,
      token: 'progress-run'
    });

    setPlaywrightLockEnvironment(lock, environment);
    assert.deepEqual(getPlaywrightLockFromEnvironment(environment), lock);
    assert.equal(ownsPlaywrightLock(lock), true);
    assert.equal(updatePlaywrightLock(lock, { status: 'test-running' }), true);

    clearPlaywrightLockEnvironment(lock, environment);
    assert.equal(getPlaywrightLockFromEnvironment(environment), null);
    assert.equal(releasePlaywrightLock(lock), true);
    assert.equal(updatePlaywrightLock(lock, { status: 'completed' }), false);
  });
});
