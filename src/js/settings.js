(function initializeSettingsDialog() {
  'use strict';

  const dependencyScripts = [
    { source: 'js/services/time-utils.js', ready: () => Boolean(window.TimeUtils) },
    { source: 'js/types/pool-enums.js', ready: () => Boolean(window.PoolStatus) },
    { source: 'js/pool-schedule.js', ready: () => Boolean(window.PoolSchedule) },
    { source: 'js/services/pool-period-schedule-service.js', ready: () => Boolean(window.PoolPeriodScheduleService) },
    { source: 'js/models/pool.js', ready: () => Boolean(window.Pool) },
    { source: 'js/pools-manager.js', ready: () => Boolean(window.PoolsManager) },
    { source: 'js/models/team.js', ready: () => Boolean(window.Team) },
    { source: 'js/teams-manager.js', ready: () => Boolean(window.TeamsManager) },
    { source: 'js/services/file-helper.js', ready: () => Boolean(window.FileHelper) },
    { source: 'js/services/data-manager.js', ready: () => Boolean(window.DataManager) }
  ];

  function loadScript(dependency) {
    if (dependency.ready()) return Promise.resolve();

    return new Promise((resolve, reject) => {
      const existing = Array.from(document.scripts).find(script => script.getAttribute('src') === dependency.source);
      const script = existing || document.createElement('script');
      const handleLoad = () => {
        if (dependency.ready()) {
          resolve();
        } else {
          reject(new Error(`Settings dependency did not initialize: ${dependency.source}`));
        }
      };
      const handleError = () => reject(new Error(`Unable to load settings dependency: ${dependency.source}`));

      script.addEventListener('load', handleLoad, { once: true });
      script.addEventListener('error', handleError, { once: true });
      if (!existing) {
        script.src = dependency.source;
        document.body.appendChild(script);
      }
    });
  }

  async function ensureDataDependencies() {
    for (const dependency of dependencyScripts) {
      await loadScript(dependency);
    }
  }

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

  function applyFormValues(form, preferences) {
    const selectedTheme = form.querySelector(`input[name="theme"][value="${preferences.theme}"]`);
    if (selectedTheme) selectedTheme.checked = true;
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
  }

  function trackFixedSettingChange(settingName, settingValue) {
    if (!window.cnslAnalytics) return;
    window.cnslAnalytics.trackFixedSettingChange(settingName, settingValue);
  }

  function trackPublishedSettingChange(settingName, selectedValue, publishedValues) {
    if (!window.cnslAnalytics) return;
    window.cnslAnalytics.trackPublishedSettingChange(settingName, selectedValue ? [selectedValue] : [], publishedValues);
  }

  function trackChangedFormSetting(changedField, existing, saved, publishedPoolNames, publishedTeamIds) {
    if (changedField.name === 'theme' && saved.theme !== existing.theme) {
      trackFixedSettingChange('theme', saved.theme);
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
      trackPublishedSettingChange('favorite_team', saved.favoriteTeamId, publishedTeamIds);
    }
  }

  function trackClearedSettings(existing, cleared, publishedPoolNames, publishedTeamIds) {
    if (existing.theme !== cleared.theme) trackFixedSettingChange('theme', cleared.theme);
    if (existing.poolScheduleLayout !== cleared.poolScheduleLayout) trackFixedSettingChange('pool_schedule_layout', cleared.poolScheduleLayout);
    if (existing.locationAwarenessEnabled !== cleared.locationAwarenessEnabled) trackFixedSettingChange('location_awareness', 'disabled');
    if (existing.weatherRefreshMinutes !== cleared.weatherRefreshMinutes) trackFixedSettingChange('weather_refresh_minutes', cleared.weatherRefreshMinutes);
    if (existing.practiceGroups.join('|') !== cleared.practiceGroups.join('|')) trackFixedSettingChange('practice_groups', 'changed');
    if (existing.favoritePoolExpanded !== cleared.favoritePoolExpanded) trackFixedSettingChange('favorite_pool_expanded', 'expanded');
    if (existing.favoriteTeamExpanded !== cleared.favoriteTeamExpanded) trackFixedSettingChange('favorite_team_expanded', 'expanded');
    if (existing.poolFeatureFilters.length !== cleared.poolFeatureFilters.length && window.cnslAnalytics) {
      window.cnslAnalytics.trackPublishedSettingChange('pool_feature_filters', [], new Set());
    }
    if (existing.favoritePoolName !== cleared.favoritePoolName) trackPublishedSettingChange('favorite_pool', cleared.favoritePoolName, publishedPoolNames);
    if (existing.favoriteTeamId !== cleared.favoriteTeamId) trackPublishedSettingChange('favorite_team', cleared.favoriteTeamId, publishedTeamIds);
  }

  function notifyPreferencesChanged() {
    window.dispatchEvent(new CustomEvent('cnsl:preferences-changed', { detail: { source: 'settings-dialog' } }));
  }

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
      timeZoneName: 'short',
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
    const status = document.getElementById('settingsStatus');
    const closeButton = document.getElementById('closeSettings');
    const publishedTeamIds = new Set();
    const publishedPoolNames = new Set();
    let optionsPromise = null;
    let restoreFocusTo = null;
    let preferencesChanged = false;

    applyFormValues(form, PreferencesService.get());
    renderWeatherCheckStatus();

    async function loadFavoriteOptions() {
      if (optionsPromise) return optionsPromise;

      optionsPromise = (async () => {
        try {
          await ensureDataDependencies();
          const dataManager = getDataManager();
          await dataManager.initialize(['pools', 'teams']);
          const teams = dataManager.getTeams().getAllTeams().sort((first, second) => first.name.localeCompare(second.name));
          const pools = dataManager.getPools().getAllPools().sort((first, second) => first.getName().localeCompare(second.getName()));

          teams.forEach(team => publishedTeamIds.add(team.id));
          pools.forEach(pool => publishedPoolNames.add(pool.getName()));

          populateSelect(favoriteTeam, teams, 'No favorite team', team => team.id, team => team.name);
          populateSelect(favoritePool, pools, 'No favorite pool', pool => pool.getName(), pool => pool.getName());
          applyFormValues(form, PreferencesService.get());
        } catch (error) {
          console.error('Unable to load setting options:', error);
          status.textContent = 'Team and pool choices are temporarily unavailable. Other settings still apply automatically.';
        }
      })();
      return optionsPromise;
    }

    function openSettingsDialog(trigger) {
      if (typeof window.closeMenu === 'function') window.closeMenu(false);
      restoreFocusTo = trigger && trigger.closest('#navMenu') ? document.querySelector('.hamburger') : trigger;
      status.textContent = '';
      applyFormValues(form, PreferencesService.get());
      renderWeatherCheckStatus();
      if (!dialog.open) dialog.showModal();
      closeButton.focus();
      loadFavoriteOptions();
    }

    form.addEventListener('change', event => {
      const theme = form.querySelector('input[name="theme"]:checked');
      const poolScheduleLayout = form.querySelector('input[name="poolScheduleLayout"]:checked');
      const weatherRefreshMinutes = form.querySelector('input[name="weatherRefreshMinutes"]:checked');
      const existing = PreferencesService.get();
      const saved = PreferencesService.save({
        theme: theme ? theme.value : 'system',
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
      trackChangedFormSetting(event.target, existing, saved, publishedPoolNames, publishedTeamIds);
      window.applyPreferenceTheme(saved);
      renderWeatherCheckStatus();
      preferencesChanged = preferencesChanged || JSON.stringify(existing) !== JSON.stringify(saved);
      if (event.target.name === 'weatherRefreshMinutes' && saved.weatherRefreshMinutes !== existing.weatherRefreshMinutes) {
        notifyPreferencesChanged();
        preferencesChanged = false;
      }
      status.textContent = '';
    });

    document.getElementById('clearSettings').addEventListener('click', async () => {
      if (!window.confirm('Clear all app data from this device?')) return;

      const existing = PreferencesService.get();
      await window.AppStorageService.clearAppData();
      const cleared = PreferencesService.get();
      trackClearedSettings(existing, cleared, publishedPoolNames, publishedTeamIds);
      applyFormValues(form, cleared);
      window.applyPreferenceTheme(cleared);
      renderWeatherCheckStatus();
      preferencesChanged = preferencesChanged || JSON.stringify(existing) !== JSON.stringify(cleared);
      status.textContent = 'All app data cleared from this device.';
    });

    closeButton.addEventListener('click', () => dialog.close());
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