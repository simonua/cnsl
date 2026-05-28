const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {
  getPoolIdFromLocation,
  getPoolDataFromLocation,
  generateGoogleMapsLink,
  generatePoolsPageLink,
  generateLinkedPoolMentions,
  generateEnhancedPoolLink,
  POOL_LOCATION_TO_ID_MAP
} = require('../../src/js/services/pool-link-helper.js');

describe('pool-link-helper', () => {
  describe('POOL_LOCATION_TO_ID_MAP', () => {
    it('maps Bryant Woods to bwp', () => {
      assert.equal(POOL_LOCATION_TO_ID_MAP['Bryant Woods'], 'bwp');
    });

    it('maps pool name with Pool suffix', () => {
      assert.equal(POOL_LOCATION_TO_ID_MAP['Bryant Woods Pool'], 'bwp');
    });

    it('has entries for all expected pools', () => {
      const expectedIds = ['bwp', 'cfp', 'ccp', 'dgp', 'dhp', 'frp', 'hgp', 'krp'];
      for (const id of expectedIds) {
        const hasId = Object.values(POOL_LOCATION_TO_ID_MAP).includes(id);
        assert.ok(hasId, `Expected to find pool ID ${id}`);
      }
    });
  });

  describe('getPoolIdFromLocation', () => {
    it('returns pool ID for exact match', () => {
      assert.equal(getPoolIdFromLocation('Bryant Woods'), 'bwp');
      assert.equal(getPoolIdFromLocation('Kendall Ridge'), 'krp');
    });

    it('returns pool ID for name with Pool suffix', () => {
      assert.equal(getPoolIdFromLocation('Bryant Woods Pool'), 'bwp');
      assert.equal(getPoolIdFromLocation("Clary's Forest Pool"), 'cfp');
      assert.equal(getPoolIdFromLocation("Hobbit's Glen Pool"), 'hgp');
    });

    it('handles case-insensitive lookup', () => {
      assert.equal(getPoolIdFromLocation('bryant woods'), 'bwp');
      assert.equal(getPoolIdFromLocation('KENDALL RIDGE'), 'krp');
    });

    it('returns null for unknown location', () => {
      assert.equal(getPoolIdFromLocation('Nonexistent Pool'), null);
    });

    it('returns null for null/empty input', () => {
      assert.equal(getPoolIdFromLocation(null), null);
      assert.equal(getPoolIdFromLocation(''), null);
    });

    it('normalizes an otherwise unmapped Pool suffix before lookup', () => {
      assert.equal(getPoolIdFromLocation('Bryant Woods   Pool'), 'bwp');
    });
  });

  describe('getPoolDataFromLocation', () => {
    const pool = { id: 'bwp', toJSON: () => ({ id: 'bwp', location: { googleMapsUrl: 'https://maps.google.com/bwp' } }) };
    const dataManager = { getPools: () => ({ getAllPools: () => [pool] }) };

    it('retrieves a matching pool record and rejects unavailable inputs', () => {
      assert.deepEqual(getPoolDataFromLocation('Bryant Woods', dataManager), { id: 'bwp', location: { googleMapsUrl: 'https://maps.google.com/bwp' } });
      assert.equal(getPoolDataFromLocation('', dataManager), null);
      assert.equal(getPoolDataFromLocation('Unknown Pool', dataManager), null);
      assert.equal(getPoolDataFromLocation('Bryant Woods', null), null);
      assert.equal(getPoolDataFromLocation('Bryant Woods', { getPools: () => ({ getAllPools: () => [] }) }), null);
    });

    it('fails safely when manager retrieval fails', () => {
      const originalWarn = console.warn;
      console.warn = () => {};
      try {
        assert.equal(getPoolDataFromLocation('Bryant Woods', { getPools: () => { throw new Error('bad'); } }), null);
      } finally {
        console.warn = originalWarn;
      }
    });
  });

  describe('generatePoolsPageLink', () => {
    it('generates a link with pool ID parameter', () => {
      const link = generatePoolsPageLink('bwp', 'Bryant Woods');
      assert.ok(link.includes('pools.html?pool=bwp'));
      assert.ok(link.includes('Bryant Woods'));
      assert.ok(link.includes('<a href='));
    });

    it('encodes display text before returning generated markup', () => {
      const link = generatePoolsPageLink('bwp', '<img src=x onerror=bad>');
      assert.ok(link.includes('&lt;img src=x onerror=bad&gt;'));
      assert.ok(!link.includes('<img'));
    });

    it('returns display text when poolId is missing', () => {
      assert.equal(generatePoolsPageLink(null, 'Test'), 'Test');
      assert.equal(generatePoolsPageLink('', 'Test'), 'Test');
    });

    it('returns empty string when both are missing', () => {
      assert.equal(generatePoolsPageLink(null, null), '');
    });
  });

  describe('generateLinkedPoolMentions', () => {
    it('links a named pool embedded within safely rendered location text', () => {
      const link = generateLinkedPoolMentions("Each Team's Home Pool (Pointers Run at Jeffers Hill Pool) <script>");
      assert.ok(link.includes('pools.html?pool=jhp'));
      assert.ok(link.includes('Jeffers Hill Pool</a>'));
      assert.ok(link.includes('&lt;script&gt;'));
    });

    it('returns empty text without a location and plain safe text without known pools', () => {
      assert.equal(generateLinkedPoolMentions(null), '');
      assert.equal(generateLinkedPoolMentions('Remote <place>'), 'Remote &lt;place&gt;');
    });
  });

  describe('generateGoogleMapsLink', () => {
    it('does not render executable map destinations', () => {
      const link = generateGoogleMapsLink({ location: { googleMapsUrl: 'javascript:alert(1)' } }, 'Pool');
      const hrefMatch = link.match(/href="([^"]+)"/);
      assert.ok(hrefMatch, 'Expected generated link to contain an href attribute');
      const parsedUrl = new URL(hrefMatch[1]);
      assert.equal(parsedUrl.protocol, 'https:');
      assert.equal(parsedUrl.host, 'www.google.com');
      assert.ok(parsedUrl.pathname.startsWith('/maps/search/'));
      assert.ok(!link.includes('javascript:'));
    });

    it('uses legacy, query, and coordinate fallbacks and safely handles absent records', () => {
      assert.match(generateGoogleMapsLink({ address: '1 Main St' }, 'Address'), /1%20Main%20St/);
      assert.match(generateGoogleMapsLink({ location: { mapsQuery: 'Pool Name' } }, 'Query'), /Pool%20Name/);
      assert.match(generateGoogleMapsLink({ lat: 1, lng: 2 }, 'Flat'), /1,2/);
      assert.match(generateGoogleMapsLink({ location: { lat: 3, lng: 4 } }, 'Nested'), /3,4/);
      assert.equal(generateGoogleMapsLink(null, 'Text'), 'Text');
      assert.equal(generateGoogleMapsLink({}, ''), '');
      assert.match(generateGoogleMapsLink({}, 'Search'), /Search%20Columbia%20MD/);
    });
  });

  describe('generateEnhancedPoolLink', () => {
    const dataManager = { getPools: () => ({ getAllPools: () => [{ id: 'bwp', toJSON: () => ({ location: { googleMapsUrl: 'https://maps.google.com/bwp' } }) }] }) };

    it('selects internal, map, and combined destinations for a known pool', () => {
      assert.match(generateEnhancedPoolLink('Bryant Woods', dataManager), /pools\.html\?pool=bwp/);
      assert.match(generateEnhancedPoolLink('Bryant Woods', dataManager, { preferPoolsPage: false }), /maps\.google\.com/);
      assert.match(generateEnhancedPoolLink('Bryant Woods', dataManager, { showBothLinks: true }), /maps-icon/);
      const unsafeMapsManager = { getPools: () => ({ getAllPools: () => [{ id: 'bwp', toJSON: () => ({ location: { googleMapsUrl: 'javascript:bad' } }) }] }) };
      assert.doesNotMatch(generateEnhancedPoolLink('Bryant Woods', unsafeMapsManager, { showBothLinks: true }), /maps-icon/);
    });

    it('generates safe fallback destinations for unknown locations', () => {
      assert.equal(generateEnhancedPoolLink('', dataManager), '');
      assert.match(generateEnhancedPoolLink('Unknown <Pool>', dataManager), /pools\.html/);
      assert.match(generateEnhancedPoolLink('Unknown Pool', dataManager, { preferPoolsPage: false }), /maps\/search/);
    });
  });

  describe('browser registration', () => {
    it('installs link helpers as browser globals', () => {
      const sourcePath = path.join(__dirname, '..', '..', 'src', 'js', 'services', 'pool-link-helper.js');
      const source = fs.readFileSync(sourcePath, 'utf8');
      const context = { window: {}, HtmlSafety: { escapeHtml: String, safeHttpUrl: String } };
      vm.runInNewContext(source, context, { filename: sourcePath });
      assert.equal(typeof context.window.generateEnhancedPoolLink, 'function');
    });
  });
});
