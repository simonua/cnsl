/**
 * Selects and formats the next published practices and swim event for a team.
 */
(function initializeTeamAgendaDisplay() {
  const SCHEDULE_LOOKAHEAD_DAYS = 366;

  function startOfDay(value) {
    const date = new Date(value);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  function formatDay(date) {
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  }

  function getNextPractices(practices) {
    const classifyPractice = practice => {
      if (practice.label === 'Morning Practice') return 'morning';
      if (practice.label === 'Evening Practice') return 'evening';

      const sessionTimes = practice.sessions.map(session => session.time).join(' ');
      if (/am\b/i.test(sessionTimes) && !/pm\b/i.test(sessionTimes)) return 'morning';
      if (/pm\b/i.test(sessionTimes) && !/am\b/i.test(sessionTimes)) return 'evening';
      return null;
    };

    return ['morning', 'evening'].map(period => {
      const practice = practices.find(entry => classifyPractice(entry) === period);
      return practice ? { ...practice, label: `Next ${period} practice` } : null;
    }).filter(Boolean);
  }

  function getVisiblePractices(practices) {
    const selectedPracticeGroups = globalThis.PreferencesService.get().practiceGroups;
    return practices.map(practice => ({
      ...practice,
      sessions: globalThis.PreferencesService.filterPracticeSessions(practice.sessions, selectedPracticeGroups)
    })).filter(practice => practice.sessions.length > 0);
  }

  function getNextMeet(meets, team, firstDate) {
    return meets.filter(meet => {
      if (!meet.date) return false;
      const meetDate = startOfDay(`${meet.date}T12:00:00`);
      const hasMatchup = Boolean(meet.visiting_team || meet.awayTeam || meet.home_team || meet.homeTeam);
      return meetDate >= firstDate && (!hasMatchup || globalThis.PreferencesService.meetIncludesFavoriteTeam(meet, team));
    }).map(meet => ({
      date: startOfDay(`${meet.date}T12:00:00`),
      label: `Next swim event: ${meet.name || 'Meet'}`,
      location: meet.location,
      sessions: [],
      teams: meet.visiting_team || meet.awayTeam ? `${meet.visiting_team || meet.awayTeam} at ${meet.home_team || meet.homeTeam}` : '',
      type: 'meet'
    })).sort((first, second) => first.date - second.date).slice(0, 1);
  }

  function getUpcomingEvents(team, meets, firstDate = new Date()) {
    if (!team) return [];

    const today = startOfDay(firstDate);
    const practices = getNextPractices(getVisiblePractices(globalThis.TeamScheduleService.getUpcomingPractices(team.practice, today, SCHEDULE_LOOKAHEAD_DAYS)));
    return [...practices, ...getNextMeet(Array.isArray(meets) ? meets : [], team, today)]
      .sort((first, second) => first.date - second.date);
  }

  function getTitle(teamName, events) {
    const eventNoun = events.length === 1 ? 'event' : 'events';
    return `${teamName}: ${events.length} practice or swim ${eventNoun} upcoming`;
  }

  function getStatus(events) {
    return events.length === 0
      ? 'No upcoming published practices or swim events are available.'
      : `Showing ${events.length} next published practice or swim event entries.`;
  }

  function renderEvents(events, dayHeadingLevel = 3) {
    const headingTag = dayHeadingLevel === 4 ? 'h4' : 'h3';
    const days = new Map();
    events.forEach(event => {
      const key = event.date.toDateString();
      if (!days.has(key)) days.set(key, { date: event.date, events: [] });
      days.get(key).events.push(event);
    });

    return `<ol class="favorite-week__days">${[...days.values()].map(day => `
      <li class="favorite-week__day">
        <${headingTag}>${globalThis.HtmlSafety.escapeHtml(formatDay(day.date))}</${headingTag}>
        <ul class="favorite-week__events">${day.events.map(event => `
          <li>
            <strong>${globalThis.HtmlSafety.escapeHtml(event.label)}</strong>
            ${event.teams ? `<span>${globalThis.HtmlSafety.escapeHtml(event.teams)}</span>` : ''}
            ${event.sessions.map(session => `<span>${globalThis.HtmlSafety.escapeHtml(session.group)}: ${globalThis.HtmlSafety.escapeHtml(session.time)}</span>`).join('')}
            <span>${globalThis.generateLinkedPoolMentions(event.location)}</span>
          </li>
        `).join('')}</ul>
      </li>
    `).join('')}</ol>`;
  }

  globalThis.TeamAgendaDisplay = Object.freeze({
    getStatus,
    getTitle,
    getUpcomingEvents,
    renderEvents
  });
})();