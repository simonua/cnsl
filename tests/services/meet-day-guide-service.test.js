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
      parkingNotes: ['Park in the fixture overflow lot.', 'Fixture parking caution.', 'Fixture reserved parking guidance.'],
      poolsideConditions: ['Fixture poolside condition.']
    },
    poolId: 'host-pool',
    source: { receivedOn: '2026-06-12', type: 'host-team-manager' },
    visitingTeam: {
      arrivalGuidance: 'Fixture arrival guidance.',
      arrivalTime: '07:15',
      clerkGuidance: 'Fixture clerk location.',
      familySetupLocation: 'in the fixture visitor area',
      swimmerCheckInLocation: 'at the fixture check-in table',
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
      volunteerCheckInLocation: 'Fixture data table.'
    },
    homeTeam: {
      arrivalTime: '06:30',
      parkingNotes: ['Fixture home parking note.', 'Fixture home <script> parking note.'],
      warmupTime: '07:00'
    },
    poolId: 'favorite-pool',
    source: { receivedOn: '2026-06-19', type: 'host-team-manager' },
    visitingTeam: {
      familySetupLocation: 'in the fixture shaded area',
      parkingNotes: ['Fixture visitor parking note.'],
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
    });

    it('uses only general instructions when host guidance belongs to an earlier meet', () => {
      const laterMeet = new Meet({
        date: '2026-06-20', home_team: 'Host', location: 'Host Pool', visiting_team: 'Second Visitor'
      }, meetTimes, 'dualMeets');
      const guide = MeetDayGuideService.getGuide(
        secondVisitorTeam,
        teams,
        [firstFavoriteMeet, laterMeet],
        pools,
        new Date(2026, 5, 19, 12)
      );
      const html = MeetDayGuideService.renderGuide(guide);

      assert.equal(guide.generalGuide, hostTeam.homeMeetGuides[0].general);
      assert.equal(guide.roleGuide, null);
      assert.ok(html.includes(hostTeam.homeMeetGuides[0].general.parkingNotes[0]));
      assert.doesNotMatch(html, /Fixture arrival guidance|Fixture clerk location|fixture visitor area/i);
      assert.match(html, /<dt>Arm markings<\/dt>/);
      assert.match(html, /<dt>Good to know<\/dt>/);
      assert.match(html, /<dt>Volunteer reminder<\/dt>/);
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
          source: { receivedOn: '2026-06-19', type: 'host-team-manager' },
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
      assert.equal(MeetDayGuideService.getGuide(host, null, [meet], null, new Date(2026, 5, 19, 12)).pool, null);
    });

    it('retains unambiguous host guidance before pool records are available', () => {
      const host = {
        id: 'host',
        name: 'Host Team',
        keywords: ['Host'],
        homePools: ['Host Pool'],
        homeMeetGuides: [{
          poolId: 'host-pool',
          general: { helpfulNotes: ['Fixture guidance'] },
          source: { receivedOn: '2026-06-19', type: 'host-team-manager' },
          homeTeam: { arrivalTime: '06:30' }
        }]
      };
      const visitor = { id: 'visitor', name: 'Visitor Team', keywords: ['Visitor'] };
      const meet = new Meet({ date: '2026-06-20', home_team: 'Host', visiting_team: 'Visitor', location: 'Host Pool' }, meetTimes, 'dualMeets');

      const guide = MeetDayGuideService.getGuide(host, [host, visitor], [meet], [], new Date(2026, 5, 19, 12));

      assert.equal(guide.pool, null);
      assert.equal(guide.generalGuide.helpfulNotes[0], 'Fixture guidance');
      assert.equal(guide.roleGuide.arrivalTime, '06:30');
    });

    it('accepts canonical meet records and skips malformed or unrelated candidates', () => {
      const host = {
        id: 'host', name: 'Host Team', keywords: ['Host'],
        homeMeetGuides: [{
          poolId: 'host-pool',
          general: {
            parkingNotes: ['Park in the main lot.', 'Overflow on Main Street'],
            poolsideConditions: ['Sunny in the morning.']
          },
          source: { receivedOn: '2026-06-19', type: 'host-team-manager' },
          homeTeam: {}
        }]
      };
      const visitor = { id: 'visitor', name: 'Visitor Team', keywords: ['Visitor'] };
      const meet = { date: '2026-06-20', home_team: 'Host', visiting_team: 'Visitor', location: 'Host Pool' };
      const guide = MeetDayGuideService.getGuide(host, [host, visitor], [
        null,
        { date: '2026-06-20', home_team: '', visiting_team: 'Visitor' },
        { date: '2026-06-20', home_team: 'Other', visiting_team: 'Visitor' },
        meet
      ], [{ id: 'host-pool', name: 'Host', address: '1 Main Street' }], new Date(2026, 5, 19, 12));

      assert.equal(guide.meet, meet);
      assert.equal(guide.homeTeam, host);
      assert.equal(guide.visitingTeam, visitor);
      assert.match(MeetDayGuideService.renderGuide(guide), /Host Team/);
      assert.match(MeetDayGuideService.renderGuide(guide), /Visitor Team/);
      assert.match(MeetDayGuideService.renderGuide(guide), /Overflow on Main Street/);
      assert.match(MeetDayGuideService.renderGuide(guide), /Sunny in the morning/);
    });
  });

  describe('renderGuide', () => {
    it('renders fixture-owned away guidance with timing and host details', () => {
      const guide = MeetDayGuideService.getGuide(favoriteTeam, teams, [firstFavoriteMeet], pools, new Date(2026, 5, 12, 12));
      const html = MeetDayGuideService.renderGuide(guide);

      assert.equal(guide.role, MeetTeamRole.AWAY);
      assertIncludesFixtureValues(html, [
        hostTeam.shortName,
        favoriteTeam.shortName,
        hostTeam.homeMeetGuides[0].general.parkingNotes[0],
        hostTeam.homeMeetGuides[0].general.helpfulNotes[0],
        guide.roleGuide.arrivalGuidance,
        guide.roleGuide.clerkGuidance,
        guide.roleGuide.familySetupLocation,
        ...hostTeam.homeMeetGuides[0].general.concessions.drinkItems,
        ...hostTeam.homeMeetGuides[0].general.concessions.mealItems,
        ...hostTeam.homeMeetGuides[0].general.concessions.snackItems
      ]);
      assert.match(html, /Favorites check in at the fixture check-in table\./);
      assert.match(html, /href="pools\.html\?pool=host-pool"/);
      assert.match(html, /<dt>Arm markings<\/dt>/);
      assert.match(html, /Please see <a href="swim-meet-resources\.html#arm-markings">how to mark a swimmer's arm<\/a> for detailed instructions\./);
      assert.doesNotMatch(html, /arm must be completely dry|Before leaving home for the meet|relay position in parentheses|Event \(E\)/);
      assert.match(html, /class="my-meet-day__directions"/);
      assert.doesNotMatch(html, /<dt>Where<\/dt>/);
      assert.doesNotMatch(html, new RegExp(pools[0].location.street));
      assert.match(html, /aria-label="Key times"/);
      assert.match(html, /<dt>Favorites Arrival<\/dt>/);
      assert.doesNotMatch(html, /Gates open/);
      assert.doesNotMatch(html, /<dt>Pool<\/dt>/);
      assert.match(html, /<dt>Parking<\/dt><dd>[^<]/);
      assert.doesNotMatch(html, /<dt>Parking<\/dt><dd><ul/);
      assert.match(html, /<dt>Good to know<\/dt><dd><ul class="my-meet-day__guidance-list"><li>/);
      assert.ok(html.indexOf('<dt>Good to know</dt>') < html.indexOf('<dt>Volunteer reminder</dt>'));
      assert.ok(html.indexOf('<dt>Volunteer reminder</dt>') < html.indexOf('<dt>Concessions</dt>'));
      assert.ok(html.includes(Meet.formatClockTime(guide.roleGuide.warmupTime)));
      assert.ok(html.includes(Meet.formatClockTime(meetTimes.dualMeets.relayCheckInDeadline)));
      assert.match(html, /Swimmers not checked in will be dropped from relays\./);
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
        favoriteTeam.homeMeetGuides[0].homeTeam.parkingNotes[0],
        ...concessions.drinkItems
      ]);
      assert.match(homeHtml, /Fixture home &lt;script&gt; parking note\./);
      assert.doesNotMatch(homeHtml, /Fixture visitor parking note\.|<script>/i);
      assert.match(homeHtml, /<dt>Favorites Arrival<\/dt>/);
      assert.doesNotMatch(homeHtml, /Gates open/);
      assert.match(homeHtml, /href="#icon-banknote"/);
      assert.match(homeHtml, /<strong>Favorites accept cash, PayPal, and Venmo\.<\/strong>/);
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
        favoriteTeam.homeMeetGuides[0].visitingTeam.parkingNotes[0],
        awayGuide.roleGuide.swimmerCheckInLocation
      ]);
      assert.match(awayHtml, /Visitors check in at the fixture check-in table\./);
      assert.doesNotMatch(awayHtml, /Fixture home parking note\.|Fixture home &lt;script&gt; parking note\./);
      assert.ok(awayHtml.includes(Meet.formatClockTime(awayGuide.roleGuide.warmupTime)));
      assert.match(awayHtml, /<dt>Visitors Arrival<\/dt>/);
      assert.match(awayHtml, /<strong>Favorites accept cash, PayPal, and Venmo\.<\/strong>/);
      assert.doesNotMatch(awayHtml, /Visitors accept/);
      assert.doesNotMatch(awayHtml, /Gates open/);
    });

    it('renders home timing, check-in, helpful notes, and role-specific content', () => {
      const guide = {
        date: '2026-06-20',
        dayLabel: 'Tomorrow',
        generalGuide: { helpfulNotes: ['Fixture home shared note.'] },
        homeTeam: { name: 'Host Team', shortName: 'Hosts' },
        meet: new Meet({ date: '2026-06-20', home_team: 'Host', visiting_team: 'Visitor', location: 'Host Pool' }, meetTimes, 'dualMeets'),
        pool: { id: 'host-pool', name: 'Host', laneCount: 8, laneLength: 25, laneLengthUnits: 'yards' },
        role: MeetTeamRole.HOME,
        roleGuide: {
          arrivalTime: '06:30', checkInGuidance: 'Fixture check-in guidance.', clerkGuidance: 'Fixture clerk guidance.', familySetupLocation: 'in the fixture setup area', helpfulNotes: ['Fixture role note.'],
          swimmerCheckInLocation: 'at the fixture swimmer area', volunteerCheckInLocation: 'at the fixture volunteer area', warmupTime: '07:00'
        },
        team: { meetTimeOverrides: {}, shortName: 'Hosts' },
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
      assert.match(html, /Hosts check in at the fixture swimmer area\./);
      assert.ok(html.includes(Meet.formatClockTime(guide.roleGuide.arrivalTime)));
      assert.match(html, /<dt>Hosts Arrival<\/dt>/);
      assert.match(html, /<strong>By 6:30 AM<\/strong>/);
      assert.doesNotMatch(html, /Arrive by/);
      assert.ok(html.includes(Meet.formatClockTime(guide.roleGuide.warmupTime)));
      assert.ok(html.includes(Meet.formatClockTime(meetTimes.dualMeets.firstSwimTime)));
      assert.match(html, /href="pools\.html\?pool=host-pool"/);
      assert.match(html, /class="my-meet-day__directions"/);
      assert.ok(html.indexOf('<dt>Parking</dt>') < html.indexOf('<dt>Check-in</dt>'));
      assert.ok(html.indexOf('<dt>Check-in</dt>') < html.indexOf('<dt>Team setup</dt>'));
      assert.doesNotMatch(html, /<dt>(?:Parking|Check-in|Team setup)<\/dt><dd><ul/);
      assert.match(html, /class="my-meet-day__fact my-meet-day__fact--volunteer"><dt>Volunteer reminder<\/dt><dd>/);
      assert.match(html, /<strong>Swim meets depend on volunteers\.<\/strong> Please check your team signup and help fill any open role\. <strong>Thank you! 🙏<\/strong>/);
      const volunteerFactPattern = /<div class="my-meet-day__fact my-meet-day__fact--volunteer">.*?<\/div>/;
      assert.equal(html.match(volunteerFactPattern)?.[0], awayHtml.match(volunteerFactPattern)?.[0]);
      assert.ok(html.indexOf(guide.roleGuide.helpfulNotes[0]) < html.indexOf(guide.generalGuide.helpfulNotes[0]));
      assert.ok(awayHtml.indexOf(guide.generalGuide.helpfulNotes[0]) < awayHtml.indexOf(guide.roleGuide.helpfulNotes[0]));
      assert.doesNotMatch(html, /my-meet-day__volunteer/);
      assert.notEqual(html, awayHtml);
      assert.doesNotMatch(html, /more heats/);
    });

    it('escapes supplied text and returns no markup without guidance', () => {
      const html = MeetDayGuideService.renderGuide({
        date: '2026-06-20"><ScRiPt>', dayLabel: 'Today', generalGuide: null,
        homeTeam: null, visitingTeam: null,
        meet: { home_team: '<Home>', visiting_team: '<Visitor>', location: '<Pool>', time: '<Time>' },
        pool: null, role: MeetTeamRole.AWAY, roleGuide: null,
        team: {}
      });

      assert.equal(MeetDayGuideService.renderGuide(null), '');
      assert.doesNotMatch(html, /<script\b|<Home>|<Visitor>|<Pool>|<Address>|<Time>/i);
      assert.match(html, /&lt;Home&gt;|&lt;Visitor&gt;/);

      const plainRecordHtml = MeetDayGuideService.renderGuide({
        date: '2026-06-20', dayLabel: 'Today', generalGuide: null,
        homeTeam: null, visitingTeam: null,
        meet: { home_team: 'Home', visiting_team: 'Visitor', location: 'Pool', timingWindow: { relayCheckInDeadline: '07:55', firstSwimTime: '08:00' } },
        pool: null, role: MeetTeamRole.AWAY, roleGuide: null,
        team: {}
      });
      assert.ok(plainRecordHtml.includes(Meet.formatClockTime('07:55')));
      assert.ok(plainRecordHtml.includes(Meet.formatClockTime('08:00')));
      assert.doesNotMatch(plainRecordHtml, /directions-link/);
    });
  });

  describe('formatting helpers', () => {
    it('formats fallback guide values and optional concessions fields', () => {
      assert.equal(MeetDayGuideService.findPool([{ id: 'other-pool' }], 'Missing Pool'), null);
      assert.equal(MeetDayGuideService.findHostGuide({
        homeMeetGuides: [{ poolId: 'other-pool' }]
      }, { id: 'host-pool' }, 'Host Pool'), null);
      assert.equal(MeetDayGuideService.findHostGuide({
        homeMeetGuides: [{ poolId: 'only-guide' }]
      }, null, null), null);
      assert.equal(MeetDayGuideService.findHostGuide({
        homeMeetGuides: [{ poolId: 'only-guide' }],
        homePools: [null]
      }, null, 'Host Pool'), null);
      assert.equal(MeetDayGuideService.getMeetDisplayTime({
        getDisplayTime: override => override,
        getTimeWindowKey: () => 'dualMeets'
      }, {
        getMeetTimeOverride: key => key
      }), 'dualMeets');
      assert.equal(MeetDayGuideService.formatClockTime('bad'), 'bad');
      assert.equal(MeetDayGuideService.formatClockTime(), '');
      assert.equal(MeetDayGuideService.formatWarmups({ warmupTime: '07:25' }), 'Start at 7:25 AM');
      assert.equal(MeetDayGuideService.formatWarmups(null), '');
      assert.deepEqual(MeetDayGuideService.getParkingLines(null, null), []);
      assert.deepEqual(MeetDayGuideService.getParkingLines({
        parkingNotes: ['Shared parking guidance.']
      }, {
        parkingNotes: ['Role parking guidance.']
      }), ['Shared parking guidance.', 'Role parking guidance.']);
      assert.deepEqual(MeetDayGuideService.getCheckInLines(null), []);
      assert.deepEqual(MeetDayGuideService.getCheckInLines({
        swimmerCheckInLocation: 'at the fixture table'
      }, 'Fixture Team'), ['Fixture Team check in at the fixture table.']);
      assert.deepEqual(MeetDayGuideService.getCheckInLines({
        swimmerCheckInLocation: 'at the fixture table'
      }), ['Swimmers check in at the fixture table.']);
      assert.deepEqual(MeetDayGuideService.getHelpfulNotes({
        helpfulNotes: ['Shared note.'], poolsideConditions: ['Shared condition.']
      }, {
        helpfulNotes: ['Home note.']
      }, MeetTeamRole.HOME), [
        'Please tell team managers or check-in volunteers before leaving early if a swimmer is in a relay.',
        'Home note.',
        'Shared condition.',
        'Shared note.'
      ]);
      assert.deepEqual(MeetDayGuideService.getHelpfulNotes({
        helpfulNotes: ['Shared note.'], poolsideConditions: ['Shared condition.']
      }, {
        helpfulNotes: ['Away note.']
      }, MeetTeamRole.AWAY), [
        'Please tell team managers or check-in volunteers before leaving early if a swimmer is in a relay.',
        'Shared condition.',
        'Shared note.',
        'Away note.'
      ]);
      assert.deepEqual(MeetDayGuideService.getConcessionLines(null), []);
      assert.equal(MeetDayGuideService.formatPaymentMethods([]), '');
      assert.deepEqual(MeetDayGuideService.getConcessionLines({
        paymentMethods: [PaymentMethod.CASH, PaymentMethod.CREDIT, PaymentMethod.VENMO, PaymentMethod.PAYPAL],
        dietaryOptions: [{ type: 'vegetarian', availability: 'available' }],
        notes: ['Limited quantities.']
      }, 'Marlins'), [
        'Marlins accept cash, credit, Venmo, and PayPal.',
        'Please use bills of $20 or less; $5 and $1 bills are especially helpful.',
        'Dietary options: vegetarian (available)',
        'Limited quantities.'
      ]);
      assert.deepEqual(MeetDayGuideService.getConcessionLines({
        paymentMethods: [PaymentMethod.CASH, PaymentMethod.PAYPAL]
      }, 'Marlins'), [
        'Marlins accept cash and PayPal.',
        'Please use bills of $20 or less; $5 and $1 bills are especially helpful.'
      ]);
      assert.deepEqual(MeetDayGuideService.getConcessionLines({
        paymentMethods: [PaymentMethod.PAYPAL]
      }, 'Marlins'), ['Marlins accept PayPal.']);
      assert.deepEqual(MeetDayGuideService.getConcessionLines({
        paymentMethods: [PaymentMethod.PAYPAL]
      }), ['The home team accepts PayPal.']);
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
      }, 'Marlins'), [
        'Marlins accept cash.',
        'Please use bills of $20 or less; $5 and $1 bills are especially helpful.',
        'We cannot accept $100 bills.'
      ]);
      assert.equal(MeetDayGuideService.renderFact('Empty', []), '');
      assert.match(MeetDayGuideService.renderFact('Mixed', ['', 'Visible']), /Visible/);
      assert.equal(MeetDayGuideService.renderGuidanceFact('Empty', []), '');
      assert.equal(
        MeetDayGuideService.renderGuidanceFact('Good to know', ['', '<Single note>']),
        '<div class="my-meet-day__fact"><dt>Good to know</dt><dd>&lt;Single note&gt;</dd></div>'
      );
      assert.equal(
        MeetDayGuideService.renderGuidanceFact('Parking', ['', 'Main lot', '<Overflow lot>']),
        '<div class="my-meet-day__fact"><dt>Parking</dt><dd><ul class="my-meet-day__guidance-list"><li>Main lot</li><li>&lt;Overflow lot&gt;</li></ul></dd></div>'
      );
      assert.equal(MeetDayGuideService.renderConcessionGroup('Food'), '');
      assert.equal(MeetDayGuideService.renderConcessionGroup('Food', []), '');
      assert.equal(
        MeetDayGuideService.renderConcessionGroup('Food & drinks', ['Bagels', '<Coffee>']),
        '<div class="my-meet-day__concessions-group"><strong>Food &amp; drinks</strong><ul class="my-meet-day__concessions-items"><li>Bagels</li><li>&lt;Coffee&gt;</li></ul></div>'
      );
      assert.match(MeetDayGuideService.renderConcessionGroup('Meals', ['Pizza']), /href="#icon-utensils"/);
      assert.match(MeetDayGuideService.renderConcessionGroup('Snacks', ['Cookies']), /href="#icon-cookie"/);
      assert.match(MeetDayGuideService.renderConcessionGroup('Drinks', ['Water']), /href="#icon-cup-soda"/);
      assert.equal(MeetDayGuideService.renderConcessions(null), '');
      assert.equal(MeetDayGuideService.renderConcessions({}), '');
      assert.equal(MeetDayGuideService.renderConcessions({ paymentMethods: ['custom'] }), '');
      assert.match(
        MeetDayGuideService.renderConcessions({ paymentMethods: [PaymentMethod.CASH] }, '<Marlins>'),
        /<div class="my-meet-day__payment-summary"><p[^>]*><strong>&lt;Marlins&gt; accept cash\.<\/strong><\/p><div class="my-meet-day__payment-methods"[^>]*>.*<\/div><\/div><p class="my-meet-day__concessions-details my-meet-day__concessions-details--supporting">Please use bills of \$20 or less; \$5 and \$1 bills are especially helpful\.<\/p>/
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
