const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const nodemonConfig = require('../../nodemon.json');
const appConfig = require('../../scripts/adapters/app-config.js');

function isWatched(sourcePath) {
  return nodemonConfig.watch.some(watchPath => {
    const relativePath = path.relative(watchPath, sourcePath);
    return relativePath === '' || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath));
  });
}

describe('nodemon development configuration', () => {
  it('should poll the source directories that produce the local build', () => {
    assert.equal(nodemonConfig.legacyWatch, true);
    assert.deepEqual(nodemonConfig.watch, [
      'src/views',
      'src/css',
      'src/js',
      'src/assets/data'
    ]);
    assert.equal(isWatched(`src/assets/data/${appConfig.YEAR}/pools/pools.json`), true);
    assert.equal(isWatched(`src/assets/data/${appConfig.YEAR + 1}/teams/teams.json`), true);
    assert.equal(nodemonConfig.ignore.some(pattern => /src\/assets\/data\/\d{4}/.test(pattern)), false);
    assert.match(nodemonConfig.exec, /posthtml\.js$/);
  });
});
