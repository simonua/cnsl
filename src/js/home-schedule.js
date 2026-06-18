/**
 * Shows the selected team's next morning practice, evening practice, and swim event.
 * Loads the agenda dependencies lazily so the home route stays lightweight until a favorite team is available.
 */

(function initializeHomeSchedule() {
  const controllerSource = document.currentScript && document.currentScript.src
    ? new URL(document.currentScript.src, document.baseURI)
    : null;
  const assetVersion = controllerSource ? controllerSource.searchParams.get('v') : '';
  let dependenciesPromise;

  /**
   * Applies the controller asset version to a lazily loaded dependency URL.
   * @param {string} source - Relative dependency source
   * @returns {string} Versioned dependency URL or the unchanged relative source
   * @private
   */
  function getDependencySource(source) {
    if (!assetVersion) return source;

    const dependencySource = new URL(source, document.baseURI);
    dependencySource.searchParams.set('v', assetVersion);
    return dependencySource.toString();
  }

  /**
   * Appends a classic script dependency and resolves after it loads.
   * @param {string} source - Relative dependency source
   * @returns {Promise<void>} Promise settled when the script loads or fails
   * @private
   */
  function loadScript(source) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = getDependencySource(source);
      script.async = false;
      script.dataset.homeScheduleDependency = source;
      script.addEventListener('load', resolve, { once: true });
      script.addEventListener('error', () => reject(new Error(`Unable to load ${source}.`)), { once: true });
      document.head.appendChild(script);
    });
  }

  /**
   * Loads the favorite-team agenda dependencies once in their required order.
   * @returns {Promise<void>} Promise settled when all dependencies have loaded
   * @private
   */
  function loadAgendaDependencies() {
    if (!dependenciesPromise) {
      dependenciesPromise = Promise.all(
        globalThis.TEAM_AGENDA_DEPENDENCIES.map(source => loadScript(source))
      ).then(() => undefined);
    }
    return dependenciesPromise;
  }

  /**
   * Resolves the My Meet Day device opt-in without interrupting the standard agenda.
   * @returns {Promise<boolean>} Whether the experimental preview may render
   * @private
   */
  async function isMyMeetDayEnabled() {
    try {
      return await globalThis.ExperimentalFeaturesService.isEnabled(
        globalThis.EXPERIMENTAL_FEATURE_IDS.MY_MEET_DAY
      );
    } catch (error) {
      console.error('Unable to load My Meet Day availability:', error);
      return false;
    }
  }

  /**
   * Renders upcoming events for the currently selected favorite team.
   * @returns {Promise<void>} Promise settled after the favorite-team section is updated
   * @private
   */
  async function renderFavoriteWeek() {
    const section = document.getElementById('favoriteWeek');
    const title = document.getElementById('favoriteWeekTitle');
    const status = document.getElementById('favoriteWeekStatus');
    const schedule = document.getElementById('favoriteWeekSchedule');
    const meetDaySection = document.getElementById('myMeetDay');
    const meetDayContent = document.getElementById('myMeetDayContent');
    const shareSite = document.getElementById('shareSite');
    const favoriteTeamId = PreferencesService.get().favoriteTeamId;
    if (!section || !title || !status || !schedule) return;
    document.documentElement.classList.toggle('has-saved-favorite-team', Boolean(favoriteTeamId));
    section.hidden = true;
    title.textContent = '';
    status.hidden = true;
    status.textContent = '';
    schedule.replaceChildren();
    if (meetDaySection) meetDaySection.hidden = true;
    if (meetDayContent) meetDayContent.replaceChildren();
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
      if (meetDaySection && meetDayContent && await isMyMeetDayEnabled()) {
        const guide = globalThis.MeetDayGuideService.getGuide(
          team,
          dataManager.getTeams().getAllTeams(),
          dataManager.getMeets().getAllMeets(),
          dataManager.getPools().getAllPools(),
          globalThis.TimeUtils.getEasternTime(),
          globalThis.MY_MEET_DAY_HOME_LOOKAHEAD_DAYS
        );
        const meetDayHtml = globalThis.MeetDayGuideService.renderGuide(guide);
        if (meetDayHtml) {
          meetDayContent.innerHTML = meetDayHtml;
          meetDaySection.hidden = false;
        }
      }
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

  /**
   * Binds one home-page section disclosure control.
   * @param {string} toggleId - Disclosure button identifier
   * @param {string} contentId - Controlled content identifier
   * @private
   */
  function initializeSectionToggle(toggleId, contentId) {
    const toggle = document.getElementById(toggleId);
    const content = document.getElementById(contentId);
    if (!toggle || !content) return;

    toggle.addEventListener('click', () => {
      const isExpanded = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!isExpanded));
      content.hidden = isExpanded;
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (globalThis.cnslSeasonState && globalThis.cnslSeasonState.isOffSeason) return;
    initializeSectionToggle('myMeetDayToggle', 'myMeetDayContent');
    initializeSectionToggle('favoriteWeekToggle', 'favoriteWeekContent');
    renderFavoriteWeek();
  });
  window.addEventListener(globalThis.PREFERENCES_CHANGED_EVENT_NAME, renderFavoriteWeek);
})();
