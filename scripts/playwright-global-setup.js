'use strict';

const { acquirePlaywrightLock, releasePlaywrightLock } = require('./playwright-run-lock.js');

module.exports = async function setupPlaywrightRunLock() {
  const lock = acquirePlaywrightLock();

  return async function releasePlaywrightRunLock() {
    releasePlaywrightLock(lock);
  };
};
