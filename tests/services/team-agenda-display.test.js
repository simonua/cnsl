const { after, describe, it } = require('node:test');
const assert = require('node:assert/strict');

globalThis.HtmlSafety = {
  escapeHtml: value => String(value)
};
globalThis.generateLinkedPoolMentions = location => String(location);

require('../../src/js/services/team-agenda-display.js');

const { TeamAgendaDisplay } = globalThis;

after(() => {
  delete globalThis.HtmlSafety;
  delete globalThis.generateLinkedPoolMentions;
  delete globalThis.TeamAgendaDisplay;
});

describe('TeamAgendaDisplay', () => {
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
});
