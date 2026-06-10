const { createClassicScriptLoader, toHostValue } = require('../../scripts/lib/classic-script-loader.js');

const CONFIG = 'config/app-config.js';
const ICONS = 'services/icon-catalog.js';
const SCHEDULE_STATE = 'types/schedule-state.js';
const TIME = 'services/time-utils.js';

const BROWSER_MODULE_MANIFESTS = Object.freeze({
  'analytics-interaction-type': { scripts: ['types/analytics-interaction-type.js'], exports: ['AnalyticsInteractionType'] },
  'app-config': { scripts: [CONFIG], exports: ['AppConfig'] },
  'app-storage-service': { scripts: [CONFIG, 'services/app-storage-service.js'], exports: ['AppStorageService'] },
  'data-manager': { scripts: [CONFIG, ICONS, TIME, 'types/pool-enums.js', SCHEDULE_STATE, 'pool-schedule.js', 'services/pool-period-schedule-service.js', 'models/pool.js', 'models/team.js', 'models/meet.js', 'pools-manager.js', 'teams-manager.js', 'meets-manager.js', 'services/data-manager.js'], exports: ['DataManager', 'getDataManager', 'initializeDataManager'] },
  'device-platform-service': { scripts: ['services/device-platform-service.js'], exports: ['DevicePlatformService'] },
  'file-helper': { scripts: [CONFIG, 'services/file-helper.js'], exports: ['FileHelper'] },
  'html-safety': { scripts: ['services/html-safety.js'], exports: ['HtmlSafety'] },
  'icon-catalog': { scripts: [ICONS], exports: ['IconCatalog'] },
  'lesson-provider-service': { scripts: ['services/lesson-provider-service.js'], exports: ['LessonProviderService'] },
  meet: { scripts: [SCHEDULE_STATE, 'models/meet.js'], exports: ['Meet', 'MeetLiveStatus'] },
  'meets-manager': { scripts: [SCHEDULE_STATE, 'models/meet.js', 'meets-manager.js'], exports: ['Meet', 'MeetsManager'] },
  pool: { scripts: [CONFIG, ICONS, TIME, 'types/pool-enums.js', SCHEDULE_STATE, 'pool-schedule.js', 'services/pool-period-schedule-service.js', 'models/pool.js'], exports: ['Pool', 'PoolStatus', 'TimeUtils', 'PoolPeriodScheduleService'], realmExports: ['PoolStatus'] },
  'pool-card-display': { scripts: ['services/html-safety.js', ICONS, SCHEDULE_STATE, 'services/pool-card-display.js'], exports: ['PoolCardDisplay'] },
  'pool-calendar-service': { scripts: ['services/pool-calendar-service.js'], exports: ['PoolCalendarService'] },
  'pool-directory-service': { scripts: ['services/pool-directory-service.js'], exports: ['PoolDirectoryService'] },
  'pool-hours-display': { scripts: ['services/html-safety.js', ICONS, SCHEDULE_STATE, 'services/pool-schedule-display.js', 'services/pool-hours-display.js'], exports: ['PoolHoursDisplay'] },
  'pool-hours-view-model-service': { scripts: [SCHEDULE_STATE, 'services/pool-calendar-service.js', 'services/team-schedule-service.js', 'services/pool-hours-view-model-service.js'], exports: ['PoolHoursViewModelService', 'PoolCalendarService'] },
  'pool-link-helper': { scripts: [CONFIG, 'services/html-safety.js', ICONS, 'services/pool-link-helper.js'], exports: ['createPoolLocationIndex', 'formatPoolCourseLabel', 'generateEnhancedPoolLink', 'generateGoogleMapsLink', 'generateLinkedPoolMentions', 'generatePoolsPageLink', 'getPoolDataFromLocation', 'getPoolIdFromLocation'] },
  'pool-meet-schedule-service': { scripts: [SCHEDULE_STATE, 'models/meet.js', 'models/team.js', 'services/pool-meet-schedule-service.js'], exports: ['Meet', 'Team', 'PoolMeetScheduleService'] },
  'pool-period-schedule-service': { scripts: [CONFIG, ICONS, TIME, 'types/pool-enums.js', 'services/pool-period-schedule-service.js'], exports: ['PoolStatus', 'TimeUtils', 'PoolPeriodScheduleService'], realmExports: ['PoolStatus'] },
  'pool-enums': { scripts: ['types/pool-enums.js'], exports: ['PoolStatus'], realmExports: ['PoolStatus'] },
  'pool-schedule': { scripts: [CONFIG, ICONS, TIME, 'types/pool-enums.js', 'pool-schedule.js'], exports: ['PoolSchedule', 'PoolStatus'], realmExports: ['PoolStatus'] },
  'pool-schedule-display': { scripts: [CONFIG, ICONS, TIME, SCHEDULE_STATE, 'services/pool-schedule-display.js'], exports: ['PoolScheduleDisplay', 'TimeUtils'] },
  'pool-week-state-service': { scripts: ['services/pool-calendar-service.js', 'services/pool-week-state-service.js'], exports: ['PoolWeekStateService'] },
  'pools-manager': { scripts: [CONFIG, ICONS, TIME, 'types/pool-enums.js', SCHEDULE_STATE, 'pool-schedule.js', 'services/pool-period-schedule-service.js', 'models/pool.js', 'pools-manager.js'], exports: ['PoolStatus', 'PoolsManager'], realmExports: ['PoolStatus'] },
  'preferences-service': { scripts: [CONFIG, 'services/preferences-service.js'], exports: ['PreferencesService'] },
  'release-notice-service': { scripts: ['services/release-notice-service.js'], exports: ['ReleaseNoticeService'] },
  'schedule-state': { scripts: [SCHEDULE_STATE], exports: ['MeetLiveStatus', 'PoolTransitionAction', 'PracticeRangeStatus'] },
  'season-service': { scripts: ['services/season-service.js'], exports: ['SeasonService'] },
  'settings-notice-service': { scripts: ['services/settings-notice-service.js'], exports: ['SettingsNoticeService'] },
  team: { scripts: ['models/team.js'], exports: ['Team'] },
  'team-agenda-display': { scripts: [CONFIG, ICONS, TIME, SCHEDULE_STATE, 'models/meet.js', 'services/team-schedule-service.js', 'services/team-agenda-display.js'], exports: ['Meet', 'TeamAgendaDisplay', 'TeamScheduleService', 'TimeUtils'] },
  'team-schedule-service': { scripts: [CONFIG, ICONS, TIME, SCHEDULE_STATE, 'services/team-schedule-service.js'], exports: ['TeamScheduleService', 'TimeUtils'] },
  'teams-manager': { scripts: ['models/team.js', 'teams-manager.js'], exports: ['Team', 'TeamsManager'] },
  'time-utils': { scripts: [CONFIG, ICONS, TIME], exports: ['TimeUtils'] },
  'weather-alert-service': { scripts: [CONFIG, 'services/weather-alert-service.js'], exports: ['WeatherAlertService'] }
});

