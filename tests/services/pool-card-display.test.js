const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const PoolCardDisplay = require('../../src/js/services/pool-card-display.js');

const viewModel = {
  pool: {
    location: {
      street: '10400 <Bryant> Woods Court',
      city: 'Columbia',
      state: 'MD',
      zip: '21044',
      mapsQuery: 'Bryant Woods Pool'
    },
    caUrl: 'https://example.com/pool?name=Bryant&Woods',
    phone: '(410) 555-0100'
  },
  poolName: 'Bryant <Woods>',
  poolId: 'bwp"><script>',
  detailsId: 'pool-details-bwp',
  isFavorite: true,
  isExpanded: true,
  distanceMiles: 1.25,
  poolStatus: { color: 'green' },
  statusTooltip: 'Open <public>',
  featureItems: [
    { label: 'Wi-Fi', category: 'amenities' },
    { label: 'Slide <fun>', category: 'water-play' }
  ],
  hoursHtml: '<div class="pool-hours">Hours</div>',
  mapsSearchBaseUrl: 'https://www.google.com/maps/search/?api=1&query='
};

describe('PoolCardDisplay', () => {
  it('renders a pool card from display-ready state with escaped text and safe actions', () => {
    const html = PoolCardDisplay.render(viewModel);

    assert.match(html, /class="pool-card favorite-card"/);
    assert.match(html, /data-pool-card data-pool-id=/);
    assert.match(html, /data-pool-name="Bryant &lt;Woods&gt;"/);
    assert.match(html, /data-analytics-context="pool_details"/);
    assert.match(html, /data-pool-card-action="toggle"/);
    assert.match(html, /data-pool-id="bwp&quot;&gt;&lt;script&gt;"/);
    assert.match(html, /Bryant &lt;Woods&gt;/);
    assert.match(html, /Favorite pool/);
    assert.match(html, /1\.3 mi/);
    assert.match(html, /Open &lt;public&gt;/);
    assert.match(html, /10400 &lt;Bryant&gt; Woods Court/);
    assert.match(html, /https:\/\/www\.google\.com\/maps\/search\/\?api=1&amp;query=Bryant%20Woods%20Pool/);
    assert.match(html, /href="https:\/\/example\.com\/pool\?name=Bryant&amp;Woods"/);
    assert.match(html, /href="tel:4105550100"/);
    assert.match(html, /feature-pill--amenities/);
    assert.match(html, /feature-pill--water-play/);
    assert.match(html, /Slide &lt;fun&gt;/);
    assert.match(html, /<div class="pool-hours">Hours<\/div>/);
    assert.doesNotMatch(html, /<script>/);
  });

  it('renders supported flat address records and rejects unsafe destinations', () => {
    const html = PoolCardDisplay.render({
      ...viewModel,
      pool: {
        address: '1 Main Street, Columbia, MD 21044',
        mapsQuery: 'javascript:alert(1)',
        caUrl: 'javascript:alert(1)',
        phone: '410-555-0100 onclick=bad'
      },
      featureItems: [],
      poolStatus: { color: 'purple' },
      distanceMiles: null
    });

    assert.match(html, /1 Main Street<br>Columbia, MD 21044/);
    assert.match(html, /<span class="pool-status-indicator gray status-tooltip"/);
    assert.match(html, /https:\/\/www\.google\.com\/maps\/search\/\?api=1&amp;query=javascript%3Aalert\(1\)/);
    assert.doesNotMatch(html, /ca-website-section/);
    assert.doesNotMatch(html, /address-section__phone/);
    assert.match(html, /<span class="status-tbd">TBD<\/span>/);
  });

  it('normalizes categories and missing display state safely', () => {
    assert.equal(PoolCardDisplay.getFeatureCategory('amenities'), 'amenities');
    assert.equal(PoolCardDisplay.getFeatureCategory('bad class'), 'additional');
    assert.equal(PoolCardDisplay.getStatusColor('green'), 'green');
    assert.equal(PoolCardDisplay.getStatusColor('purple'), 'gray');
    assert.equal(PoolCardDisplay.renderDistance(Number.NaN), '');
    assert.match(PoolCardDisplay.render({}), /Unknown Pool/);
  });

  it('renders only explicit string nested fragments', () => {
    const html = PoolCardDisplay.render({ ...viewModel, hoursHtml: { unexpected: true } });

    assert.doesNotMatch(html, /\[object Object\]/);
    assert.doesNotMatch(html, /pool-hours/);
  });

  it('installs the display helper as a browser script global', () => {
    const sourcePath = path.join(__dirname, '..', '..', 'src', 'js', 'services', 'pool-card-display.js');
    const source = fs.readFileSync(sourcePath, 'utf8');
    const context = {
      window: {},
      HtmlSafety: { escapeHtml: value => String(value).replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character])), safeHttpUrl: () => '', safeTelephoneUrl: () => '' }
    };
    vm.runInNewContext(source, context, { filename: sourcePath });

    assert.equal(typeof context.window.PoolCardDisplay, 'function');
  });
});
