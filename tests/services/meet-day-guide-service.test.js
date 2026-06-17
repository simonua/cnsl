const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const meetDayModule = require('../helpers/browser-module-loader.js').loadBrowserModule('meet-day-guide-service');

const {
  Meet,
  MeetDayGuideService,
  MeetTeamRole,
  PaymentMethod
} = meetDayModule;

const meetTimes = {
  dualMeets: {
    end: '12:00',
    firstSwimTime: '08:00',
    relayCheckInDeadline: '07:55',
    start: '07:00'
  }
};
const hostTeam = {
  homeMeetGuides: [{
    general: {
      concessions: {
        denominationsNotAccepted: [100],
        dietaryOptions: [{ availability: 'by-request', type: 'fixture vegan option' }],
        drinkItems: ['fixture coffee', 'fixture water'],
        mealItems: ['fixture breakfast'],
        notes: ['Fixture concession note.'],
        opensAt: '07:30',
        paymentMethods: [PaymentMethod.CASH],
        snackItems: ['fixture snack']
      },
      helpfulNotes: ['Fixture shared note.'],
      parkingLocation: 'in the fixture overflow lot',
      parkingNotes: ['Fixture parking caution.'],
      poolsideConditions: ['Fixture poolside condition.']
    },
    poolId: 'host-pool',
    visitingTeam: {
      arrivalGuidance: 'Fixture arrival guidance.',
      arrivalTime: '07:15',
      clerkGuidance: 'Fixture clerk location.',
      familySetupLocation: 'in the fixture visitor area',
      reservedParking: 'Fixture reserved parking guidance.',
      warmupTime: '07:25'
    }
  }],
  id: 'host',
  keywords: ['Host'],
  name: 'Host Team',
  shortName: 'Hosts'
};
const favoriteTeam = {
  homeMeetGuides: [{
    general: {
      concessions: {
        drinkItems: ['fixture soda', 'fixture water'],
        paymentMethods: [PaymentMethod.CASH, PaymentMethod.PAYPAL, PaymentMethod.VENMO],
      },
      parkingNotes: ['Fixture home parking note.'],
      volunteerCheckInLocation: 'Fixture data table.'
    },
    homeTeam: { arrivalTime: '06:30', warmupTime: '07:00' },
    poolId: 'favorite-pool',
    visitingTeam: {
      familySetupLocation: 'in the fixture shaded area',
      reservedParking: 'Fixture visitor parking reservation.',
      swimmerCheckInLocation: 'at the fixture check-in table',
      warmupTime: '07:25'
    }
  }],
  id: 'favorite',
  keywords: ['Favorite'],
  name: 'Favorite Team',
  shortName: 'Favorites'
};
const secondVisitorTeam = {
  id: 'second-visitor',
  keywords: ['Second Visitor'],
  name: 'Second Visitor Team',
  shortName: 'Visitors'
};
const teams = [hostTeam, favoriteTeam, secondVisitorTeam];
const pools = [{
  id: 'host-pool',
  laneCount: 6,
  laneLength: 25,
  laneLengthUnits: 'meters',
  location: { city: 'Fixture City', state: 'MD', street: '1 Fixture Lane', zip: '21000' },
  name: 'Host'
}, {
  id: 'favorite-pool',
  laneCount: 8,
  laneLength: 25,
  laneLengthUnits: 'yards',
  location: { city: 'Fixture City', state: 'MD', street: '2 Fixture Lane', zip: '21000' },
  name: 'Favorite'
}];
const firstFavoriteMeet = new Meet({
  date: '2026-06-13', home_team: 'Host', location: 'Host Pool', visiting_team: 'Favorite'
}, meetTimes, 'dualMeets');
const secondFavoriteMeet = new Meet({
  date: '2026-06-20', home_team: 'Favorite', location: 'Favorite Pool', visiting_team: 'Second Visitor'
}, meetTimes, 'dualMeets');

function assertIncludesFixtureValues(html, values) {
  values.filter(Boolean).forEach(value => assert.ok(html.includes(value), `Expected rendered fixture value: ${value}`));
}

