/**
 * Shows the selected team's next morning practice, evening practice, and swim event.
 */
(function initializeHomeSchedule() {
  const AGENDA_DEPENDENCIES = [
    'js/services/html-safety.js',
    'js/services/pool-link-helper.js',
    'js/teams-manager.js',
    'js/meets-manager.js',
    'js/services/file-helper.js',
    'js/services/data-manager.js',
    'js/services/team-schedule-service.js',
    'js/services/team-agenda-display.js'
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

      const events = globalThis.TeamAgendaDisplay.getUpcomingEvents(team, dataManager.getMeets().getAllMeets());
      document.getElementById('favoriteWeekTitle').textContent = globalThis.TeamAgendaDisplay.getTitle(team.name);
      if (events.length === 0) {
        status.textContent = globalThis.TeamAgendaDisplay.getStatus(events);
        return;
      }

      status.textContent = globalThis.TeamAgendaDisplay.getStatus(events);
      schedule.innerHTML = globalThis.TeamAgendaDisplay.renderEvents(events);
    } catch (error) {
      console.error('Failed to load favorite team schedule:', error);
      status.textContent = 'Your team schedule is currently unavailable. Please try again later.';
    }
  }

  function initializeFavoriteWeekToggle() {
    const toggle = document.getElementById('favoriteWeekToggle');
    const content = document.getElementById('favoriteWeekContent');
    if (!toggle || !content) return;

    toggle.addEventListener('click', () => {
      const isExpanded = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!isExpanded));
      content.hidden = isExpanded;
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    initializeFavoriteWeekToggle();
    renderFavoriteWeek();
  });
  window.addEventListener('cnsl:preferences-changed', renderFavoriteWeek);
})();