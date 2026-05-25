const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  js.configs.recommended,

  // Browser JS (src/js/) — jQuery globals, browser environment
  {
    files: ['src/js/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        ...globals.browser,
        $: 'readonly',
        jQuery: 'readonly',
        module: 'readonly',
        require: 'readonly',
        // App globals loaded via <script> tags
        DataManager: 'readonly',
        getDataManager: 'readonly',
        PoolsManager: 'readonly',
        TeamsManager: 'readonly',
        MeetsManager: 'readonly',
        Pool: 'readonly',
        PoolSchedule: 'readonly',
        PoolScheduleDisplay: 'readonly',
        HtmlSafety: 'readonly',
        PoolStatus: 'readonly',
        PoolNames: 'readonly',
        FileHelper: 'readonly',
        CacheService: 'readonly',
        PreferencesService: 'readonly',
        TimeUtils: 'readonly',
        CNSLSearchEngine: 'readonly',
        WeatherService: 'readonly',
        WeatherAlertService: 'readonly',
        generateEnhancedPoolLink: 'readonly',
        getPoolDataFromLocation: 'readonly',
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
      'eqeqeq': ['error', 'always'],
      'no-var': 'warn',
      'prefer-const': 'warn',
    },
  },

  // Node build scripts (posthtml.js, automation scripts, test files, config)
  {
    files: ['posthtml.js', 'posthtml.config.js', 'playwright.config.js', 'eslint.config.js', 'scripts/**/*.js', 'test-*.js', 'tests/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
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
      ecmaVersion: 2022,
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
    ignores: ['out/**', 'node_modules/**'],
  },
];
