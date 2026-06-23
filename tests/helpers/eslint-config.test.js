const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { ESLint } = require('eslint');

const repositoryRoot = path.join(__dirname, '..', '..');
const retiredGlobals = [
  '$',
  'jQuery',
  'PoolSchedule',
  'CacheService',
  'CNSLSearchEngine',
  'WeatherService',
  'handleSearch'
];

describe('ESLint browser configuration', () => {
  it('should reject references to retired browser globals', async () => {
    const eslint = new ESLint({ cwd: repositoryRoot });
    const fixture = retiredGlobals.map(globalName => `${globalName};`).join('\n');
    const [result] = await eslint.lintText(fixture, {
      filePath: path.join(repositoryRoot, 'src', 'js', 'retired-globals-fixture.js')
    });
    const undefinedGlobalLines = result.messages
      .filter(message => message.ruleId === 'no-undef')
      .map(message => message.line);

    assert.deepEqual(undefinedGlobalLines, retiredGlobals.map((_, index) => index + 1));
  });
});
