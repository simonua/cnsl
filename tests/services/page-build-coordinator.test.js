const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { coordinatePageBuilds } = require('../../scripts/lib/page-build-coordinator.js');

describe('page build coordinator', () => {
  it('should wait for every page before finalizing the build', async () => {
    let releaseDelayedPage;
    const delayedPage = new Promise(resolve => {
      releaseDelayedPage = resolve;
    });
    const events = [];

    const build = coordinatePageBuilds(
      ['ready.html', 'delayed.html'],
      async file => {
        if (file === 'delayed.html') await delayedPage;
        events.push(`page:${file}`);
      },
      () => events.push('finalize'),
      error => assert.fail(error)
    );

    await Promise.resolve();
    assert.deepEqual(events, ['page:ready.html']);

    releaseDelayedPage();
    await build;
    assert.deepEqual(events, ['page:ready.html', 'page:delayed.html', 'finalize']);
  });

  it('should fail without finalizing when a page rejects', async () => {
    const pageError = new Error('Fixture page failed');
    let finalized = false;
    let exitCode = 0;
    let observedError;

    await coordinatePageBuilds(
      ['failed.html'],
      () => Promise.reject(pageError),
      () => {
        finalized = true;
      },
      error => {
        observedError = error;
        exitCode = 1;
      }
    );

    assert.equal(finalized, false);
    assert.equal(exitCode, 1);
    assert.equal(observedError, pageError);
  });
});
