const { createClassicScriptLoader, toHostValue } = require('../../scripts/lib/classic-script-loader.js');
const { readPackageVersion } = require('../../scripts/lib/package-version.js');

const CONFIG = 'config/app-config.js';
const ANALYTICS_TYPES = 'types/analytics-interaction-type.js';
const ATTENTION_BANNER_TYPE = 'types/attention-banner-type.js';
const ICONS = 'services/icon-catalog.js';
const PAYMENT_METHOD = 'types/payment-method.js';
const SCHEDULE_STATE = 'types/schedule-state.js';
const TIME = 'services/time-utils.js';
const WEATHER_HAZARD = 'types/weather-hazard.js';
const WEATHER_SOURCE = 'types/weather-alert-source.js';
const START_PAGE = 'types/start-page.js';

const BROWSER_MODULE_MANIFESTS = Object.freeze({
  'analytics-interaction-type': { scripts: [ANALYTICS_TYPES], exports: ['AnalyticsExternalLinkPurpose', 'AnalyticsInteractionType'] },
  'attention-banner-type': { scripts: [ATTENTION_BANNER_TYPE], exports: ['AttentionBannerType'], realmExports: ['AttentionBannerType'] },
  'app-config': { scripts: [ATTENTION_BANNER_TYPE, CONFIG], exports: ['AppConfig', 'AttentionBannerType'], realmExports: ['AttentionBannerType'] },
  'data-manager': { scripts: [ATTENTION_BANNER_TYPE, CONFIG, ICONS, TIME, 'types/pool-enums.js', SCHEDULE_STATE, 'services/pool-period-schedule-service.js', 'models/pool.js', 'models/team.js', 'models/meet.js', 'managers/pools-manager.js', 'managers/teams-manager.js', 'managers/meets-manager.js', 'services/file-helper.js', 'services/data-manager.js'], exports: ['DataManager', 'getDataManager'] },
  'device-platform-service': { scripts: ['services/device-platform-service.js'], exports: ['DevicePlatformService'] },
  'experimental-features-service': { scripts: [ATTENTION_BANNER_TYPE, CONFIG, START_PAGE, 'services/preferences-service.js', 'services/experimental-features-service.js'], exports: ['ExperimentalFeaturesService', 'PreferencesService'] },
  'file-helper': { scripts: [ATTENTION_BANNER_TYPE, CONFIG, 'services/file-helper.js'], exports: ['FileHelper'] },
  'html-safety': { scripts: ['services/html-safety.js'], exports: ['HtmlSafety'] },
  'icon-catalog': { scripts: [ICONS], exports: ['IconCatalog'] },
  'lesson-provider-service': { scripts: ['services/lesson-provider-service.js'], exports: ['LessonProviderService'] },
  meet: { scripts: [SCHEDULE_STATE, 'models/meet.js'], exports: ['Meet', 'MeetLiveStatus'] },
  'meet-day-guide-service': { scripts: [ATTENTION_BANNER_TYPE, CONFIG, START_PAGE, ICONS, TIME, SCHEDULE_STATE, 'models/meet.js', 'services/preferences-service.js', 'services/html-safety.js', 'services/device-platform-service.js', 'services/pool-link-helper.js', 'types/meet-team-role.js', PAYMENT_METHOD, 'services/team-schedule-service.js', 'services/team-agenda-display.js', 'services/meet-day-guide-service.js'], exports: ['Meet', 'MeetDayGuideService', 'MeetTeamRole', 'PaymentMethod', 'PreferencesService', 'TeamAgendaDisplay'], realmExports: ['PaymentMethod'] },
  'meet-team-role': { scripts: ['types/meet-team-role.js'], exports: ['MeetTeamRole'] },
  'payment-method': { scripts: [PAYMENT_METHOD], exports: ['PaymentMethod'], realmExports: ['PaymentMethod'] },
  'meets-manager': { scripts: [SCHEDULE_STATE, 'models/meet.js', 'managers/meets-manager.js'], exports: ['Meet', 'MeetsManager'] },
  pool: { scripts: [ATTENTION_BANNER_TYPE, CONFIG, ICONS, TIME, 'types/pool-enums.js', SCHEDULE_STATE, 'services/pool-period-schedule-service.js', 'models/pool.js'], exports: ['Pool', 'PoolStatus', 'TimeUtils', 'PoolPeriodScheduleService'], realmExports: ['PoolStatus'] },
  'pool-card-display': { scripts: [ATTENTION_BANNER_TYPE, CONFIG, ANALYTICS_TYPES, 'services/html-safety.js', ICONS, 'services/device-platform-service.js', 'services/pool-link-helper.js', SCHEDULE_STATE, 'services/pool-card-display.js'], exports: ['PoolCardDisplay'] },
  'pool-calendar-service': { scripts: ['services/pool-calendar-service.js'], exports: ['PoolCalendarService'] },
  'pool-directory-service': { scripts: ['services/pool-directory-service.js'], exports: ['PoolDirectoryService'] },
  'pool-hours-display': { scripts: ['services/html-safety.js', ICONS, SCHEDULE_STATE, 'services/pool-card-display.js', 'services/pool-schedule-display.js', 'services/pool-hours-display.js'], exports: ['PoolHoursDisplay'] },
  'pool-hours-view-model-service': { scripts: [SCHEDULE_STATE, 'services/pool-calendar-service.js', 'services/team-schedule-service.js', 'services/pool-hours-view-model-service.js'], exports: ['PoolHoursViewModelService', 'PoolCalendarService'] },
  'pool-link-helper': { scripts: [ATTENTION_BANNER_TYPE, CONFIG, 'services/html-safety.js', ICONS, 'services/device-platform-service.js', 'services/pool-link-helper.js'], exports: ['createPoolLocationIndex', 'formatPoolCourseLabel', 'generateEnhancedPoolLink', 'generateGoogleMapsLink', 'generateLinkedPoolMentions', 'generateMeetPageLink', 'generatePoolDirectionsLink', 'generatePoolsPageLink', 'getPoolDataFromLocation', 'getPoolDirectionsQuery', 'getPoolIdFromLocation'] },
  'pool-meet-schedule-service': { scripts: [SCHEDULE_STATE, 'models/meet.js', 'models/team.js', 'services/pool-meet-schedule-service.js'], exports: ['Meet', 'Team', 'PoolMeetScheduleService'] },
  'pool-period-schedule-service': { scripts: [ATTENTION_BANNER_TYPE, CONFIG, ICONS, TIME, 'types/pool-enums.js', 'services/pool-period-schedule-service.js'], exports: ['PoolStatus', 'TimeUtils', 'PoolPeriodScheduleService'], realmExports: ['PoolStatus'] },
  'pool-enums': { scripts: ['types/pool-enums.js'], exports: ['PoolStatus'], realmExports: ['PoolStatus'] },
  'pool-schedule-display': { scripts: [ATTENTION_BANNER_TYPE, CONFIG, 'services/html-safety.js', ICONS, TIME, SCHEDULE_STATE, 'services/pool-schedule-display.js'], exports: ['PoolScheduleDisplay', 'TimeUtils'] },
  'pool-week-state-service': { scripts: ['services/pool-calendar-service.js', 'services/pool-week-state-service.js'], exports: ['PoolWeekStateService'] },
  'pools-manager': { scripts: [ATTENTION_BANNER_TYPE, CONFIG, ICONS, TIME, 'types/pool-enums.js', SCHEDULE_STATE, 'services/pool-period-schedule-service.js', 'models/pool.js', 'managers/pools-manager.js'], exports: ['PoolStatus', 'PoolsManager'], realmExports: ['PoolStatus'] },
  'preferences-service': { scripts: [ATTENTION_BANNER_TYPE, CONFIG, START_PAGE, 'services/preferences-service.js'], exports: ['PreferencesService'] },
  'start-page': { scripts: [START_PAGE], exports: ['StartPage'] },
  'release-notice-service': { scripts: ['services/release-notice-service.js'], exports: ['ReleaseNoticeService'] },
  'schedule-state': { scripts: [SCHEDULE_STATE], exports: ['MeetLiveStatus', 'PoolTransitionAction', 'PracticeRangeStatus'] },
  'season-service': { scripts: ['services/season-service.js'], exports: ['SeasonService'] },
  'welcome-dialog-service': { scripts: ['services/welcome-dialog-service.js'], exports: ['WelcomeDialogService'] },
  team: { scripts: ['models/team.js'], exports: ['Team'] },
  'team-agenda-display': { scripts: [ATTENTION_BANNER_TYPE, CONFIG, 'services/html-safety.js', ICONS, 'services/device-platform-service.js', 'services/pool-link-helper.js', TIME, SCHEDULE_STATE, 'models/meet.js', 'services/team-schedule-service.js', 'services/team-agenda-display.js'], exports: ['Meet', 'TeamAgendaDisplay', 'TeamScheduleService', 'TimeUtils'] },
  'team-schedule-service': { scripts: [ATTENTION_BANNER_TYPE, CONFIG, ICONS, TIME, SCHEDULE_STATE, 'services/team-schedule-service.js'], exports: ['TeamScheduleService', 'TimeUtils'] },
  'teams-manager': { scripts: ['models/team.js', 'managers/teams-manager.js'], exports: ['Team', 'TeamsManager'] },
  'time-utils': { scripts: [ATTENTION_BANNER_TYPE, CONFIG, ICONS, TIME], exports: ['TimeUtils'] },
  'weather-alert-display': { scripts: [WEATHER_HAZARD, WEATHER_SOURCE, ICONS, 'weather-alert-display.js'], exports: ['WeatherAlertDisplay', 'WeatherAlertSource'], realmExports: ['WeatherAlertDisplay', 'WeatherAlertSource'] },
  'weather-alert-cache-service': { scripts: [ATTENTION_BANNER_TYPE, CONFIG, WEATHER_HAZARD, WEATHER_SOURCE, 'services/weather-freshness-service.js'], exports: ['WeatherAlertCacheService', 'WeatherAlertSource'], realmExports: ['WeatherAlertSource'] },
  'weather-alert-service': { scripts: [ATTENTION_BANNER_TYPE, CONFIG, WEATHER_HAZARD, WEATHER_SOURCE, 'services/weather-freshness-service.js', 'services/weather-alert-service.js'], exports: ['WeatherAlertService', 'WeatherAlertSource', 'WeatherHazard'], realmExports: ['WeatherAlertSource', 'WeatherHazard'] },
  'weather-alert-source': { scripts: [WEATHER_SOURCE], exports: ['WeatherAlertSource'], realmExports: ['WeatherAlertSource'] },
  'weather-freshness-service': { scripts: [ATTENTION_BANNER_TYPE, CONFIG, 'services/weather-freshness-service.js'], exports: ['WeatherFreshnessService'] },
  'weather-hazard': { scripts: [WEATHER_HAZARD], exports: ['WeatherHazard'], realmExports: ['WeatherHazard'] }
});

const DEFAULT_INJECTIONS = Object.freeze({
  APP_VERSION: readPackageVersion(),
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
