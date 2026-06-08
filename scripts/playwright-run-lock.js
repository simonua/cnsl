'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const LOCK_METADATA_FILE = 'owner.json';
const RECOVERY_FILE = 'recovery.lock';
const DEFAULT_POLL_INTERVAL_MS = 1000;
const DEFAULT_METADATA_GRACE_PERIOD_MS = 5000;

function getDefaultLockDirectory(workspaceDirectory = path.resolve(__dirname, '..')) {
  const workspaceKey = crypto.createHash('sha256').update(path.resolve(workspaceDirectory)).digest('hex').slice(0, 16);
  return path.join(os.tmpdir(), `cnsl-playwright-${workspaceKey}.lock`);
}

function sleep(milliseconds) {
  const waitBuffer = new SharedArrayBuffer(4);
  Atomics.wait(new Int32Array(waitBuffer), 0, 0, milliseconds);
}

function isProcessAlive(processId) {
  try {
    process.kill(processId, 0);
    return true;
  } catch (error) {
    return error.code !== 'ESRCH';
  }
}

function readOwner(lockDirectory) {
  try {
    const metadataPath = path.join(lockDirectory, LOCK_METADATA_FILE);
    return JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT' || error.name === 'SyntaxError') return null;
    throw error;
  }
}

function isRecentLock(lockDirectory, currentTime, gracePeriodMilliseconds) {
  try {
    return currentTime - fs.statSync(lockDirectory).mtimeMs < gracePeriodMilliseconds;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

function claimAbandonedLock(lockDirectory, abandonedOwner, options) {
  const recoveryPath = path.join(lockDirectory, RECOVERY_FILE);
  let recoveryHandle;

  try {
    recoveryHandle = fs.openSync(recoveryPath, 'wx');
    fs.closeSync(recoveryHandle);
  } catch (error) {
    if (recoveryHandle !== undefined) fs.closeSync(recoveryHandle);
    if (error.code === 'EEXIST' || error.code === 'ENOENT') return false;
    throw error;
  }

  const currentOwner = readOwner(lockDirectory);
  const sameAbandonedOwner = abandonedOwner && currentOwner && abandonedOwner.token === currentOwner.token && !options.processAlive(currentOwner.pid);
  const stillOwnerless = !abandonedOwner && !currentOwner && !isRecentLock(lockDirectory, options.currentTime(), options.gracePeriodMilliseconds);

  if (!sameAbandonedOwner && !stillOwnerless) {
    fs.rmSync(recoveryPath, { force: true });
    return false;
  }

  fs.rmSync(lockDirectory, { force: true, recursive: true });
  return true;
}

function acquirePlaywrightLock(options = {}) {
  const lockDirectory = options.lockDirectory || getDefaultLockDirectory();
  const pollIntervalMilliseconds = options.pollIntervalMilliseconds ?? DEFAULT_POLL_INTERVAL_MS;
  const metadataGracePeriodMilliseconds = options.metadataGracePeriodMilliseconds ?? DEFAULT_METADATA_GRACE_PERIOD_MS;
  const wait = options.sleep || sleep;
  const processAlive = options.isProcessAlive || isProcessAlive;
  const log = options.log || console.log;
  const currentTime = options.now || Date.now;
  const owner = {
    pid: options.processId || process.pid,
    startedAt: new Date(currentTime()).toISOString(),
    token: options.token || crypto.randomUUID()
  };
  let hasReportedWaiting = false;

  fs.mkdirSync(path.dirname(lockDirectory), { recursive: true });

  while (true) {
    try {
      fs.mkdirSync(lockDirectory);
      fs.writeFileSync(path.join(lockDirectory, LOCK_METADATA_FILE), JSON.stringify(owner));
      return { lockDirectory, token: owner.token };
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }

    const activeOwner = readOwner(lockDirectory);
    if (activeOwner && Number.isSafeInteger(activeOwner.pid) && processAlive(activeOwner.pid)) {
      if (!hasReportedWaiting) {
        log(`Another Playwright run is active in this workspace (PID ${activeOwner.pid}); waiting for it to finish.`);
        hasReportedWaiting = true;
      }
      wait(pollIntervalMilliseconds);
      continue;
    }

    if (!activeOwner && isRecentLock(lockDirectory, currentTime(), metadataGracePeriodMilliseconds)) {
      if (!hasReportedWaiting) {
        log('Another Playwright run is acquiring the workspace lock; waiting for it to finish.');
        hasReportedWaiting = true;
      }
      wait(pollIntervalMilliseconds);
      continue;
    }

    if (claimAbandonedLock(lockDirectory, activeOwner, {
      currentTime,
      gracePeriodMilliseconds: metadataGracePeriodMilliseconds,
      processAlive
    })) {
      log('Recovered an abandoned Playwright workspace lock from an interrupted run.');
    } else {
      wait(pollIntervalMilliseconds);
    }
  }
}

function releasePlaywrightLock(lock) {
  const owner = readOwner(lock.lockDirectory);
  if (!owner || owner.token !== lock.token) return false;

  fs.rmSync(lock.lockDirectory, { force: true, recursive: true });
  return true;
}

module.exports = {
  acquirePlaywrightLock,
  getDefaultLockDirectory,
  releasePlaywrightLock
};
