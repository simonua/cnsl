const AppConfig = require('../../../scripts/adapters/app-config.js');

const YEAR = AppConfig.YEAR;
const TEST_IDENTITIES = Object.freeze({
  pools: Object.freeze({
    contact: Object.freeze({ id: 'fixture-harbor-pool', name: 'Fixture Harbor' }),
    host: Object.freeze({ id: 'fixture-grove-pool', name: 'Fixture Grove' }),
    secondary: Object.freeze({ id: 'fixture-hills-pool', name: 'Fixture Hills' }),
    fourth: Object.freeze({ id: 'fixture-meadow-pool', name: 'Fixture Meadow' }),
    fifth: Object.freeze({ id: 'fixture-springs-pool', name: 'Fixture Springs' })
  }),
  teams: Object.freeze({
    primary: Object.freeze({ id: 'fixture-rapids', name: 'Fixture Rapids' }),
    opponent: Object.freeze({ id: 'fixture-barracudas', name: 'Fixture Barracudas' }),
    externalActions: Object.freeze({ id: 'fixture-stingrays', name: 'Fixture Stingrays' }),
    withoutActions: Object.freeze({ id: 'fixture-otters', name: 'Fixture Otters' })
  })
});

function createLocation(seed, street) {
  return {
    street,
    city: 'Columbia',
    state: 'MD',
    zip: `2104${seed}`,
    lat: 39.2 + (seed / 1000),
    lng: -76.8 - (seed / 1000),
    mapsQuery: `${street} Columbia MD`,
    googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=Fixture+Pool+${seed}`
  };
}

function createSchedules(includeAquaSource) {
  return [{
    startDate: `${YEAR}-05-23`,
    endDate: `${YEAR}-09-07`,
    hours: [
      { weekDays: ['Mon', 'Tue', 'Fri', 'Sat', 'Sun'], types: ['Laps', 'Rec Swim'], accessStatus: 'public', startTime: '12:00pm', endTime: '7:00pm' },
      {
        weekDays: ['Wed'],
        types: ['Aqua Fitness'],
        accessStatus: 'restricted',
        startTime: '10:00am',
        endTime: '11:00am',
        ...(includeAquaSource ? { sourceUrl: 'https://fixtures.example/aqua-fitness' } : {})
      },
      { weekDays: ['Thu'], types: ['CNSL Practice Only'], accessStatus: 'practice-only', startTime: '8:00am', endTime: '10:00am' }
    ]
  }];
}

function createPool({ id, name, seed, phone = '' }) {
  return {
    id,
    name,
    caUrl: `https://fixtures.example/pools/${id}`,
    location: createLocation(seed, `${seed} Fixture Lane`),
    ...(phone ? { phone } : {}),
    features: seed === 1
      ? ['ADA compliant', 'lap', 'wading']
      : [...(seed === 2 ? ['basketball court', 'heated pool'] : []), 'lap', 'shade'],
    laneCount: 6,
    laneLengthUnits: seed === 2 ? 'yards' : 'meters',
    laneLength: 25,
    scheduleUrl: `https://fixtures.example/schedules/${id}.pdf`,
    schedules: createSchedules(seed === 1),
    scheduleOverrides: []
  };
}

function createStaff(teamId) {
  return {
    sourceUrl: `https://fixtures.example/teams/${teamId}/staff`,
    verifiedOn: `${YEAR}-05-01`,
    coaches: [],
    managers: [],
    contacts: []
  };
}

