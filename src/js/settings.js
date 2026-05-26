(function initializeSettingsPage() {
  'use strict';

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
    if (existing.favoritePoolExpanded !== cleared.favoritePoolExpanded) trackFixedSettingChange('favorite_pool_expanded', 'expanded');
    if (existing.favoriteTeamExpanded !== cleared.favoriteTeamExpanded) trackFixedSettingChange('favorite_team_expanded', 'expanded');
    if (existing.poolFeatureFilters.length !== cleared.poolFeatureFilters.length && window.cnslAnalytics) {
      window.cnslAnalytics.trackPublishedSettingChange('pool_feature_filters', [], new Set());
    }
    if (existing.favoritePoolName !== cleared.favoritePoolName) trackPublishedSettingChange('favorite_pool', cleared.favoritePoolName, publishedPoolNames);
    if (existing.favoriteTeamId !== cleared.favoriteTeamId) trackPublishedSettingChange('favorite_team', cleared.favoriteTeamId, publishedTeamIds);
  }

  document.addEventListener('DOMContentLoaded', async () => {
    const form = document.getElementById('settingsForm');
    if (!form) return;

    const favoriteTeam = document.getElementById('favoriteTeam');
    const favoritePool = document.getElementById('favoritePool');
    const status = document.getElementById('settingsStatus');
    const publishedTeamIds = new Set();
    const publishedPoolNames = new Set();
    const preferences = PreferencesService.get();
    applyFormValues(form, preferences);

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
        locationAwarenessEnabled: form.elements.locationAwarenessEnabled.checked,
        weatherRefreshMinutes: weatherRefreshMinutes ? Number(weatherRefreshMinutes.value) : existing.weatherRefreshMinutes
      });
      trackChangedFormSetting(event.target, existing, saved, publishedPoolNames, publishedTeamIds);
      window.applyPreferenceTheme(saved);
      window.dispatchEvent(new CustomEvent('cnsl:preferences-changed'));
      status.textContent = '';
    });

    try {
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
      status.textContent = 'Team and pool choices are temporarily unavailable. Appearance can still be saved.';
    }

    document.getElementById('clearSettings').addEventListener('click', () => {
      const existing = PreferencesService.get();
      PreferencesService.clear();
      const cleared = PreferencesService.get();
      trackClearedSettings(existing, cleared, publishedPoolNames, publishedTeamIds);
      applyFormValues(form, cleared);
      window.applyPreferenceTheme(cleared);
      window.dispatchEvent(new CustomEvent('cnsl:preferences-changed'));
      status.textContent = 'Saved settings removed from this device.';
    });
  });
}());