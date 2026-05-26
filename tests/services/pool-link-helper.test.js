const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  getPoolIdFromLocation,
  generateGoogleMapsLink,
  generatePoolsPageLink,
  generateLinkedPoolMentions,
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
  });

  describe('generateGoogleMapsLink', () => {
    it('does not render executable map destinations', () => {
      const link = generateGoogleMapsLink({ location: { googleMapsUrl: 'javascript:alert(1)' } }, 'Pool');
      assert.ok(link.includes('https://www.google.com/maps/search/'));
      assert.ok(!link.includes('javascript:'));
    });
  });
});
