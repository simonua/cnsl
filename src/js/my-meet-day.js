/**
 * Loads the saved favorite team's dedicated meet-day view.
 * Keeps route state in the DOM while delegating guide selection and safe markup to MeetDayGuideService.
 */

(function initializeMyMeetDayView() {
  const VIEW_STATE_IDS = Object.freeze([
    'myMeetDayDisabled',
    'myMeetDayNoFavorite',
    'myMeetDayNoMeet',
    'myMeetDayTeamUnavailable',
    'myMeetDayUnavailable'
  ]);
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
      script.dataset.myMeetDayDependency = source;
      script.addEventListener('load', resolve, { once: true });
      script.addEventListener('error', () => reject(new Error(`Unable to load ${source}.`)), { once: true });
      document.head.appendChild(script);
    });
  }

  /**
   * Loads the meet-day guide dependencies once in their required order.
   * @returns {Promise<void>} Promise settled when all dependencies have loaded
   * @private
   */
  function loadGuideDependencies() {
    if (!dependenciesPromise) {
      dependenciesPromise = globalThis.TEAM_AGENDA_DEPENDENCIES.reduce(
        (loadPromise, source) => loadPromise.then(() => loadScript(source)),
        Promise.resolve()
      );
    }
    return dependenciesPromise;
  }

  /**
   * Hides every page state and the rendered guide before a refresh.
   * @private
   */
  function resetView() {
    VIEW_STATE_IDS.forEach(id => {
      const state = document.getElementById(id);
      if (state) state.hidden = true;
    });

    const guide = document.getElementById('myMeetDay');
    const content = document.getElementById('myMeetDayContent');
    if (guide) guide.hidden = true;
    if (content) content.replaceChildren();
  }

  /**
   * Shows one recovery state and announces its message.
   * @param {string} stateId - DOM identifier for the state to reveal
   * @param {string} message - Status announcement for assistive technology
   * @private
   */
  function showState(stateId, message) {
    const state = document.getElementById(stateId);
    const status = document.getElementById('myMeetDayStatus');
    if (state) state.hidden = false;
    if (status) status.textContent = message;
  }

  /**
   * Resolves whether this device opted into the configured My Meet Day experiment.
   * @returns {Promise<boolean>} Whether the experimental route may load its data
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
   * Loads annual data and renders the current favorite team's guide.
   * @returns {Promise<void>} Promise settled after the route state is updated
   * @private
   */
  async function renderMyMeetDay() {
    const content = document.getElementById('myMeetDayContent');
    const guideView = document.getElementById('myMeetDay');
    const status = document.getElementById('myMeetDayStatus');
    if (!content || !guideView || !status) return;

    resetView();
    status.textContent = 'Loading meet-day details.';
    if (!await isMyMeetDayEnabled()) {
      showState('myMeetDayDisabled', 'My Meet Day is off on this device. Open Experimental Features in Settings to enable it.');
      return;
    }
    const favoriteTeamId = globalThis.PreferencesService.get().favoriteTeamId;
    if (!favoriteTeamId) {
      showState('myMeetDayNoFavorite', 'Choose a favorite team to see meet-day details.');
      return;
    }

    try {
      await loadGuideDependencies();
      if (globalThis.PreferencesService.get().favoriteTeamId !== favoriteTeamId) return;

      const dataManager = globalThis.getDataManager();
      await dataManager.initialize(['pools', 'teams', 'meets']);
      if (globalThis.PreferencesService.get().favoriteTeamId !== favoriteTeamId) return;

      const teams = dataManager.getTeams().getAllTeams();
      const team = globalThis.PreferencesService.findFavoriteTeam(teams, favoriteTeamId);
      if (!team) {
        showState('myMeetDayTeamUnavailable', 'Your saved team is not listed this season.');
        return;
      }

      const guide = globalThis.MeetDayGuideService.getGuide(
        team,
        teams,
        dataManager.getMeets().getAllMeets(),
        dataManager.getPools().getAllPools(),
        globalThis.TimeUtils.getEasternTime()
      );
      const guideMarkup = globalThis.MeetDayGuideService.renderGuide(guide);
      if (!guideMarkup) {
        const teamName = document.getElementById('myMeetDayTeamName');
        if (teamName) teamName.textContent = team.shortName || team.name;
        const noMeetState = document.getElementById('myMeetDayNoMeet');
        showState(
          'myMeetDayNoMeet',
          noMeetState?.querySelector('p')?.textContent.trim()
            || 'No meet-day details are available in the configured window.'
        );
        return;
      }

      content.innerHTML = guideMarkup;
      guideView.hidden = false;
      status.textContent = 'Meet-day details loaded.';
    } catch (error) {
      console.error('Failed to load My Meet Day:', error);
      if (globalThis.PreferencesService.get().favoriteTeamId !== favoriteTeamId) return;
      showState('myMeetDayUnavailable', 'Meet-day details did not load. Please refresh the page to try again.');
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (globalThis.cnslSeasonState && globalThis.cnslSeasonState.isOffSeason) return;
    renderMyMeetDay();
  });
  globalThis.addEventListener(globalThis.PREFERENCES_CHANGED_EVENT_NAME, renderMyMeetDay);
})();
