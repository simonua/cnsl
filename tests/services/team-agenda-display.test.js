const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const activeTeamsData = require('../../src/assets/data/2026/teams/teams.json');
const activeMeetsData = require('../../src/assets/data/2026/meets/meets.json');
const teamAgendaModule = require('../helpers/browser-module-loader.js').loadBrowserModule('team-agenda-display');
const { Meet, TimeUtils, TeamScheduleService: PublishedTeamScheduleService } = teamAgendaModule;
const testContext = teamAgendaModule.context;

testContext.HtmlSafety = {
  escapeHtml: value => String(value)
};
testContext.generateLinkedPoolMentions = location => String(location);
testContext.createPoolLocationIndex = pools => pools;
testContext.PreferencesService = {
  get: () => ({ practiceGroups: [] }),
  filterPracticeSessions: sessions => sessions,
  meetIncludesFavoriteTeam: () => false
};
testContext.TimeUtils = TimeUtils;
testContext.TeamScheduleService = {
  getUpcomingPractices: () => [],
  getTimeRange: PublishedTeamScheduleService.getTimeRange
};

const { TeamAgendaDisplay } = teamAgendaModule;

describe('TeamAgendaDisplay', () => {
  describe('getTitle', () => {
    it('uses the team name with a concise upcoming events label', () => {
      assert.equal(TeamAgendaDisplay.getTitle('Long Reach Marlins'), 'Long Reach Marlins: Upcoming events');
    });

    it('reports whether no published events or several events are present', () => {
      assert.match(TeamAgendaDisplay.getStatus([]), /No upcoming/);
      assert.match(TeamAgendaDisplay.getStatus([{}, {}]), /Showing 2/);
    });
  });

  describe('renderEvents', () => {
    it('renders agenda dates with full month names', () => {
      const html = TeamAgendaDisplay.renderEvents([{
        date: new Date(2026, 5, 17),
        label: 'Next morning practice',
        practicePeriod: 'morning',
        location: 'Swansfield Pool',
        sessions: [],
        teams: ''
      }], 3, [], new Date(2026, 5, 17));

      assert.match(html, /Wednesday, June 17/);
      assert.doesNotMatch(html, /Wednesday, Jun 17/);
      assert.match(html, /favorite-week__day-relative upcoming-day-pill upcoming-day-pill--today">today</);
    });

    it('renders calendar-relative day cues beside upcoming agenda dates', () => {
      const createEvent = date => ({ date, label: 'Practice', location: 'Pool', sessions: [], teams: '' });
      const html = TeamAgendaDisplay.renderEvents([
        createEvent(new Date(2026, 5, 16)),
        createEvent(new Date(2026, 5, 17)),
        createEvent(new Date(2026, 5, 18)),
        createEvent(new Date(2026, 5, 20))
      ], 3, [], new Date(2026, 5, 17));

      assert.deepEqual([...html.matchAll(/favorite-week__day-relative upcoming-day-pill(?: upcoming-day-pill--(?:today|tomorrow))?">([^<]+)/g)].map(match => match[1]), [
        'today',
        'tomorrow',
        'in 3 days'
      ]);
      assert.match(html, /upcoming-day-pill--today">today</);
      assert.match(html, /upcoming-day-pill--tomorrow">tomorrow</);
      assert.doesNotMatch(html, /yesterday|days ago/);
    });

    it('renders practice sessions using time-first schedule rows', () => {
      const html = TeamAgendaDisplay.renderEvents([{
        date: new Date(2026, 5, 17),
        label: 'Next morning practice',
        practicePeriod: 'morning',
        location: 'Swansfield Pool',
        sessions: [{ time: '8:00 - 8:45am', group: '13 and over' }],
        teams: ''
      }]);

      assert.match(html, /class="sessions"/);
      assert.match(html, /class="favorite-week__event-heading">[\s\S]*class="favorite-week__location">[\s\S]*class="favorite-week__pool-icon" aria-hidden="true">[\s\S]*Swansfield<\/span>/);
      assert.match(html, /class="session-time">8:00 - 8:45am<\/span>[\s\S]*class="session-group">13 and over<\/span>/);
    });

    it('renders a swim event name below its label', () => {
      const html = TeamAgendaDisplay.renderEvents([{
        date: new Date(2026, 5, 6),
        label: 'Next swim event:',
        name: 'Time Trials for returning / experienced swimmers',
        location: 'Kendall Ridge Pool',
        time: '7:00 AM - 12:00 PM',
        sessions: [],
        teams: '',
        type: 'meet'
      }]);

      assert.match(html, /favorite-week__event-icon--event" aria-hidden="true">[\s\S]*href="#icon-swimmer"/);
      assert.match(html, /<strong class="favorite-week__event-label">[\s\S]*Next swim event:<\/strong>[\s\S]*<strong class="favorite-week__event-name">Time Trials for returning \/ experienced swimmers<\/strong>/);
      assert.match(html, /class="session-time">7:00 AM - 12:00 PM<\/span>/);
    });

    it('renders decorative activity glyphs for morning and evening practices', () => {
      const html = TeamAgendaDisplay.renderEvents([{
        date: new Date(2026, 5, 17),
        label: 'Next morning practice',
        practicePeriod: 'morning',
        location: 'Swansfield Pool',
        sessions: [],
        teams: ''
      }, {
        date: new Date(2026, 5, 17),
        label: 'Next evening practice',
        practicePeriod: 'evening',
        location: 'Swansfield Pool',
        sessions: [],
        teams: ''
      }]);

      assert.match(html, /favorite-week__event-icon--morning" aria-hidden="true">[\s\S]*href="#icon-sun"/);
      assert.match(html, /favorite-week__event-icon--evening" aria-hidden="true">[\s\S]*href="#icon-moon"/);
    });

    it('uses compact headings and renders team matchups when supplied', () => {
      const html = TeamAgendaDisplay.renderEvents([{ date: new Date(2026, 5, 17), label: 'Other activity', location: '', sessions: [], teams: 'Visitor at Home', type: 'meet' }], 4);
      assert.match(html, /<h4>/);
      assert.match(html, /Visitor at Home/);
    });
  });

  describe('getUpcomingEvents', () => {
    it('resolves each team time trials event to its published pool location', () => {
      const meetData = activeMeetsData.special_meets.find(meet => meet.timeWindowKey === 'timeTrials');
      const meet = new Meet(meetData, activeMeetsData.meetTimes);
      const phelpsLuck = activeTeamsData.teams.find(team => team.id === 'pls');
      const pointersRun = activeTeamsData.teams.find(team => team.id === 'prp');
      const phelpsLuckEvent = TeamAgendaDisplay.getUpcomingEvents(phelpsLuck, [meet], new Date('2026-05-26'))[0];

      assert.equal(phelpsLuckEvent.label, 'Next swim event:');
      assert.equal(phelpsLuckEvent.name, 'Time Trials for returning / experienced swimmers');
      assert.equal(phelpsLuckEvent.location, 'Phelps Luck Pool');
      assert.equal(phelpsLuckEvent.time, '7:00 AM - 12:00 PM');
      assert.equal(TeamAgendaDisplay.isTimeTrialsMeet(meet), true);
      assert.equal(TeamAgendaDisplay.getUpcomingEvents(pointersRun, [meet], new Date('2026-05-26'))[0].location, 'Jeffers Hill Pool');
      const untimedSpecial = new Meet({ ...meetData, timeWindowKey: undefined }, activeMeetsData.meetTimes);
      assert.equal(TeamAgendaDisplay.getUpcomingEvents(phelpsLuck, [untimedSpecial], new Date('2026-05-26'))[0].location, meet.location);
    });

    it('selects the first qualifying meet after sorting and applies fallback fields', () => {
      const originalIncludesTeam = testContext.PreferencesService.meetIncludesFavoriteTeam;
      testContext.PreferencesService.meetIncludesFavoriteTeam = meet => meet.homeTeam === 'Marlins';
      try {
        const events = TeamAgendaDisplay.getUpcomingEvents({ practice: {}, timeTrialsPool: '' }, [
          { date: '', name: 'Missing Date' },
          { date: '2026-06-11', awayTeam: 'Visitors', homeTeam: 'Other', location: 'Away Pool' },
          { date: '2026-06-10', awayTeam: 'Visitors', homeTeam: 'Marlins', location: 'Home Pool' },
          { date: '2026-06-09', location: 'Neutral Pool' },
          { date: '2026-05-01', location: 'Past Pool' }
        ], new Date('2026-05-26'));
        assert.equal(events.length, 1);
        assert.equal(events[0].name, 'Meet');
        assert.equal(events[0].location, 'Neutral Pool');
        assert.equal(events[0].time, 'Time not published');
        assert.equal(events[0].teams, '');
      } finally {
        testContext.PreferencesService.meetIncludesFavoriteTeam = originalIncludesTeam;
      }
    });

    it('uses a team timing override ahead of the standard meet timing window', () => {
      const meet = new Meet({
        date: '2026-06-13',
        name: 'Dual Meet #1',
        location: 'Home Pool',
        home_team: 'Home'
      }, activeMeetsData.meetTimes, 'dualMeets');
      const time = TeamAgendaDisplay.getMeetDisplayTime(meet, {
        meetTimeOverrides: { dualMeets: { start: '08:30', end: '11:30' } }
      });

      assert.equal(time, '8:30 AM - 11:30 AM');
      assert.equal(TeamAgendaDisplay.getMeetDisplayTime({
        getTimeWindowKey: () => 'dualMeets',
        getDisplayTime: timingWindow => timingWindow.start
      }, { meetTimeOverrides: { dualMeets: { start: '09:00', end: '11:00' } } }), '09:00');
      assert.equal(TeamAgendaDisplay.getMeetDisplayTime({
        getTimeWindowKey: () => 'dualMeets',
        getDisplayTime: timingWindow => timingWindow.start
      }, { getMeetTimeOverride: () => ({ start: '10:00', end: '11:00' }) }), '10:00');
    });

    it('returns no agenda without a team and selects explicit semantic practice periods', () => {
      const originalGetUpcoming = testContext.TeamScheduleService.getUpcomingPractices;
      testContext.TeamScheduleService.getUpcomingPractices = () => [
        { date: new Date(2026, 5, 1), label: 'Evening copy', practicePeriod: 'morning', location: 'Pool', sessions: [{ time: 'Noon', group: 'A' }] },
        { date: new Date(2026, 5, 1), label: 'Morning copy', practicePeriod: 'evening', location: 'Pool', sessions: [{ time: 'Noon', group: 'B' }] },
        { date: new Date(2026, 5, 1), label: 'Practice', practicePeriod: 'other', location: 'Pool', sessions: [{ time: '8:00am', group: 'C' }] }
      ];
      try {
        assert.deepEqual(TeamAgendaDisplay.getUpcomingEvents(null, []), []);
        assert.deepEqual(TeamAgendaDisplay.getUpcomingEvents({ practice: {} }, [], new Date(2026, 5, 1)).map(event => event.label), ['Next morning practice', 'Next evening practice']);
      } finally {
        testContext.TeamScheduleService.getUpcomingPractices = originalGetUpcoming;
      }
    });

    it('ignores visible practice labels when semantic periods are absent', () => {
      const originalGetUpcoming = testContext.TeamScheduleService.getUpcomingPractices;
      testContext.TeamScheduleService.getUpcomingPractices = () => [
        { date: new Date(2026, 5, 1), label: 'Morning Practice', location: 'Pool', sessions: [{ time: 'Noon', group: 'A' }] },
        { date: new Date(2026, 5, 2), label: 'Evening Practice', location: 'Pool', sessions: [{ time: 'Noon', group: 'B' }] }
      ];
      try {
        assert.deepEqual(TeamAgendaDisplay.getUpcomingEvents({ practice: {} }, [], new Date(2026, 5, 1)), []);
      } finally {
        testContext.TeamScheduleService.getUpcomingPractices = originalGetUpcoming;
      }
    });

    it('selects the next same-period practice once todays visible session has ended', () => {
      const originalGetUpcoming = testContext.TeamScheduleService.getUpcomingPractices;
      testContext.TeamScheduleService.getUpcomingPractices = () => [
        { date: new Date(2026, 4, 29), label: 'Evening Practice', practicePeriod: 'evening', location: 'First Pool', sessions: [{ time: '6:30 - 7:00pm', group: 'A' }] },
        { date: new Date(2026, 5, 1), label: 'Evening Practice', practicePeriod: 'evening', location: 'Next Pool', sessions: [{ time: '5:00 - 6:00pm', group: 'A' }] }
      ];
      try {
        const beforeEnd = TeamAgendaDisplay.getUpcomingEvents({ practice: {} }, [], new Date(2026, 4, 29, 18, 59));
        const atEnd = TeamAgendaDisplay.getUpcomingEvents({ practice: {} }, [], new Date(2026, 4, 29, 19, 0));

        assert.equal(beforeEnd[0].location, 'First Pool');
        assert.equal(atEnd[0].location, 'Next Pool');
      } finally {
        testContext.TeamScheduleService.getUpcomingPractices = originalGetUpcoming;
      }
    });

    it('omits a practice with no morning or evening scheduling signal', () => {
      const originalGetUpcoming = testContext.TeamScheduleService.getUpcomingPractices;
      testContext.TeamScheduleService.getUpcomingPractices = () => [
        { date: new Date(2026, 5, 1), label: 'Morning Practice', practicePeriod: 'other', location: 'Pool', sessions: [{ time: '8:00am', group: 'A' }] }
      ];
      try {
        assert.deepEqual(TeamAgendaDisplay.getUpcomingEvents({ practice: {} }, [], new Date(2026, 5, 1)), []);
      } finally {
        testContext.TeamScheduleService.getUpcomingPractices = originalGetUpcoming;
      }
    });

    it('omits practice groups hidden by user preferences and accepts non-array meet input', () => {
      const originalGetUpcoming = testContext.TeamScheduleService.getUpcomingPractices;
      const originalFilterSessions = testContext.PreferencesService.filterPracticeSessions;
      testContext.TeamScheduleService.getUpcomingPractices = () => [{ date: new Date(2026, 5, 1), label: 'Morning Practice', practicePeriod: 'morning', location: 'Pool', sessions: [{ time: '8:00am', group: 'A' }] }];
      testContext.PreferencesService.filterPracticeSessions = () => [];
      try {
        assert.deepEqual(TeamAgendaDisplay.getUpcomingEvents({ practice: {} }, null, new Date(2026, 5, 1)), []);
      } finally {
        testContext.TeamScheduleService.getUpcomingPractices = originalGetUpcoming;
        testContext.PreferencesService.filterPracticeSessions = originalFilterSessions;
      }
    });

    it('omits practices from prior calendar days', () => {
      const originalGetUpcoming = testContext.TeamScheduleService.getUpcomingPractices;
      testContext.TeamScheduleService.getUpcomingPractices = () => [{
        date: new Date(2026, 4, 31),
        practicePeriod: 'morning',
        sessions: [{ time: '8:00 - 9:00am', group: 'A' }]
      }];
      try {
        assert.deepEqual(TeamAgendaDisplay.getUpcomingEvents({ practice: {} }, [], new Date(2026, 5, 1)), []);
      } finally {
        testContext.TeamScheduleService.getUpcomingPractices = originalGetUpcoming;
      }
    });
  });

  describe('browser registration', () => {
    it('uses browser globals and accepts a prebuilt pool index', () => {
      const sourcePath = path.join(__dirname, '..', '..', 'src', 'js', 'services', 'team-agenda-display.js');
      const source = fs.readFileSync(sourcePath, 'utf8');
      const context = {
        Date,
        Map,
        globalThis: null,
        IconCatalog: { render: () => '' },
        HtmlSafety: { escapeHtml: String },
        PreferencesService: testContext.PreferencesService,
        TeamScheduleService: testContext.TeamScheduleService,
        TimeUtils,
        createPoolLocationIndex: () => new Map(),
        generateLinkedPoolMentions: String
      };
      context.globalThis = context;
      vm.runInNewContext(source, context, { filename: sourcePath });

      assert.equal(typeof context.TeamAgendaDisplay.renderEvents, 'function');
      assert.match(context.TeamAgendaDisplay.renderEvents([{
        date: new Date(2026, 5, 1), label: 'Practice', location: '', sessions: [], teams: ''
      }], 3, new Map(), new Date(2026, 5, 1)), /Practice/);
    });
  });
});
