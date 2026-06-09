const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createLocalStorageMock } = require('../helpers/test-helpers.js');
const PreferencesService = require('../../src/js/services/preferences-service.js');

describe('PreferencesService', () => {
  describe('get and save', () => {
    it('returns device defaults when no preferences are stored', () => {
      assert.deepEqual(PreferencesService.get(createLocalStorageMock()), {
        theme: 'system',
        favoriteTeamId: '',
        favoritePoolName: '',
        favoriteTeamExpanded: true,
        favoritePoolExpanded: true,
        poolScheduleLayout: 'list',
        poolFeatureFilters: [],
        practiceGroups: ['first-splash', '8-under', '9-10', '11-12', '13-14', '15-18'],
        locationAwarenessEnabled: false,
        weatherRefreshMinutes: 5
      });
    });

    it('stores normalized preferences only in the supplied device storage', () => {
      const storage = createLocalStorageMock();
      const saved = PreferencesService.save({
        theme: 'dark',
        favoriteTeamId: '  lrm ',
        favoritePoolName: ' Kendall Ridge ',
        favoriteTeamExpanded: false,
        favoritePoolExpanded: false,
        poolScheduleLayout: 'calendar',
        poolFeatureFilters: [' slide ', 'Beach Entry', 'slide'],
        practiceGroups: ['15-18', 'first-splash', '9-10', 'unknown'],
        locationAwarenessEnabled: true,
        weatherRefreshMinutes: 10,
        analyticsEnabled: true
      }, storage);

      assert.deepEqual(saved, {
        theme: 'dark', favoriteTeamId: 'lrm', favoritePoolName: 'Kendall Ridge', favoriteTeamExpanded: false,
        favoritePoolExpanded: false, poolScheduleLayout: 'calendar',
        poolFeatureFilters: ['beach entry', 'slide'], practiceGroups: ['first-splash', '9-10', '15-18'],
        locationAwarenessEnabled: true, weatherRefreshMinutes: 10
      });
      assert.deepEqual(PreferencesService.get(storage), saved);
      assert.ok(storage.getItem(PreferencesService.STORAGE_KEY));
    });

    it('falls back safely when stored content is invalid', () => {
      const storage = createLocalStorageMock();
      storage.setItem(PreferencesService.STORAGE_KEY, '{bad json');

      assert.deepEqual(PreferencesService.get(storage), PreferencesService.DEFAULT_PREFERENCES);
      assert.deepEqual(PreferencesService.normalize({ theme: 'unsupported', favoriteTeamId: 10 }), {
        theme: 'system', favoriteTeamId: '', favoritePoolName: '', favoriteTeamExpanded: true,
        favoritePoolExpanded: true, poolScheduleLayout: 'list', poolFeatureFilters: [],
        practiceGroups: ['first-splash', '8-under', '9-10', '11-12', '13-14', '15-18'],
        locationAwarenessEnabled: false, weatherRefreshMinutes: 5
      });
    });

    it('accepts only supported weather refresh intervals', () => {
      assert.equal(PreferencesService.normalize({ weatherRefreshMinutes: 0 }).weatherRefreshMinutes, 0);
      assert.equal(PreferencesService.normalize({ weatherRefreshMinutes: '10' }).weatherRefreshMinutes, 10);
      assert.equal(PreferencesService.normalize({ weatherRefreshMinutes: 15 }).weatherRefreshMinutes, 5);
    });

    it('clears saved values from the device', () => {
      const storage = createLocalStorageMock();
      PreferencesService.save({ theme: 'light', favoriteTeamId: 'ccc' }, storage);
      PreferencesService.clear(storage);

      assert.equal(storage.getItem(PreferencesService.STORAGE_KEY), null);
      assert.deepEqual(PreferencesService.get(storage), PreferencesService.DEFAULT_PREFERENCES);
    });

    it('fails safely with absent or restricted device storage', () => {
      const restrictedStorage = { setItem: () => { throw new Error('blocked'); }, removeItem: () => { throw new Error('blocked'); } };
      assert.deepEqual(PreferencesService.get(null), { ...PreferencesService.DEFAULT_PREFERENCES });
      assert.deepEqual(PreferencesService.save({ theme: 'dark' }, restrictedStorage).theme, 'dark');
      assert.doesNotThrow(() => PreferencesService.clear(null));
      assert.doesNotThrow(() => PreferencesService.clear(restrictedStorage));
      assert.equal(PreferencesService.getStorage(), null);
      assert.equal(PreferencesService.save({ theme: 'light' }, null).theme, 'light');
    });

    it('discovers browser local storage when it is available', () => {
      const storage = createLocalStorageMock();
      globalThis.localStorage = storage;
      try {
        assert.equal(PreferencesService.getStorage(), storage);
        assert.equal(PreferencesService.save({ theme: 'dark' }).theme, 'dark');
        PreferencesService.clear();
      } finally {
        delete globalThis.localStorage;
      }
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
      assert.deepEqual(PreferencesService.sortWithFavorite(
        [{ id: 'favorite' }, { id: 'other' }],
        'favorite',
        item => item.id,
        () => 0
      ).map(item => item.id), ['favorite', 'other']);
    });
  });

  describe('pool feature filtering', () => {
    const pools = [
      { name: 'Hopewell', laneCount: 8, laneLengthUnits: 'yards', features: ['Beach Entry', 'Slide', 'Wading', 'Yoga'] },
      { name: 'Running Brook', laneCount: 6, laneLengthUnits: 'meters', features: ['beach entry', 'shade'] },
      { name: 'Bryant Woods', laneCount: 6, features: ['pool lift', 'shade'] }
    ];

    it('returns sorted published features and lane metadata filters without duplicate casing', () => {
      assert.deepEqual(PreferencesService.getPoolFeatures(pools), [
        '6 lanes', '8 lanes', 'beach entry', 'meter lanes', 'pool lift', 'shade', 'slide', 'wading', 'yard lanes', 'yoga'
      ]);
      assert.deepEqual(PreferencesService.getPoolFeatures(null), []);
      assert.deepEqual(PreferencesService.getPoolFeatures([{ features: null }]), []);
    });

    it('groups available features by visitor need and retains new published features', () => {
      assert.deepEqual(PreferencesService.groupPoolFeatures([
        'pool lift', 'ADA compliant', 'baseball', 'yoga', 'splash', 'lap', '8 lanes', 'meter lanes', 'yard lanes', 'wifi', 'new amenity'
      ]), [
        { key: 'accessibility', label: 'Accessibility & inclusion', features: ['ada compliant', 'pool lift'] },
        { key: 'young-swimmers', label: 'Young swimmers & non-swimmers', features: ['splash'] },
        { key: 'water-play', label: 'Swimming & water play', features: ['8 lanes', 'meter lanes', 'yard lanes', 'lap'] },
        { key: 'recreation', label: 'Sports & recreation', features: ['baseball', 'yoga'] },
        { key: 'amenities', label: 'Amenities', features: ['wifi'] },
        { key: 'additional', label: 'Additional features', features: ['new amenity'] }
      ]);
      assert.deepEqual(PreferencesService.groupPoolFeatures(['pool lift']), [
        { key: 'accessibility', label: 'Accessibility & inclusion', features: ['pool lift'] }
      ]);
    });

    it('resolves published features to stable visual categories', () => {
      assert.equal(PreferencesService.getPoolFeatureCategory('Pool Lift'), 'accessibility');
      assert.equal(PreferencesService.getPoolFeatureCategory('wading'), 'young-swimmers');
      assert.equal(PreferencesService.getPoolFeatureCategory('slide'), 'water-play');
      assert.equal(PreferencesService.getPoolFeatureCategory('8 lanes'), 'water-play');
      assert.equal(PreferencesService.getPoolFeatureCategory('meter lanes'), 'water-play');
      assert.equal(PreferencesService.getPoolFeatureCategory('yard lanes'), 'water-play');
      assert.equal(PreferencesService.getPoolFeatureCategory('tennis'), 'recreation');
      assert.equal(PreferencesService.getPoolFeatureCategory('yoga'), 'recreation');
      assert.equal(PreferencesService.getPoolFeatureCategory('shade'), 'amenities');
      assert.equal(PreferencesService.getPoolFeatureCategory('new amenity'), 'additional');
    });

    it('keeps only pools containing every selected feature', () => {
      assert.deepEqual(
        PreferencesService.filterPoolsByFeatures(pools, ['beach entry', 'slide']).map(pool => pool.name),
        ['Hopewell']
      );
      assert.deepEqual(
        PreferencesService.filterPoolsByFeatures(pools, ['8 lanes']).map(pool => pool.name),
        ['Hopewell']
      );
      assert.deepEqual(
        PreferencesService.filterPoolsByFeatures(pools, ['meter lanes']).map(pool => pool.name),
        ['Running Brook']
      );
      assert.deepEqual(
        PreferencesService.filterPoolsByFeatures(pools, ['8 lanes', 'yard lanes']).map(pool => pool.name),
        ['Hopewell']
      );
      assert.deepEqual(
        PreferencesService.filterPoolsByFeatures(pools, ['yoga']).map(pool => pool.name),
        ['Hopewell']
      );
      assert.deepEqual(PreferencesService.filterPoolsByFeatures(pools, []), pools);
      assert.deepEqual(PreferencesService.filterPoolsByFeatures(null, ['slide']), []);
      assert.deepEqual(PreferencesService.filterPoolsByFeatures([{ name: 'No Features' }], ['slide']), []);
    });
  });

  describe('practice-group filtering', () => {
    const sessions = [
      { group: '8 & Under', time: '8:00am' },
      { group: '9 - 12', time: '8:30am' },
      { group: '13 and over', time: '9:15am' },
      { group: 'First Splash', time: '5:00pm' }
    ];

    it('defaults new preferences to all practice groups', () => {
      assert.deepEqual(PreferencesService.normalize({ theme: 'dark' }).practiceGroups, [
        'first-splash', '8-under', '9-10', '11-12', '13-14', '15-18'
      ]);
    });

    it('migrates saved age-only preferences with First Splash still selected', () => {
      assert.deepEqual(PreferencesService.normalize({ practiceAgeGroups: ['11-12'] }).practiceGroups, [
        'first-splash', '11-12'
      ]);
    });

    it('includes published ranges and named programs that are selected', () => {
      assert.deepEqual(
        PreferencesService.filterPracticeSessions(sessions, ['11-12']).map(session => session.group),
        ['9 - 12']
      );
      assert.deepEqual(
        PreferencesService.filterPracticeSessions(sessions, ['first-splash', '11-12']).map(session => session.group),
        ['9 - 12', 'First Splash']
      );
      assert.deepEqual(
        PreferencesService.filterPracticeSessions([{ group: '10 & Under' }, { group: '11 & Up' }], ['9-10']),
        [{ group: '10 & Under' }]
      );
    });

    it('excludes First Splash when no selectable practice groups are checked', () => {
      assert.deepEqual(
        PreferencesService.filterPracticeSessions(sessions, []).map(session => session.group),
        []
      );
    });

    it('retains published sessions that have no configured filter group', () => {
      assert.deepEqual(PreferencesService.filterPracticeSessions([{ group: 'New Swimmers' }], []), [
        { group: 'New Swimmers' }
      ]);
    });

    it('parses age ranges and fails safely for invalid session collections', () => {
      assert.deepEqual(PreferencesService.getPracticeSessionAgeRange('8 and younger'), { minimumAge: 0, maximumAge: 8 });
      assert.deepEqual(PreferencesService.getPracticeSessionAgeRange('13 and older'), { minimumAge: 13, maximumAge: 18 });
      assert.equal(PreferencesService.getPracticeSessionAgeRange('14 - 10'), null);
      assert.deepEqual(PreferencesService.getPracticeSessionAgeRange('9 - 10'), { minimumAge: 9, maximumAge: 10 });
      assert.equal(PreferencesService.getPracticeSessionAgeRange('Swimmer'), null);
      assert.equal(PreferencesService.getPracticeSessionAgeRange(null), null);
      assert.deepEqual(PreferencesService.filterPracticeSessions(null, []), []);
      assert.deepEqual(PreferencesService.filterPracticeSessions([{}], []), [{}]);
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
      assert.equal(PreferencesService.findFavoriteTeam(null, 'cfhss'), null);
    });

    it('matches league schedule aliases in snake-case meet fields', () => {
      const meet = { home_team: "Clary's Forest, Hawthorn, Swansfield", visiting_team: 'Oakland Mills' };
      assert.equal(PreferencesService.meetIncludesFavoriteTeam(meet, favoriteTeam), true);
    });

    it('matches full team names in legacy meet fields and rejects unrelated meets', () => {
      assert.equal(PreferencesService.meetIncludesFavoriteTeam({ homeTeam: 'CHS Swim Sundevils' }, favoriteTeam), true);
      assert.equal(PreferencesService.meetIncludesFavoriteTeam({ home_team: 'Long Reach', visiting_team: 'Wilde Lake' }, favoriteTeam), false);
      assert.equal(PreferencesService.meetIncludesFavoriteTeam({ name: 'Time Trials' }, favoriteTeam), false);
      assert.equal(PreferencesService.meetIncludesFavoriteTeam({ homeTeam: 'Sundevils' }, { name: 'CHS Swim Sundevils', keywords: [null, 'sd'] }), true);
      assert.equal(PreferencesService.meetIncludesFavoriteTeam({}, null), false);
      assert.equal(PreferencesService.teamMatchesLabel({ name: 'Marlins', keywords: null }, 'Marlins'), true);
    });

    it('hoists the favorite matchup while preserving the remaining meet order', () => {
      const meets = [
        { home_team: 'Long Reach', visiting_team: 'Wilde Lake' },
        { home_team: 'Clary\'s Forest, Hawthorn, Swansfield', visiting_team: 'Oakland Mills' },
        { home_team: 'Thunder Hill', visiting_team: 'Huntington' }
      ];

      assert.deepEqual(PreferencesService.sortMeetsWithFavorite(meets, favoriteTeam), [meets[1], meets[0], meets[2]]);
      assert.deepEqual(PreferencesService.sortMeetsWithFavorite(meets, null), meets);
      assert.deepEqual(PreferencesService.sortMeetsWithFavorite(null, favoriteTeam), []);
      assert.deepEqual(PreferencesService.sortMeetsWithFavorite([meets[1], { home_team: 'Swansfield' }], favoriteTeam).length, 2);
      assert.equal(PreferencesService.sortMeetsWithFavorite([meets[1], meets[0]], favoriteTeam)[0], meets[1]);
    });

    it('rejects missing label inputs before alias matching', () => {
      assert.equal(PreferencesService.teamMatchesLabel(null, 'team'), false);
      assert.equal(PreferencesService.teamMatchesLabel(favoriteTeam, null), false);
      assert.equal(PreferencesService.meetIncludesFavoriteTeam(null, favoriteTeam), false);
    });
  });

  describe('browser registration', () => {
    it('installs preferences as a browser script global', () => {
      const sourcePath = path.join(__dirname, '..', '..', 'src', 'js', 'services', 'preferences-service.js');
      const source = fs.readFileSync(sourcePath, 'utf8');
      const context = { window: {}, globalThis: { PREFERENCES_STORAGE_KEY: 'prefs', WEATHER_ALERT_REFRESH_MINUTES_OPTIONS: [0, 5], WEATHER_ALERT_DEFAULT_REFRESH_MINUTES: 5 } };
      vm.runInNewContext(source, context, { filename: sourcePath });
      assert.equal(typeof context.window.PreferencesService, 'function');
    });
  });
});
