const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const nodemonConfig = require('../../nodemon.json');

describe('nodemon development configuration', () => {
  it('should poll the source directories that produce the local build', () => {
    assert.equal(nodemonConfig.legacyWatch, true);
    assert.deepEqual(nodemonConfig.watch, [
      'src/views',
      'src/css',
      'src/js',
      'src/assets/data/2026'
    ]);
    assert.match(nodemonConfig.exec, /posthtml\.js$/);
  });
});
