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
  const assetVersion = ClassicScriptLoader.getAssetVersion(document.currentScript);
  let optionalDependenciesPromise;
  let primaryDependenciesPromise;
  let renderSequence = 0;

  /**
   * Loads dependencies required for the primary meet-day guide.
   * @returns {Promise<void>} Promise settled when all dependencies have loaded
   * @private
   */
  function loadPrimaryDependencies() {
    if (!primaryDependenciesPromise) {
      primaryDependenciesPromise = ClassicScriptLoader.load(globalThis.MY_MEET_DAY_PRIMARY_DEPENDENCIES, {
        assetVersion,
        dataset: source => ({ myMeetDayDependency: source })
      });
    }
    return primaryDependenciesPromise;
  }

  /**
   * Loads pool-specific dependencies after the primary guide is visible.
   * @returns {Promise<void>} Promise settled when optional dependencies have loaded
   * @private
   */
  function loadOptionalDependencies() {
    if (!optionalDependenciesPromise) {
      optionalDependenciesPromise = ClassicScriptLoader.load(globalThis.MY_MEET_DAY_OPTIONAL_DEPENDENCIES, {
        assetVersion,
        dataset: source => ({ myMeetDayDependency: source })
      });
    }
    return optionalDependenciesPromise;
  }

  /**
   * Records one dedicated-route readiness boundary for performance measurement.
   * @param {string} phaseName - Route lifecycle phase
   * @private
   */
  function markMyMeetDayPerformance(phaseName) {
    if (globalThis.performance && typeof globalThis.performance.mark === 'function') {
      globalThis.performance.mark(`cnsl:my-meet-day:${phaseName}`);
    }
  }

  /**
   * Allows the primary guide to paint before optional enrichment starts.
   * @returns {Promise<void>} Promise resolved after the next paint opportunity
   * @private
   */
  function waitForPrimaryGuidePaint() {
    return new Promise(resolve => {
      globalThis.requestAnimationFrame(() => globalThis.requestAnimationFrame(() => resolve()));
    });
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
    const calendarActions = document.getElementById('myMeetDayCalendarActions');
    if (guide) guide.hidden = true;
    if (content) content.replaceChildren();
    if (calendarActions) {
      calendarActions.hidden = true;
      calendarActions.replaceChildren();
    }
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
    const renderId = ++renderSequence;
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
      await loadPrimaryDependencies();
      if (renderId !== renderSequence || globalThis.PreferencesService.get().favoriteTeamId !== favoriteTeamId) return;

      const dataManager = globalThis.getDataManager();
      await dataManager.initialize(['teams', 'meets']);
      if (renderId !== renderSequence || globalThis.PreferencesService.get().favoriteTeamId !== favoriteTeamId) return;
      markMyMeetDayPerformance('primary-data-ready');

      const teams = dataManager.getTeams().getAllTeams();
      const team = globalThis.PreferencesService.findFavoriteTeam(teams, favoriteTeamId);
      if (!team) {
        showState('myMeetDayTeamUnavailable', 'Your saved team is not listed this season.');
        return;
      }

      const calendarActions = document.getElementById('myMeetDayCalendarActions');
      const calendarActionsMarkup = globalThis.TeamAgendaDisplay.renderCalendarActions(team);
      if (calendarActions && calendarActionsMarkup) {
        calendarActions.innerHTML = calendarActionsMarkup;
        calendarActions.hidden = false;
      }

      const guide = globalThis.MeetDayGuideService.getGuide(
        team,
        teams,
        dataManager.getMeets().getAllMeets(),
        [],
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
        markMyMeetDayPerformance('summary-visible');
        markMyMeetDayPerformance('optional-enrichment-settled');
        return;
      }

      content.innerHTML = guideMarkup;
      guideView.hidden = false;
      status.textContent = 'Meet-day details loaded.';
      markMyMeetDayPerformance('summary-visible');

      try {
        await waitForPrimaryGuidePaint();
        await loadOptionalDependencies();
        await dataManager.initialize(['pools']);
        if (renderId !== renderSequence || globalThis.PreferencesService.get().favoriteTeamId !== favoriteTeamId) return;
        const enrichedGuide = globalThis.MeetDayGuideService.getGuide(
          team,
          teams,
          dataManager.getMeets().getAllMeets(),
          dataManager.getPools().getAllPools(),
          globalThis.TimeUtils.getEasternTime()
        );
        const enrichedMarkup = globalThis.MeetDayGuideService.renderGuide(enrichedGuide);
        if (enrichedMarkup) content.innerHTML = enrichedMarkup;
      } catch (error) {
        console.error('Failed to enrich My Meet Day pool details:', error);
      } finally {
        if (renderId === renderSequence) markMyMeetDayPerformance('optional-enrichment-settled');
      }
    } catch (error) {
      console.error('Failed to load My Meet Day:', error);
      if (renderId !== renderSequence || globalThis.PreferencesService.get().favoriteTeamId !== favoriteTeamId) return;
      showState('myMeetDayUnavailable', 'Meet-day details did not load. Please refresh the page to try again.');
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (globalThis.cnslSeasonState && globalThis.cnslSeasonState.isOffSeason) return;
    renderMyMeetDay();
  });
  globalThis.addEventListener(globalThis.PREFERENCES_CHANGED_EVENT_NAME, renderMyMeetDay);
})();
