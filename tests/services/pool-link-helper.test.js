const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const poolLinkModule = require('../helpers/browser-module-loader.js').loadBrowserModule('pool-link-helper');
const {
  createPoolLocationIndex,
  getPoolIdFromLocation,
  getPoolDataFromLocation,
  formatPoolCourseLabel,
  generateGoogleMapsLink,
  generatePoolDirectionsLink,
  generatePoolsPageLink,
  getPoolDirectionsQuery,
  generateLinkedPoolMentions,
  generateEnhancedPoolLink
} = poolLinkModule;

const publishedPools = [
  { id: 'bwp', name: 'Bryant Woods' },
  { id: 'cfp', name: "Clary's Forest" },
  { id: 'hgp', name: "Hobbit's Glen" },
  { id: 'jhp', name: 'Jeffers Hill' },
  { id: 'krp', name: 'Kendall Ridge' }
];

describe('pool-link-helper', () => {
  describe('createPoolLocationIndex', () => {
    it('derives direct and suffixed location aliases from published pools', () => {
      const locations = createPoolLocationIndex(publishedPools);
      assert.equal(locations.get('bryant woods'), 'bwp');
      assert.equal(locations.get('bryant woods pool'), 'bwp');
      assert.equal(createPoolLocationIndex([{ id: 'new', name: 'New Published Pool' }]).get('new published pool'), 'new');
    });

    it('uses model names and skips unusable pool records', () => {
      const locations = createPoolLocationIndex([
        { id: 'model', getName: () => 'Model Pool' },
        { id: 'blank', getName: () => '' },
        { name: 'Missing ID' }
      ]);

      assert.equal(locations.get('model pool'), 'model');
      assert.equal(locations.has('missing id'), false);
    });
  });

  describe('getPoolIdFromLocation', () => {
    it('returns pool ID for exact match', () => {
      assert.equal(getPoolIdFromLocation('Bryant Woods', publishedPools), 'bwp');
      assert.equal(getPoolIdFromLocation('Kendall Ridge', publishedPools), 'krp');
    });

    it('returns pool ID for name with Pool suffix', () => {
      assert.equal(getPoolIdFromLocation('Bryant Woods Pool', publishedPools), 'bwp');
      assert.equal(getPoolIdFromLocation("Clary's Forest Pool", publishedPools), 'cfp');
      assert.equal(getPoolIdFromLocation("Hobbit's Glen Pool", publishedPools), 'hgp');
    });

    it('handles case-insensitive lookup', () => {
      assert.equal(getPoolIdFromLocation('bryant woods', publishedPools), 'bwp');
      assert.equal(getPoolIdFromLocation('KENDALL RIDGE', publishedPools), 'krp');
    });

    it('returns null for unknown location', () => {
      assert.equal(getPoolIdFromLocation('Nonexistent Pool', publishedPools), null);
    });

    it('returns null for null/empty input', () => {
      assert.equal(getPoolIdFromLocation(null), null);
      assert.equal(getPoolIdFromLocation(''), null);
    });

    it('normalizes an otherwise unmapped Pool suffix before lookup', () => {
      assert.equal(getPoolIdFromLocation('Bryant Woods   Pool', publishedPools), 'bwp');
    });
  });

  describe('getPoolDataFromLocation', () => {
    const pool = { id: 'bwp', name: 'Bryant Woods', toJSON: () => ({ id: 'bwp', location: { googleMapsUrl: 'https://maps.google.com/bwp' } }) };
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

  describe('formatPoolCourseLabel', () => {
    it('formats complete semantic lane metadata and omits incomplete combinations', () => {
      assert.equal(formatPoolCourseLabel({ laneCount: 6, laneLength: 25, laneLengthUnits: 'meters' }), '6-lane / 25-meter');
      assert.equal(formatPoolCourseLabel({ laneCount: 6, laneLength: 25, laneLengthUnits: 'yards' }), '6-lane / 25-yard');
      assert.equal(formatPoolCourseLabel({ laneCount: 6, laneLength: null, laneLengthUnits: 'yards' }), '6-lane / yard');
      assert.equal(formatPoolCourseLabel({ laneCount: 6, laneLengthUnits: null }), '');
      assert.equal(formatPoolCourseLabel(null), '');
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
      const link = generateLinkedPoolMentions("Each Team's Home Pool (Pointers Run at Jeffers Hill Pool) <script>", publishedPools);
      assert.ok(link.includes('pools.html?pool=jhp'));
      assert.ok(link.includes('Jeffers Hill Pool</a>'));
      assert.ok(link.includes('&lt;script&gt;'));
    });

    it('returns empty text without a location and plain safe text without known pools', () => {
      assert.equal(generateLinkedPoolMentions(null), '');
      assert.equal(generateLinkedPoolMentions('Remote <place>'), 'Remote &lt;place&gt;');
    });

    it('accepts a prebuilt index and links multiple known mentions', () => {
      const index = createPoolLocationIndex(publishedPools);
      const html = generateLinkedPoolMentions('Bryant Woods at Kendall Ridge', index);

      assert.equal((html.match(/pools\.html\?pool=/g) || []).length, 2);
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

  describe('generatePoolDirectionsLink', () => {
    const pool = {
      location: {
        street: '1 Main Street', city: 'Columbia', state: 'MD', zip: '21044',
        mapsQuery: 'Example Pool Columbia MD'
      }
    };

    it('opens Apple Maps on Apple platforms and Google Maps elsewhere', () => {
      const appleLink = generatePoolDirectionsLink(pool, 'Example Pool', { platform: 'iPhone' });
      const googleLink = generatePoolDirectionsLink(pool, 'Example Pool', { platform: 'Linux' });

      assert.match(appleLink, /https:\/\/maps\.apple\.com\/\?daddr=Example\+Pool\+Columbia\+MD/);
      assert.match(appleLink, /aria-label="Get directions to Example Pool in Apple Maps"/);
      assert.match(googleLink, /https:\/\/www\.google\.com\/maps\/dir\/\?destination=Example\+Pool\+Columbia\+MD&amp;api=1/);
      assert.match(googleLink, /aria-label="Get directions to Example Pool in Google Maps"/);
      assert.match(googleLink, /<span>Directions<\/span>/);
    });

    it('detects Apple platforms and builds safe destination fallbacks', () => {
      assert.equal(getPoolDirectionsQuery(pool, 'Fallback'), 'Example Pool Columbia MD');
      assert.equal(getPoolDirectionsQuery({ location: { street: '1 Main', city: 'Columbia', state: 'MD', zip: '21044' } }, ''), '1 Main Columbia, MD 21044');
      assert.equal(getPoolDirectionsQuery({ location: { lat: 39.2, lng: -76.8 } }, ''), '39.2,-76.8');
      assert.equal(getPoolDirectionsQuery({ lat: 39.1, lng: -76.7 }, ''), '39.1,-76.7');
      assert.equal(getPoolDirectionsQuery({ mapsQuery: 'Flat query' }, ''), 'Flat query');
      assert.equal(getPoolDirectionsQuery({ location: 'invalid', address: '2 Main Street' }, ''), '2 Main Street');
      assert.equal(getPoolDirectionsQuery({ location: { lat: 39.2 }, address: 'Latitude only' }, ''), 'Latitude only');
      assert.equal(getPoolDirectionsQuery({ location: { lng: -76.8 } }, 'Longitude only'), 'Longitude only');
      assert.equal(getPoolDirectionsQuery(null, 'Fallback Pool'), 'Fallback Pool');
      assert.equal(generatePoolDirectionsLink(null, '', { platform: 'Linux' }), '');
      assert.match(generatePoolDirectionsLink(pool, 'Example Pool', null), /Google Maps/);
      assert.match(generatePoolDirectionsLink({ address: '3 Main Street' }, '', { platform: 'Linux' }), /Get directions to this pool in Google Maps/);
      assert.doesNotMatch(generatePoolDirectionsLink({ location: { mapsQuery: '"><ScRiPt>' } }, '"><Pool>', { platform: 'Linux' }), /<script\b|<Pool>/i);

      const originalSafeHttpUrl = poolLinkModule.context.HtmlSafety.safeHttpUrl;
      poolLinkModule.context.HtmlSafety.safeHttpUrl = () => '';
      try {
        assert.equal(generatePoolDirectionsLink(pool, 'Example Pool', { platform: 'Linux' }), '');
      } finally {
        poolLinkModule.context.HtmlSafety.safeHttpUrl = originalSafeHttpUrl;
      }
    });
  });

  describe('generateEnhancedPoolLink', () => {
    const dataManager = { getPools: () => ({ getAllPools: () => [{ id: 'bwp', name: 'Bryant Woods', toJSON: () => ({ location: { googleMapsUrl: 'https://maps.google.com/bwp' } }) }] }) };

    it('selects internal, map, and combined destinations for a known pool', () => {
      assert.match(generateEnhancedPoolLink('Bryant Woods', dataManager), /pools\.html\?pool=bwp/);
      const conciseLink = generateEnhancedPoolLink('Bryant Woods Pool', dataManager, { displayText: 'Bryant Woods' });
      assert.match(conciseLink, /pools\.html\?pool=bwp/);
      assert.match(conciseLink, />Bryant Woods<\/a>/);
      assert.doesNotMatch(conciseLink, />Bryant Woods Pool<\/a>/);
      assert.match(generateEnhancedPoolLink('Bryant Woods', dataManager, { preferPoolsPage: false }), /maps\.google\.com/);
      assert.match(generateEnhancedPoolLink('Bryant Woods', dataManager, { showBothLinks: true }), /maps-icon/);
      const unsafeMapsManager = { getPools: () => ({ getAllPools: () => [{ id: 'bwp', name: 'Bryant Woods', toJSON: () => ({ location: { googleMapsUrl: 'javascript:bad' } }) }] }) };
      assert.doesNotMatch(generateEnhancedPoolLink('Bryant Woods', unsafeMapsManager, { showBothLinks: true }), /maps-icon/);
    });

    it('generates safe fallback destinations for unknown locations', () => {
      assert.equal(generateEnhancedPoolLink('', dataManager), '');
      assert.match(generateEnhancedPoolLink('Unknown <Pool>', dataManager), /pools\.html/);
      assert.match(generateEnhancedPoolLink('Unknown Pool', dataManager, { displayText: '<Unknown>' }), /&lt;Unknown&gt;/);
      assert.match(generateEnhancedPoolLink('Unknown Pool', dataManager, { preferPoolsPage: false }), /maps\/search/);
      assert.match(generateEnhancedPoolLink('Unknown Pool', null, { preferPoolsPage: false }), /maps\/search/);
    });
  });

  describe('browser registration', () => {
    it('installs link helpers as browser globals', () => {
      const sourcePath = path.join(__dirname, '..', '..', 'src', 'js', 'services', 'pool-link-helper.js');
      const source = fs.readFileSync(sourcePath, 'utf8');
      const context = { window: {}, HtmlSafety: { escapeHtml: String, safeHttpUrl: String }, IconCatalog: { render: () => '' } };
      Object.assign(context, context.globalThis || {}, context.window || {});
      context.globalThis = context; context.self = context; context.window = context;
      vm.runInNewContext(source, context, { filename: sourcePath });
      assert.equal(typeof context.window.generateEnhancedPoolLink, 'function');
      assert.equal(typeof context.window.createPoolLocationIndex, 'function');
      assert.equal(typeof context.window.formatPoolCourseLabel, 'function');
      assert.equal(typeof context.window.generatePoolDirectionsLink, 'function');
    });
  });
});
