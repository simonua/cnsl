const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { createLocalStorageMock } = require('../helpers/test-helpers.js');
const PreferencesService = require('../../src/js/services/preferences-service.js');

describe('PreferencesService', () => {
  describe('get and save', () => {
    it('returns device defaults when no preferences are stored', () => {
      assert.deepEqual(PreferencesService.get(createLocalStorageMock()), {
        theme: 'system',
        favoriteTeamId: '',
        favoritePoolName: '',
        poolScheduleLayout: 'list',
        poolFeatureFilters: []
      });
    });

    it('stores normalized preferences only in the supplied device storage', () => {
      const storage = createLocalStorageMock();
      const saved = PreferencesService.save({
        theme: 'dark',
        favoriteTeamId: '  lrm ',
        favoritePoolName: ' Kendall Ridge ',
        poolScheduleLayout: 'calendar',
        poolFeatureFilters: [' slide ', 'Beach Entry', 'slide']
      }, storage);

      assert.deepEqual(saved, {
        theme: 'dark', favoriteTeamId: 'lrm', favoritePoolName: 'Kendall Ridge', poolScheduleLayout: 'calendar',
        poolFeatureFilters: ['beach entry', 'slide']
      });
      assert.deepEqual(PreferencesService.get(storage), saved);
      assert.ok(storage.getItem(PreferencesService.STORAGE_KEY));
    });

    it('falls back safely when stored content is invalid', () => {
      const storage = createLocalStorageMock();
      storage.setItem(PreferencesService.STORAGE_KEY, '{bad json');

      assert.deepEqual(PreferencesService.get(storage), PreferencesService.DEFAULT_PREFERENCES);
      assert.deepEqual(PreferencesService.normalize({ theme: 'unsupported', favoriteTeamId: 10 }), {
        theme: 'system', favoriteTeamId: '', favoritePoolName: '', poolScheduleLayout: 'list', poolFeatureFilters: []
      });
    });

    it('clears saved values from the device', () => {
      const storage = createLocalStorageMock();
      PreferencesService.save({ theme: 'light', favoriteTeamId: 'ccc' }, storage);
      PreferencesService.clear(storage);

      assert.equal(storage.getItem(PreferencesService.STORAGE_KEY), null);
      assert.deepEqual(PreferencesService.get(storage), PreferencesService.DEFAULT_PREFERENCES);
    });
  });

  describe('sortWithFavorite', () => {
    const items = [{ id: 'b', name: 'Beta' }, { id: 'a', name: 'Alpha' }, { id: 'c', name: 'Charlie' }];
    const sort = favorite => PreferencesService.sortWithFavorite(
      items,
      favorite,
      item => item.id,
      (first, second) => first.name.localeCompare(second.name)
    ).map(item => item.id);

    it('puts a configured favorite first and sorts all remaining entries', () => {
      assert.deepEqual(sort('c'), ['c', 'a', 'b']);
    });

    it('keeps normal ordering when no available favorite is selected', () => {
      assert.deepEqual(sort(''), ['a', 'b', 'c']);
      assert.deepEqual(sort('missing'), ['a', 'b', 'c']);
    });
  });

  describe('pool feature filtering', () => {
    const pools = [
      { name: 'Hopewell', features: ['Beach Entry', 'Slide', 'Wading'] },
      { name: 'Running Brook', features: ['beach entry', 'shade'] },
      { name: 'Bryant Woods', features: ['pool lift', 'shade'] }
    ];

    it('returns sorted published features without duplicate casing', () => {
      assert.deepEqual(PreferencesService.getPoolFeatures(pools), [
        'beach entry', 'pool lift', 'shade', 'slide', 'wading'
      ]);
    });

    it('keeps only pools containing every selected feature', () => {
      assert.deepEqual(
        PreferencesService.filterPoolsByFeatures(pools, ['beach entry', 'slide']).map(pool => pool.name),
        ['Hopewell']
      );
      assert.deepEqual(PreferencesService.filterPoolsByFeatures(pools, []), pools);
    });
  });

  describe('favorite meet matching', () => {
    const favoriteTeam = {
      id: 'cfhss',
      name: 'CHS Swim Sundevils',
      keywords: ['clary\'s forest', 'hawthorn', 'swansfield']
    };

    it('finds the favorite team by its stable id', () => {
      assert.equal(PreferencesService.findFavoriteTeam([favoriteTeam], 'cfhss'), favoriteTeam);
      assert.equal(PreferencesService.findFavoriteTeam([favoriteTeam], 'missing'), null);
    });

    it('matches league schedule aliases in snake-case meet fields', () => {
      const meet = { home_team: "Clary's Forest, Hawthorn, Swansfield", visiting_team: 'Oakland Mills' };
      assert.equal(PreferencesService.meetIncludesFavoriteTeam(meet, favoriteTeam), true);
    });

    it('matches full team names in legacy meet fields and rejects unrelated meets', () => {
      assert.equal(PreferencesService.meetIncludesFavoriteTeam({ homeTeam: 'CHS Swim Sundevils' }, favoriteTeam), true);
      assert.equal(PreferencesService.meetIncludesFavoriteTeam({ home_team: 'Long Reach', visiting_team: 'Wilde Lake' }, favoriteTeam), false);
      assert.equal(PreferencesService.meetIncludesFavoriteTeam({ name: 'Time Trials' }, favoriteTeam), false);
    });
  });
});