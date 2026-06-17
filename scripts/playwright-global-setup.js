'use strict';

const {
  acquirePlaywrightLock,
  clearPlaywrightLockEnvironment,
  getPlaywrightLockFromEnvironment,
  ownsPlaywrightLock,
  releasePlaywrightLock,
  setPlaywrightLockEnvironment
} = require('./playwright-run-lock.js');

module.exports = async function setupPlaywrightRunLock() {
  const inheritedLock = getPlaywrightLockFromEnvironment();
  if (inheritedLock && ownsPlaywrightLock(inheritedLock)) return () => {};

  const lock = acquirePlaywrightLock();
  setPlaywrightLockEnvironment(lock);

  return async function releasePlaywrightRunLock() {
    clearPlaywrightLockEnvironment(lock);
    releasePlaywrightLock(lock);
  };
};