const DEFAULT_INJECTIONS = Object.freeze({
  Date,
  URL,
  URLSearchParams,
  console
});
const DEFAULT_BRIDGES = Object.freeze(['caches', 'fetch', 'FileHelper', 'localStorage', 'sessionStorage']);

function createHostAdapter(preservedValues = new WeakSet()) {
  const adaptedValues = new WeakMap();
  const hostArguments = new WeakSet();
  const sourceValues = new WeakMap();

  function unwrap(value) {
    return sourceValues.get(value) || value;
  }

  function adapt(value) {
    if ((typeof value !== 'object' || value === null) && typeof value !== 'function') return value;
    if (preservedValues.has(value)) return value;
    if (hostArguments.has(value)) return value;
    if (adaptedValues.has(value)) return adaptedValues.get(value);
    const prototype = Object.getPrototypeOf(value);
    if ([Date.prototype, Function.prototype, Map.prototype, Object.prototype, Set.prototype].includes(prototype)) {
      return value;
    }
    if (typeof value.then === 'function') {
      const promise = Promise.resolve(value).then(adapt);
      adaptedValues.set(value, promise);
      return promise;
    }

    if (typeof value === 'function') {
      const proxy = new Proxy(value, {
        apply: (target, thisArgument, argumentsList) => {
          argumentsList.forEach(argument => {
            if ((typeof argument === 'object' && argument !== null) || typeof argument === 'function') hostArguments.add(argument);
          });
          return adapt(Reflect.apply(target, unwrap(thisArgument), argumentsList.map(unwrap)));
        },
        construct: (target, argumentsList) => {
          argumentsList.forEach(argument => {
            if ((typeof argument === 'object' && argument !== null) || typeof argument === 'function') hostArguments.add(argument);
          });
          return adapt(Reflect.construct(target, argumentsList.map(unwrap)));
        },
        get: (target, property) => adapt(Reflect.get(target, property)),
        set: (target, property, nextValue) => Reflect.set(target, property, unwrap(nextValue))
      });
      adaptedValues.set(value, proxy);
      sourceValues.set(proxy, value);
      return proxy;
    }

    const prototypeName = Object.getPrototypeOf(value)?.constructor?.name;
    if (Array.isArray(value)) {
      const hostValue = [];
      adaptedValues.set(value, hostValue);
      sourceValues.set(hostValue, value);
      for (let index = 0; index < value.length; index += 1) {
        const item = value[index];
        const itemPrototype = item && typeof item === 'object' ? Object.getPrototypeOf(item) : null;
        const isPlainRecord = itemPrototype && Reflect.ownKeys(itemPrototype).length === 1;
        hostValue.push(isPlainRecord ? toHostValue(item) : adapt(item));
      }
      if (Object.isFrozen(value)) Object.freeze(hostValue);
      else if (Object.isSealed(value)) Object.seal(hostValue);
      else if (!Object.isExtensible(value)) Object.preventExtensions(hostValue);
      return hostValue;
    }
    if (['Map', 'Set'].includes(prototypeName)) return value;
    if (prototypeName === 'Object') {
      const hostValue = {};
      adaptedValues.set(value, hostValue);
      sourceValues.set(hostValue, value);
      Reflect.ownKeys(value).forEach(key => {
        hostValue[key] = adapt(value[key]);
      });
      if (Object.isFrozen(value)) Object.freeze(hostValue);
      else if (Object.isSealed(value)) Object.seal(hostValue);
      else if (!Object.isExtensible(value)) Object.preventExtensions(hostValue);
      return hostValue;
    }
    if (prototypeName === 'Date') {
      const hostValue = toHostValue(value);
      adaptedValues.set(value, hostValue);
      sourceValues.set(hostValue, value);
      return hostValue;
    }

    const proxy = new Proxy(value, {
      get: (target, property) => adapt(Reflect.get(target, property)),
      set: (target, property, nextValue) => Reflect.set(target, property, unwrap(nextValue))
    });
    adaptedValues.set(value, proxy);
    sourceValues.set(proxy, value);
    return proxy;
  }

  return adapt;
}

