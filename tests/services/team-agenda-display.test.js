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

      assert.equal(TeamAgendaDisplay.getUpcomingEvents(phelpsLuck, [meet], new Date('2026-05-26'))[0].location, 'Phelps Luck Pool');
      assert.equal(TeamAgendaDisplay.getUpcomingEvents(pointersRun, [meet], new Date('2026-05-26'))[0].location, 'Jeffers Hill Pool');
      assert.equal(TeamAgendaDisplay.getUpcomingEvents(phelpsLuck, [{ ...meet, name: 'Future Delegated Event' }], new Date('2026-05-26'))[0].location, meet.location);
    });
  });
});
