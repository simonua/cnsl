const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('@playwright/test');
const {
  prepareStableWeatherResponses,
  seedPreferences
} = require('../browser/browser-test-helpers.js');

const DEFAULT_ORIGIN = 'http://localhost:9090';
const DEFAULT_OUTPUT_DIRECTORY = path.join('test-results', 'meet-guidance');
const DEFAULT_TIMEZONE = 'America/New_York';
const DEFAULT_VIEWPORT = Object.freeze({ height: 1800, width: 1440 });
const EXTERNAL_REQUEST = /^https?:\/\/(?!(?:127\.0\.0\.1|localhost|\[::1\])(?::\d+)?(?:[/?#]|$))/i;
const LOCAL_HOSTNAMES = new Set(['127.0.0.1', '::1', '[::1]', 'localhost']);
const MEET_DAY_PATH = '/my-meet-day.html';
const READY_STATUS = 'Meet-day details loaded.';
const TEAM_ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/i;

const HELP_TEXT = `Capture home and away My Meet Day views from the local built site.

Usage:
  pnpm run capture:meet-guidance -- --meet-date YYYY-MM-DD --home-team-id ID --away-team-id ID [options]

Required:
  --meet-date DATE       Represented meet date in YYYY-MM-DD form
  --home-team-id ID      Home team identifier used by cnsl_preferences
  --away-team-id ID      Away team identifier used by cnsl_preferences

Repeatable assertions:
  --shared-text TEXT     Text expected in both rendered views
  --home-text TEXT       Text expected only in the home view
  --away-text TEXT       Text expected only in the away view
  --exclude-text TEXT    Text prohibited from both rendered views

Other options:
  --origin URL           Local site origin (default: http://localhost:9090)
  --output-directory DIR Screenshot directory (default: test-results/meet-guidance)
  --reference-time TIME  ISO timestamp override; defaults to the day before the meet
  --headed               Show the Chromium window
  --help                 Show this help
`;

function normalizeWhitespace(value) {
  return String(value).replace(/\r\n/g, '\n').replace(/[ \t]+$/gm, '').trim();
}

function normalizeForComparison(value) {
  return normalizeWhitespace(value).replace(/\s+/g, ' ');
}

function parseCalendarDate(value, optionName) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) {
    throw new Error(`${optionName} must use YYYY-MM-DD format.`);
  }
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) {
    throw new Error(`${optionName} must be a real calendar date.`);
  }
  return parsed;
}

function deriveReferenceTime(meetDate) {
  const parsed = parseCalendarDate(meetDate, '--meet-date');
  return new Date(Date.UTC(
    parsed.getUTCFullYear(),
    parsed.getUTCMonth(),
    parsed.getUTCDate() - 1,
    17
  ));
}

function parseReferenceTime(value, meetDate) {
  if (!value) return deriveReferenceTime(meetDate);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('--reference-time must be a valid ISO timestamp.');
  }
  return parsed;
}

function parseLocalOrigin(value) {
  let origin;
  try {
    origin = new URL(value);
  } catch {
    throw new Error('--origin must be a valid local HTTP URL.');
  }
  if (origin.protocol !== 'http:' || !LOCAL_HOSTNAMES.has(origin.hostname) || origin.username || origin.password) {
    throw new Error('--origin must use HTTP and a localhost or loopback hostname.');
  }
  return origin.origin;
}

function readOptionValue(argumentsList, index, optionName) {
  const value = argumentsList[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`${optionName} requires a value.`);
  }
  return value;
}

function parseArguments(argumentsList) {
  const options = {
    awayExpectedText: [],
    excludedText: [],
    headless: true,
    homeExpectedText: [],
    sharedExpectedText: []
  };
  const valueOptions = new Map([
    ['--away-team-id', 'awayTeamId'],
    ['--home-team-id', 'homeTeamId'],
    ['--meet-date', 'meetDate'],
    ['--origin', 'origin'],
    ['--output-directory', 'outputDirectory'],
    ['--reference-time', 'referenceTime']
  ]);
  const repeatedOptions = new Map([
    ['--away-text', 'awayExpectedText'],
    ['--exclude-text', 'excludedText'],
    ['--home-text', 'homeExpectedText'],
    ['--shared-text', 'sharedExpectedText']
  ]);

  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    if (argument === '--help') {
      options.help = true;
    } else if (argument === '--headed') {
      options.headless = false;
    } else if (valueOptions.has(argument)) {
      options[valueOptions.get(argument)] = readOptionValue(argumentsList, index, argument);
      index += 1;
    } else if (repeatedOptions.has(argument)) {
      options[repeatedOptions.get(argument)].push(readOptionValue(argumentsList, index, argument));
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }
  return options;
}

function validateTeamId(value, optionName) {
  if (!TEAM_ID_PATTERN.test(value || '')) {
    throw new Error(`${optionName} must be a nonempty alphanumeric team identifier and may include hyphens.`);
  }
  return value;
}

