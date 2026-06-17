(function initializeSettingsDialog() {
  'use strict';

  const dependencyScripts = [
    { source: 'js/services/time-utils.js', ready: () => Boolean(window.TimeUtils) },
    { source: 'js/types/pool-enums.js', ready: () => Boolean(window.PoolStatus) },
    { source: 'js/models/pool-schedule.js', ready: () => Boolean(window.PoolSchedule) },
    { source: 'js/services/pool-period-schedule-service.js', ready: () => Boolean(window.PoolPeriodScheduleService) },
    { source: 'js/models/pool.js', ready: () => Boolean(window.Pool) },
    { source: 'js/managers/pools-manager.js', ready: () => Boolean(window.PoolsManager) },
    { source: 'js/models/team.js', ready: () => Boolean(window.Team) },
    { source: 'js/managers/teams-manager.js', ready: () => Boolean(window.TeamsManager) },
    { source: 'js/services/file-helper.js', ready: () => Boolean(window.FileHelper) },
    { source: 'js/services/data-manager.js', ready: () => Boolean(window.DataManager) }
  ];

  /**
   * Loads one settings dependency unless its global is already ready.
   * @param {Object} dependency - Dependency source and readiness test
   * @returns {Promise<void>} Promise settled after dependency initialization
   * @private
   */
  function loadScript(dependency) {
    if (dependency.ready()) return Promise.resolve();

    return new Promise((resolve, reject) => {
      const existing = Array.from(document.scripts).find(script => script.getAttribute('src') === dependency.source);
      const script = existing || document.createElement('script');
      /**
       * Resolves after verifying that the loaded dependency initialized.
       * @private
       */
      const handleLoad = () => {
        if (dependency.ready()) {
          resolve();
        } else {
          reject(new Error(`Settings dependency did not initialize: ${dependency.source}`));
        }
      };
      /**
       * Rejects when the dependency script cannot be loaded.
       * @private
       */
      const handleError = () => reject(new Error(`Unable to load settings dependency: ${dependency.source}`));

      script.addEventListener('load', handleLoad, { once: true });
      script.addEventListener('error', handleError, { once: true });
      if (!existing) {
        script.src = dependency.source;
        document.body.appendChild(script);
      }
    });
  }

  /**
   * Loads all data dependencies in their required order.
   * @returns {Promise<void>} Promise settled after all dependencies initialize
   * @private
   */
  async function ensureDataDependencies() {
    for (const dependency of dependencyScripts) {
      await loadScript(dependency);
    }
  }

  /**
   * Populates a favorite selector from normalized domain items.
   * @param {HTMLSelectElement} select - Select element to populate
   * @param {Array} items - Domain items used for options
   * @param {string} emptyText - Label for the empty option
   * @param {Function} getValue - Extracts an option value
   * @param {Function} getLabel - Extracts an option label
   * @private
   */
  function populateSelect(select, items, emptyText, getValue, getLabel) {
    select.innerHTML = '';
    const noFavoriteOption = document.createElement('option');
    noFavoriteOption.value = '';
    noFavoriteOption.textContent = emptyText;
    select.appendChild(noFavoriteOption);

    items.forEach(item => {
      const option = document.createElement('option');
      option.value = getValue(item);
      option.textContent = getLabel(item);
      select.appendChild(option);
    });
    select.disabled = false;
  }

  /**
   * Updates the Experimental Features summary from currently rendered options.
   * @param {HTMLFormElement} form - Settings form containing experimental feature switches
   * @private
   */
  function updateExperimentalFeaturesCount(form) {
    const count = document.getElementById('experimentalFeaturesCount');
    if (!count) return;

    const featureToggles = form.querySelectorAll('input[name="experimentalFeatures"]');
    const enabledCount = Array.from(featureToggles).filter(featureToggle => featureToggle.checked).length;
    count.textContent = `${enabledCount}/${featureToggles.length} enabled`;
  }

  /**
   * Applies saved preference values to the settings form.
   * @param {HTMLFormElement} form - Settings form
   * @param {Object} preferences - Saved preferences
   * @private
   */
  function applyFormValues(form, preferences) {
    const selectedTheme = form.querySelector(`input[name="theme"][value="${preferences.theme}"]`);
    if (selectedTheme) selectedTheme.checked = true;
    const selectedTextSize = form.querySelector(`input[name="textSize"][value="${preferences.textSize}"]`);
    if (selectedTextSize) selectedTextSize.checked = true;
    const selectedContrast = form.querySelector(`input[name="contrast"][value="${preferences.contrast}"]`);
    if (selectedContrast) selectedContrast.checked = true;
    const selectedMotion = form.querySelector(`input[name="motion"][value="${preferences.motion}"]`);
    if (selectedMotion) selectedMotion.checked = true;
    form.elements.underlineLinks.checked = preferences.underlineLinks;
    form.querySelectorAll('input[name="experimentalFeatures"]').forEach(featureToggle => {
      featureToggle.checked = preferences.experimentalFeatures.includes(featureToggle.value);
      const state = featureToggle.closest('.settings-experiment')?.querySelector('.settings-switch__state');
      if (state) state.textContent = featureToggle.checked ? 'On' : 'Off';
    });
    const selectedScheduleLayout = form.querySelector(`input[name="poolScheduleLayout"][value="${preferences.poolScheduleLayout}"]`);
    if (selectedScheduleLayout) selectedScheduleLayout.checked = true;
    const selectedWeatherRefresh = form.querySelector(`input[name="weatherRefreshMinutes"][value="${preferences.weatherRefreshMinutes}"]`);
    if (selectedWeatherRefresh) selectedWeatherRefresh.checked = true;
    form.querySelectorAll('input[name="practiceGroups"]').forEach(practiceGroup => {
      practiceGroup.checked = preferences.practiceGroups.includes(practiceGroup.value);
    });
    form.elements.favoriteTeam.value = preferences.favoriteTeamId;
    form.elements.favoritePool.value = preferences.favoritePoolName;
    form.elements.locationAwarenessEnabled.checked = preferences.locationAwarenessEnabled;
    updateExperimentalFeaturesCount(form);
  }

  /**
   * Publishes an analytics event for a changed fixed setting.
   * @param {string} settingName - Approved setting name
   * @param {*} settingValue - New fixed setting value
   * @private
   */
  function trackFixedSettingChange(settingName, settingValue) {
    if (!window.cnslAnalytics) return;
    window.cnslAnalytics.trackInteraction(AnalyticsInteractionType.FIXED_SETTING_CHANGE, {
      settingName,
      settingValue
    });
  }

  /**
   * Publishes an analytics event for a changed annual-data setting.
   * @param {string} settingName - Approved setting name
   * @param {string} selectedValue - Selected annual-data value
   * @param {Set<string>} publishedValues - Allowed annual-data values
   * @private
   */
  function trackPublishedSettingChange(settingName, selectedValue, publishedValues) {
    if (!window.cnslAnalytics) return;
    window.cnslAnalytics.trackInteraction(AnalyticsInteractionType.PUBLISHED_SETTING_CHANGE, {
      publishedValues,
      selectedValues: selectedValue ? [selectedValue] : [],
      settingName
    });
  }

  /**
   * Publishes an analytics event for a reviewed experimental feature change.
   * @param {string} featureId - Application-owned experimental feature identifier
   * @param {boolean} enabled - Whether the visitor enabled the feature
   * @private
   */
  function trackExperimentalFeatureChange(featureId, enabled) {
    if (!window.cnslAnalytics) return;
    window.cnslAnalytics.trackInteraction(AnalyticsInteractionType.EXPERIMENTAL_FEATURE_CHANGE, {
      action: enabled ? 'enabled' : 'disabled',
      featureId
    });
  }

  /**
   * Resolves a stored team identifier to its published team name for analytics.
   * @param {string} teamId - Stored favorite team identifier
   * @param {Map<string, string>} publishedTeamNamesById - Published team names keyed by identifier
   * @returns {string} Published team name, empty selection, or the unrecognized value for rejection
   * @private
   */
  function getFavoriteTeamAnalyticsValue(teamId, publishedTeamNamesById) {
    if (!teamId) return '';
    return publishedTeamNamesById.get(teamId) || teamId;
  }

  /**
   * Tracks the setting represented by a changed form control.
   * @param {Element} changedField - Changed form control
   * @param {Object} existing - Preferences before the change
   * @param {Object} saved - Preferences after the change
   * @param {Set<string>} publishedPoolNames - Published pool names
  * @param {Set<string>} publishedTeamNames - Published team names
  * @param {Map<string, string>} publishedTeamNamesById - Published team names keyed by identifier
   * @private
   */
  function trackChangedFormSetting(changedField, existing, saved, publishedPoolNames, publishedTeamNames, publishedTeamNamesById) {
    if (changedField.name === 'theme' && saved.theme !== existing.theme) {
      trackFixedSettingChange('theme', saved.theme);
    } else if (changedField.name === 'textSize' && saved.textSize !== existing.textSize) {
      trackFixedSettingChange('text_size', saved.textSize);
    } else if (changedField.name === 'contrast' && saved.contrast !== existing.contrast) {
      trackFixedSettingChange('contrast', saved.contrast);
    } else if (changedField.name === 'motion' && saved.motion !== existing.motion) {
      trackFixedSettingChange('motion', saved.motion);
    } else if (changedField.name === 'underlineLinks' && saved.underlineLinks !== existing.underlineLinks) {
      trackFixedSettingChange('underline_links', saved.underlineLinks ? 'enabled' : 'disabled');
    } else if (changedField.name === 'experimentalFeatures'
      && saved.experimentalFeatures.join('|') !== existing.experimentalFeatures.join('|')) {
      trackExperimentalFeatureChange(changedField.value, saved.experimentalFeatures.includes(changedField.value));
    } else if (changedField.name === 'poolScheduleLayout' && saved.poolScheduleLayout !== existing.poolScheduleLayout) {
      trackFixedSettingChange('pool_schedule_layout', saved.poolScheduleLayout);
    } else if (changedField.name === 'locationAwarenessEnabled' && saved.locationAwarenessEnabled !== existing.locationAwarenessEnabled) {
      trackFixedSettingChange('location_awareness', saved.locationAwarenessEnabled ? 'enabled' : 'disabled');
    } else if (changedField.name === 'weatherRefreshMinutes' && saved.weatherRefreshMinutes !== existing.weatherRefreshMinutes) {
      trackFixedSettingChange('weather_refresh_minutes', saved.weatherRefreshMinutes);
    } else if (changedField.name === 'practiceGroups' && saved.practiceGroups.join('|') !== existing.practiceGroups.join('|')) {
      trackFixedSettingChange('practice_groups', 'changed');
    } else if (changedField.name === 'favoritePool' && saved.favoritePoolName !== existing.favoritePoolName) {
      trackPublishedSettingChange('favorite_pool', saved.favoritePoolName, publishedPoolNames);
    } else if (changedField.name === 'favoriteTeam' && saved.favoriteTeamId !== existing.favoriteTeamId) {
      const teamName = getFavoriteTeamAnalyticsValue(saved.favoriteTeamId, publishedTeamNamesById);
      trackPublishedSettingChange('favorite_team', teamName, publishedTeamNames);
    }
  }

  /**
   * Tracks settings changed by restoring preference defaults.
   * @param {Object} existing - Preferences before resetting
   * @param {Object} reset - Default preferences after resetting
   * @param {Set<string>} publishedPoolNames - Published pool names
   * @param {Set<string>} publishedTeamNames - Published team names
   * @private
   */
  function trackResetSettings(existing, reset, publishedPoolNames, publishedTeamNames) {
    if (existing.theme !== reset.theme) trackFixedSettingChange('theme', reset.theme);
    if (existing.textSize !== reset.textSize) trackFixedSettingChange('text_size', reset.textSize);
    if (existing.contrast !== reset.contrast) trackFixedSettingChange('contrast', reset.contrast);
    if (existing.motion !== reset.motion) trackFixedSettingChange('motion', reset.motion);
    if (existing.underlineLinks !== reset.underlineLinks) trackFixedSettingChange('underline_links', 'disabled');
    existing.experimentalFeatures
      .filter(featureId => !reset.experimentalFeatures.includes(featureId))
      .forEach(featureId => trackExperimentalFeatureChange(featureId, false));
    if (existing.poolScheduleLayout !== reset.poolScheduleLayout) trackFixedSettingChange('pool_schedule_layout', reset.poolScheduleLayout);
    if (existing.locationAwarenessEnabled !== reset.locationAwarenessEnabled) trackFixedSettingChange('location_awareness', 'disabled');
    if (existing.weatherRefreshMinutes !== reset.weatherRefreshMinutes) trackFixedSettingChange('weather_refresh_minutes', reset.weatherRefreshMinutes);
    if (existing.practiceGroups.join('|') !== reset.practiceGroups.join('|')) trackFixedSettingChange('practice_groups', 'changed');
    if (existing.favoritePoolExpanded !== reset.favoritePoolExpanded) trackFixedSettingChange('favorite_pool_expanded', 'expanded');
    if (existing.favoriteTeamExpanded !== reset.favoriteTeamExpanded) trackFixedSettingChange('favorite_team_expanded', 'expanded');
    if (existing.poolFeatureFilters.length !== reset.poolFeatureFilters.length && window.cnslAnalytics) {
      window.cnslAnalytics.trackInteraction(AnalyticsInteractionType.PUBLISHED_SETTING_CHANGE, {
        publishedValues: new Set(),
        selectedValues: [],
        settingName: 'pool_feature_filters'
      });
    }
    if (existing.favoritePoolName !== reset.favoritePoolName) trackPublishedSettingChange('favorite_pool', reset.favoritePoolName, publishedPoolNames);
    if (existing.favoriteTeamId !== reset.favoriteTeamId) trackPublishedSettingChange('favorite_team', reset.favoriteTeamId, publishedTeamNames);
  }

  /**
   * Notifies browser controllers that saved preferences changed.
   * @private
   */
  function notifyPreferencesChanged() {
    window.dispatchEvent(new CustomEvent(globalThis.PREFERENCES_CHANGED_EVENT_NAME, {
      detail: { source: 'settings-dialog' }
    }));
  }

  /**
   * Renders the latest successful weather-check status in settings.
   * @private
   */
  function renderWeatherCheckStatus() {
    const weatherCheckStatus = document.getElementById('weatherCheckStatus');
    if (!weatherCheckStatus || typeof WeatherAlertService === 'undefined') return;

    const preferences = PreferencesService.get();
    const latestStatus = WeatherAlertService.readLatestCheckedStatus();
    const currentStatus = WeatherAlertService.getLatestStatus();
    const offMessage = preferences.weatherRefreshMinutes === 0 ? ' Weather safety alerts are currently off.' : '';
    const unavailableMessage = preferences.weatherRefreshMinutes !== 0 && currentStatus && currentStatus.reason === 'weather-service-unavailable'
      ? 'Weather service is temporarily unavailable. '
      : '';
    if (!latestStatus) {
      weatherCheckStatus.textContent = `${unavailableMessage}No successful weather check has been recorded on this device yet.${offMessage}`;
      return;
    }

    const updatedAt = new Date(latestStatus.updatedAt);
    const time = document.createElement('time');
    time.dateTime = latestStatus.updatedAt;
    time.textContent = new Intl.DateTimeFormat('en-US', {
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      month: 'short',
      timeZone: WeatherAlertService.EASTERN_TIMEZONE,
      year: 'numeric'
    }).format(updatedAt);
    weatherCheckStatus.replaceChildren(unavailableMessage, 'Most recent successful weather check: ', time, offMessage ? `.${offMessage}` : '');
  }

  document.addEventListener('DOMContentLoaded', () => {
    const dialog = document.getElementById('settingsDialog');
    const form = document.getElementById('settingsForm');
    if (!dialog || !form) return;

    const favoriteTeam = document.getElementById('favoriteTeam');
    const favoritePool = document.getElementById('favoritePool');
    const favoriteSettings = document.getElementById('favoriteSettings');
    const status = document.getElementById('settingsStatus');
    const closeButton = document.getElementById('closeSettings');
    const publishedTeamNames = new Set();
    const publishedTeamNamesById = new Map();
    const publishedPoolNames = new Set();
    let experimentalOptionsPromise = null;
    let optionsPromise = null;
    let restoreFocusTo = null;
    let preferencesChanged = false;

    /**
     * Creates one accessible left-to-right experimental feature switch.
     * @param {Object} feature - Validated feature metadata
     * @returns {HTMLElement} Rendered feature option
     * @private
     */
    function createExperimentalFeatureOption(feature) {
      const option = document.createElement('div');
      option.className = 'settings-experiment';

      const copy = document.createElement('div');
      copy.className = 'settings-experiment__copy';
      const heading = document.createElement('div');
      heading.className = 'settings-experiment__heading';
      const label = document.createElement('strong');
      label.textContent = feature.label;
      const badge = document.createElement('span');
      badge.className = 'experimental-badge';
      badge.textContent = 'Experimental';
      heading.append(label, badge);

      const description = document.createElement('p');
      description.className = 'settings-experiment__description';
      description.id = `experimental-${feature.id}-description`;
      description.textContent = feature.description;
      copy.append(heading, description);

      const switchLabel = document.createElement('label');
      switchLabel.className = 'settings-switch';
      const accessibleLabel = document.createElement('span');
      accessibleLabel.className = 'visually-hidden';
      accessibleLabel.textContent = `Enable ${feature.label}`;
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.name = 'experimentalFeatures';
      input.value = feature.id;
      input.setAttribute('aria-describedby', description.id);
      const track = document.createElement('span');
      track.className = 'settings-switch__track';
      track.setAttribute('aria-hidden', 'true');
      const thumb = document.createElement('span');
      thumb.className = 'settings-switch__thumb';
      track.appendChild(thumb);
      const state = document.createElement('span');
      state.className = 'settings-switch__state';
      state.setAttribute('aria-hidden', 'true');
      state.textContent = 'Off';
      switchLabel.append(accessibleLabel, input, track, state);

      option.append(copy, switchLabel);
      return option;
    }

    /**
     * Loads and renders currently available experimental feature options once.
     * @returns {Promise<void>} Promise settled after options render or fail
     * @private
     */
    async function loadExperimentalOptions() {
      if (experimentalOptionsPromise) return experimentalOptionsPromise;

      experimentalOptionsPromise = (async () => {
        const options = document.getElementById('experimentalFeatureOptions');
        if (!options) return;

        try {
          const features = (await globalThis.ExperimentalFeaturesService.load()).filter(feature => feature.available);
          if (features.length === 0) {
            options.replaceChildren();
            const emptyMessage = document.createElement('p');
            emptyMessage.className = 'settings-hint settings-hint--flush';
            emptyMessage.textContent = 'No experimental features are currently available.';
            options.appendChild(emptyMessage);
          } else {
            options.replaceChildren(...features.map(createExperimentalFeatureOption));
          }
          applyFormValues(form, PreferencesService.get());
        } catch (error) {
          console.error('Unable to load experimental features:', error);
          const errorMessage = document.createElement('p');
          errorMessage.className = 'settings-hint settings-hint--flush';
          errorMessage.textContent = 'Experimental features are temporarily unavailable.';
          options.replaceChildren(errorMessage);
        }
      })();
      return experimentalOptionsPromise;
    }

    applyFormValues(form, PreferencesService.get());
    renderWeatherCheckStatus();

    /**
     * Loads and populates favorite team and pool options once.
     * @returns {Promise<void>} Promise settled after options load or fail
     * @private
     */
    async function loadFavoriteOptions() {
      if (optionsPromise) return optionsPromise;

      optionsPromise = (async () => {
        try {
          await ensureDataDependencies();
          const dataManager = getDataManager();
          await dataManager.initialize(['pools', 'teams']);
          const teams = dataManager.getTeams().getAllTeams().sort((first, second) => first.name.localeCompare(second.name));
          const pools = dataManager.getPools().getAllPools().sort((first, second) => first.getName().localeCompare(second.getName()));

          teams.forEach(team => {
            publishedTeamNames.add(team.name);
            publishedTeamNamesById.set(team.id, team.name);
          });
          pools.forEach(pool => publishedPoolNames.add(pool.getName()));

          populateSelect(favoriteTeam, teams, 'No favorite team', team => team.id, team => team.name);
          populateSelect(favoritePool, pools, 'No favorite pool', pool => pool.getName(), pool => pool.getName());
          applyFormValues(form, PreferencesService.get());
        } catch (error) {
          console.error('Unable to load setting options:', error);
          status.textContent = 'Team and pool choices did not load, but your other settings will still apply.';
        }
      })();
      return optionsPromise;
    }

    /**
     * Opens the settings dialog and preserves the appropriate return-focus target.
     * @param {Element} trigger - Element that requested the dialog
     * @private
     */
    function openSettingsDialog(trigger) {
      if (typeof window.closeMenu === 'function') window.closeMenu(false);
      restoreFocusTo = trigger && trigger.closest('#navMenu') ? document.querySelector('.hamburger') : trigger;
      status.textContent = '';
      applyFormValues(form, PreferencesService.get());
      renderWeatherCheckStatus();
      favoriteSettings.open = true;
      if (!dialog.open) dialog.showModal();
      closeButton.focus();
      loadFavoriteOptions();
      loadExperimentalOptions();
    }

    form.addEventListener('change', event => {
      const theme = form.querySelector('input[name="theme"]:checked');
      const textSize = form.querySelector('input[name="textSize"]:checked');
      const contrast = form.querySelector('input[name="contrast"]:checked');
      const motion = form.querySelector('input[name="motion"]:checked');
      const poolScheduleLayout = form.querySelector('input[name="poolScheduleLayout"]:checked');
      const weatherRefreshMinutes = form.querySelector('input[name="weatherRefreshMinutes"]:checked');
      const existing = PreferencesService.get();
      const saved = PreferencesService.save({
        theme: theme ? theme.value : 'system',
        textSize: textSize ? textSize.value : 'default',
        contrast: contrast ? contrast.value : 'system',
        motion: motion ? motion.value : 'system',
        underlineLinks: form.elements.underlineLinks.checked,
        experimentalFeatures: Array.from(form.querySelectorAll('input[name="experimentalFeatures"]:checked'), featureToggle => featureToggle.value),
        favoriteTeamId: favoriteTeam.disabled ? existing.favoriteTeamId : favoriteTeam.value,
        favoritePoolName: favoritePool.disabled ? existing.favoritePoolName : favoritePool.value,
        favoriteTeamExpanded: existing.favoriteTeamExpanded,
        favoritePoolExpanded: existing.favoritePoolExpanded,
        poolScheduleLayout: poolScheduleLayout ? poolScheduleLayout.value : 'list',
        poolFeatureFilters: existing.poolFeatureFilters,
        practiceGroups: Array.from(form.querySelectorAll('input[name="practiceGroups"]:checked'), practiceGroup => practiceGroup.value),
        locationAwarenessEnabled: form.elements.locationAwarenessEnabled.checked,
        weatherRefreshMinutes: weatherRefreshMinutes ? Number(weatherRefreshMinutes.value) : existing.weatherRefreshMinutes
      });
      trackChangedFormSetting(event.target, existing, saved, publishedPoolNames, publishedTeamNames, publishedTeamNamesById);
      if (event.target.name === 'experimentalFeatures') {
        const switchState = event.target.closest('.settings-experiment')?.querySelector('.settings-switch__state');
        if (switchState) switchState.textContent = saved.experimentalFeatures.includes(event.target.value) ? 'On' : 'Off';
        updateExperimentalFeaturesCount(form);
      }
      window.applyPreferenceTheme(saved);
      renderWeatherCheckStatus();
      preferencesChanged = preferencesChanged || JSON.stringify(existing) !== JSON.stringify(saved);
      if (event.target.name === 'weatherRefreshMinutes' && saved.weatherRefreshMinutes !== existing.weatherRefreshMinutes) {
        notifyPreferencesChanged();
        preferencesChanged = false;
      }
      status.textContent = '';
    });

    document.getElementById('resetSettings').addEventListener('click', () => {
      if (!window.confirm('Reset all settings to their defaults on this device?')) return;

      const existing = PreferencesService.get();
      PreferencesService.clear();
      const reset = PreferencesService.get();
      trackResetSettings(existing, reset, publishedPoolNames, publishedTeamNames);
      applyFormValues(form, reset);
      window.applyPreferenceTheme(reset);
      renderWeatherCheckStatus();
      preferencesChanged = preferencesChanged || JSON.stringify(existing) !== JSON.stringify(reset);
      status.textContent = 'All settings have been reset to their defaults.';
    });

    document.getElementById('forceUpdate').addEventListener('click', async event => {
      const forceUpdateButton = event.currentTarget;
      forceUpdateButton.disabled = true;
      forceUpdateButton.setAttribute('aria-busy', 'true');
      status.textContent = 'Checking for the latest app files...';

      try {
        await window.cnslPwa.forceUpdate();
      } catch (error) {
        console.error('Unable to force an app update:', error);
        forceUpdateButton.disabled = false;
        forceUpdateButton.removeAttribute('aria-busy');
        status.textContent = 'The app could not refresh right now. Please check your connection and try again.';
      }
    });

    closeButton.addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => {
      if (event.target === dialog) dialog.close();
    });
    dialog.addEventListener('close', () => {
      if (preferencesChanged) {
        notifyPreferencesChanged();
        preferencesChanged = false;
      }
      if (restoreFocusTo && restoreFocusTo.isConnected) restoreFocusTo.focus();
    });
    window.addEventListener('cnsl:weather-alert-status-changed', renderWeatherCheckStatus);

    document.addEventListener('click', event => {
      const trigger = event.target.closest('a[href="settings.html"], [data-settings-open]');
      if (!trigger) return;
      event.preventDefault();
      openSettingsDialog(trigger);
    });

    const automaticLauncher = document.querySelector('[data-settings-auto-open]');
    if (automaticLauncher) openSettingsDialog(automaticLauncher);
  });
}());