describe('MeetDayGuideService', () => {
  describe('getGuide', () => {
    it('builds away guidance from deterministic matchup records one day before the meet', () => {
      const guide = MeetDayGuideService.getGuide(favoriteTeam, teams, [firstFavoriteMeet], pools, new Date(2026, 5, 12, 12));

      assert.equal(guide.role, MeetTeamRole.AWAY);
      assert.equal(guide.dayLabel, 'Tomorrow');
      assert.equal(guide.homeTeam, hostTeam);
      assert.equal(guide.visitingTeam, favoriteTeam);
      assert.equal(guide.pool, pools[0]);
      assert.equal(guide.roleGuide, hostTeam.homeMeetGuides[0].visitingTeam);
      assert.equal(guide.meet.timingWindow.relayCheckInDeadline, meetTimes.dualMeets.relayCheckInDeadline);
      assert.ok(guide.poolAddress.includes(pools[0].location.street));
    });

    it('applies an optional inclusive look-ahead window', () => {
      const twoDaysAheadGuide = MeetDayGuideService.getGuide(favoriteTeam, teams, [firstFavoriteMeet], pools, new Date(2026, 5, 11, 12), 2);
      const todayGuide = MeetDayGuideService.getGuide(favoriteTeam, teams, [firstFavoriteMeet], pools, new Date(2026, 5, 13, 6));

      assert.equal(twoDaysAheadGuide.dayLabel, 'In 2 days');
      assert.equal(todayGuide.dayLabel, 'Today');
      assert.equal(MeetDayGuideService.getGuide(favoriteTeam, teams, [firstFavoriteMeet], pools, new Date(2026, 5, 10, 12), 2), null);
      assert.equal(MeetDayGuideService.getGuide(favoriteTeam, teams, [firstFavoriteMeet], pools, new Date(2026, 5, 14, 12)), null);
      assert.equal(MeetDayGuideService.getGuide(null, teams, [firstFavoriteMeet], pools, new Date(2026, 5, 12, 12)), null);
      assert.equal(MeetDayGuideService.getGuide(favoriteTeam, teams, null, pools, new Date(2026, 5, 12, 12)), null);
      assert.equal(MeetDayGuideService.getGuide(favoriteTeam, teams, [firstFavoriteMeet], pools, new Date('invalid')), null);
      assert.equal(MeetDayGuideService.getGuide(null), null);
    });

    it('advances to the next chronological meet after the current meet concludes', () => {
      const duringMeet = MeetDayGuideService.getGuide(
        favoriteTeam, teams, [secondFavoriteMeet, firstFavoriteMeet], pools, new Date(2026, 5, 13, 11, 59)
      );
      const afterMeet = MeetDayGuideService.getGuide(
        favoriteTeam, teams, [secondFavoriteMeet, firstFavoriteMeet], pools, new Date(2026, 5, 13, 12)
      );
      const homePreviewAfterMeet = MeetDayGuideService.getGuide(
        favoriteTeam, teams, [firstFavoriteMeet, secondFavoriteMeet], pools, new Date(2026, 5, 13, 12), 2
      );

      assert.equal(duringMeet.meet.date, '2026-06-13');
      assert.equal(afterMeet.meet.date, '2026-06-20');
      assert.equal(afterMeet.dayLabel, 'In 7 days');
      assert.equal(homePreviewAfterMeet, null);
    });

    it('builds role-specific home guidance and accepts absent collections', () => {
      const host = {
        id: 'host',
        name: 'Host Team',
        shortName: 'Hosts',
        keywords: ['Host'],
        homeMeetGuides: [{
          poolId: 'host-pool',
          general: { helpfulNotes: ['Bring a canopy.'] },
          homeTeam: {
            arrivalTime: '06:30',
            clerkGuidance: 'The clerk of course checks in by the office.',
            helpfulNotes: ['Check assignments before arriving.'],
            swimmerCheckInLocation: 'at the large pavilion',
            volunteerCheckInLocation: 'at the volunteer table',
            warmupTime: '07:00'
          }
        }]
      };
      const visitor = { id: 'visitor', name: 'Visitor Team', shortName: 'Visitors', keywords: ['Visitor'] };
      const meet = new Meet({ date: '2026-06-20', home_team: 'Host', visiting_team: 'Visitor', location: 'Host Pool' }, meetTimes, 'dualMeets');
      const pool = { id: 'host-pool', name: 'Host', location: { street: '1 Main Street', city: 'Columbia', state: 'MD', zip: '21044' }, laneCount: 8, laneLength: 25, laneLengthUnits: 'yards' };
      const guide = MeetDayGuideService.getGuide(host, [host, visitor], [meet], [pool], new Date(2026, 5, 19, 12));

      assert.equal(guide.role, MeetTeamRole.HOME);
      assert.equal(guide.poolAddress, '1 Main Street, Columbia, MD 21044');
      assert.equal(MeetDayGuideService.getGuide(host, null, [meet], null, new Date(2026, 5, 19, 12)).pool, null);
    });

    it('accepts compatible camelCase meet records and skips malformed or unrelated candidates', () => {
      const host = {
        id: 'host', name: 'Host Team', keywords: ['Host'],
        homeMeetGuides: [{
          poolId: 'host-pool',
          general: {
            parkingLocation: 'Main lot', parkingNotes: ['Overflow on Main Street'],
            poolsideConditions: ['Sunny in the morning.']
          },
          homeTeam: { parkingLocation: 'Volunteer row' }
        }]
      };
      const visitor = { id: 'visitor', name: 'Visitor Team', keywords: ['Visitor'] };
      const meet = { date: '2026-06-20', homeTeam: 'Host', awayTeam: 'Visitor', location: 'Host Pool', time: '8:00 AM' };
      const guide = MeetDayGuideService.getGuide(host, [host, visitor], [
        null,
        { date: '2026-06-20', homeTeam: '', awayTeam: 'Visitor' },
        { date: '2026-06-20', homeTeam: 'Other', awayTeam: 'Visitor' },
        meet
      ], [{ id: 'host-pool', name: 'Host', address: '1 Main Street' }], new Date(2026, 5, 19, 12));

      assert.equal(guide.meet, meet);
      assert.equal(guide.homeTeam, host);
      assert.equal(guide.visitingTeam, visitor);
      assert.equal(guide.poolAddress, '1 Main Street');
      assert.match(MeetDayGuideService.renderGuide(guide), /Host Team/);
      assert.match(MeetDayGuideService.renderGuide(guide), /Visitor Team/);
      assert.match(MeetDayGuideService.renderGuide(guide), /Overflow on Main Street/);
      assert.match(MeetDayGuideService.renderGuide(guide), /Volunteer row/);
      assert.match(MeetDayGuideService.renderGuide(guide), /Sunny in the morning/);
      assert.equal(MeetDayGuideService.getPoolAddress({ name: 'Pool without location' }), '');
    });
  });

  describe('renderGuide', () => {
    it('renders fixture-owned away guidance with course, timing, and host details', () => {
      const guide = MeetDayGuideService.getGuide(favoriteTeam, teams, [firstFavoriteMeet], pools, new Date(2026, 5, 12, 12));
      const html = MeetDayGuideService.renderGuide(guide);

      assert.equal(guide.role, MeetTeamRole.AWAY);
      assertIncludesFixtureValues(html, [
        hostTeam.shortName,
        favoriteTeam.shortName,
        pools[0].location.street,
        hostTeam.homeMeetGuides[0].general.parkingNotes[0],
        hostTeam.homeMeetGuides[0].general.helpfulNotes[0],
        guide.roleGuide.arrivalGuidance,
        guide.roleGuide.clerkGuidance,
        guide.roleGuide.familySetupLocation,
        guide.roleGuide.reservedParking,
        ...hostTeam.homeMeetGuides[0].general.concessions.drinkItems,
        ...hostTeam.homeMeetGuides[0].general.concessions.mealItems,
        ...hostTeam.homeMeetGuides[0].general.concessions.snackItems
      ]);
      assert.match(html, /href="pools\.html\?pool=host-pool"/);
      assert.match(html, /class="my-meet-day__directions"/);
      assert.match(html, /aria-label="Key times"/);
      assert.ok(html.includes(Meet.formatClockTime(guide.roleGuide.warmupTime)));
      assert.ok(html.includes(Meet.formatClockTime(meetTimes.dualMeets.relayCheckInDeadline)));
      assert.ok(html.includes(Meet.formatClockTime(meetTimes.dualMeets.firstSwimTime)));

      const guidanceOnlyHtml = MeetDayGuideService.renderGuide({
        ...guide,
        roleGuide: { ...guide.roleGuide, arrivalTime: undefined }
      });
      assert.ok(guidanceOnlyHtml.includes(guide.roleGuide.arrivalGuidance));

      const twoDaysAheadHtml = MeetDayGuideService.renderGuide(
        MeetDayGuideService.getGuide(favoriteTeam, teams, [firstFavoriteMeet], pools, new Date(2026, 5, 11, 12))
      );
      assert.ok(twoDaysAheadHtml.toLowerCase().includes('in 2 days'));
    });

    it('renders shared concessions and role-specific guidance from deterministic records', () => {
      const homeGuide = MeetDayGuideService.getGuide(favoriteTeam, teams, [secondFavoriteMeet], pools, new Date(2026, 5, 19, 12));
      const homeHtml = MeetDayGuideService.renderGuide(homeGuide);
      const concessions = favoriteTeam.homeMeetGuides[0].general.concessions;

      assertIncludesFixtureValues(homeHtml, [
        ...favoriteTeam.homeMeetGuides[0].general.parkingNotes,
        ...concessions.drinkItems
      ]);
      assert.match(homeHtml, /href="#icon-banknote"/);
      assert.match(homeHtml, /src="assets\/images\/payment-methods\/paypal-monogram-full-color\.png"/);
      assert.match(homeHtml, /src="assets\/images\/payment-methods\/venmo-wordmark-blue\.png"/);
      assert.doesNotMatch(homeHtml, /payment-logo-frame/);
      assert.equal((homeHtml.match(/my-meet-day__concessions-items/g) || []).length, 1);

      const awayGuide = MeetDayGuideService.getGuide(secondVisitorTeam, teams, [secondFavoriteMeet], pools, new Date(2026, 5, 19, 12));
      const awayHtml = MeetDayGuideService.renderGuide(awayGuide);

      assert.equal(awayGuide.role, MeetTeamRole.AWAY);
      assert.equal(awayGuide.roleGuide, favoriteTeam.homeMeetGuides[0].visitingTeam);
      assertIncludesFixtureValues(awayHtml, [
        favoriteTeam.shortName,
        secondVisitorTeam.shortName,
        awayGuide.roleGuide.familySetupLocation,
        awayGuide.roleGuide.reservedParking,
        awayGuide.roleGuide.swimmerCheckInLocation
      ]);
      assert.ok(awayHtml.includes(Meet.formatClockTime(awayGuide.roleGuide.warmupTime)));
    });

    it('renders home timing, check-in, helpful notes, and role-specific content', () => {
      const guide = {
        date: '2026-06-20',
        dayLabel: 'Tomorrow',
        generalGuide: { helpfulNotes: ['Fixture home shared note.'] },
        homeTeam: { name: 'Host Team', shortName: 'Hosts' },
        meet: new Meet({ date: '2026-06-20', home_team: 'Host', visiting_team: 'Visitor', location: 'Host Pool' }, meetTimes, 'dualMeets'),
        pool: { id: 'host-pool', name: 'Host', laneCount: 8, laneLength: 25, laneLengthUnits: 'yards' },
        poolAddress: '1 Main Street',
        role: MeetTeamRole.HOME,
        roleGuide: {
          arrivalTime: '06:30', checkInGuidance: 'Fixture check-in guidance.', clerkGuidance: 'Fixture clerk guidance.', helpfulNotes: ['Fixture role note.'],
          swimmerCheckInLocation: 'at the fixture swimmer area', volunteerCheckInLocation: 'at the fixture volunteer area', warmupTime: '07:00'
        },
        team: { meetTimeOverrides: {} },
        visitingTeam: { name: 'Visitor Team', shortName: 'Visitors' }
      };
      const html = MeetDayGuideService.renderGuide(guide);
      const awayHtml = MeetDayGuideService.renderGuide({ ...guide, role: MeetTeamRole.AWAY });

      assert.equal(guide.role, MeetTeamRole.HOME);
      assertIncludesFixtureValues(html, [
        guide.homeTeam.shortName,
        guide.visitingTeam.shortName,
        guide.generalGuide.helpfulNotes[0],
        guide.roleGuide.checkInGuidance,
        guide.roleGuide.clerkGuidance,
        guide.roleGuide.helpfulNotes[0],
        guide.roleGuide.swimmerCheckInLocation,
        guide.roleGuide.volunteerCheckInLocation
      ]);
      assert.ok(html.includes(Meet.formatClockTime(guide.roleGuide.arrivalTime)));
      assert.ok(html.includes(Meet.formatClockTime(guide.roleGuide.warmupTime)));
      assert.ok(html.includes(Meet.formatClockTime(meetTimes.dualMeets.firstSwimTime)));
      assert.match(html, /href="pools\.html\?pool=host-pool"/);
      assert.match(html, /class="my-meet-day__directions"/);
      assert.notEqual(html, awayHtml);
      assert.doesNotMatch(html, /more heats/);
    });

    it('escapes supplied text and returns no markup without guidance', () => {
      const html = MeetDayGuideService.renderGuide({
        date: '2026-06-20"><ScRiPt>', dayLabel: 'Today', generalGuide: null,
        homeTeam: null, visitingTeam: null,
        meet: { homeTeam: '<Home>', awayTeam: '<Visitor>', location: '<Pool>', time: '<Time>' },
        pool: null, poolAddress: '<Address>', role: MeetTeamRole.AWAY, roleGuide: null,
        team: {}
      });

      assert.equal(MeetDayGuideService.renderGuide(null), '');
      assert.doesNotMatch(html, /<script\b|<Home>|<Visitor>|<Pool>|<Address>|<Time>/i);
      assert.match(html, /&lt;Home&gt;|&lt;Visitor&gt;/);

      const plainRecordHtml = MeetDayGuideService.renderGuide({
        date: '2026-06-20', dayLabel: 'Today', generalGuide: null,
        homeTeam: null, visitingTeam: null,
        meet: { homeTeam: 'Home', awayTeam: 'Visitor', location: 'Pool', timingWindow: { relayCheckInDeadline: '07:55', firstSwimTime: '08:00' } },
        pool: null, poolAddress: '', role: MeetTeamRole.AWAY, roleGuide: null,
        team: {}
      });
      assert.ok(plainRecordHtml.includes(Meet.formatClockTime('07:55')));
      assert.ok(plainRecordHtml.includes(Meet.formatClockTime('08:00')));
      assert.doesNotMatch(plainRecordHtml, /directions-link/);
    });
  });

  describe('formatting helpers', () => {
    it('formats fallback guide values and optional concessions fields', () => {
      assert.equal(MeetDayGuideService.formatClockTime('bad'), 'bad');
      assert.equal(MeetDayGuideService.formatClockTime(), '');
      assert.equal(MeetDayGuideService.formatWarmups({ warmupTime: '07:25' }), 'Start at 7:25 AM');
      assert.equal(MeetDayGuideService.formatWarmups(null), '');
      assert.deepEqual(MeetDayGuideService.getParkingLines(null, null), []);
      assert.deepEqual(MeetDayGuideService.getParkingLines(null, {
        reservedParking: 'Two spaces near the entrance are reserved for coaches and managers.'
      }), ['Two spaces near the entrance are reserved for coaches and managers.']);
      assert.deepEqual(MeetDayGuideService.getCheckInLines(null), []);
      assert.deepEqual(MeetDayGuideService.getConcessionLines(null), []);
      assert.equal(MeetDayGuideService.formatPaymentMethods([]), '');
      assert.deepEqual(MeetDayGuideService.getConcessionLines({
        paymentMethods: [PaymentMethod.CASH, PaymentMethod.CREDIT, PaymentMethod.VENMO, PaymentMethod.PAYPAL],
        dietaryOptions: [{ type: 'vegetarian', availability: 'available' }],
        notes: ['Limited quantities.']
      }), [
        'We accept cash, credit, Venmo, and PayPal.',
        'Please use bills of $20 or less; $5 and $1 bills are especially helpful.',
        'Dietary options: vegetarian (available)',
        'Limited quantities.'
      ]);
      assert.deepEqual(MeetDayGuideService.getConcessionLines({
        paymentMethods: [PaymentMethod.CASH, PaymentMethod.PAYPAL]
      }), [
        'We accept cash and PayPal.',
        'Please use bills of $20 or less; $5 and $1 bills are especially helpful.'
      ]);
      assert.deepEqual(MeetDayGuideService.getConcessionLines({
        paymentMethods: [PaymentMethod.PAYPAL]
      }), ['We accept PayPal.']);
      assert.deepEqual(MeetDayGuideService.getPaymentMethods({
        paymentMethods: [PaymentMethod.VENMO, 'Venmo', PaymentMethod.CASH, PaymentMethod.VENMO]
      }), [PaymentMethod.VENMO, PaymentMethod.CASH]);
      assert.deepEqual(MeetDayGuideService.getConcessionLines({ paymentMethods: ['custom'] }), []);
      assert.deepEqual(MeetDayGuideService.getConcessionLines({
        denominationsNotAccepted: [50, 100]
      }), ['We cannot accept $50 bills and $100 bills.']);
      assert.deepEqual(MeetDayGuideService.getConcessionLines({
        denominationsNotAccepted: [100],
        paymentMethods: [PaymentMethod.CASH]
      }), [
        'We accept cash.',
        'Please use bills of $20 or less; $5 and $1 bills are especially helpful.',
        'We cannot accept $100 bills.'
      ]);
      assert.equal(MeetDayGuideService.renderFact('Empty', []), '');
      assert.match(MeetDayGuideService.renderFact('Mixed', ['', 'Visible']), /Visible/);
      assert.equal(MeetDayGuideService.renderConcessionGroup('Food'), '');
      assert.equal(MeetDayGuideService.renderConcessionGroup('Food', []), '');
      assert.equal(
        MeetDayGuideService.renderConcessionGroup('Food & drinks', ['Bagels', '<Coffee>']),
        '<div class="my-meet-day__concessions-group"><strong>Food &amp; drinks</strong><ul class="my-meet-day__concessions-items"><li>Bagels</li><li>&lt;Coffee&gt;</li></ul></div>'
      );
      assert.equal(MeetDayGuideService.renderConcessions(null), '');
      assert.equal(MeetDayGuideService.renderConcessions({}), '');
      assert.equal(MeetDayGuideService.renderConcessions({ paymentMethods: ['custom'] }), '');
      assert.match(
        MeetDayGuideService.renderConcessions({ paymentMethods: [PaymentMethod.CASH] }),
        /<strong>We accept cash\.<\/strong><br>Please use bills of \$20 or less; \$5 and \$1 bills are especially helpful\./
      );
      assert.match(MeetDayGuideService.renderPaymentMethods([
        PaymentMethod.CASH, PaymentMethod.CREDIT, PaymentMethod.OTHER, PaymentMethod.PAYPAL, PaymentMethod.VENMO
      ]), /Cash.*Credit.*Other methods.*paypal-monogram-full-color.*venmo-wordmark-blue/);
      assert.equal(MeetDayGuideService.renderPaymentMethod('custom'), '');
      assert.equal(MeetDayGuideService.renderPaymentMethods(['custom']), '');
      assert.match(MeetDayGuideService.renderConcessions({ foodItems: ['bagels'] }), />Food<\/strong><ul[^>]*><li>bagels<\/li><\/ul>/);
      assert.equal(MeetDayGuideService.renderTimingFact('Empty', '', ''), '');
    });
  });

  describe('browser registration', () => {
    it('does not replace an existing service global', () => {
      const existingService = meetDayModule.context.MeetDayGuideService;
      meetDayModule.load('services/meet-day-guide-service.js');
      assert.equal(meetDayModule.context.MeetDayGuideService, existingService);
    });
  });
});
