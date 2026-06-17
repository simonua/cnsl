'use strict';

const crypto = require('node:crypto');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { performance } = require('node:perf_hooks');

const LOCK_METADATA_FILE = 'owner.json';
const RECOVERY_FILE = 'recovery.lock';
const PLAYWRIGHT_OWNER_KIND = 'cnsl-playwright';
const DEFAULT_POLL_INTERVAL_MS = 500;
const DEFAULT_METADATA_GRACE_PERIOD_MS = 2000;
const DEFAULT_STALE_PROGRESS_TIMEOUT_MS = 90000;
const LOCK_DIRECTORY_ENVIRONMENT_VARIABLE = 'CNSL_PLAYWRIGHT_LOCK_DIRECTORY';
const LOCK_TOKEN_ENVIRONMENT_VARIABLE = 'CNSL_PLAYWRIGHT_LOCK_TOKEN';

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

function getLinuxProcessIdentity(processId) {
  const processDirectory = path.join('/proc', String(processId));
  const stat = fs.readFileSync(path.join(processDirectory, 'stat'), 'utf8');
  const statFields = stat.slice(stat.lastIndexOf(') ') + 2).trim().split(/\s+/);
  const startTimeTicks = statFields[19];
  const commandLine = fs.readFileSync(path.join(processDirectory, 'cmdline'), 'utf8').replaceAll('\0', ' ').trim();
  return `${startTimeTicks}|${commandLine}`;
}

function getWindowsProcessIdentity(processId) {
  if (processId === process.pid) {
    return `win32:${Math.floor(performance.timeOrigin / 1000)}`;
  }

  const powershellPath = path.join(
    process.env.SystemRoot || 'C:\\Windows',
    'System32',
    'WindowsPowerShell',
    'v1.0',
    'powershell.exe'
  );
  const command = [
    `$target = Get-CimInstance Win32_Process -Filter "ProcessId = ${processId}"`,
    'if ($null -ne $target) {',
    '  $startedAt = [DateTimeOffset]::new($target.CreationDate)',
    '  Write-Output "win32:$($startedAt.ToUnixTimeSeconds())"',
    '}'
  ].join('; ');

  return childProcess.execFileSync(powershellPath, [
    '-NoLogo',
    '-NoProfile',
    '-NonInteractive',
    '-Command',
    command
  ], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
    windowsHide: true
  }).trim() || null;
}

function getPosixProcessIdentity(processId) {
  return childProcess.execFileSync('ps', [
    '-p',
    String(processId),
    '-o',
    'lstart=',
    '-o',
    'command='
  ], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore']
  }).trim() || null;
}

function getProcessIdentity(processId) {
  try {
    if (process.platform === 'win32') return getWindowsProcessIdentity(processId);
    if (process.platform === 'linux') return getLinuxProcessIdentity(processId);
    return getPosixProcessIdentity(processId);
  } catch {
    return null;
  }
}

