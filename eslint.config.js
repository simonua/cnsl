const js = require('@eslint/js');
const globals = require('globals');

const COMPLETE_REGEXP_ESCAPE_PATTERN = /[.*+?^${}()|[\]\\]/.source;
const regexpSafetyPlugin = {
  rules: {
    'complete-escaping': {
      meta: {
        type: 'problem',
        docs: {
          description: 'Require complete metacharacter escaping when text is interpolated into a regular expression.'
        },
        messages: {
          incomplete: 'Regular expression escaping must include every metacharacter, including backslash. Prefer a non-regex comparison when possible.'
        },
        schema: []
      },
      create(context) {
        return {
          CallExpression(node) {
            const { callee, arguments: callArguments } = node;
            if (callee.type !== 'MemberExpression'
              || callee.computed
              || callee.property.name !== 'replace'
              || callArguments.length < 2) return;

            const [pattern, replacement] = callArguments;
            if (!pattern.regex || replacement.type !== 'Literal' || replacement.value !== '\\$&') return;
            if (pattern.regex.pattern === COMPLETE_REGEXP_ESCAPE_PATTERN && pattern.regex.flags.includes('g')) return;

            context.report({ node, messageId: 'incomplete' });
          }
        };
      }
    }
  }
};

module.exports = [
  js.configs.recommended,

  // Shared source-length boundary
  {
    files: ['**/*.js'],
    plugins: {
      'regexp-safety': regexpSafetyPlugin,
    },
    rules: {
      'max-len': ['error', {
        code: 250,
        comments: 250,
        ignoreUrls: true,
        ignoreStrings: true,
        ignoreTemplateLiterals: true,
        ignoreRegExpLiterals: true,
      }],
      'regexp-safety/complete-escaping': 'error',
    },
  },

  // Browser JS (src/js/) — classic-script application globals, browser environment
  {
    files: ['src/js/**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'script',
      globals: {
        ...globals.browser,
        // App globals loaded via <script> tags
        AnalyticsInteractionType: 'readonly',
        ClassicScriptLoader: 'readonly',
        DataManager: 'readonly',
        getDataManager: 'readonly',
        PoolsManager: 'readonly',
        TeamsManager: 'readonly',
        MeetsManager: 'readonly',
        Pool: 'readonly',
        Team: 'readonly',
        Meet: 'readonly',
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
        PreferencesService: 'readonly',
        TimeUtils: 'readonly',
        TeamScheduleService: 'readonly',
        WeatherAlertService: 'readonly',
        WeatherAlertDisplay: 'readonly',
        WeatherAlertSource: 'readonly',
        WeatherHazard: 'readonly',
        generateEnhancedPoolLink: 'readonly',
        getPoolDataFromLocation: 'readonly',
        formatPoolCourseLabel: 'readonly',
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
