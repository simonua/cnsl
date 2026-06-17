const assert = require('node:assert/strict');
const { describe, it } = require('node:test');
const {
  assertRenderedText,
  deriveReferenceTime,
  normalizeConfiguration,
  normalizeForComparison,
  normalizeWhitespace,
  parseArguments,
  parseCalendarDate,
  parseLocalOrigin
} = require('./capture-meet-guidance.js');

describe('capture-meet-guidance helper', () => {
  describe('parseArguments', () => {
    it('should parse required and repeatable capture options', () => {
      const options = parseArguments([
        '--meet-date', '2026-06-20',
        '--home-team-id', 'lrm',
        '--away-team-id', 'prp',
        '--shared-text', 'Shared fact',
        '--shared-text', 'Second fact',
        '--home-text', 'Home fact',
        '--away-text', 'Away fact',
        '--exclude-text', 'Private fact',
        '--headed'
      ]);

      assert.deepEqual(options, {
        awayExpectedText: ['Away fact'],
        awayTeamId: 'prp',
        excludedText: ['Private fact'],
        headless: false,
        homeExpectedText: ['Home fact'],
        homeTeamId: 'lrm',
        meetDate: '2026-06-20',
        sharedExpectedText: ['Shared fact', 'Second fact']
      });
    });

    it('should reject unknown options and missing values', () => {
      assert.throws(() => parseArguments(['--unknown']));
      assert.throws(() => parseArguments(['--meet-date']));
      assert.throws(() => parseArguments(['--meet-date', '--headed']));
    });
  });

  describe('date and origin validation', () => {
    it('should derive a stable reference time on the day before the meet', () => {
      assert.equal(deriveReferenceTime('2026-06-20').toISOString(), '2026-06-19T17:00:00.000Z');
      assert.equal(deriveReferenceTime('2027-01-01').toISOString(), '2026-12-31T17:00:00.000Z');
    });

    it('should reject malformed and impossible calendar dates', () => {
      assert.throws(() => parseCalendarDate('06-20-2026', '--meet-date'));
      assert.throws(() => parseCalendarDate('2026-02-30', '--meet-date'));
    });

    it('should allow only local HTTP origins', () => {
      assert.equal(parseLocalOrigin('http://localhost:9090/path'), 'http://localhost:9090');
      assert.equal(parseLocalOrigin('http://127.0.0.1:9090'), 'http://127.0.0.1:9090');
      assert.equal(parseLocalOrigin('http://[::1]:9090'), 'http://[::1]:9090');
      assert.throws(() => parseLocalOrigin('https://localhost:9090'));
      assert.throws(() => parseLocalOrigin('https://example.com'));
      assert.throws(() => parseLocalOrigin('not a URL'));
    });
  });

  describe('normalizeConfiguration', () => {
    it('should apply reusable defaults and preserve expected facts', () => {
      const configuration = normalizeConfiguration({
        awayExpectedText: ['Away fact'],
        awayTeamId: 'prp',
        homeTeamId: 'lrm',
        meetDate: '2026-06-20',
        sharedExpectedText: ['Shared fact']
      });

      assert.equal(configuration.origin, 'http://localhost:9090');
      assert.equal(configuration.headless, true);
      assert.equal(configuration.referenceTime.toISOString(), '2026-06-19T17:00:00.000Z');
      assert.deepEqual(configuration.sharedExpectedText, ['Shared fact']);
      assert.deepEqual(configuration.awayExpectedText, ['Away fact']);
    });

    it('should reject unsafe or incomplete matchup configuration', () => {
      assert.throws(() => normalizeConfiguration());
      assert.throws(() => normalizeConfiguration({ awayTeamId: 'prp', homeTeamId: 'lrm' }));
      assert.throws(() => normalizeConfiguration({ awayTeamId: 'prp', homeTeamId: '../lrm', meetDate: '2026-06-20' }));
      assert.throws(() => normalizeConfiguration({ awayTeamId: 'lrm', homeTeamId: 'lrm', meetDate: '2026-06-20' }));
      assert.throws(() => normalizeConfiguration({ awayTeamId: 'prp', homeTeamId: 'lrm', meetDate: '2026-06-20', referenceTime: 'invalid' }));
    });
  });

  describe('rendered-text assertions', () => {
    it('should normalize line endings and whitespace for comparisons', () => {
      assert.equal(normalizeWhitespace(' Home meet \r\nFact  \r\n'), 'Home meet\nFact');
      assert.equal(normalizeForComparison('Drinks\ncoffee\twater'), 'Drinks coffee water');
    });

    it('should assert expected and excluded facts by perspective', () => {
      assert.doesNotThrow(() => assertRenderedText(
        'Away meet\nDrinks\ncoffee\nwater',
        'Away',
        ['Drinks coffee water'],
        ['Private note']
      ));
      assert.throws(() => assertRenderedText('Home meet\nShared fact', 'Away', [], []));
      assert.throws(() => assertRenderedText('Away meet\nShared fact', 'Away', ['Missing fact'], []));
      assert.throws(() => assertRenderedText('Away meet\nPrivate Note', 'Away', [], ['private note']));
    });
  });
});
