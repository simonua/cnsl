const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { createEntityDetailPages } = require('../../scripts/lib/entity-detail-pages.js');

const homePageUrl = 'https://example.com';

function createFixturePages(overrides = {}) {
  return createEntityDetailPages({
    homePageUrl,
    year: '2026',
    pools: [{
      id: 'alpha',
      name: 'Alpha & <Pool>',
      caUrl: 'https://official.example/pools/alpha',
      scheduleUrl: 'https://official.example/schedules/alpha.pdf',
      location: {
        street: '1 Main & Oak',
        city: 'Columbia',
        state: 'MD',
        zip: '21044',
        lat: 39.2,
        lng: -76.8,
        googleMapsUrl: 'https://maps.example/alpha'
      },
      phone: '410-555-0100',
      laneCount: 6,
      laneLength: 25,
      laneLengthUnits: 'meters',
      features: ['lap', '<script>alert(1)</script>']
    }],
    teams: [{
      id: 'sample-team',
      name: 'Sample & Team',
      shortName: 'Samples',
      url: 'https://team.example/home',
      calendarUrl: 'https://team.example/calendar',
      homePools: ['Alpha'],
      practicePools: ['Alpha', 'Beta'],
      practice: { url: 'https://team.example/practice' },
      homeMeetGuides: [{ general: { parking: 'Do not publish this manager guidance.' } }]
    }],
    ...overrides
  });
}

describe('entity detail pages', () => {
  it('creates deterministic pool and team pages with canonical metadata and breadcrumbs', () => {
    const pages = createFixturePages();
    const poolPage = pages.find(page => page.filename === 'pool-alpha.html');
    const teamPage = pages.find(page => page.filename === 'team-sample-team.html');

    assert.deepEqual(pages.map(page => page.filename), ['pool-alpha.html', 'team-sample-team.html']);
    assert.equal(poolPage.canonicalUrl, `${homePageUrl}/pool-alpha.html`);
    assert.match(poolPage.source, new RegExp(`<link rel="canonical" href="${homePageUrl}/pool-alpha\\.html"`));
    assert.match(poolPage.source, /<title>Alpha &amp; &lt;Pool&gt; Pool: 2026 Hours &amp; Schedule<\/title>/);
    assert.match(poolPage.source, /current status and hours/);
    assert.match(poolPage.source, /"@type": "SportsActivityLocation"/);
    assert.match(poolPage.source, /"alternateName": "Alpha & \\u003cPool>"/);
    assert.match(poolPage.source, /"@type": "BreadcrumbList"/);
    assert.match(teamPage.source, /<title>Sample &amp; Team: 2026 CNSL Swim Team<\/title>/);
    assert.match(teamPage.source, /2026 CNSL home pool Alpha/);
    assert.match(teamPage.source, /official practice and team schedule links/);
    assert.match(teamPage.source, /"@type": "SportsTeam"/);
    assert.match(teamPage.source, /"alternateName": "Samples"/);
    assert.match(teamPage.source, /href="teams\.html\?team=sample-team"/);
  });

  it('escapes visible annual text and keeps JSON-LD safe inside its script element', () => {
    const [poolPage] = createFixturePages();

    assert.match(poolPage.source, /Alpha &amp; &lt;Pool&gt;/);
    assert.match(poolPage.source, /1 Main &amp; Oak/);
    assert.doesNotMatch(poolPage.source, /<script>alert\(1\)<\/script>/);
    assert.match(poolPage.source, /\\u003cscript>alert\(1\)\\u003c\/script>/);
  });

  it('publishes only public team summary fields', () => {
    const teamPage = createFixturePages().find(page => page.filename.startsWith('team-'));

    assert.match(teamPage.source, /Home pool/);
    assert.match(teamPage.source, /Official team website/);
    assert.doesNotMatch(teamPage.source, /manager guidance|homeMeetGuides|parking/i);
  });

  it('rejects unsafe identifiers and external destinations', () => {
    assert.throws(
      () => createFixturePages({ pools: [{ id: '../bad', name: 'Bad', caUrl: 'https://example.com', location: {} }] }),
      /safe pool ID/
    );
    assert.throws(
      () => createFixturePages({
        teams: [{ id: 'bad', name: 'Bad', url: 'javascript:alert(1)', homePools: ['Alpha'] }]
      }),
      /HTTPS Bad official URL/
    );
  });
});
