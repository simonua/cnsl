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

  function trackFavoriteSelection(favoriteType, favoriteValue, publishedValues) {
    if (typeof window.gtag !== 'function') return;
    if (favoriteValue && !publishedValues.has(favoriteValue)) return;

    window.gtag('event', 'ca_select_favorite', {
      favorite_type: favoriteType,
      favorite_value: favoriteValue || 'none'
    });
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
      if (event.target === favoritePool && saved.favoritePoolName !== existing.favoritePoolName) {
        trackFavoriteSelection('pool', saved.favoritePoolName, publishedPoolNames);
      }
      if (event.target === favoriteTeam && saved.favoriteTeamId !== existing.favoriteTeamId) {
        trackFavoriteSelection('team', saved.favoriteTeamId, publishedTeamIds);
      }
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
      if (existing.favoritePoolName !== cleared.favoritePoolName) {
        trackFavoriteSelection('pool', cleared.favoritePoolName, publishedPoolNames);
      }
      if (existing.favoriteTeamId !== cleared.favoriteTeamId) {
        trackFavoriteSelection('team', cleared.favoriteTeamId, publishedTeamIds);
      }
      applyFormValues(form, cleared);
      window.applyPreferenceTheme(cleared);
      window.dispatchEvent(new CustomEvent('cnsl:preferences-changed'));
      status.textContent = 'Saved settings removed from this device.';
    });
  });
}());