function createPractice(poolName) {
  return {
    url: 'https://fixtures.example/practice-schedule',
    preseason: [
      {
        period: 'May 26 - May 29',
        days: 'Tuesday - Friday',
        location: `${poolName} Pool`,
        sessions: [
          { time: '5:00 - 5:30pm', group: 'First Splash' },
          { time: '5:30 - 6:00pm', group: '8 & Under' },
          { time: '6:00 - 6:30pm', group: '9 - 10' }
        ]
      },
      {
        period: 'June 1 - June 5',
        days: 'Monday - Friday',
        location: `${poolName} Pool`,
        sessions: [{ time: '5:00 - 5:45pm', group: '9 - 10' }]
      }
    ],
    regular: {
      season: 'June 19 - July 23',
      morning: [{
        days: 'Tuesday - Friday',
        location: `${poolName} Pool`,
        sessions: [
          { time: '8:00 - 8:45am', group: '11 & Over' },
          { time: '8:45 - 9:30am', group: '9 - 10' },
          { time: '9:30 - 10:00am', group: '8 & Under' }
        ]
      }],
      evening: [{
        day: 'Monday',
        location: `${poolName} Pool`,
        sessions: [{ time: '5:00 - 5:45pm', group: '10 & Under' }]
      }]
    }
  };
}

function createMeetGuide(poolId) {
  return {
    poolId,
    source: { type: 'host-team-manager', receivedOn: `${YEAR}-05-20` },
    general: {
      helpfulNotes: ['Fixture data table is beside the entrance.'],
      concessions: {
        paymentMethods: ['cash', 'paypal', 'venmo'],
        mealItems: ['sandwiches'],
        snackItems: ['fruit'],
        drinkItems: ['water']
      }
    },
    homeTeam: {
      arrivalTime: '06:45',
      familySetupLocation: 'the home side of the pool',
      swimmerCheckInLocation: 'the home team table',
      warmupTime: '07:00'
    },
    visitingTeam: {
      arrivalTime: '07:00',
      familySetupLocation: 'the visiting side of the pool',
      swimmerCheckInLocation: 'the visiting team table',
      warmupTime: '07:25'
    }
  };
}

function createBaseTeam({ id, name, shortName, homePool, actions = false }) {
  return {
    id,
    name,
    shortName,
    keywords: [name.toLowerCase(), shortName.toLowerCase()],
    url: `https://fixtures.example/teams/${id}`,
    merchandiseUrl: actions ? 'https://fixture-team-swimseason.spiritsale.com/' : '',
    calendarUrl: `https://fixtures.example/teams/${id}/page/calendar`,
    eventsSubscriptionUrl: actions ? `https://fixtures.example/teams/${id}/events.ics` : '',
    ...(actions ? { booster: { name: `${name} Booster Club`, url: `https://fixtures.example/teams/${id}/boosters` } } : {}),
    homePools: [homePool],
    timeTrialsPool: homePool,
    practicePools: [homePool],
    staff: createStaff(id)
  };
}

