const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { PoolCardDisplay } = require('../helpers/browser-module-loader.js').loadBrowserModule('pool-card-display');

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
    scheduleUrl: 'https://example.com/schedules/Bryant_Woods.pdf?season=current&view=official',
    phone: '(410) 555-0100'
  },
  poolName: 'Bryant <Woods>',
  poolId: 'bwp"><script>',
  detailsId: 'pool-details-bwp',
  isFavorite: true,
  isExpanded: true,
  distanceMiles: 1.25,
  transitionText: 'Opens in 1h 15m',
  transitionLabel: 'Opens in 1 hour 15 minutes',
  transitionAction: 'opens',
  transitionMinutes: 75,
  poolStatus: { color: 'green' },
  statusTooltip: 'Open <public>',
  featureItems: [
    { label: 'Wi-Fi', category: 'amenities' },
    { label: 'Slide <fun>', category: 'water-play' },
    { label: 'Lessons', category: 'young-swimmers', href: 'lessons.html' }
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
    assert.match(html, /favorite-marker[^>]*role="img"[^>]*aria-label="[^"]+"/);
    assert.match(html, /distance-badge[^>]*aria-label="1\.3 miles away"/);
    assert.match(html, /pool-header__metadata/);
    assert.match(html, /pool-transition-summary--opens" aria-label="Opens in 1 hour 15 minutes">Opens in 1h 15m/);
    assert.match(html, /Open &lt;public&gt;/);
    assert.match(html, /10400 &lt;Bryant&gt; Woods Court/);
    assert.match(html, /https:\/\/www\.google\.com\/maps\/search\/\?api=1&amp;query=Bryant%20Woods%20Pool/);
    assert.match(html, /class="directions-link"/);
    assert.match(html, /class="address-section__directions"/);
    assert.match(html, /class="address-section__secondary-actions"/);
    assert.match(html, /href="https:\/\/example\.com\/pool\?name=Bryant&amp;Woods"/);
    assert.match(html, /data-analytics-link-purpose="pool_page"/);
    assert.match(html, /href="https:\/\/example\.com\/schedules\/Bryant_Woods\.pdf\?season=current&amp;view=official"/);
    assert.match(html, /data-analytics-link-purpose="pool_schedule"/);
    assert.match(html, />\s*CA Pool Schedule\s*<\/a>/);
    assert.match(html, /href="tel:4105550100"/);
    assert.match(html, /feature-pill--amenities/);
    assert.match(html, /feature-pill--water-play/);
    assert.match(html, /Slide &lt;fun&gt;/);
    assert.match(html, /feature-pill--young-swimmers feature-pill--link" href="lessons\.html"/);
    assert.match(html, /Lessons<svg[^>]*aria-hidden="true"/);
    assert.doesNotMatch(html, /nav-menu__icon--lessons/);
    assert.match(html, /<div class="pool-hours">Hours<\/div>/);
    assert.doesNotMatch(html, /<script\b/i);
  });

  it('renders supported nested address records and rejects unsafe destinations', () => {
    const html = PoolCardDisplay.render({
      ...viewModel,
      pool: {
        location: {
          street: '1 Main Street', city: 'Columbia', state: 'MD', zip: '21044',
          mapsQuery: 'javascript:alert(1)'
        },
        caUrl: 'javascript:alert(1)',
        scheduleUrl: 'data:text/html,<script>alert(1)</script>',
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
    assert.doesNotMatch(html, /data:text\/html/i);
    assert.doesNotMatch(html, /address-section__phone/);
    assert.match(html, /class="status-tbd">[^<]+<\/span>/);
  });

  it('maps every semantic current status to meaningful copy independent of color', () => {
    const tooltips = new Map([
      ['open', PoolCardDisplay.getStatusTooltip('open')],
      ['practice-only', PoolCardDisplay.getStatusTooltip('practice-only')],
      ['special-event', PoolCardDisplay.getStatusTooltip('special-event')],
      ['closed-to-public', PoolCardDisplay.getStatusTooltip('closed-to-public')],
      ['schedule-not-found', PoolCardDisplay.getStatusTooltip('schedule-not-found')],
      ['status-not-applicable', PoolCardDisplay.getStatusTooltip('status-not-applicable')],
      ['missing', PoolCardDisplay.getStatusTooltip('missing')],
      ['closed', PoolCardDisplay.getStatusTooltip('closed')],
      ['restricted', PoolCardDisplay.getStatusTooltip('restricted')]
    ]);

    tooltips.forEach(tooltip => assert.ok(tooltip.trim().length > 0));
    assert.equal(tooltips.get('practice-only'), tooltips.get('special-event'));
    assert.equal(tooltips.get('practice-only'), tooltips.get('restricted'));
    assert.equal(tooltips.get('closed-to-public'), tooltips.get('closed'));
    assert.notEqual(tooltips.get('open'), tooltips.get('closed'));
  });

  it('formats public status transitions with compact and accessible units', () => {
    assert.equal(PoolCardDisplay.formatPublicStatusTransition({ action: 'opens', minutes: 1 }), 'Opens in 1 min');
    assert.equal(PoolCardDisplay.formatPublicStatusTransition({ action: 'opens', minutes: 59 }), 'Opens in 59 mins');
    assert.equal(PoolCardDisplay.formatPublicStatusTransition({ action: 'opens', minutes: 60 }), 'Opens in 1 hr 0 mins');
    assert.equal(PoolCardDisplay.formatPublicStatusTransition({ action: 'opens', minutes: 61 }), 'Opens in 1 hr 1 min');
    assert.equal(PoolCardDisplay.formatPublicStatusTransition({ action: 'opens', minutes: 122 }), 'Opens in 2 hrs 2 mins');
    assert.equal(PoolCardDisplay.formatPublicStatusTransition({ action: 'closes', minutes: 1 }), 'Closes in 1 min');
    assert.equal(PoolCardDisplay.formatPublicStatusTransition({ action: 'closes', minutes: 122 }), 'Closes in 2 hrs 2 mins');
    assert.equal(PoolCardDisplay.formatPublicStatusTransition({ action: 'closes', minutes: 121 }, { useLongUnits: true }), 'Closes in 2 hours 1 minute');
    assert.equal(PoolCardDisplay.formatPublicStatusTransition({ action: 'opens', minutes: 1 }, { useLongUnits: true }), 'Opens in 1 minute');
    assert.equal(PoolCardDisplay.formatPublicStatusTransition({ action: 'opens', minutes: 2 }, { useLongUnits: true }), 'Opens in 2 minutes');
    assert.equal(PoolCardDisplay.formatPublicStatusTransition({ action: 'opens', minutes: 61 }, { useLongUnits: true }), 'Opens in 1 hour 1 minute');
    assert.equal(PoolCardDisplay.formatPublicStatusTransition(null), '');
    assert.equal(PoolCardDisplay.formatPublicStatusTransition({ action: 'opens', minutes: 0 }), '');
    assert.equal(PoolCardDisplay.formatPublicStatusTransition({ action: 'closed', minutes: 15 }), '');
  });

  it('adds caution styling only for a closing transition within the next hour', () => {
    assert.equal(PoolCardDisplay.getPublicStatusTransitionClass({ action: 'closes', minutes: 59 }), 'pool-status-countdown pool-status-countdown--caution');
    assert.equal(PoolCardDisplay.getPublicStatusTransitionClass({ action: 'closes', minutes: 60 }), 'pool-status-countdown');
    assert.equal(PoolCardDisplay.getPublicStatusTransitionClass({ action: 'opens', minutes: 15 }), 'pool-status-countdown');
    assert.equal(PoolCardDisplay.getPublicStatusTransitionClass(null), 'pool-status-countdown');
    assert.equal(PoolCardDisplay.getPublicStatusTransitionClass({ action: 'closes', minutes: 0 }), 'pool-status-countdown');
  });

  it('uses warning styling until a closing transition is within one hour', () => {
    assert.equal(
      PoolCardDisplay.getTransitionSummaryClass('closes', 61),
      'pool-transition-summary pool-transition-summary--closes pool-transition-summary--closing-later'
    );
    assert.equal(
      PoolCardDisplay.getTransitionSummaryClass('closes', 60),
      'pool-transition-summary pool-transition-summary--closes'
    );
    assert.equal(
      PoolCardDisplay.getTransitionSummaryClass('opens', 61),
      'pool-transition-summary pool-transition-summary--opens'
    );
    assert.equal(PoolCardDisplay.getTransitionSummaryClass('', 61), 'pool-transition-summary');
  });

  it('links only the fixed Lessons destination from feature pills', () => {
    const html = PoolCardDisplay.renderFeatures([
      { label: 'Lessons', category: 'young-swimmers', href: 'javascript:alert(1)' },
      { label: 'Lessons', category: 'young-swimmers', href: 'lessons.html' }
    ]);

    assert.doesNotMatch(html, /javascript:/);
    assert.equal((html.match(/href="lessons\.html"/g) || []).length, 1);
  });

  it('notes added and removed feature corrections while ignoring unsupported actions', () => {
    const correctedHtml = PoolCardDisplay.renderFeatures([
      { label: 'Diving board', category: 'recreation', correctionAction: 'add' },
      { label: 'Main pool slide', category: 'water-play', correctionAction: 'remove' },
      { label: 'Lap', category: 'water-play', correctionAction: 'replace' }
    ]);

    assert.match(correctedHtml, /feature-pill--add[^>]*><span class="feature-pill__label">Diving board<\/span><sup[^>]*><span aria-hidden="true">1<\/span><span class="visually-hidden"> \(footnote 1\)<\/span><\/sup>/);
    assert.match(correctedHtml, /feature-pill--remove[^>]*><span class="feature-pill__label">Main pool slide<\/span><sup[^>]*><span aria-hidden="true">2<\/span><span class="visually-hidden"> \(footnote 2\)<\/span><\/sup>/);
    assert.match(correctedHtml, /<ol class="pool-features__footnotes" aria-label="Feature notes"><li>Diving board was added to this list based on current facility information that differs from the CA facility page.<\/li><li>Main pool slide was removed from this list based on current facility information that differs from the CA facility page.<\/li><\/ol>/);
    assert.doesNotMatch(correctedHtml, /feature-pill--replace|Includes corrections/);
    assert.match(correctedHtml, /feature-pill--water-play">Lap<\/span>/);
  });

  it('normalizes categories and missing display state safely', () => {
    assert.equal(PoolCardDisplay.getFeatureCategory('amenities'), 'amenities');
    assert.equal(PoolCardDisplay.getFeatureCategory('bad class'), 'additional');
    assert.equal(PoolCardDisplay.getStatusColor('green'), 'green');
    assert.equal(PoolCardDisplay.getStatusColor('purple'), 'gray');
    assert.equal(PoolCardDisplay.renderDistance(Number.NaN), '');
    assert.equal(PoolCardDisplay.renderTransition('', ''), '');
    assert.match(PoolCardDisplay.render({}), /data-pool-card/);
    assert.match(PoolCardDisplay.render(null), /pool-header__toggle/);
    assert.match(PoolCardDisplay.renderDetails(null), /pool-contact/);
  });

  it('normalizes partial and absent nested address records', () => {
    assert.deepEqual(PoolCardDisplay.getAddressData({ location: {
      street: '1 Main Street',
      city: 'Columbia',
      googleMapsUrl: 'https://example.com/map'
    } }, 'https://maps.example/?q='), {
      streetAddress: '1 Main Street',
      cityStateZip: 'Columbia',
      mapsUrl: 'https://example.com/map'
    });
    assert.deepEqual(PoolCardDisplay.getAddressData(null, null), {
      streetAddress: '',
      cityStateZip: '',
      mapsUrl: ''
    });
    assert.match(PoolCardDisplay.renderContact({}, '', ''), /class="address-link"/);
    assert.doesNotMatch(PoolCardDisplay.renderContact({}, '', ''), /address-section__actions/);
    assert.deepEqual(PoolCardDisplay.getAddressData({ location: { state: 'MD', zip: '21044', mapsQuery: 'Pool' } }, 'https://maps.example/?q='), {
      streetAddress: '',
      cityStateZip: 'MD 21044',
      mapsUrl: 'https://maps.example/?q=Pool'
    });
    assert.match(PoolCardDisplay.renderContact({ location: { state: 'MD' } }, '', ''), />\s*MD\s*<\/a>/);
    const streetOnlyHtml = PoolCardDisplay.renderContact({ location: { street: '1 Main Street' } }, '', '');
    assert.match(streetOnlyHtml, />\s*1 Main Street\s*<\/a>/);
    assert.doesNotMatch(streetOnlyHtml, /1 Main Street<br>|Address not available/);
    assert.deepEqual(PoolCardDisplay.getAddressData({ location: {} }, ''), {
      streetAddress: '', cityStateZip: '', mapsUrl: ''
    });
  });

  it('renders independent action, feature, status, and transition defaults', () => {
    const phoneActionsHtml = PoolCardDisplay.renderActions({ phone: '410-555-0100' });
    assert.match(phoneActionsHtml, /aria-label="[^"]+"/);
    assert.match(phoneActionsHtml, /<\/svg>410-555-0100/);
    assert.match(PoolCardDisplay.renderActions({ caUrl: 'https://example.com' }, 'Example'), /href="https:\/\/example\.com\/"/);
    assert.match(PoolCardDisplay.renderFeatures([null]), /feature-pill--additional/);
    assert.match(PoolCardDisplay.renderStatusIndicator(null, ''), /tooltip-text">[^<]+/);
    assert.match(PoolCardDisplay.renderTransition('Opens soon'), /aria-label="Opens soon"/);
    assert.match(PoolCardDisplay.renderDetails(null), /class="address-link"/);
  });

  it('renders public-status transitions and distance metadata independently', () => {
    const transitionOnlyHtml = PoolCardDisplay.render({
      ...viewModel,
      distanceMiles: null,
      isExpanded: false,
      isDetailsHydrated: false
    });
    const distanceOnlyHtml = PoolCardDisplay.render({
      ...viewModel,
      transitionText: '',
      transitionLabel: '',
      isExpanded: false,
      isDetailsHydrated: false
    });

    const closingHtml = PoolCardDisplay.render({
      ...viewModel,
      transitionText: 'Closes in 45 min',
      transitionLabel: 'Closes in 45 minutes',
      transitionAction: 'closes',
      transitionMinutes: 45
    });
    const neutralHtml = PoolCardDisplay.render({
      ...viewModel,
      transitionText: 'Closed today',
      transitionLabel: 'Closed today',
      transitionAction: ''
    });

    assert.match(transitionOnlyHtml, /Opens in 1h 15m/);
    assert.doesNotMatch(transitionOnlyHtml, /distance-badge/);
    assert.match(closingHtml, /pool-transition-summary--closes" aria-label="Closes in 45 minutes">Closes in 45 min/);
    assert.doesNotMatch(closingHtml, /pool-transition-summary--closing-later/);
    assert.doesNotMatch(neutralHtml, /pool-transition-summary--(?:opens|closes)/);
    assert.match(distanceOnlyHtml, /distance-badge/);
    assert.doesNotMatch(distanceOnlyHtml, /pool-transition-summary/);
  });

  it('renders only explicit string nested fragments', () => {
    const html = PoolCardDisplay.render({ ...viewModel, hoursHtml: { unexpected: true } });

    assert.doesNotMatch(html, /\[object Object\]/);
    assert.doesNotMatch(html, /pool-hours/);
  });

  it('renders a summary without detail work until hydration is requested', () => {
    const summaryHtml = PoolCardDisplay.render({ ...viewModel, isExpanded: false, isDetailsHydrated: false });

    assert.match(summaryHtml, /data-pool-details-hydrated="false"/);
    assert.doesNotMatch(summaryHtml, /pool-contact/);
    assert.doesNotMatch(summaryHtml, /pool-hours/);
    assert.doesNotMatch(summaryHtml, /pool-features/);
    assert.match(PoolCardDisplay.renderDetails(viewModel), /pool-contact/);
    assert.match(PoolCardDisplay.renderDetails(viewModel), /pool-hours/);
    assert.match(PoolCardDisplay.renderDetails(viewModel), /pool-features/);
  });

  it('installs the display helper as a browser script global', () => {
    const sourcePath = path.join(__dirname, '..', '..', 'src', 'js', 'services', 'pool-card-display.js');
    const source = fs.readFileSync(sourcePath, 'utf8');
    const context = {
      window: {},
      HtmlSafety: { escapeHtml: value => String(value).replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character])), safeHttpUrl: () => '', safeTelephoneUrl: () => '' },
      IconCatalog: { render: () => '' },
      generatePoolDirectionsLink: () => ''
    };
    Object.assign(context, context.globalThis || {}, context.window || {});
    context.globalThis = context; context.self = context; context.window = context;
    vm.runInNewContext(source, context, { filename: sourcePath });

    assert.equal(typeof context.window.PoolCardDisplay, 'function');
  });
});
