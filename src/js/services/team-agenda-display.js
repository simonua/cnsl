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
  const TeamAgendaIcons = globalThis.IconCatalog;

  /**
   * Normalize a value to local start of day.
   * @param {*} value - Date-compatible value
   * @returns {Date} Local start of day
   * @private
   */
  function startOfDay(value) {
    const date = new Date(value);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  /**
   * Format a date as a long day label.
   * @param {Date} date - Date to format
   * @returns {string} Long day label
   * @private
   */
  function formatDay(date) {
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  }

  /**
   * Select the next morning and evening practices.
   * @param {Array} practices - Upcoming practices
   * @returns {Array} Next morning and evening entries
   * @private
   */
  function getNextPractices(practices) {
    return ['morning', 'evening'].map(period => {
      const practice = practices.find(entry => entry.practicePeriod === period);
      return practice ? { ...practice, label: `Next ${period} practice` } : null;
    }).filter(Boolean);
  }

  /**
   * Filter practices by saved practice groups.
   * @param {Array} practices - Upcoming practices
   * @returns {Array} Practices matching saved groups
   * @private
   */
  function getVisiblePractices(practices) {
    const selectedPracticeGroups = globalThis.PreferencesService.get().practiceGroups;
    return practices.map(practice => ({
      ...practice,
      sessions: globalThis.PreferencesService.filterPracticeSessions(practice.sessions, selectedPracticeGroups)
    })).filter(practice => practice.sessions.length > 0);
  }

  /**
   * Check whether a practice has not yet ended.
   * @param {Object} practice - Dated practice entry
   * @param {Date} referenceDate - Current date and time
   * @returns {boolean} Whether the practice remains pending
   * @private
   */
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

  /**
   * Check whether an event is a time trials meet.
   * @param {Object} meet - Meet model or record
   * @returns {boolean} Whether it is time trials
   */
  function isTimeTrialsMeet(meet) {
    return Boolean(meet && (typeof meet.getTimeWindowKey === 'function'
      ? meet.getTimeWindowKey() === 'timeTrials'
      : meet.timeWindowKey === 'timeTrials'));
  }

  /**
   * Resolve a meet location for the selected team.
   * @param {Object} meet - Meet model
   * @param {Object} team - Team model
   * @returns {string} Display location
   */
  function getMeetLocation(meet, team) {
    const isTimeTrials = isTimeTrialsMeet(meet);
    return isTimeTrials && team.timeTrialsPool ? `${team.timeTrialsPool} Pool` : meet.location;
  }

  /**
   * Resolve a meet time for the selected team.
   * @param {Object} meet - Meet model
   * @param {Object} team - Team model
   * @returns {string} Display time
   */
  function getMeetDisplayTime(meet, team) {
    const timeWindowKey = typeof meet.getTimeWindowKey === 'function' ? meet.getTimeWindowKey() : '';
    const overrideTimingWindow = timeWindowKey && team
      ? (typeof team.getMeetTimeOverride === 'function' ? team.getMeetTimeOverride(timeWindowKey) : team.meetTimeOverrides?.[timeWindowKey])
      : null;
    return typeof meet.getDisplayTime === 'function' ? meet.getDisplayTime(overrideTimingWindow) : meet.time || 'Time not published';
  }

  /**
   * Select the next relevant swim event.
   * @param {Array} meets - Meet models
   * @param {Object} team - Favorite team
   * @param {Date} firstDate - Earliest date
   * @returns {Array} Zero or one display-ready meet
   * @private
   */
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

  /**
   * Select upcoming practices and the next swim event for a team.
   * @param {Object|null} team - Favorite team
   * @param {Array} meets - Meet models
   * @param {Date} firstDate - Reference date and time
   * @returns {Array} Chronological agenda entries
   */
  function getUpcomingEvents(team, meets, firstDate = new Date()) {
    if (!team) return [];

    const today = startOfDay(firstDate);
    const visiblePractices = getVisiblePractices(globalThis.TeamScheduleService.getUpcomingPractices(team.practice, today, SCHEDULE_LOOKAHEAD_DAYS));
    const practices = getNextPractices(visiblePractices.filter(practice => isPendingPractice(practice, firstDate)));
    return [...practices, ...getNextMeet(Array.isArray(meets) ? meets : [], team, today)]
      .sort((first, second) => first.date - second.date);
  }

  /**
   * Format an agenda title.
   * @param {string} teamName - Team name
   * @returns {string} Agenda title
   */
  function getTitle(teamName) {
    return `${teamName}: Upcoming events`;
  }

  /**
   * Format an agenda result status.
   * @param {Array} events - Agenda entries
   * @returns {string} Agenda status message
   */
  function getStatus(events) {
    return events.length === 0
      ? 'No upcoming published practices or swim events are available.'
      : `Showing ${events.length} next published practice or swim event entries.`;
  }

  /**
   * Render a meet event name.
   * @param {Object} event - Agenda event
   * @returns {string} Meet-name HTML
   * @private
   */
  function renderEventName(event) {
    if (event.type !== 'meet') return '';

    return `<strong class="favorite-week__event-name">${globalThis.HtmlSafety.escapeHtml(event.name || 'Meet')}</strong>`;
  }

  /**
   * Render an agenda event label and icon.
   * @param {Object} event - Agenda event
   * @returns {string} Event-label HTML
   * @private
   */
  function renderEventLabel(event) {
    const iconType = event.type === 'meet'
      ? 'event'
      : EVENT_LABEL_ICONS[event.practicePeriod] ? event.practicePeriod : '';
    const icon = iconType
      ? `<span class="favorite-week__event-icon favorite-week__event-icon--${iconType}" aria-hidden="true">${TeamAgendaIcons.render(EVENT_LABEL_ICONS[iconType])}</span>`
      : '';
    return `<strong class="favorite-week__event-label">${icon}${globalThis.HtmlSafety.escapeHtml(event.label)}</strong>`;
  }

  /**
   * Render a linked pool location.
   * @param {string} location - Published location
   * @param {Map<string, string>} poolLocationIndex - Prepared pool location index
   * @returns {string} Location HTML
   * @private
   */
  function renderLocation(location, poolLocationIndex) {
    const displayLocation = String(location || '').replace(/\s+Pool\s*$/i, '');
    return `<span class="favorite-week__pool-icon" aria-hidden="true">${TeamAgendaIcons.render('pool')}</span>${globalThis.generateLinkedPoolMentions(displayLocation, poolLocationIndex)}`;
  }

  /**
   * Render agenda entries grouped by calendar day.
   * @param {Array} events - Display-ready agenda entries
   * @param {number} dayHeadingLevel - Heading level for each day
   * @param {Array|Map<string, string>} poolsOrIndex - Pools or prepared location index
   * @param {Date} referenceDate - Date used for relative labels
   * @returns {string} Agenda HTML
   */
  function renderEvents(events, dayHeadingLevel = 3, poolsOrIndex = [], referenceDate = new Date()) {
    const headingTag = dayHeadingLevel === 4 ? 'h4' : 'h3';
    const poolLocationIndex = poolsOrIndex instanceof Map ? poolsOrIndex : globalThis.createPoolLocationIndex(poolsOrIndex);
    const days = new Map();
    events.forEach(event => {
      const key = event.date.toDateString();
      if (!days.has(key)) days.set(key, { date: event.date, events: [] });
      days.get(key).events.push(event);
    });

    return `<ol class="favorite-week__days">${[...days.values()].map(day => {
      const relativeDayOffset = globalThis.TimeUtils.getRelativeFutureDayOffset(day.date, referenceDate);
      const relativeDay = globalThis.TimeUtils.formatRelativeFutureDay(day.date, referenceDate);
      return `
      <li class="favorite-week__day">
        <${headingTag}><span>${globalThis.HtmlSafety.escapeHtml(formatDay(day.date))}</span>${relativeDay ? ` <span class="favorite-week__day-relative upcoming-day-pill${relativeDayOffset === 0 ? ' upcoming-day-pill--today' : relativeDayOffset === 1 ? ' upcoming-day-pill--tomorrow' : ''}">${globalThis.HtmlSafety.escapeHtml(relativeDay)}</span>` : ''}</${headingTag}>
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
    `;}).join('')}</ol>`;
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
