const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const activeMeetsData = require('../../src/assets/data/2026/meets/meets.json');
const activePoolsData = require('../../src/assets/data/2026/pools/pools.json');
const activeTeamsData = require('../../src/assets/data/2026/teams/teams.json');
const meetDayModule = require('../helpers/browser-module-loader.js').loadBrowserModule('meet-day-guide-service');

const {
  Meet,
  MeetDayGuideService,
  MeetTeamRole
} = meetDayModule;

const teams = activeTeamsData.teams;
const pools = activePoolsData.pools;
const marlins = teams.find(team => team.id === 'lrm');
const firstMarlinsMeetData = activeMeetsData.regular_meets.find(meet => meet.date === '2026-06-13' && meet.visiting_team === 'Long Reach');
const firstMarlinsMeet = new Meet(firstMarlinsMeetData, activeMeetsData.meetTimes, 'dualMeets');

describe('MeetDayGuideService', () => {
  describe('getGuide', () => {
    it('builds away guidance from the active Marlins matchup one day before the meet', () => {
      const guide = MeetDayGuideService.getGuide(marlins, teams, [firstMarlinsMeet], pools, new Date(2026, 5, 12, 12));

      assert.equal(guide.role, MeetTeamRole.AWAY);
      assert.equal(guide.dayLabel, 'Tomorrow');
      assert.equal(guide.homeTeam.id, 'wlw');
      assert.equal(guide.visitingTeam.id, 'lrm');
      assert.equal(guide.pool.id, 'frp');
      assert.equal(guide.poolAddress, '10518 Marble Faun Court, Columbia, MD 21044');
      assert.equal(guide.roleGuide.reservedParking.spaceCount, 6);
    });

    it('shows guidance from two days ahead through meet day and omits it outside the configured window', () => {
      const twoDaysAheadGuide = MeetDayGuideService.getGuide(marlins, teams, [firstMarlinsMeet], pools, new Date(2026, 5, 11, 12));
      const todayGuide = MeetDayGuideService.getGuide(marlins, teams, [firstMarlinsMeet], pools, new Date(2026, 5, 13, 6));

      assert.equal(twoDaysAheadGuide.dayLabel, 'In 2 days');
      assert.equal(todayGuide.dayLabel, 'Today');
      assert.equal(MeetDayGuideService.getGuide(marlins, teams, [firstMarlinsMeet], pools, new Date(2026, 5, 10, 12)), null);
      assert.equal(MeetDayGuideService.getGuide(marlins, teams, [firstMarlinsMeet], pools, new Date(2026, 5, 14, 12)), null);
      assert.equal(MeetDayGuideService.getGuide(null, teams, [firstMarlinsMeet], pools, new Date(2026, 5, 12, 12)), null);
      assert.equal(MeetDayGuideService.getGuide(marlins, teams, null, pools, new Date(2026, 5, 12, 12)), null);
      assert.equal(MeetDayGuideService.getGuide(marlins, teams, [firstMarlinsMeet], pools, new Date('invalid')), null);
      assert.equal(MeetDayGuideService.getGuide(null), null);
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
            clerkLocation: 'By the office',
            helpfulNotes: ['Check assignments before arriving.'],
            swimmerCheckInLocation: 'Large pavilion',
            volunteerCheckInLocation: 'Volunteer table',
            warmups: { start: '07:00', end: '07:20' }
          }
        }]
      };
      const visitor = { id: 'visitor', name: 'Visitor Team', shortName: 'Visitors', keywords: ['Visitor'] };
      const meet = new Meet({ date: '2026-06-20', home_team: 'Host', visiting_team: 'Visitor', location: 'Host Pool' }, activeMeetsData.meetTimes, 'dualMeets');
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
    it('renders the active away guidance with course, host details, and volunteer context', () => {
      const guide = MeetDayGuideService.getGuide(marlins, teams, [firstMarlinsMeet], pools, new Date(2026, 5, 12, 12));
      const html = MeetDayGuideService.renderGuide(guide);

      assert.match(html, /Away meet/);
      assert.match(html, /Marlins at Watercats/);
      assert.match(html, /Friday|Saturday/);
      assert.match(html, /7:00 AM - 12:00 PM/);
      assert.match(html, /10518 Marble Faun Court, Columbia, MD 21044/);
      assert.match(html, /6-lane \/ 25-meter/);
      assert.match(html, /6 lanes can mean more heats/);
      assert.match(html, /Neighborhood center behind the pool/);
      assert.match(html, /6 reserved spaces for coaches and managers/);
      assert.match(html, /Behind the wading pool/);
      assert.match(html, /Payment: cash/);
      assert.match(html, /Cannot accept \$100 bills/);
      assert.match(html, /vegan by request/);
      assert.match(html, /volunteers from both teams/);
      assert.doesNotMatch(html, /Courtney|Lauren|Bess|gmail/);
    });

    it('renders home timing, check-in, helpful notes, and the stronger volunteer reminder', () => {
      const guide = {
        date: '2026-06-20',
        dayLabel: 'Tomorrow',
        generalGuide: { helpfulNotes: ['Bring a canopy.'] },
        homeTeam: { name: 'Host Team', shortName: 'Hosts' },
        meet: new Meet({ date: '2026-06-20', home_team: 'Host', visiting_team: 'Visitor', location: 'Host Pool' }, activeMeetsData.meetTimes, 'dualMeets'),
        pool: { id: 'host-pool', name: 'Host', laneCount: 8, laneLength: 25, laneLengthUnits: 'yards' },
        poolAddress: '1 Main Street',
        role: MeetTeamRole.HOME,
        roleGuide: {
          arrivalTime: '06:30', clerkLocation: 'By the office', helpfulNotes: ['Check assignments.'],
          swimmerCheckInLocation: 'Large pavilion', volunteerCheckInLocation: 'Volunteer table', warmups: { start: '07:00', end: '07:20' }
        },
        team: { meetTimeOverrides: {} },
        visitingTeam: { name: 'Visitor Team', shortName: 'Visitors' }
      };
      const html = MeetDayGuideService.renderGuide(guide);

      assert.match(html, /Home meet/);
      assert.match(html, /6:30 AM/);
      assert.match(html, /7:00 AM - 7:20 AM/);
      assert.match(html, /Large pavilion/);
      assert.match(html, /Volunteer table/);
      assert.match(html, /By the office/);
      assert.match(html, /Bring a canopy/);
      assert.match(html, /Home meets depend on volunteers/);
      assert.doesNotMatch(html, /more heats/);
    });

    it('escapes supplied text and returns no markup without guidance', () => {
      const html = MeetDayGuideService.renderGuide({
        date: '2026-06-20"><script>', dayLabel: 'Today', generalGuide: null,
        homeTeam: null, visitingTeam: null,
        meet: { homeTeam: '<Home>', awayTeam: '<Visitor>', location: '<Pool>', time: '<Time>' },
        pool: null, poolAddress: '<Address>', role: MeetTeamRole.AWAY, roleGuide: null,
        team: {}
      });

      assert.equal(MeetDayGuideService.renderGuide(null), '');
      assert.doesNotMatch(html, /<script>|<Home>|<Visitor>|<Pool>|<Address>|<Time>/);
      assert.match(html, /&lt;Home&gt;|&lt;Visitor&gt;/);
    });
  });

  describe('formatting helpers', () => {
    it('formats fallback guide values and optional concessions fields', () => {
      assert.equal(MeetDayGuideService.formatClockTime('bad'), 'bad');
      assert.equal(MeetDayGuideService.formatClockTime(), '');
      assert.equal(MeetDayGuideService.formatWarmups({ warmups: { start: '07:00' } }), 'Start at 7:00 AM');
      assert.equal(MeetDayGuideService.formatWarmups({ warmupsStartAt: '07:30' }), 'Start at 7:30 AM');
      assert.equal(MeetDayGuideService.formatWarmups(null), '');
      assert.deepEqual(MeetDayGuideService.getParkingLines(null, null), []);
      assert.deepEqual(MeetDayGuideService.getConcessionLines(null), []);
      assert.deepEqual(MeetDayGuideService.getConcessionLines({
        paymentMethods: ['cash', 'credit', 'venmo', 'paypal'],
        dietaryOptions: [{ type: 'vegetarian', availability: 'available' }],
        notes: ['Limited quantities.']
      }), ['Payment: cash, credit, Venmo, PayPal', 'Dietary options: vegetarian (available)', 'Limited quantities.']);
      assert.deepEqual(MeetDayGuideService.getConcessionLines({
        paymentMethods: ['custom']
      }), ['Payment: custom']);
      assert.equal(MeetDayGuideService.renderFact('Empty', []), '');
      assert.match(MeetDayGuideService.renderFact('Mixed', ['', 'Visible']), /Visible/);
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
