const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const teamAgendaModule = require('../helpers/browser-module-loader.js').loadBrowserModule('team-agenda-display');
const { Meet, TimeUtils, TeamScheduleService: PublishedTeamScheduleService } = teamAgendaModule;
const testContext = teamAgendaModule.context;

testContext.HtmlSafety = {
  escapeHtml: value => String(value),
  safeHttpUrl: value => {
    if (!value || /["'<>`]/.test(value)) return '';
    try {
      const url = new URL(value);
      return url.protocol === 'http:' || url.protocol === 'https:' ? value : '';
    } catch (_error) {
      return '';
    }
  }
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
const meetTimes = {
  dualMeets: { end: '12:00', start: '07:00' },
  timeTrials: { end: '12:00', start: '07:00' }
};

describe('TeamAgendaDisplay', () => {
  describe('renderCalendarActions', () => {
    it('renders safe official calendar and subscription actions', () => {
      const html = TeamAgendaDisplay.renderCalendarActions({
        calendarUrl: 'https://example.com/team/calendar',
        eventsSubscriptionUrl: 'https://example.com/team/events.ics?enabled=true'
      });

      assert.match(html, /href="https:\/\/example\.com\/team\/calendar" target="_blank" rel="noopener"/);
      assert.match(html, />Team Calendar<\/a>/);
      assert.match(html, /href="https:\/\/example\.com\/team\/events\.ics\?enabled=true" target="_blank" rel="noopener"/);
      assert.match(html, />Subscribe<span class="visually-hidden"> to team events calendar<\/span><\/a>/);
    });

    it('renders only the calendar action when no subscription is published', () => {
      const html = TeamAgendaDisplay.renderCalendarActions({
        calendarUrl: 'https://example.com/team/calendar',
        eventsSubscriptionUrl: ''
      });

      assert.match(html, /Team Calendar/);
      assert.doesNotMatch(html, /Subscribe/);
    });

    it('renders only the subscription action when no calendar page is published', () => {
      const html = TeamAgendaDisplay.renderCalendarActions({
        calendarUrl: '',
        eventsSubscriptionUrl: 'https://example.com/team/events.ics'
      });

      assert.doesNotMatch(html, /Team Calendar/);
      assert.match(html, />Subscribe<span class="visually-hidden">/);
    });

    it('omits missing, malformed, and unsafe destinations', () => {
      assert.equal(TeamAgendaDisplay.renderCalendarActions(null), '');
      assert.equal(TeamAgendaDisplay.renderCalendarActions({}), '');
      for (const unsafeUrl of [
        'javascript:alert(1)',
        'data:text/html,unsafe',
        'not a URL',
        'https://example.com/" onclick="alert(1)'
      ]) {
        assert.equal(TeamAgendaDisplay.renderCalendarActions({
          calendarUrl: unsafeUrl,
          eventsSubscriptionUrl: unsafeUrl
        }), '');
      }
    });
  });

  describe('getTitle', () => {
    it('uses the team name with a concise upcoming events label', () => {
      const teamName = 'Fixture Team';
      const title = TeamAgendaDisplay.getTitle(teamName);

      assert.ok(title.includes(teamName));
      assert.ok(title.length > teamName.length);
    });

    it('reports whether no published events or several events are present', () => {
      const events = [{}, {}];
      assert.ok(TeamAgendaDisplay.getStatus([]).length > 0);
      assert.ok(TeamAgendaDisplay.getStatus(events).includes(String(events.length)));
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
      assert.match(html, /favorite-week__day-relative upcoming-day-pill upcoming-day-pill--today">[^<]+</);
    });

    it('renders calendar-relative day cues beside upcoming agenda dates', () => {
      const createEvent = date => ({ date, label: 'Practice', location: 'Pool', sessions: [], teams: '' });
      const html = TeamAgendaDisplay.renderEvents([
        createEvent(new Date(2026, 5, 16)),
        createEvent(new Date(2026, 5, 17)),
        createEvent(new Date(2026, 5, 18)),
        createEvent(new Date(2026, 5, 20))
      ], 3, [], new Date(2026, 5, 17));

      const relativeLabels = [...html.matchAll(/favorite-week__day-relative upcoming-day-pill(?: upcoming-day-pill--(?:today|tomorrow))?">([^<]+)/g)].map(match => match[1]);
      assert.equal(relativeLabels.length, 3);
      assert.equal(new Set(relativeLabels).size, relativeLabels.length);
      assert.match(html, /upcoming-day-pill--today">[^<]+</);
      assert.match(html, /upcoming-day-pill--tomorrow">[^<]+</);
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
      assert.match(html, /class="favorite-week__location"/);
      assert.match(html, /class="favorite-week__pool-icon" aria-hidden="true"/);
      assert.ok(html.indexOf('8:00 - 8:45am') < html.indexOf('13 and over'));
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
      assert.ok(html.indexOf('Next swim event:') < html.indexOf('Time Trials for returning / experienced swimmers'));
      assert.match(html, /class="session-time">7:00 AM - 12:00 PM<\/span>/);
    });

    it('renders an indented matchup link to the corresponding meet', () => {
      const html = TeamAgendaDisplay.renderEvents([{
        date: new Date(2026, 5, 27),
        label: 'Next swim event:',
        meetDate: '2026-06-27',
        name: 'Fixture Dual Meet',
        location: 'Fixture Host Pool',
        time: '7:00 AM - 12:00 PM',
        sessions: [],
        teams: 'Fixture Visitor at Fixture Host',
        type: 'meet'
      }], 3, [{ id: 'fixture-host', name: 'Fixture Host' }]);

      assert.match(html, /class="favorite-week__matchup"><a href="meets\.html\?date=2026-06-27&pool=fixture-host"/);
      assert.match(html, />Fixture Visitor at Fixture Host<\/a><\/span>/);
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
    it('resolves each team time trials event to its fixture-owned pool location', () => {
      const meetData = { date: '2026-06-06', location: 'League Facility', name: 'Fixture Time Trials', timeWindowKey: 'timeTrials' };
      const meet = new Meet(meetData, meetTimes);
      const homePoolTeam = { practice: {}, timeTrialsPool: 'Home Facility' };
      const alternatePoolTeam = { practice: {}, timeTrialsPool: 'Alternate Facility' };
      const homePoolEvent = TeamAgendaDisplay.getUpcomingEvents(homePoolTeam, [meet], new Date('2026-05-26'))[0];

      assert.equal(homePoolEvent.name, meet.name);
      assert.equal(homePoolEvent.location, `${homePoolTeam.timeTrialsPool} Pool`);
      assert.equal(homePoolEvent.time, meet.getDisplayTime());
      assert.equal(TeamAgendaDisplay.isTimeTrialsMeet(meet), true);
      assert.equal(
        TeamAgendaDisplay.getUpcomingEvents(alternatePoolTeam, [meet], new Date('2026-05-26'))[0].location,
        `${alternatePoolTeam.timeTrialsPool} Pool`
      );
      const untimedSpecial = new Meet({ ...meetData, timeWindowKey: undefined }, meetTimes);
      assert.equal(TeamAgendaDisplay.getUpcomingEvents(homePoolTeam, [untimedSpecial], new Date('2026-05-26'))[0].location, meet.location);
    });

    it('selects the first qualifying canonical meet after sorting and applies display fallbacks', () => {
      const originalIncludesTeam = testContext.PreferencesService.meetIncludesFavoriteTeam;
      testContext.PreferencesService.meetIncludesFavoriteTeam = meet => meet.home_team === 'Marlins';
      try {
        const events = TeamAgendaDisplay.getUpcomingEvents({ practice: {}, timeTrialsPool: '' }, [
          { date: '', name: 'Missing Date' },
          { date: '2026-06-11', visiting_team: 'Visitors', home_team: 'Other', location: 'Away Pool' },
          { date: '2026-06-10', visiting_team: 'Visitors', home_team: 'Marlins', location: 'Home Pool' },
          { date: '2026-06-09', location: 'Neutral Pool' },
          { date: '2026-05-01', location: 'Past Pool' }
        ], new Date('2026-05-26'));
        assert.equal(events.length, 1);
        assert.equal(events[0].location, 'Neutral Pool');
        assert.ok(events[0].name.length > 0);
        assert.ok(events[0].time.length > 0);
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
      }, meetTimes, 'dualMeets');
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
        const events = TeamAgendaDisplay.getUpcomingEvents({ practice: {} }, [], new Date(2026, 5, 1));
        assert.deepEqual(events.map(event => event.practicePeriod), ['morning', 'evening']);
        assert.ok(events.every(event => event.label.length > 0));
        assert.notEqual(events[0].label, events[1].label);
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
        generateLinkedPoolMentions: String,
        generateMeetPageLink: (date, poolId, text) => text,
        getPoolIdFromLocation: () => null
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
