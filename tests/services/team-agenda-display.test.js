const { after, describe, it } = require('node:test');
const assert = require('node:assert/strict');
const activeTeamsData = require('../../src/assets/data/2026/teams/teams.json');

globalThis.HtmlSafety = {
  escapeHtml: value => String(value)
};
globalThis.generateLinkedPoolMentions = location => String(location);
globalThis.PreferencesService = {
  get: () => ({ practiceGroups: [] }),
  filterPracticeSessions: sessions => sessions,
  meetIncludesFavoriteTeam: () => false
};
globalThis.TeamScheduleService = {
  getUpcomingPractices: () => []
};

require('../../src/js/services/team-agenda-display.js');

const { TeamAgendaDisplay } = globalThis;

after(() => {
  delete globalThis.HtmlSafety;
  delete globalThis.generateLinkedPoolMentions;
  delete globalThis.PreferencesService;
  delete globalThis.TeamScheduleService;
  delete globalThis.TeamAgendaDisplay;
});

describe('TeamAgendaDisplay', () => {
  describe('getTitle', () => {
    it('uses the team name with a concise upcoming events label', () => {
      assert.equal(TeamAgendaDisplay.getTitle('Long Reach Marlins'), 'Long Reach Marlins: Upcoming events');
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
      assert.match(html, /class="favorite-week__event-heading">[\s\S]*class="favorite-week__location">Swansfield Pool<\/span>/);
      assert.match(html, /class="session-time">8:00 - 8:45am<\/span>[\s\S]*class="session-group">13 and over<\/span>/);
    });

    it('renders a swim event name below its label', () => {
      const html = TeamAgendaDisplay.renderEvents([{
        date: new Date(2026, 5, 6),
        label: 'Next swim event:',
        name: 'Time Trials for returning/experienced swimmers',
        location: 'Kendall Ridge Pool',
        sessions: [],
        teams: '',
        type: 'meet'
      }]);

      assert.match(html, /<strong>Next swim event:<\/strong>[\s\S]*<strong class="favorite-week__event-name">Time Trials for returning\/experienced swimmers<\/strong>/);
    });
  });

  describe('getUpcomingEvents', () => {
    it('resolves each team time trials event to its published pool location', () => {
      const meet = {
        date: '2026-06-06',
        name: 'Time Trials for returning/experienced swimmers',
        location: "Each Team's Home Pool (Pointers Run at Jeffers Hill Pool)"
      };
      const phelpsLuck = activeTeamsData.teams.find(team => team.id === 'pls');
      const pointersRun = activeTeamsData.teams.find(team => team.id === 'prp');
      const phelpsLuckEvent = TeamAgendaDisplay.getUpcomingEvents(phelpsLuck, [meet], new Date('2026-05-26'))[0];

      assert.equal(phelpsLuckEvent.label, 'Next swim event:');
      assert.equal(phelpsLuckEvent.name, 'Time Trials for returning/experienced swimmers');
      assert.equal(phelpsLuckEvent.location, 'Phelps Luck Pool');
      assert.equal(TeamAgendaDisplay.getUpcomingEvents(pointersRun, [meet], new Date('2026-05-26'))[0].location, 'Jeffers Hill Pool');
      assert.equal(TeamAgendaDisplay.getUpcomingEvents(phelpsLuck, [{ ...meet, name: 'Future Delegated Event' }], new Date('2026-05-26'))[0].location, meet.location);
    });
  });
});
