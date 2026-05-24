/**
 * Shared test helpers for CNSL unit tests
 */

/**
 * Create a minimal localStorage mock for browser-storage services
 */
function createLocalStorageMock() {
  const store = {};
  return {
    getItem: (key) => store[key] ?? null,
    setItem: (key, value) => { store[key] = String(value); },
    removeItem: (key) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach(k => delete store[k]); },
    get length() { return Object.keys(store).length; },
    key: (i) => Object.keys(store)[i] ?? null,
    _store: store
  };
}

/**
 * Sample pool data for testing Pool model
 */
function createSamplePoolData(overrides = {}) {
  return {
    id: 'bwp',
    name: 'Bryant Woods',
    caUrl: 'https://example.com/bwp',
    scheduleUrl: 'https://example.com/bwp/schedule',
    location: {
      address: '10400 Bryant Woods Court',
      city: 'Columbia',
      state: 'MD',
      zip: '21044',
      lat: 39.2,
      lng: -76.8,
      googleMapsUrl: 'https://maps.google.com/?q=Bryant+Woods+Pool'
    },
    phone: '410-555-1234',
    ...overrides
  };
}

/**
 * Sample pools data in the format expected by PoolsManager.loadData()
 */
function createSamplePoolsManagerData(poolsArray) {
  const pools = poolsArray || [createSamplePoolData(), createSamplePoolData({ id: 'krp', name: 'Kendall Ridge' })];
  return { pools };
}

/**
 * Sample teams data in the format expected by TeamsManager.loadData()
 */
function createSampleTeamsData() {
  return {
    teams: [
      {
        id: 'bwb',
        name: 'Bryant Woods Barracudas',
        homePools: ['Bryant Woods'],
        practicePools: ['Bryant Woods', 'Running Brook'],
        staff: {
          sourceUrl: 'https://example.com/bwb/staff',
          verifiedOn: '2026-05-24',
          coaches: [{ name: 'Jane Smith', role: 'Head Coach', email: 'jane@example.com' }],
          managers: [{ name: 'Alex Rivera', role: 'Team Manager' }],
          contacts: [{ audience: 'managers', label: 'Team managers', email: 'managers@example.com' }]
        }
      },
      {
        id: 'krk',
        name: 'Kendall Ridge Krakens',
        homePools: ['Kendall Ridge'],
        practicePools: ['Kendall Ridge'],
        staff: {
          sourceUrl: 'https://example.com/krk/staff',
          verifiedOn: '2026-05-24',
          coaches: [{ name: 'John Doe', role: 'Head Coach' }],
          managers: [],
          contacts: []
        }
      }
    ]
  };
}

/**
 * Sample meets data in the format expected by MeetsManager.loadData()
 */
function createSampleMeetsData() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  const lastWeek = new Date();
  lastWeek.setDate(lastWeek.getDate() - 7);

  return {
    regular_meets: [
      {
        id: 'meet-1',
        date: tomorrow.toISOString().split('T')[0],
        time: '6:00PM',
        homeTeam: 'Bryant Woods Barracudas',
        awayTeam: 'Kendall Ridge Krakens',
        location: 'Bryant Woods',
        type: 'Regular'
      },
      {
        id: 'meet-2',
        date: nextWeek.toISOString().split('T')[0],
        time: '9:00AM',
        homeTeam: 'Kendall Ridge Krakens',
        awayTeam: 'Bryant Woods Barracudas',
        location: 'Kendall Ridge',
        type: 'Regular'
      },
      {
        id: 'meet-3',
        date: lastWeek.toISOString().split('T')[0],
        time: '6:00PM',
        homeTeam: 'Bryant Woods Barracudas',
        awayTeam: 'Kendall Ridge Krakens',
        location: 'Bryant Woods',
        type: 'Regular'
      }
    ]
  };
}

/**
 * Suppress console output during a callback.
 * Use in tests that intentionally trigger error/warn logging.
 * @param {Function} fn - Function to execute with console suppressed
 * @returns {*} Return value of fn
 */
function suppressConsole(fn) {
  const orig = { log: console.log, warn: console.warn, error: console.error, info: console.info };
  console.log = console.warn = console.error = console.info = () => {};
  try {
    return fn();
  } finally {
    Object.assign(console, orig);
  }
}

module.exports = {
  createLocalStorageMock,
  createSamplePoolData,
  createSamplePoolsManagerData,
  createSampleTeamsData,
  createSampleMeetsData,
  suppressConsole
};
