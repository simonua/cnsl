/**
 * Shows the selected team's next morning practice, evening practice, and swim event.
 * Loads the agenda dependencies lazily so the home route stays lightweight until a favorite team is available.
 */

(function initializeHomeSchedule() {
  const AGENDA_DEPENDENCIES = [
    'js/services/html-safety.js',
    'js/services/pool-link-helper.js',
    'js/services/time-utils.js',
    'js/types/pool-enums.js',
    'js/pool-schedule.js',
    'js/services/pool-period-schedule-service.js',
    'js/models/pool.js',
    'js/pools-manager.js',
    'js/models/team.js',
    'js/teams-manager.js',
    'js/models/meet.js',
    'js/meets-manager.js',
    'js/services/file-helper.js',
    'js/services/data-manager.js',
    'js/services/team-schedule-service.js',
    'js/services/team-agenda-display.js'
  ];
  const controllerSource = document.currentScript && document.currentScript.src
    ? new URL(document.currentScript.src, document.baseURI)
    : null;
  const assetVersion = controllerSource ? controllerSource.searchParams.get('v') : '';
  let dependenciesPromise;

  function getDependencySource(source) {
    if (!assetVersion) return source;

    const dependencySource = new URL(source, document.baseURI);
    dependencySource.searchParams.set('v', assetVersion);
    return dependencySource.toString();
  }

  function loadScript(source) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = getDependencySource(source);
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
    const title = document.getElementById('favoriteWeekTitle');
    const status = document.getElementById('favoriteWeekStatus');
    const schedule = document.getElementById('favoriteWeekSchedule');
    const shareSite = document.getElementById('shareSite');
    const favoriteTeamId = PreferencesService.get().favoriteTeamId;
    if (!section || !title || !status || !schedule) return;
    document.documentElement.classList.toggle('has-saved-favorite-team', Boolean(favoriteTeamId));
    section.hidden = true;
    title.textContent = '';
    status.hidden = true;
    status.textContent = '';
    schedule.replaceChildren();
    if (shareSite) shareSite.hidden = true;

    if (!favoriteTeamId) {
      if (shareSite) shareSite.hidden = false;
      return;
    }

    try {
      await loadAgendaDependencies();
      if (PreferencesService.get().favoriteTeamId !== favoriteTeamId) return;

      const dataManager = getDataManager();
      await dataManager.initialize(['pools', 'teams', 'meets']);
      if (PreferencesService.get().favoriteTeamId !== favoriteTeamId) return;

      const team = PreferencesService.findFavoriteTeam(dataManager.getTeams().getAllTeams(), favoriteTeamId);
      if (!team) {
        title.textContent = 'Favorite team not found';
        status.hidden = false;
        status.textContent = 'That team is not listed this season. Please choose another favorite on the Teams page.';
        section.hidden = false;
        return;
      }

      const events = globalThis.TeamAgendaDisplay.getUpcomingEvents(team, dataManager.getMeets().getAllMeets());
      title.textContent = `Upcoming ${team.shortName || team.name} events`;
      if (events.length === 0) {
        status.hidden = false;
        status.textContent = globalThis.TeamAgendaDisplay.getStatus(events);
        section.hidden = false;
        return;
      }

      schedule.innerHTML = globalThis.TeamAgendaDisplay.renderEvents(events, 3, dataManager.getPools().getAllPools());
      section.hidden = false;
    } catch (error) {
      console.error('Failed to load favorite team schedule:', error);
      if (PreferencesService.get().favoriteTeamId !== favoriteTeamId) return;

      title.textContent = 'Team schedule did not load';
      status.hidden = false;
      status.textContent = 'Please check your connection, then refresh the page to try again.';
      section.hidden = false;
    } finally {
      if (shareSite && PreferencesService.get().favoriteTeamId === favoriteTeamId) {
        shareSite.hidden = false;
      }
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
    if (globalThis.cnslSeasonState && globalThis.cnslSeasonState.isOffSeason) return;
    initializeFavoriteWeekToggle();
    renderFavoriteWeek();
  });
  window.addEventListener('cnsl:preferences-changed', renderFavoriteWeek);
})();
