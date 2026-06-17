'use strict';

const {
  getPlaywrightLockFromEnvironment,
  updatePlaywrightLock
} = require('./playwright-run-lock.js');

function recordProgress(status) {
  const lock = getPlaywrightLockFromEnvironment();
  if (lock) updatePlaywrightLock(lock, { status });
}

class PlaywrightProgressReporter {
  onBegin() {
    recordProgress('running');
  }

  onTestBegin() {
    recordProgress('test-running');
  }

  onTestEnd() {
    recordProgress('test-completed');
  }

  onEnd() {
    recordProgress('completed');
  }
}

module.exports = PlaywrightProgressReporter;