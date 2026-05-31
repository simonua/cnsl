const { after, describe, it } = require('node:test');
const assert = require('node:assert/strict');
const activeTeamsData = require('../../src/assets/data/2026/teams/teams.json');
const activeMeetsData = require('../../src/assets/data/2026/meets/meets.json');
const Meet = require('../../src/js/models/meet.js');
const TimeUtils = require('../../src/js/services/time-utils');
const { TeamScheduleService: PublishedTeamScheduleService } = require('../../src/js/services/team-schedule-service');

globalThis.HtmlSafety = {
  escapeHtml: value => String(value)
};
globalThis.generateLinkedPoolMentions = location => String(location);
globalThis.createPoolLocationIndex = pools => pools;
globalThis.PreferencesService = {
  get: () => ({ practiceGroups: [] }),
  filterPracticeSessions: sessions => sessions,
  meetIncludesFavoriteTeam: () => false
};
globalThis.TimeUtils = TimeUtils;
globalThis.TeamScheduleService = {
  getUpcomingPractices: () => [],
  getTimeRange: PublishedTeamScheduleService.getTimeRange
};

require('../../src/js/services/team-agenda-display.js');

const { TeamAgendaDisplay } = globalThis;

after(() => {
  delete globalThis.HtmlSafety;
  delete globalThis.generateLinkedPoolMentions;
  delete globalThis.createPoolLocationIndex;
  delete globalThis.PreferencesService;
  delete globalThis.TimeUtils;
  delete globalThis.TeamScheduleService;
  delete globalThis.TeamAgendaDisplay;
});

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
        location: 'Swansfield Pool',
        sessions: [],
        teams: ''
      }]);

      assert.match(html, /Wednesday, June 17/);
      assert.doesNotMatch(html, /Wednesday, Jun 17/);
    });

    it('renders practice sessions using time-first schedule rows', () => {
      const html = TeamAgendaDisplay.renderEvents([{
        date: new Date(2026, 5, 17),
        label: 'Next morning practice',
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
        time: '8:00 AM - 12:00 PM',
        sessions: [],
        teams: '',
        type: 'meet'
      }]);

      assert.match(html, /favorite-week__event-icon--event" aria-hidden="true">🏊<\/span>/);
      assert.match(html, /<strong class="favorite-week__event-label">[\s\S]*Next swim event:<\/strong>[\s\S]*<strong class="favorite-week__event-name">Time Trials for returning\/experienced swimmers<\/strong>/);
      assert.match(html, /class="session-time">8:00 AM - 12:00 PM<\/span>/);
    });

    it('renders decorative activity glyphs for morning and evening practices', () => {
      const html = TeamAgendaDisplay.renderEvents([{
        date: new Date(2026, 5, 17),
        label: 'Next morning practice',
        location: 'Swansfield Pool',
        sessions: [],
        teams: ''
      }, {
        date: new Date(2026, 5, 17),
        label: 'Next evening practice',
        location: 'Swansfield Pool',
        sessions: [],
        teams: ''
      }]);

      assert.match(html, /favorite-week__event-icon--morning" aria-hidden="true">☀️<\/span>/);
      assert.match(html, /favorite-week__event-icon--evening" aria-hidden="true">🌙<\/span>/);
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
      assert.equal(phelpsLuckEvent.time, '8:00 AM - 12:00 PM');
      assert.equal(TeamAgendaDisplay.isTimeTrialsMeet(meet), true);
      assert.equal(TeamAgendaDisplay.getUpcomingEvents(pointersRun, [meet], new Date('2026-05-26'))[0].location, 'Jeffers Hill Pool');
      const untimedSpecial = new Meet({ ...meetData, timeWindowKey: undefined }, activeMeetsData.meetTimes);
      assert.equal(TeamAgendaDisplay.getUpcomingEvents(phelpsLuck, [untimedSpecial], new Date('2026-05-26'))[0].location, meet.location);
    });

    it('selects the first qualifying meet after sorting and applies fallback fields', () => {
      const originalIncludesTeam = globalThis.PreferencesService.meetIncludesFavoriteTeam;
      globalThis.PreferencesService.meetIncludesFavoriteTeam = meet => meet.homeTeam === 'Marlins';
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
        globalThis.PreferencesService.meetIncludesFavoriteTeam = originalIncludesTeam;
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
    });

    it('returns no agenda without a team and classifies sessions by their time labels', () => {
      const originalGetUpcoming = globalThis.TeamScheduleService.getUpcomingPractices;
      globalThis.TeamScheduleService.getUpcomingPractices = () => [
        { date: new Date(2026, 5, 1), label: 'Practice', location: 'Pool', sessions: [{ time: '8:00am', group: 'A' }] },
        { date: new Date(2026, 5, 1), label: 'Practice', location: 'Pool', sessions: [{ time: '5:00pm', group: 'B' }] },
        { date: new Date(2026, 5, 1), label: 'Practice', location: 'Pool', sessions: [{ time: 'Noon', group: 'C' }] }
      ];
      try {
        assert.deepEqual(TeamAgendaDisplay.getUpcomingEvents(null, []), []);
        assert.deepEqual(TeamAgendaDisplay.getUpcomingEvents({ practice: {} }, [], new Date(2026, 5, 1)).map(event => event.label), ['Next morning practice', 'Next evening practice']);
      } finally {
        globalThis.TeamScheduleService.getUpcomingPractices = originalGetUpcoming;
      }
    });

    it('uses published morning and evening practice labels before inspecting sessions', () => {
      const originalGetUpcoming = globalThis.TeamScheduleService.getUpcomingPractices;
      globalThis.TeamScheduleService.getUpcomingPractices = () => [
        { date: new Date(2026, 5, 1), label: 'Morning Practice', location: 'Pool', sessions: [{ time: 'Noon', group: 'A' }] },
        { date: new Date(2026, 5, 2), label: 'Evening Practice', location: 'Pool', sessions: [{ time: 'Noon', group: 'B' }] }
      ];
      try {
        assert.deepEqual(TeamAgendaDisplay.getUpcomingEvents({ practice: {} }, [], new Date(2026, 5, 1)).map(event => event.label), ['Next morning practice', 'Next evening practice']);
      } finally {
        globalThis.TeamScheduleService.getUpcomingPractices = originalGetUpcoming;
      }
    });

    it('selects the next same-period practice once todays visible session has ended', () => {
      const originalGetUpcoming = globalThis.TeamScheduleService.getUpcomingPractices;
      globalThis.TeamScheduleService.getUpcomingPractices = () => [
        { date: new Date(2026, 4, 29), label: 'Evening Practice', location: 'First Pool', sessions: [{ time: '6:30 - 7:00pm', group: 'A' }] },
        { date: new Date(2026, 5, 1), label: 'Evening Practice', location: 'Next Pool', sessions: [{ time: '5:00 - 6:00pm', group: 'A' }] }
      ];
      try {
        const beforeEnd = TeamAgendaDisplay.getUpcomingEvents({ practice: {} }, [], new Date(2026, 4, 29, 18, 59));
        const atEnd = TeamAgendaDisplay.getUpcomingEvents({ practice: {} }, [], new Date(2026, 4, 29, 19, 0));

        assert.equal(beforeEnd[0].location, 'First Pool');
        assert.equal(atEnd[0].location, 'Next Pool');
      } finally {
        globalThis.TeamScheduleService.getUpcomingPractices = originalGetUpcoming;
      }
    });

    it('omits a practice with no morning or evening scheduling signal', () => {
      const originalGetUpcoming = globalThis.TeamScheduleService.getUpcomingPractices;
      globalThis.TeamScheduleService.getUpcomingPractices = () => [
        { date: new Date(2026, 5, 1), label: 'Practice', location: 'Pool', sessions: [{ time: 'Noon', group: 'A' }] }
      ];
      try {
        assert.deepEqual(TeamAgendaDisplay.getUpcomingEvents({ practice: {} }, [], new Date(2026, 5, 1)), []);
      } finally {
        globalThis.TeamScheduleService.getUpcomingPractices = originalGetUpcoming;
      }
    });

    it('omits practice groups hidden by user preferences and accepts non-array meet input', () => {
      const originalGetUpcoming = globalThis.TeamScheduleService.getUpcomingPractices;
      const originalFilterSessions = globalThis.PreferencesService.filterPracticeSessions;
      globalThis.TeamScheduleService.getUpcomingPractices = () => [{ date: new Date(2026, 5, 1), label: 'Morning Practice', location: 'Pool', sessions: [{ time: '8:00am', group: 'A' }] }];
      globalThis.PreferencesService.filterPracticeSessions = () => [];
      try {
        assert.deepEqual(TeamAgendaDisplay.getUpcomingEvents({ practice: {} }, null, new Date(2026, 5, 1)), []);
      } finally {
        globalThis.TeamScheduleService.getUpcomingPractices = originalGetUpcoming;
        globalThis.PreferencesService.filterPracticeSessions = originalFilterSessions;
      }
    });
  });
});
