'use strict';

const {
	acquirePlaywrightLock,
	clearPlaywrightLockEnvironment,
	releasePlaywrightLock,
	setPlaywrightLockEnvironment
} = require('./playwright-run-lock.js');

process.env.PW_DISABLE_TS_ESM = '1';

const lock = acquirePlaywrightLock();
let lockReleased = false;

setPlaywrightLockEnvironment(lock);

function releaseLock() {
	if (lockReleased) return;
	lockReleased = true;
	clearPlaywrightLockEnvironment(lock);
	releasePlaywrightLock(lock);
}

process.once('exit', releaseLock);
for (const signal of ['SIGINT', 'SIGTERM']) {
	process.once(signal, () => {
		releaseLock();
		process.kill(process.pid, signal);
	});
}

require('@playwright/test/cli');