function normalizeConfiguration(options) {
  if (!options || typeof options !== 'object') {
    throw new Error('Capture options are required.');
  }
  const meetDate = options.meetDate;
  parseCalendarDate(meetDate, '--meet-date');
  const homeTeamId = validateTeamId(options.homeTeamId, '--home-team-id');
  const awayTeamId = validateTeamId(options.awayTeamId, '--away-team-id');
  if (homeTeamId === awayTeamId) {
    throw new Error('Home and away team identifiers must differ.');
  }
  return {
    awayExpectedText: [...(options.awayExpectedText || [])],
    awayTeamId,
    excludedText: [...(options.excludedText || [])],
    headless: options.headless !== false,
    homeExpectedText: [...(options.homeExpectedText || [])],
    homeTeamId,
    meetDate,
    origin: parseLocalOrigin(options.origin || DEFAULT_ORIGIN),
    outputDirectory: path.resolve(options.outputDirectory || DEFAULT_OUTPUT_DIRECTORY),
    referenceTime: parseReferenceTime(options.referenceTime, meetDate),
    sharedExpectedText: [...(options.sharedExpectedText || [])]
  };
}

function assertRenderedText(text, role, expectedText, excludedText) {
  const comparableText = normalizeForComparison(text);
  assert.match(comparableText, new RegExp(`^${role} meet\\b`));
  expectedText.forEach(value => {
    const comparableValue = normalizeForComparison(value);
    assert.ok(comparableValue && comparableText.includes(comparableValue), `Missing expected ${role.toLowerCase()} text: ${value}`);
  });
  excludedText.forEach(value => {
    const comparableValue = normalizeForComparison(value);
    assert.ok(
      comparableValue && !comparableText.toLowerCase().includes(comparableValue.toLowerCase()),
      `Found excluded ${role.toLowerCase()} text: ${value}`
    );
  });
}

async function capturePerspective(browser, configuration, perspective) {
  const context = await browser.newContext({
    reducedMotion: 'reduce',
    serviceWorkers: 'block',
    timezoneId: DEFAULT_TIMEZONE,
    viewport: DEFAULT_VIEWPORT
  });
  const blockedExternalRequests = [];
  try {
    await context.route(EXTERNAL_REQUEST, route => {
      blockedExternalRequests.push(route.request().url());
      return route.abort('blockedbyclient');
    });
    const page = await context.newPage();
    await prepareStableWeatherResponses(page);
    await page.clock.setFixedTime(configuration.referenceTime);
    await seedPreferences(page, {
      experimentalFeatures: ['my-meet-day'],
      favoriteTeamId: perspective.teamId
    });
    await page.goto(new URL(MEET_DAY_PATH, configuration.origin).href, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(readyStatus => globalThis.document.getElementById('myMeetDayStatus')?.textContent === readyStatus, READY_STATUS);

    const meetDay = page.locator('#myMeetDay');
    await meetDay.waitFor({ state: 'visible' });
    const text = normalizeWhitespace(await meetDay.innerText());
    assertRenderedText(
      text,
      perspective.role,
      [...configuration.sharedExpectedText, ...perspective.expectedText],
      configuration.excludedText
    );
    const screenshotPath = path.join(
      configuration.outputDirectory,
      `${configuration.meetDate}-${perspective.teamId}-${perspective.role.toLowerCase()}.png`
    );
    await meetDay.screenshot({
      animations: 'disabled',
      path: screenshotPath,
      style: 'header, footer { visibility: hidden !important; }'
    });
    assert.deepEqual(blockedExternalRequests, [], `The ${perspective.role.toLowerCase()} view attempted external requests.`);
    return {
      role: perspective.role,
      screenshot: path.relative(process.cwd(), screenshotPath).replace(/\\/g, '/'),
      teamId: perspective.teamId,
      text
    };
  } finally {
    await context.close();
  }
}

async function captureMeetGuidance(options, dependencies = {}) {
  const configuration = normalizeConfiguration(options);
  await fs.mkdir(configuration.outputDirectory, { recursive: true });
  const browserType = dependencies.browserType || chromium;
  const browser = await browserType.launch({ channel: 'chromium', headless: configuration.headless });
  try {
    const home = await capturePerspective(browser, configuration, {
      expectedText: configuration.homeExpectedText,
      role: 'Home',
      teamId: configuration.homeTeamId
    });
    const away = await capturePerspective(browser, configuration, {
      expectedText: configuration.awayExpectedText,
      role: 'Away',
      teamId: configuration.awayTeamId
    });
    return {
      away,
      home,
      meetDate: configuration.meetDate,
      referenceTime: configuration.referenceTime.toISOString()
    };
  } finally {
    await browser.close();
  }
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    console.log(HELP_TEXT);
    return;
  }
  const result = await captureMeetGuidance(options);
  console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) {
  main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  HELP_TEXT,
  assertRenderedText,
  captureMeetGuidance,
  deriveReferenceTime,
  normalizeConfiguration,
  normalizeForComparison,
  normalizeWhitespace,
  parseArguments,
  parseCalendarDate,
  parseLocalOrigin
};
