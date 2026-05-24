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
    form.elements.favoriteTeam.value = preferences.favoriteTeamId;
    form.elements.favoritePool.value = preferences.favoritePoolName;
    form.elements.locationAwarenessEnabled.checked = preferences.locationAwarenessEnabled;
  }

  document.addEventListener('DOMContentLoaded', async () => {
    const form = document.getElementById('settingsForm');
    if (!form) return;

    const favoriteTeam = document.getElementById('favoriteTeam');
    const favoritePool = document.getElementById('favoritePool');
    const status = document.getElementById('settingsStatus');
    const preferences = PreferencesService.get();
    applyFormValues(form, preferences);

    form.addEventListener('change', () => {
      const theme = form.querySelector('input[name="theme"]:checked');
      const poolScheduleLayout = form.querySelector('input[name="poolScheduleLayout"]:checked');
      const existing = PreferencesService.get();
      const saved = PreferencesService.save({
        theme: theme ? theme.value : 'system',
        favoriteTeamId: favoriteTeam.disabled ? existing.favoriteTeamId : favoriteTeam.value,
        favoritePoolName: favoritePool.disabled ? existing.favoritePoolName : favoritePool.value,
        poolScheduleLayout: poolScheduleLayout ? poolScheduleLayout.value : 'list',
        poolFeatureFilters: existing.poolFeatureFilters,
        locationAwarenessEnabled: form.elements.locationAwarenessEnabled.checked
      });
      window.applyPreferenceTheme(saved);
      status.textContent = '';
    });

    try {
      const dataManager = getDataManager();
      await dataManager.initialize();
      const teams = dataManager.getTeams().getAllTeams().sort((first, second) => first.name.localeCompare(second.name));
      const pools = dataManager.getPools().getAllPools().sort((first, second) => first.getName().localeCompare(second.getName()));

      populateSelect(favoriteTeam, teams, 'No favorite team', team => team.id, team => team.name);
      populateSelect(favoritePool, pools, 'No favorite pool', pool => pool.getName(), pool => pool.getName());
      applyFormValues(form, PreferencesService.get());
    } catch (error) {
      console.error('Unable to load setting options:', error);
      status.textContent = 'Team and pool choices are temporarily unavailable. Appearance can still be saved.';
    }

    document.getElementById('clearSettings').addEventListener('click', () => {
      PreferencesService.clear();
      const cleared = PreferencesService.get();
      applyFormValues(form, cleared);
      window.applyPreferenceTheme(cleared);
      status.textContent = 'Saved settings removed from this device.';
    });
  });
}());