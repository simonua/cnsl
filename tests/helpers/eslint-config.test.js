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

  it('should reject incomplete regular expression escaping', async () => {
    const eslint = new ESLint({ cwd: repositoryRoot });
    const unsafeFixture = String.raw`const escaped = value.replace(/[+/=]/g, '\\$&');`;
    const completeEscapeExpression = /[.*+?^${}()|[\]\\]/g;
    const safeFixture = String.raw`const escaped = value.replace(${completeEscapeExpression}, '\\$&');`;
    const [unsafeResult] = await eslint.lintText(unsafeFixture, {
      filePath: path.join(repositoryRoot, 'tests', 'incomplete-regexp-escaping-fixture.js')
    });
    const [safeResult] = await eslint.lintText(safeFixture, {
      filePath: path.join(repositoryRoot, 'tests', 'complete-regexp-escaping-fixture.js')
    });

    assert.ok(unsafeResult.messages.some(message => message.ruleId === 'regexp-safety/complete-escaping'));
    assert.doesNotMatch(safeResult.messages.map(message => message.message).join('\n'), /Regular expression escaping must include/);
  });
});