function terminateProcessTree(processId) {
  if (process.platform === 'win32') {
    return childProcess.spawnSync('taskkill', ['/PID', String(processId), '/T', '/F'], {
      stdio: 'ignore',
      windowsHide: true
    }).status === 0;
  }

  try {
    process.kill(processId, 'SIGTERM');
    return true;
  } catch (error) {
    return error.code === 'ESRCH';
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

function writeOwner(lockDirectory, owner) {
  fs.writeFileSync(path.join(lockDirectory, LOCK_METADATA_FILE), JSON.stringify(owner));
}

function isRecentLock(lockDirectory, currentTime, gracePeriodMilliseconds) {
  try {
    return currentTime - fs.statSync(lockDirectory).mtimeMs < gracePeriodMilliseconds;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

function inspectOwner(owner, options) {
  if (!owner || !Number.isSafeInteger(owner.pid) || !options.processAlive(owner.pid)) {
    return { active: false, identityVerified: false };
  }

  if (!owner.processIdentity) return { active: true, identityVerified: false };

  const currentProcessIdentity = options.processIdentity(owner.pid);
  if (!currentProcessIdentity) return { active: true, identityVerified: false };

  return {
    active: currentProcessIdentity === owner.processIdentity,
    identityVerified: currentProcessIdentity === owner.processIdentity
  };
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
  const sameAbandonedOwner = abandonedOwner
    && currentOwner
    && abandonedOwner.token === currentOwner.token
    && !inspectOwner(currentOwner, options).active;
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
  const staleProgressTimeoutMilliseconds = options.staleProgressTimeoutMilliseconds ?? DEFAULT_STALE_PROGRESS_TIMEOUT_MS;
  const wait = options.sleep || sleep;
  const processAlive = options.isProcessAlive || isProcessAlive;
  const processIdentity = options.getProcessIdentity || getProcessIdentity;
  const terminate = options.terminateProcessTree || terminateProcessTree;
  const log = options.log || console.log;
  const currentTime = options.now || Date.now;
  const processId = options.processId || process.pid;
  const startedAt = new Date(currentTime()).toISOString();
  const owner = {
    kind: PLAYWRIGHT_OWNER_KIND,
    lastProgressAt: startedAt,
    pid: processId,
    processIdentity: options.processIdentity === undefined
      ? (processId === process.pid ? processIdentity(processId) : null)
      : options.processIdentity,
    startedAt,
    status: 'starting',
    token: options.token || crypto.randomUUID()
  };
  let hasReportedWaiting = false;

  fs.mkdirSync(path.dirname(lockDirectory), { recursive: true });

  while (true) {
    try {
      fs.mkdirSync(lockDirectory);
      writeOwner(lockDirectory, owner);
      return { lockDirectory, token: owner.token };
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }

    const activeOwner = readOwner(lockDirectory);
    const ownerState = inspectOwner(activeOwner, { processAlive, processIdentity });
    if (ownerState.active) {
      const lastProgressTime = Date.parse(activeOwner.lastProgressAt || activeOwner.startedAt);
      const progressAge = Number.isFinite(lastProgressTime) ? currentTime() - lastProgressTime : 0;

      if (
        activeOwner.kind === PLAYWRIGHT_OWNER_KIND
        && ownerState.identityVerified
        && progressAge >= staleProgressTimeoutMilliseconds
      ) {
        log(`Playwright run PID ${activeOwner.pid} has made no progress for ${Math.round(progressAge / 1000)} seconds; terminating its verified process tree.`);
        if (terminate(activeOwner.pid)) {
          wait(pollIntervalMilliseconds);
          continue;
        }
      }

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
      processAlive,
      processIdentity
    })) {
      log('Recovered an abandoned Playwright workspace lock from an interrupted run.');
    } else {
      wait(pollIntervalMilliseconds);
    }
  }
}

function updatePlaywrightLock(lock, progress = {}) {
  const owner = readOwner(lock.lockDirectory);
  if (!owner || owner.token !== lock.token) return false;

  writeOwner(lock.lockDirectory, {
    ...owner,
    ...progress,
    lastProgressAt: new Date().toISOString(),
    pid: owner.pid,
    processIdentity: owner.processIdentity,
    token: owner.token
  });
  return true;
}

function getPlaywrightLockFromEnvironment(environment = process.env) {
  const lockDirectory = environment[LOCK_DIRECTORY_ENVIRONMENT_VARIABLE];
  const token = environment[LOCK_TOKEN_ENVIRONMENT_VARIABLE];
  return lockDirectory && token ? { lockDirectory, token } : null;
}

function setPlaywrightLockEnvironment(lock, environment = process.env) {
  environment[LOCK_DIRECTORY_ENVIRONMENT_VARIABLE] = lock.lockDirectory;
  environment[LOCK_TOKEN_ENVIRONMENT_VARIABLE] = lock.token;
}

function clearPlaywrightLockEnvironment(lock, environment = process.env) {
  if (environment[LOCK_DIRECTORY_ENVIRONMENT_VARIABLE] === lock.lockDirectory) {
    delete environment[LOCK_DIRECTORY_ENVIRONMENT_VARIABLE];
  }
  if (environment[LOCK_TOKEN_ENVIRONMENT_VARIABLE] === lock.token) {
    delete environment[LOCK_TOKEN_ENVIRONMENT_VARIABLE];
  }
}

function ownsPlaywrightLock(lock) {
  const owner = lock && readOwner(lock.lockDirectory);
  return Boolean(owner && owner.token === lock.token);
}

function releasePlaywrightLock(lock) {
  const owner = readOwner(lock.lockDirectory);
  if (!owner || owner.token !== lock.token) return false;

  fs.rmSync(lock.lockDirectory, { force: true, recursive: true });
  return true;
}

module.exports = {
  acquirePlaywrightLock,
  clearPlaywrightLockEnvironment,
  getPlaywrightLockFromEnvironment,
  getDefaultLockDirectory,
  ownsPlaywrightLock,
  releasePlaywrightLock,
  setPlaywrightLockEnvironment,
  updatePlaywrightLock
};
