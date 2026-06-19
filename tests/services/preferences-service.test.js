const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createLocalStorageMock } = require('../helpers/test-helpers.js');
const preferencesModule = require('../helpers/browser-module-loader.js').loadBrowserModule('preferences-service');
const { PreferencesService, context: preferencesContext } = preferencesModule;

const summarizeFeatureGroups = groups => groups.map(({ key, features }) => ({ key, features }));
const summarizeFeatureColumns = columns => columns.map(column => summarizeFeatureGroups(column));

describe('PreferencesService', () => {
  describe('get and save', () => {
    it('returns device defaults when no preferences are stored', () => {
      assert.deepEqual(PreferencesService.get(createLocalStorageMock()), {
        theme: 'system',
        textSize: 'default',
        contrast: 'system',
        motion: 'system',
        underlineLinks: false,
        hideHomeIntro: false,
        hidePageHeadings: false,
        experimentalFeatures: [],
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
        textSize: 'extra-large',
        contrast: 'high',
        motion: 'reduced',
        underlineLinks: true,
        hideHomeIntro: true,
        hidePageHeadings: true,
        experimentalFeatures: ['my-meet-day', 'unknown', 'my-meet-day'],
        favoriteTeamId: '  lrm ',
        favoritePoolName: ' Kendall Ridge ',
        favoriteTeamExpanded: false,
        favoritePoolExpanded: false,
        poolScheduleLayout: 'calendar',
        poolFeatureFilters: [' main pool slide ', 'Wading Pool Slide', 'main pool slide'],
        practiceGroups: ['15-18', 'first-splash', '9-10', 'unknown'],
        locationAwarenessEnabled: true,
        weatherRefreshMinutes: 10,
        analyticsEnabled: true
      }, storage);

      assert.deepEqual(saved, {
        theme: 'dark', textSize: 'extra-large', contrast: 'high', motion: 'reduced', underlineLinks: true,
        hideHomeIntro: true, hidePageHeadings: true,
        experimentalFeatures: ['my-meet-day'],
        favoriteTeamId: 'lrm', favoritePoolName: 'Kendall Ridge', favoriteTeamExpanded: false,
        favoritePoolExpanded: false, poolScheduleLayout: 'calendar',
        poolFeatureFilters: ['main pool slide', 'wading pool slide'], practiceGroups: ['first-splash', '9-10', '15-18'],
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
        theme: 'system', textSize: 'default', contrast: 'system', motion: 'system', underlineLinks: false,
        hideHomeIntro: false, hidePageHeadings: false,
        experimentalFeatures: [],
        favoriteTeamId: '', favoritePoolName: '', favoriteTeamExpanded: true,
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

    it('accepts only supported accessibility preferences', () => {
      assert.deepEqual(PreferencesService.normalize({
        textSize: 'large',
        contrast: 'high',
        motion: 'reduced',
        underlineLinks: true,
        hideHomeIntro: true,
        hidePageHeadings: true
      }), {
        ...PreferencesService.DEFAULT_PREFERENCES,
        textSize: 'large',
        contrast: 'high',
        motion: 'reduced',
        underlineLinks: true,
        hideHomeIntro: true,
        hidePageHeadings: true
      });
      assert.deepEqual(PreferencesService.normalize({
        textSize: '200%',
        contrast: 'maximum',
        motion: 'none',
        underlineLinks: 'true',
        hideHomeIntro: 'true',
        hidePageHeadings: 1
      }), PreferencesService.DEFAULT_PREFERENCES);
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
      assert.equal(PreferencesService.get(restrictedStorage).theme, 'dark');
      assert.equal(PreferencesService.get(null).theme, 'dark');
      assert.doesNotThrow(() => PreferencesService.clear(null));
      assert.doesNotThrow(() => PreferencesService.clear(restrictedStorage));
      assert.equal(PreferencesService.getStorage(), null);
      assert.equal(PreferencesService.save({ theme: 'light' }, null).theme, 'light');
      assert.equal(PreferencesService.get(null).theme, 'light');
      PreferencesService.clear(null);
    });

    it('returns null when the browser local storage getter throws', () => {
      const originalDescriptor = Object.getOwnPropertyDescriptor(preferencesContext, 'localStorage');
      Object.defineProperty(preferencesContext, 'localStorage', {
        configurable: true,
        get: () => { throw new Error('blocked'); }
      });
      try {
        assert.equal(PreferencesService.getStorage(), null);
        assert.doesNotThrow(() => PreferencesService.get());
      } finally {
        if (originalDescriptor) Object.defineProperty(preferencesContext, 'localStorage', originalDescriptor);
        else delete preferencesContext.localStorage;
      }
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
      { name: 'Hopewell', laneCount: 8, laneLengthUnits: 'yards', features: ['Main Pool Beach Entry', 'Main Pool Slide', 'Wading', 'Yoga'] },
      { name: 'Kendall Ridge', laneCount: 8, laneLengthUnits: 'yards', features: ['main pool beach entry', 'wading pool beach entry', 'wading pool slide', 'shade'] },
      { name: 'Running Brook', laneCount: 6, laneLengthUnits: 'meters', features: ['in-water basketball', 'shade'] },
      { name: 'Bryant Woods', laneCount: 6, features: ['pool lift', 'shade'] }
    ];

    it('returns sorted published features and lane metadata filters without duplicate casing', () => {
      assert.deepEqual(PreferencesService.getPoolFeatures(pools), [
        '6 lanes', '8 lanes', 'in-water basketball', 'main pool beach entry', 'main pool slide', 'meter lanes',
        'pool lift', 'shade', 'wading', 'wading pool beach entry', 'wading pool slide', 'yard lanes', 'yoga'
      ]);
      assert.deepEqual(PreferencesService.getPoolFeatures(null), []);
      assert.deepEqual(PreferencesService.getPoolFeatures([{ features: null }]), []);
    });

    it('groups known available features by visitor need and omits uncategorized features', () => {
      assert.deepEqual(summarizeFeatureGroups(PreferencesService.groupPoolFeatures([
        'pool lift', 'ADA compliant', 'basketball court', 'sand volleyball', 'yoga', 'lessons', 'wading pool slide',
        'main pool beach entry', 'lap', 'main pool slide', 'in-water basketball', '8 lanes', 'meter lanes', 'yard lanes', 'heated pool', 'wifi', 'new amenity'
      ])), [
        { key: 'accessibility', features: ['ada compliant', 'pool lift'] },
        { key: 'young-swimmers', features: ['lessons', 'main pool beach entry', 'wading pool slide'] },
        { key: 'water-play', features: ['8 lanes', 'meter lanes', 'yard lanes', 'in-water basketball', 'lap', 'main pool slide'] },
        { key: 'recreation', features: ['basketball court', 'sand volleyball', 'yoga'] },
        { key: 'amenities', features: ['heated pool', 'wifi'] }
      ]);
      assert.deepEqual(summarizeFeatureGroups(PreferencesService.groupPoolFeatures(['pool lift'])), [
        { key: 'accessibility', features: ['pool lift'] }
      ]);
      assert.ok(PreferencesService.groupPoolFeatures(['pool lift']).every(group => group.label.length > 0));
    });

    it('arranges visible feature groups in the directory filter columns', () => {
      assert.deepEqual(summarizeFeatureColumns(PreferencesService.getPoolFeatureFilterColumns([
        'pool lift', 'basketball court', 'lessons', 'lap', 'heated pool'
      ])), [
        [
          { key: 'water-play', features: ['lap'] },
          { key: 'young-swimmers', features: ['lessons'] }
        ],
        [
          { key: 'amenities', features: ['heated pool'] },
          { key: 'recreation', features: ['basketball court'] },
          { key: 'accessibility', features: ['pool lift'] }
        ]
      ]);
      assert.deepEqual(summarizeFeatureColumns(PreferencesService.getPoolFeatureFilterColumns(['lap'])), [[
        { key: 'water-play', features: ['lap'] }
      ]]);
    });

    it('resolves published features to stable visual categories', () => {
      assert.equal(PreferencesService.getPoolFeatureCategory('Pool Lift'), 'accessibility');
      assert.equal(PreferencesService.getPoolFeatureCategory('Lessons'), 'young-swimmers');
      assert.equal(PreferencesService.getPoolFeatureCategory('wading'), 'young-swimmers');
      assert.equal(PreferencesService.getPoolFeatureCategory('wading pool slide'), 'young-swimmers');
      assert.equal(PreferencesService.getPoolFeatureCategory('main pool slide'), 'water-play');
      assert.equal(PreferencesService.getPoolFeatureCategory('in-water basketball'), 'water-play');
      assert.equal(PreferencesService.getPoolFeatureCategory('8 lanes'), 'water-play');
      assert.equal(PreferencesService.getPoolFeatureCategory('meter lanes'), 'water-play');
      assert.equal(PreferencesService.getPoolFeatureCategory('yard lanes'), 'water-play');
      assert.equal(PreferencesService.getPoolFeatureCategory('basketball court'), 'recreation');
      assert.equal(PreferencesService.getPoolFeatureCategory('grass volleyball'), 'recreation');
      assert.equal(PreferencesService.getPoolFeatureCategory('tennis'), 'recreation');
      assert.equal(PreferencesService.getPoolFeatureCategory('yoga'), 'recreation');
      assert.equal(PreferencesService.getPoolFeatureCategory('shade'), 'amenities');
      assert.equal(PreferencesService.getPoolFeatureCategory('heated pool'), 'amenities');
      assert.equal(PreferencesService.getPoolFeatureCategory('new amenity'), 'additional');
    });

    it('keeps only pools containing every selected feature', () => {
      assert.deepEqual(
        PreferencesService.filterPoolsByFeatures(pools, ['main pool beach entry', 'main pool slide']).map(pool => pool.name),
        ['Hopewell']
      );
      assert.deepEqual(
        PreferencesService.filterPoolsByFeatures(pools, ['wading pool beach entry', 'wading pool slide']).map(pool => pool.name),
        ['Kendall Ridge']
      );
      assert.deepEqual(
        PreferencesService.filterPoolsByFeatures(pools, ['8 lanes']).map(pool => pool.name),
        ['Hopewell', 'Kendall Ridge']
      );
      assert.deepEqual(
        PreferencesService.filterPoolsByFeatures(pools, ['meter lanes']).map(pool => pool.name),
        ['Running Brook']
      );
      assert.deepEqual(
        PreferencesService.filterPoolsByFeatures(pools, ['8 lanes', 'yard lanes']).map(pool => pool.name),
        ['Hopewell', 'Kendall Ridge']
      );
      assert.deepEqual(
        PreferencesService.filterPoolsByFeatures(pools, ['yoga']).map(pool => pool.name),
        ['Hopewell']
      );
      assert.deepEqual(PreferencesService.filterPoolsByFeatures(pools, []), pools);
      assert.deepEqual(PreferencesService.filterPoolsByFeatures(null, ['main pool slide']), []);
      assert.deepEqual(PreferencesService.filterPoolsByFeatures([{ name: 'No Features' }], ['wading pool slide']), []);
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

    it('matches full team names in canonical meet fields and rejects unrelated meets', () => {
      assert.equal(PreferencesService.meetIncludesFavoriteTeam({ home_team: 'CHS Swim Sundevils' }, favoriteTeam), true);
      assert.equal(PreferencesService.meetIncludesFavoriteTeam({ home_team: 'Long Reach', visiting_team: 'Wilde Lake' }, favoriteTeam), false);
      assert.equal(PreferencesService.meetIncludesFavoriteTeam({ name: 'Time Trials' }, favoriteTeam), false);
      assert.equal(PreferencesService.meetIncludesFavoriteTeam({ home_team: 'Sundevils' }, { name: 'CHS Swim Sundevils', keywords: [null, 'sd'] }), true);
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
      Object.assign(context, context.globalThis || {}, context.window || {});
      context.globalThis = context; context.self = context; context.window = context;
      vm.runInNewContext(source, context, { filename: sourcePath });
      assert.equal(typeof context.window.PreferencesService, 'function');
    });
  });
});
