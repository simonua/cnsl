/**
 * Selects and formats the next published practices and swim event for a team.
 */
(function initializeTeamAgendaDisplay() {
  const SCHEDULE_LOOKAHEAD_DAYS = 366;
  const EVENT_LABEL_ICONS = Object.freeze({
    morning: '☀️',
    evening: '🌙',
    event: '🏊'
  });
  const POOL_ICON = '<svg viewBox="0 0 24 24"><path d="M2 7c1.5 0 2.25 1.5 3.75 1.5S8 7 9.5 7s2.25 1.5 3.75 1.5S15.5 7 17 7s2.25 1.5 3.75 1.5S23 7 23 7"></path><path d="M2 12c1.5 0 2.25 1.5 3.75 1.5S8 12 9.5 12s2.25 1.5 3.75 1.5S15.5 12 17 12s2.25 1.5 3.75 1.5S23 12 23 12"></path><path d="M2 17c1.5 0 2.25 1.5 3.75 1.5S8 17 9.5 17s2.25 1.5 3.75 1.5S15.5 17 17 17s2.25 1.5 3.75 1.5S23 17 23 17"></path></svg>';

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

  function isPendingPractice(practice, referenceDate) {
    const practiceDate = startOfDay(practice.date);
    const today = startOfDay(referenceDate);
    if (practiceDate > today) return true;
    if (practiceDate < today) return false;

    const currentMinutes = (referenceDate.getHours() * 60) + referenceDate.getMinutes();
    const sessionRanges = practice.sessions
      .map(session => globalThis.TeamScheduleService.getTimeRange(session.time, globalThis.TimeUtils))
      .filter(Boolean);
    return sessionRanges.length < practice.sessions.length
      || sessionRanges.some(sessionRange => sessionRange.end > currentMinutes);
  }

  function getMeetLocation(meet, team) {
    const isTimeTrials = typeof meet.name === 'string' && /^Time Trials\b/i.test(meet.name);
    const usesTeamHomePool = typeof meet.location === 'string' && /^Each Team's Home Pool\b/i.test(meet.location);
    return isTimeTrials && usesTeamHomePool && team.timeTrialsPool ? `${team.timeTrialsPool} Pool` : meet.location;
  }

  function getNextMeet(meets, team, firstDate) {
    return meets.filter(meet => {
      if (!meet.date) return false;
      const meetDate = startOfDay(`${meet.date}T12:00:00`);
      const hasMatchup = Boolean(meet.visiting_team || meet.awayTeam || meet.home_team || meet.homeTeam);
      return meetDate >= firstDate && (!hasMatchup || globalThis.PreferencesService.meetIncludesFavoriteTeam(meet, team));
    }).map(meet => ({
      date: startOfDay(`${meet.date}T12:00:00`),
      label: 'Next swim event:',
      name: meet.name || 'Meet',
      location: getMeetLocation(meet, team),
      sessions: [],
      teams: meet.visiting_team || meet.awayTeam ? `${meet.visiting_team || meet.awayTeam} at ${meet.home_team || meet.homeTeam}` : '',
      type: 'meet'
    })).sort((first, second) => first.date - second.date).slice(0, 1);
  }

  function getUpcomingEvents(team, meets, firstDate = new Date()) {
    if (!team) return [];

    const today = startOfDay(firstDate);
    const visiblePractices = getVisiblePractices(globalThis.TeamScheduleService.getUpcomingPractices(team.practice, today, SCHEDULE_LOOKAHEAD_DAYS));
    const practices = getNextPractices(visiblePractices.filter(practice => isPendingPractice(practice, firstDate)));
    return [...practices, ...getNextMeet(Array.isArray(meets) ? meets : [], team, today)]
      .sort((first, second) => first.date - second.date);
  }

  function getTitle(teamName) {
    return `${teamName}: Upcoming events`;
  }

  function getStatus(events) {
    return events.length === 0
      ? 'No upcoming published practices or swim events are available.'
      : `Showing ${events.length} next published practice or swim event entries.`;
  }

  function renderEventName(event) {
    if (event.type !== 'meet') return '';

    return `<strong class="favorite-week__event-name">${globalThis.HtmlSafety.escapeHtml(event.name || 'Meet')}</strong>`;
  }

  function renderEventLabel(event) {
    const iconType = event.type === 'meet'
      ? 'event'
      : event.label === 'Next morning practice' ? 'morning' : event.label === 'Next evening practice' ? 'evening' : '';
    const icon = iconType
      ? `<span class="favorite-week__event-icon favorite-week__event-icon--${iconType}" aria-hidden="true">${EVENT_LABEL_ICONS[iconType]}</span>`
      : '';
    return `<strong class="favorite-week__event-label">${icon}${globalThis.HtmlSafety.escapeHtml(event.label)}</strong>`;
  }

  function renderLocation(location, poolLocationIndex) {
    const displayLocation = String(location || '').replace(/\s+Pool\s*$/i, '');
    return `<span class="favorite-week__pool-icon" aria-hidden="true">${POOL_ICON}</span>${globalThis.generateLinkedPoolMentions(displayLocation, poolLocationIndex)}`;
  }

  function renderEvents(events, dayHeadingLevel = 3, poolsOrIndex = []) {
    const headingTag = dayHeadingLevel === 4 ? 'h4' : 'h3';
    const poolLocationIndex = poolsOrIndex instanceof Map ? poolsOrIndex : globalThis.createPoolLocationIndex(poolsOrIndex);
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
            <div class="favorite-week__event-heading">
              ${renderEventLabel(event)}
              ${renderEventName(event)}
              <span class="favorite-week__location">${renderLocation(event.location, poolLocationIndex)}</span>
            </div>
            ${event.teams ? `<span>${globalThis.HtmlSafety.escapeHtml(event.teams)}</span>` : ''}
            ${event.sessions.length > 0 ? `<div class="sessions">${event.sessions.map(session => `
              <div class="session-item">
                <span class="session-time">${globalThis.HtmlSafety.escapeHtml(session.time)}</span>
                <span class="session-group">${globalThis.HtmlSafety.escapeHtml(session.group)}</span>
              </div>
            `).join('')}</div>` : ''}
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