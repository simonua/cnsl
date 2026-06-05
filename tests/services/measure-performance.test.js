const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { median, spread, summarizeRouteSamples } = require('../../scripts/measure-performance.js');

describe('performance measurement reporting', () => {
  it('should calculate the existing upper median and a compact sample spread', () => {
    assert.equal(median([900, 500, 700, 600]), 700);
    assert.deepEqual(spread([900, 500, 700]), { min: 500, median: 700, max: 900 });
    assert.throws(() => spread([]), /empty performance sample/);
  });

  it('should report route usability separately from progressive Pools phases', () => {
    const summary = summarizeRouteSamples([
      {
        annualDomainRequests: { pools: 1, teams: 1 },
        bytes: 800,
        phases: { 'primary-data-ready': 120, 'summary-visible': 180, 'optional-enrichment-settled': 700 },
        requests: 40,
        usableMs: 220
      },
      {
        annualDomainRequests: { pools: 1, teams: 1, meets: 1 },
        bytes: 900,
        phases: { 'primary-data-ready': 100, 'summary-visible': 160, 'optional-enrichment-settled': 900 },
        requests: 42,
        usableMs: 200
      },
      {
        annualDomainRequests: { pools: 1, teams: 1, meets: 1 },
        bytes: 850,
        phases: { 'primary-data-ready': 110, 'summary-visible': 170, 'optional-enrichment-settled': 800 },
        requests: 41,
        usableMs: 210
      }
    ]);

    assert.deepEqual(summary.usableMs, { min: 200, median: 210, max: 220 });
    assert.deepEqual(summary.phases['summary-visible'], { min: 160, median: 170, max: 180 });
    assert.deepEqual(summary.phases['optional-enrichment-settled'], { min: 700, median: 800, max: 900 });
    assert.deepEqual(summary.annualDomainRequests, { pools: 1, teams: 1, meets: 1 });
    assert.equal(summary.bytes, 850);
    assert.equal(summary.requests, 41);
  });
});
