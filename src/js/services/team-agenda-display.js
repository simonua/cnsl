/**
 * Selects and formats the next published practices and swim event for a team.
 */
(function initializeTeamAgendaDisplay() {
  const SCHEDULE_LOOKAHEAD_DAYS = 366;
  const EVENT_LABEL_ICONS = Object.freeze({
    morning: 'sun',
    evening: 'moon',
    event: 'swimmer'
  });
  const TeamAgendaIcons = typeof module !== 'undefined' && module.exports
    ? require('./icon-catalog.js')
    : globalThis.IconCatalog;

  function startOfDay(value) {
    const date = new Date(value);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  function formatDay(date) {
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  }

  function formatRelativeDay(date, referenceDate = new Date()) {
    const getCalendarDay = value => Date.UTC(value.getFullYear(), value.getMonth(), value.getDate());
    const dayOffset = Math.round((getCalendarDay(date) - getCalendarDay(referenceDate)) / (24 * 60 * 60 * 1000));
    if (dayOffset === 0) return 'today';
    if (dayOffset === 1) return 'tomorrow';
    if (dayOffset > 1) return `in ${dayOffset} days`;
    if (dayOffset === -1) return 'yesterday';
    return `${Math.abs(dayOffset)} days ago`;
  }

  function getNextPractices(practices) {
    return ['morning', 'evening'].map(period => {
      const practice = practices.find(entry => entry.practicePeriod === period);
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

  function isTimeTrialsMeet(meet) {
    return Boolean(meet && (typeof meet.getTimeWindowKey === 'function'
      ? meet.getTimeWindowKey() === 'timeTrials'
      : meet.timeWindowKey === 'timeTrials'));
  }

  function getMeetLocation(meet, team) {
    const isTimeTrials = isTimeTrialsMeet(meet);
    return isTimeTrials && team.timeTrialsPool ? `${team.timeTrialsPool} Pool` : meet.location;
  }

  function getMeetDisplayTime(meet, team) {
    const timeWindowKey = typeof meet.getTimeWindowKey === 'function' ? meet.getTimeWindowKey() : '';
    const overrideTimingWindow = timeWindowKey && team
      ? (typeof team.getMeetTimeOverride === 'function' ? team.getMeetTimeOverride(timeWindowKey) : team.meetTimeOverrides?.[timeWindowKey])
      : null;
    return typeof meet.getDisplayTime === 'function' ? meet.getDisplayTime(overrideTimingWindow) : meet.time || 'Time not published';
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
      time: getMeetDisplayTime(meet, team),
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
      : EVENT_LABEL_ICONS[event.practicePeriod] ? event.practicePeriod : '';
    const icon = iconType
      ? `<span class="favorite-week__event-icon favorite-week__event-icon--${iconType}" aria-hidden="true">${TeamAgendaIcons.render(EVENT_LABEL_ICONS[iconType])}</span>`
      : '';
    return `<strong class="favorite-week__event-label">${icon}${globalThis.HtmlSafety.escapeHtml(event.label)}</strong>`;
  }

  function renderLocation(location, poolLocationIndex) {
    const displayLocation = String(location || '').replace(/\s+Pool\s*$/i, '');
    return `<span class="favorite-week__pool-icon" aria-hidden="true">${TeamAgendaIcons.render('pool')}</span>${globalThis.generateLinkedPoolMentions(displayLocation, poolLocationIndex)}`;
  }

  function renderEvents(events, dayHeadingLevel = 3, poolsOrIndex = [], referenceDate = new Date()) {
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
        <${headingTag}><span>${globalThis.HtmlSafety.escapeHtml(formatDay(day.date))}</span> <span class="favorite-week__day-relative">${globalThis.HtmlSafety.escapeHtml(formatRelativeDay(day.date, referenceDate))}</span></${headingTag}>
        <ul class="favorite-week__events">${day.events.map(event => `
          <li>
            <div class="favorite-week__event-heading">
              ${renderEventLabel(event)}
              ${renderEventName(event)}
              <span class="favorite-week__location">${renderLocation(event.location, poolLocationIndex)}</span>
            </div>
            ${event.teams ? `<span>${globalThis.HtmlSafety.escapeHtml(event.teams)}</span>` : ''}
            ${event.type === 'meet' && event.time ? `<div class="sessions"><div class="session-item"><span class="session-time">${globalThis.HtmlSafety.escapeHtml(event.time)}</span></div></div>` : ''}
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
    getMeetDisplayTime,
    getMeetLocation,
    getUpcomingEvents,
    isTimeTrialsMeet,
    renderEvents
  });
})();