function loadBrowserModule(manifestName, options = {}) {
  const manifest = BROWSER_MODULE_MANIFESTS[manifestName];
  if (!manifest) throw new Error(`Unknown browser module manifest: ${manifestName}`);

  const loader = createClassicScriptLoader({
    bridge: options.bridge || DEFAULT_BRIDGES,
    inject: { ...DEFAULT_INJECTIONS, ...options.inject },
    name: `test:${manifestName}`
  });
  loader.load(manifest.scripts);
  const exports = loader.pick(options.exports || manifest.exports);
  const realmExports = new Set(manifest.realmExports || []);
  const preservedValues = new WeakSet();
  realmExports.forEach(name => {
    const realmExport = exports[name];
    if ((typeof realmExport === 'object' && realmExport !== null) || typeof realmExport === 'function') {
      preservedValues.add(realmExport);
      Reflect.ownKeys(realmExport).forEach(key => {
        const value = realmExport[key];
        if ((typeof value === 'object' && value !== null) || typeof value === 'function') preservedValues.add(value);
      });
    }
  });
  const adapt = createHostAdapter(preservedValues);
  return {
    ...loader,
    ...Object.fromEntries(Object.entries(exports).map(([name, value]) => [name, realmExports.has(name) ? value : adapt(value)]))
  };
}

module.exports = {
  BROWSER_MODULE_MANIFESTS,
  loadBrowserModule,
  toHostValue
};
