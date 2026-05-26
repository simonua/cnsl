/**
 * Shows the selected team's practices and meets for the coming seven days.
 */
(function initializeHomeSchedule() {
  const AGENDA_DEPENDENCIES = [
    'js/services/html-safety.js',
    'js/teams-manager.js',
    'js/meets-manager.js',
    'js/services/file-helper.js',
    'js/services/data-manager.js',
    'js/services/team-schedule-service.js'
  ];
  let dependenciesPromise;

  function loadScript(source) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = source;
      script.dataset.homeScheduleDependency = source;
      script.addEventListener('load', resolve, { once: true });
      script.addEventListener('error', () => reject(new Error(`Unable to load ${source}.`)), { once: true });
      document.head.appendChild(script);
    });
  }

  function loadAgendaDependencies() {
    if (!dependenciesPromise) {
      dependenciesPromise = AGENDA_DEPENDENCIES.reduce(
        (loadPromise, source) => loadPromise.then(() => loadScript(source)),
        Promise.resolve()
      );
    }
    return dependenciesPromise;
  }

  function startOfDay(value) {
    const date = new Date(value);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  function formatDay(date) {
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  }

  function getFavoriteMeets(meets, team, firstDate) {
    const finalDate = new Date(firstDate);
    finalDate.setDate(finalDate.getDate() + 6);

    return meets.filter(meet => {
      if (!meet.date || !PreferencesService.meetIncludesFavoriteTeam(meet, team)) return false;
      const meetDate = startOfDay(`${meet.date}T12:00:00`);
      return meetDate >= firstDate && meetDate <= finalDate;
    }).map(meet => ({
      date: startOfDay(`${meet.date}T12:00:00`),
      label: meet.name || 'Meet',
      location: meet.location,
      sessions: [],
      teams: `${meet.visiting_team || meet.awayTeam} at ${meet.home_team || meet.homeTeam}`,
      type: 'meet'
    }));
  }

  function renderEvents(container, events) {
    const days = new Map();
    events.sort((first, second) => first.date - second.date).forEach(event => {
      const key = event.date.toDateString();
      if (!days.has(key)) days.set(key, { date: event.date, events: [] });
      days.get(key).events.push(event);
    });

    container.innerHTML = `<ol class="favorite-week__days">${[...days.values()].map(day => `
      <li class="favorite-week__day">
        <h3>${HtmlSafety.escapeHtml(formatDay(day.date))}</h3>
        <ul class="favorite-week__events">${day.events.map(event => `
          <li>
            <strong>${HtmlSafety.escapeHtml(event.label)}</strong>
            ${event.teams ? `<span>${HtmlSafety.escapeHtml(event.teams)}</span>` : ''}
            ${event.sessions.map(session => `<span>${HtmlSafety.escapeHtml(session.group)}: ${HtmlSafety.escapeHtml(session.time)}</span>`).join('')}
            <span>${HtmlSafety.escapeHtml(event.location)}</span>
          </li>
        `).join('')}</ul>
      </li>
    `).join('')}</ol>`;
  }

  async function renderFavoriteWeek() {
    const section = document.getElementById('favoriteWeek');
    const status = document.getElementById('favoriteWeekStatus');
    const schedule = document.getElementById('favoriteWeekSchedule');
    const favoriteTeamId = PreferencesService.get().favoriteTeamId;
    if (!section || !status || !schedule) return;

    if (!favoriteTeamId) {
      section.hidden = true;
      schedule.replaceChildren();
      return;
    }

    section.hidden = false;
    status.textContent = 'Loading your team\'s schedule.';
    schedule.replaceChildren();
    try {
      await loadAgendaDependencies();
      if (PreferencesService.get().favoriteTeamId !== favoriteTeamId) return;

      const dataManager = getDataManager();
      await dataManager.initialize(['teams', 'meets']);
      const team = PreferencesService.findFavoriteTeam(dataManager.getTeams().getAllTeams(), favoriteTeamId);
      if (!team) {
        status.textContent = 'Your saved favorite team is no longer listed for this season.';
        return;
      }

      document.getElementById('favoriteWeekTitle').textContent = `${team.name}: next seven days`;
      const today = startOfDay(new Date());
      const practices = TeamScheduleService.getUpcomingPractices(team.practice, today, 7);
      const meets = getFavoriteMeets(dataManager.getMeets().getAllMeets(), team, today);
      const events = [...practices, ...meets];
      if (events.length === 0) {
        status.textContent = 'No published practices or meets are scheduled in the next seven days.';
        return;
      }

      status.textContent = `${events.length} published practice or meet schedule entries in the next seven days.`;
      renderEvents(schedule, events);
    } catch (error) {
      console.error('Failed to load favorite team schedule:', error);
      status.textContent = 'Your team schedule is currently unavailable. Please try again later.';
    }
  }

  document.addEventListener('DOMContentLoaded', renderFavoriteWeek);
  window.addEventListener('cnsl:preferences-changed', renderFavoriteWeek);
})();