const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { selectRelease } = require('../../scripts/select-release.js');

describe('release selection', () => {
  it('should tag the first semantic release', () => {
    assert.deepEqual(
      selectRelease({
        currentTags: [],
        previousTags: [],
        packageVersion: '2.26.8'
      }),
      {
        releaseVersion: '2.26.8',
        shouldTag: true
      }
    );
  });

  it('should tag a package version newer than the latest release', () => {
    assert.deepEqual(
      selectRelease({
        currentTags: [],
        previousTags: ['2.26.7', 'unrelated'],
        packageVersion: '2.26.8'
      }),
      { releaseVersion: '2.26.8', shouldTag: true }
    );
  });

  it('should leave an unchanged historical release tag in place', () => {
    assert.deepEqual(
      selectRelease({
        currentTags: [],
        previousTags: ['2.26.8'],
        packageVersion: '2.26.8'
      }),
      { releaseVersion: '', shouldTag: false }
    );
  });

  it('should be idempotent when the deployed commit is already tagged', () => {
    assert.deepEqual(
      selectRelease({
        currentTags: ['2.26.8'],
        previousTags: ['2.26.7'],
        packageVersion: '2.26.8'
      }),
      { releaseVersion: '', shouldTag: false }
    );
  });

  it('should reject rollback and conflicting current tags', () => {
    assert.throws(
      () =>
        selectRelease({
          currentTags: [],
          previousTags: ['2.26.8'],
          packageVersion: '2.26.7'
        }),
      /must not be lower/
    );
    assert.throws(
      () =>
        selectRelease({
          currentTags: ['2.26.7'],
          previousTags: [],
          packageVersion: '2.26.8'
        }),
      /does not match/
    );
  });
});