function createTestDataFixture() {
  const contactPool = createPool({ ...TEST_IDENTITIES.pools.contact, seed: 1, phone: '410-555-0101' });
  contactPool.scheduleOverrides = [{
    startDate: `${YEAR}-06-25`,
    endDate: `${YEAR}-06-25`,
    overrideMode: 'overlay',
    reason: 'Fixture community event',
    hours: [{ weekDays: ['Thu'], types: ['Special Event'], accessStatus: 'special-event', startTime: '10:00am', endTime: '12:00pm' }]
  }];

  const hostPool = createPool({ ...TEST_IDENTITIES.pools.host, seed: 2 });
  const secondaryPool = createPool({ ...TEST_IDENTITIES.pools.secondary, seed: 3 });
  const fourthPool = createPool({ ...TEST_IDENTITIES.pools.fourth, seed: 4 });
  const fifthPool = createPool({ ...TEST_IDENTITIES.pools.fifth, seed: 5 });

  const primaryTeam = {
    ...createBaseTeam({
      ...TEST_IDENTITIES.teams.primary,
      shortName: 'Rapids',
      homePool: contactPool.name
    }),
    practice: createPractice(contactPool.name),
    homeMeetGuides: [createMeetGuide(contactPool.id)],
    staff: {
      sourceUrl: `https://fixtures.example/teams/${TEST_IDENTITIES.teams.primary.id}/staff`,
      verifiedOn: `${YEAR}-05-01`,
      coaches: [
        { name: 'Fixture Head Coach', role: 'Head Coach', email: 'head.coach@fixtures.example' },
        { name: 'Fixture Assistant Coach', role: 'Assistant Coach' }
      ],
      managers: [
        { name: 'Fixture Team Manager', role: 'Team Manager', email: 'manager@fixtures.example' }
      ],
      contacts: [
        { audience: 'coaches', label: 'All coaches', email: 'coaches@fixtures.example' },
        { audience: 'managers', label: 'All managers', email: 'managers@fixtures.example' }
      ]
    }
  };
  const opponentTeam = {
    ...createBaseTeam({
      ...TEST_IDENTITIES.teams.opponent,
      shortName: 'Barracudas',
      homePool: hostPool.name
    }),
    homeMeetGuides: [createMeetGuide(hostPool.id)]
  };
  const externalActionTeam = createBaseTeam({
    ...TEST_IDENTITIES.teams.externalActions,
    shortName: 'Stingrays',
    homePool: fourthPool.name,
    actions: true
  });
  const teamWithoutActions = createBaseTeam({
    ...TEST_IDENTITIES.teams.withoutActions,
    shortName: 'Otters',
    homePool: secondaryPool.name
  });

  return {
    pools: {
      $schema: 'pools.schema.json',
      seasonStartDate: `${YEAR}-05-23`,
      seasonEndDate: `${YEAR}-09-07`,
      caPoolDirectoryUrl: 'https://fixtures.example/pools',
      caPoolGuideUrl: 'https://fixtures.example/pool-guide',
      pools: [contactPool, hostPool, secondaryPool, fourthPool, fifthPool]
    },
    teams: {
      $schema: 'teams.schema.json',
      teams: [primaryTeam, opponentTeam, externalActionTeam, teamWithoutActions]
    },
    meets: {
      $schema: 'meets.schema.json',
      url: 'https://fixtures.example/meet-schedule.pdf',
      meetTimes: {
        dualMeets: { start: '07:00', end: '12:00', relayCheckInDeadline: '07:55', firstSwimTime: '08:00' },
        timeTrials: { start: '07:00', end: '12:00' }
      },
      regular_meets: [
        { date: `${YEAR}-06-13`, name: 'Fixture Dual Meet 1', visiting_team: primaryTeam.name, home_team: opponentTeam.name, location: `${hostPool.name} Pool` },
        { date: `${YEAR}-06-20`, name: 'Fixture Dual Meet 2', visiting_team: opponentTeam.name, home_team: primaryTeam.name, location: `${contactPool.name} Pool` },
        { date: `${YEAR}-07-11`, name: 'Fixture Dual Meet 3', visiting_team: primaryTeam.name, home_team: teamWithoutActions.name, location: `${secondaryPool.name} Pool` }
      ],
      special_meets: [{ date: `${YEAR}-06-06`, name: 'Fixture Time Trials', location: `${contactPool.name} Pool`, timeWindowKey: 'timeTrials' }]
    }
  };
}

function createTestDataScenario() {
  const annualData = createTestDataFixture();
  const [contactPool, hostPool, secondaryPool] = annualData.pools.pools;
  const [primaryTeam, opponentTeam, externalActionTeam, teamWithoutActions] = annualData.teams.teams;
  const [awayMeet, homeMeet, laterAwayMeet] = annualData.meets.regular_meets;
  const [timeTrialsMeet] = annualData.meets.special_meets;

  return {
    annualData,
    pools: { contactPool, hostPool, secondaryPool, specialEventPool: contactPool },
    teams: { primaryTeam, opponentTeam, externalActionTeam, teamWithoutActions },
    meets: { awayMeet, homeMeet, laterAwayMeet, timeTrialsMeet }
  };
}

module.exports = {
  TEST_IDENTITIES,
  createTestDataFixture,
  createTestDataScenario
};
