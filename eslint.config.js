const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  js.configs.recommended,

  // Shared source-length boundary
  {
    files: ['**/*.js'],
    rules: {
      'max-len': ['error', {
        code: 250,
        comments: 250,
        ignoreUrls: true,
        ignoreStrings: true,
        ignoreTemplateLiterals: true,
        ignoreRegExpLiterals: true,
      }],
    },
  },

  // Browser JS (src/js/) — jQuery globals, browser environment
  {
    files: ['src/js/**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'script',
      globals: {
        ...globals.browser,
        $: 'readonly',
        jQuery: 'readonly',
        // App globals loaded via <script> tags
        AnalyticsInteractionType: 'readonly',
        DataManager: 'readonly',
        getDataManager: 'readonly',
        PoolsManager: 'readonly',
        TeamsManager: 'readonly',
        MeetsManager: 'readonly',
        Pool: 'readonly',
        Team: 'readonly',
        Meet: 'readonly',
        PoolSchedule: 'readonly',
        PoolScheduleDisplay: 'readonly',
        PoolPeriodScheduleService: 'readonly',
        PoolHoursDisplay: 'readonly',
        PoolHoursViewModelService: 'readonly',
        PoolCardDisplay: 'readonly',
        PoolCalendarService: 'readonly',
        PoolCalendarControls: 'readonly',
        PoolWeekStateService: 'readonly',
        PoolDirectoryService: 'readonly',
        PoolMeetScheduleService: 'readonly',
        HtmlSafety: 'readonly',
        IconCatalog: 'readonly',
        LessonProviderService: 'readonly',
        PoolStatus: 'readonly',
        MeetLiveStatus: 'readonly',
        PoolTransitionAction: 'readonly',
        PracticeRangeStatus: 'readonly',
        PoolNames: 'readonly',
        FileHelper: 'readonly',
        CacheService: 'readonly',
        PreferencesService: 'readonly',
        TimeUtils: 'readonly',
        TeamScheduleService: 'readonly',
        CNSLSearchEngine: 'readonly',
        WeatherService: 'readonly',
        WeatherAlertService: 'readonly',
        WeatherAlertDisplay: 'readonly',
        WeatherAlertSource: 'readonly',
        WeatherHazard: 'readonly',
        generateEnhancedPoolLink: 'readonly',
        getPoolDataFromLocation: 'readonly',
        formatPoolCourseLabel: 'readonly',
        getPoolStatus: 'readonly',
        isPoolOpen: 'readonly',
        handleSearch: 'readonly',
        YEAR: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
      'no-console': 'off',
      'no-undef': 'error',
      'no-redeclare': ['error', { builtinGlobals: false }],
      'no-restricted-globals': ['error', 'exports', 'module', 'process', 'require', '__dirname', '__filename'],
      'no-restricted-syntax': [
        'error',
        {
          selector: "UnaryExpression[operator='typeof'] > Identifier[name='window']",
          message: 'Browser source must not contain Node-environment window guards.'
        }
      ],
      'eqeqeq': ['error', 'always'],
      'no-var': 'warn',
      'prefer-const': 'warn',
    },
  },

  // Node build scripts (posthtml.js, automation scripts, test files, config)
  {
    files: ['posthtml.js', 'posthtml.config.js', 'playwright.config.js', 'browser-sync.config.js', 'eslint.config.js', 'scripts/**/*.js', 'test-*.js', 'tests/**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
      },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
      'no-console': 'off',
    },
  },

  // Service worker — browser + service worker globals
  {
    files: ['service-worker.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'script',
      globals: {
        ...globals.serviceworker,
        LOCAL_DEVELOPMENT_HOSTNAMES: 'readonly',
        LOCAL_DEVELOPMENT_PORT: 'readonly',
        PWA_CACHE_PREFIX: 'readonly',
        YEAR: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
      'no-console': 'off',
    },
  },

  // Ignore build output and dependencies
  {
    ignores: ['out/**', 'node_modules/**', 'test-results/**', 'playwright-report/**'],
  },
];
