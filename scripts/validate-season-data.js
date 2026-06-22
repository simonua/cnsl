'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');
const { isValidArtifactDate, parseReadmePdfSources, resolveLatestPoolSchedulePaths } = require('./season-data-agent');
const TeamScheduleService = require('./adapters/team-schedule-service.js');

const DOMAINS = Object.freeze(['pools', 'meets', 'teams']);
const REPOSITORY_ROOT = path.resolve(__dirname, '..');
const CLOCK_TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const TIME_PATTERN = /^(0?[1-9]|1[0-2]):([0-5][0-9])(AM|PM)$/i;
const CONCESSION_ITEM_FIELDS = Object.freeze(['mealItems', 'snackItems', 'drinkItems']);
const ALPHABETICAL_COLLATOR = new Intl.Collator('en', { sensitivity: 'base' });

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

async function readActiveYear(repositoryRoot) {
  const config = await fs.readFile(path.join(repositoryRoot, 'src', 'js', 'config', 'app-config.js'), 'utf8');
  const match = config.match(/\bconst YEAR = (\d{4});/);
  if (!match) {
    throw new Error('Could not find the active YEAR in src/js/config/app-config.js.');
  }
  return Number(match[1]);
}

function formatSchemaErrors(domain, validationErrors) {
  return validationErrors.map((error) => {
    const fieldPath = error.instancePath || '/';
    return `${domain}${fieldPath}: ${error.message}`;
  });
}

function validateSchema(domain, data, schema) {
  const validator = new Ajv({ allErrors: true, strict: false });
  addFormats(validator);
  const validate = validator.compile(schema);

  return validate(data) ? [] : formatSchemaErrors(domain, validate.errors);
}

function addUniqueValueErrors(errors, values, label) {
  const observed = new Set();
  values.forEach((value) => {
    if (typeof value !== 'string' || value.trim() === '') {
      errors.push(`${label} must be populated for every record.`);
      return;
    }
    if (observed.has(value)) {
      errors.push(`${label} must be unique; duplicate value: ${value}.`);
      return;
    }
    observed.add(value);
  });
}

function validateHttpsUrl(errors, label, value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') {
      errors.push(`${label} must use HTTPS: ${value}.`);
      return null;
    }
    return url;
  } catch (_error) {
    errors.push(`${label} must be a valid HTTPS URL: ${value}.`);
    return null;
  }
}

function validateSeasonDate(errors, label, value, season) {
  if (!value.startsWith(`${season}-`)) {
    errors.push(`${label} must belong to the active ${season} season: ${value}.`);
  }
}

function validateDateRange(errors, label, startDate, endDate) {
  if (startDate > endDate) {
    errors.push(`${label} ends before it starts: ${startDate} to ${endDate}.`);
  }
}

function parseTimeMinutes(value) {
  if (typeof value !== 'string') return null;
  const match = value.match(TIME_PATTERN);
  if (!match) return null;
  const hour = (Number(match[1]) % 12) + (match[3].toLowerCase() === 'pm' ? 12 : 0);
  return hour * 60 + Number(match[2]);
}

function parseClockMinutes(value) {
  if (typeof value !== 'string') return null;
  const match = value.match(CLOCK_TIME_PATTERN);
  return match ? (Number(match[1]) * 60) + Number(match[2]) : null;
}

function validateTimingWindow(errors, label, timingWindow) {
  if (!timingWindow) return;
  const startMinutes = parseClockMinutes(timingWindow.start);
  const endMinutes = parseClockMinutes(timingWindow.end);
  if (startMinutes !== null && endMinutes !== null && startMinutes >= endMinutes) {
    errors.push(`${label} must end after it starts: ${timingWindow.start} to ${timingWindow.end}.`);
  }
}

function validateAlphabeticalOrder(errors, label, values) {
  if (!values) return;
  const sortedValues = [...values].sort(ALPHABETICAL_COLLATOR.compare);
  if (values.some((value, index) => value !== sortedValues[index])) {
    errors.push(`${label} must be sorted A-to-Z: ${values.join(', ')}.`);
  }
}

function validateDualMeetMilestones(errors, timingWindow) {
  if (!timingWindow) return;
  const orderedValues = [
    timingWindow.start,
    timingWindow.relayCheckInDeadline,
    timingWindow.firstSwimTime,
    timingWindow.end
  ];
  const orderedMinutes = orderedValues.map(parseClockMinutes);
  if (orderedMinutes.some(value => value === null)) return;
  if (orderedMinutes.some((value, index) => index > 0 && orderedMinutes[index - 1] > value)) {
    errors.push(
      'Meet dualMeets timing must order start, relay check-in deadline, first swim, and end: ' +
      `${orderedValues.join(', ')}.`
    );
  }
}

function validateHomeMeetGuideTimes(errors, label, guide) {
  const roleGuides = [
    ['home team', guide.homeTeam],
    ['visiting team', guide.visitingTeam]
  ];
  roleGuides.forEach(([roleLabel, roleGuide]) => {
    if (!roleGuide) return;
    const arrivalMinutes = parseClockMinutes(roleGuide.arrivalTime);
    const warmupMinutes = parseClockMinutes(roleGuide.warmupTime);
    if (arrivalMinutes !== null && warmupMinutes !== null && arrivalMinutes > warmupMinutes) {
      errors.push(
        `${label} ${roleLabel} arrival time must not be after warm-ups: ` +
        `${roleGuide.arrivalTime} to ${roleGuide.warmupTime}.`
      );
    }
  });
}

function validatePoolScheduleHours(errors, poolName, scope, schedules) {
  schedules.forEach((schedule, scheduleIndex) => {
    schedule.hours.forEach((hours, hoursIndex) => {
      const startMinutes = parseTimeMinutes(hours.startTime);
      const endMinutes = parseTimeMinutes(hours.endTime);
      if (startMinutes !== null && endMinutes !== null && startMinutes >= endMinutes) {
        errors.push(
          `${poolName} ${scope} ${scheduleIndex + 1} hours ${hoursIndex + 1} ` +
          `must end after it starts: ${hours.startTime} to ${hours.endTime}.`
        );
      }
    });
  });
}

function validatePoolFeatureOverrides(errors, pool, season) {
  const publishedFeatures = new Set(pool.features || []);
  const overriddenFeatures = new Set();
  (pool.featureOverrides || []).forEach((override) => {
    const label = `${pool.name} feature override for ${override.feature}`;
    if (overriddenFeatures.has(override.feature)) {
      errors.push(`${label} must be unique; only one override is allowed per feature.`);
    }
    overriddenFeatures.add(override.feature);
    if (override.action === 'add' && publishedFeatures.has(override.feature)) {
      errors.push(`${label} cannot add a feature already present in the published baseline.`);
    }
    if (override.action === 'remove' && !publishedFeatures.has(override.feature)) {
      errors.push(`${label} cannot remove a feature absent from the published baseline.`);
    }
    if (override.action === 'remove' && override.evidence.type !== 'official-source') {
      errors.push(`${label} requires official-source evidence to remove a published feature.`);
    }
    if (override.evidence.observedOn) {
      validateSeasonDate(errors, `${label} observation date`, override.evidence.observedOn, season);
    }
    validateSeasonDate(
      errors,
      `${label} official-source check date`,
      override.evidence.officialSourceCheckedOn,
      season
    );
  });
}

function hasRecognizedPoolLocation(location, poolNames) {
  if (location.startsWith("Each Team's Home Pool")) {
    return true;
  }
  return [...poolNames].some((poolName) => location.includes(`${poolName} Pool`));
}

function collectIntegrityErrors({ meetsData, poolsData, season, teamsData }) {
  const errors = [];
  const pools = poolsData.pools;
  const teams = teamsData.teams;
  const poolNames = new Set(pools.map((pool) => pool.name));
  const teamAliases = new Set(teams.flatMap((team) => [team.name, ...team.keywords].map((name) => name.toLowerCase())));

  addUniqueValueErrors(errors, pools.map((pool) => pool.id), 'Pool id');
  addUniqueValueErrors(errors, pools.map((pool) => pool.name), 'Pool name');
  addUniqueValueErrors(errors, teams.map((team) => team.id), 'Team id');
  addUniqueValueErrors(errors, teams.map((team) => team.name), 'Team name');

  validateSeasonDate(errors, 'Pool season start date', poolsData.seasonStartDate, season);
  validateSeasonDate(errors, 'Pool season end date', poolsData.seasonEndDate, season);
  validateDateRange(errors, 'Pool season', poolsData.seasonStartDate, poolsData.seasonEndDate);
  validateHttpsUrl(errors, 'CA pool directory URL', poolsData.caPoolDirectoryUrl);
  validateHttpsUrl(errors, 'CA pool guide URL', poolsData.caPoolGuideUrl);

  pools.forEach((pool) => {
    if (Number.isFinite(pool.laneLength) && pool.laneLength > 0 && !['meters', 'yards'].includes(pool.laneLengthUnits)) {
      errors.push(`${pool.name} lane measurement units must be provided when lane length is known.`);
    }
    validateHttpsUrl(errors, `${pool.name} CA source URL`, pool.caUrl);
    validateHttpsUrl(errors, `${pool.name} schedule URL`, pool.scheduleUrl);
    validateHttpsUrl(errors, `${pool.name} Google Maps URL`, pool.location && pool.location.googleMapsUrl);
    [...pool.schedules, ...(pool.scheduleOverrides || [])].forEach((schedule, index) => {
      const label = `${pool.name} schedule entry ${index + 1}`;
      validateSeasonDate(errors, `${label} start date`, schedule.startDate, season);
      validateSeasonDate(errors, `${label} end date`, schedule.endDate, season);
      validateDateRange(errors, label, schedule.startDate, schedule.endDate);
    });
    validatePoolScheduleHours(errors, pool.name, 'schedule', pool.schedules);
    validatePoolScheduleHours(errors, pool.name, 'schedule override', pool.scheduleOverrides || []);
    validatePoolFeatureOverrides(errors, pool, season);
  });

  teams.forEach((team) => {
    validateHttpsUrl(errors, `${team.name} public URL`, team.url);
    if (team.resultsUrl) {
      validateHttpsUrl(errors, `${team.name} results URL`, team.resultsUrl);
    }
    if (team.calendarUrl) {
      validateHttpsUrl(errors, `${team.name} calendar URL`, team.calendarUrl);
    }
    if (team.eventsSubscriptionUrl) {
      validateHttpsUrl(errors, `${team.name} events subscription URL`, team.eventsSubscriptionUrl);
    }
    if (team.booster && team.booster.url) {
      validateHttpsUrl(errors, `${team.name} booster URL`, team.booster.url);
    }
    validateHttpsUrl(errors, `${team.name} staff source URL`, team.staff.sourceUrl);
    if (team.practice && team.practice.url) {
      validateHttpsUrl(errors, `${team.name} practice URL`, team.practice.url);
    }
    Object.entries(team.meetTimeOverrides || {}).forEach(([eventType, timingWindow]) => {
      validateTimingWindow(errors, `${team.name} ${eventType} timing window`, timingWindow);
    });
    TeamScheduleService.getValidationErrors(team.practice, season).forEach((error) => {
      errors.push(`${team.name} practice ${error}`);
    });
    TeamScheduleService.getPracticePatterns(team.practice, season).forEach((practicePattern) => {
      const poolName = TeamScheduleService.normalizePoolName(practicePattern.location);
      if (!poolNames.has(poolName)) {
        errors.push(`${team.name} detailed practice references unknown pool location: ${practicePattern.location}.`);
      } else if (!team.practicePools.includes(poolName)) {
        errors.push(`${team.name} detailed practice location is missing from practicePools: ${poolName}.`);
      }
    });
    (team.homeMeetGuides || []).forEach((guide) => {
      const concessions = guide.general && guide.general.concessions;
      validateHomeMeetGuideTimes(errors, `${team.name} ${guide.poolId}`, guide);
      CONCESSION_ITEM_FIELDS.forEach((field) => {
        validateAlphabeticalOrder(
          errors,
          `${team.name} ${guide.poolId} concessions ${field}`,
          concessions && concessions[field]
        );
      });
    });
    [...team.homePools, ...team.practicePools, team.timeTrialsPool].filter(Boolean).forEach((poolName) => {
      if (!poolNames.has(poolName)) {
        errors.push(`${team.name} references unknown pool: ${poolName}.`);
      }
    });
  });

  validateHttpsUrl(errors, 'Meet source URL', meetsData.url);
  Object.entries(meetsData.meetTimes || {}).forEach(([eventType, timingWindow]) => {
    validateTimingWindow(errors, `Meet ${eventType} timing window`, timingWindow);
  });
  validateDualMeetMilestones(errors, meetsData.meetTimes && meetsData.meetTimes.dualMeets);
  meetsData.regular_meets.forEach((meet, index) => {
    const label = `Regular meet ${index + 1}`;
    validateSeasonDate(errors, `${label} date`, meet.date, season);
    if (!hasRecognizedPoolLocation(meet.location, poolNames)) {
      errors.push(`${label} references an unknown pool location: ${meet.location}.`);
    }
    [meet.home_team, meet.visiting_team].flatMap((teamName) => teamName.split(','))
      .map((teamName) => teamName.trim().toLowerCase())
      .forEach((teamName) => {
        if (!teamAliases.has(teamName)) {
          errors.push(`${label} references an unknown team alias: ${teamName}.`);
        }
      });
  });
  meetsData.special_meets.forEach((meet, index) => {
    const label = `Special meet ${index + 1}`;
    validateSeasonDate(errors, `${label} date`, meet.date, season);
    if (!hasRecognizedPoolLocation(meet.location, poolNames)) {
      errors.push(`${label} references an unknown pool location: ${meet.location}.`);
    }
  });

  return errors;
}

function safeDataPath(dataRoot, localPath) {
  const normalized = path.posix.normalize(localPath);
  if (normalized.startsWith('../') || path.posix.isAbsolute(normalized)) {
    throw new Error(`Unsafe annual data document path: ${localPath}`);
  }
  return path.join(dataRoot, ...normalized.split('/'));
}

function localPdfPathFromUrl(domain, folder, url) {
  try {
    const filename = decodeURIComponent(path.posix.basename(new URL(url).pathname));
    return `${domain}/${folder}/${filename}`;
  } catch (_error) {
    return null;
  }
}

/**
 * Recursively list retained PDF paths beneath an annual data root.
 * @param {string} rootPath - Annual data root
 * @param {string} relativePath - Relative folder to inspect
 * @returns {Promise<string[]>} POSIX-style retained PDF paths
 */
async function listPdfPaths(rootPath, relativePath = '') {
  let entries;
  try {
    entries = await fs.readdir(path.join(rootPath, ...relativePath.split('/').filter(Boolean)), { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
  const paths = await Promise.all(entries.map(async (entry) => {
    const childPath = [relativePath, entry.name].filter(Boolean).join('/');
    if (entry.isDirectory()) return listPdfPaths(rootPath, childPath);
    return entry.isFile() && entry.name.toLowerCase().endsWith('.pdf') ? [childPath] : [];
  }));
  return paths.flat();
}

async function validateRetainedDocuments({ annualReadme, dataRoot, meetsData, poolsData }) {
  const errors = [];
  const documentedSources = parseReadmePdfSources(annualReadme);
  const documentedPaths = new Set(documentedSources.map((source) => source.localPath));
  documentedSources.forEach((source) => {
    validateHttpsUrl(errors, `Annual README source URL for ${source.localPath}`, source.url);
  });
  let latestPoolPaths = new Map();
  try {
    latestPoolPaths = await resolveLatestPoolSchedulePaths(dataRoot, poolsData.pools);
  } catch (error) {
    errors.push(error.message);
  }
  const requiredPaths = [...latestPoolPaths.values()];
  const meetPdfPath = localPdfPathFromUrl('meets', 'meet-schedules', meetsData.url);
  if (meetPdfPath) {
    requiredPaths.push(meetPdfPath);
    if (!documentedPaths.has(meetPdfPath)) {
      errors.push(`Annual README does not document retained meet source PDF: ${meetPdfPath}.`);
    }
  }

  const expectedPoolFiles = new Map(poolsData.pools.map((pool) => [
    pool.id,
    decodeURIComponent(path.posix.basename(new URL(pool.scheduleUrl).pathname))
  ]));
  const sourceFolders = [
    ['pools', 'pool-schedules'],
    ['meets', 'meet-schedules'],
    ['teams', 'team-schedules']
  ];
  const storedPaths = [];
  await Promise.all(sourceFolders.map(async ([domain, folder]) => {
    const paths = await listPdfPaths(dataRoot, `${domain}/${folder}`);
    storedPaths.push(...paths);
  }));
  const retainedPoolPaths = storedPaths.filter((localPath) => localPath.startsWith('pools/pool-schedules/'));
  const validPoolPaths = retainedPoolPaths.filter((localPath) => {
    const parts = localPath.split('/');
    const [, , poolId, downloadedOn, filename] = parts;
    const expectedFilename = expectedPoolFiles.get(poolId);
    const isValid = parts.length === 5
      && isValidArtifactDate(downloadedOn)
      && expectedFilename === filename;
    if (!isValid) {
      errors.push(`Retained pool schedule must use pool-schedules/<pool-id>/<YYYY-MM-DD>/<official-filename>: ${localPath}.`);
    }
    return isValid;
  });
  const allPaths = [...new Set([...requiredPaths, ...documentedPaths, ...validPoolPaths])];
  storedPaths.forEach((localPath) => {
    if (!allPaths.includes(localPath)) {
      errors.push(`Retained official document is not referenced by active data or its annual README: ${localPath}.`);
    }
  });

  await Promise.all(allPaths.map(async (localPath) => {
    try {
      const content = await fs.readFile(safeDataPath(dataRoot, localPath));
      if (content.subarray(0, 5).toString('ascii') !== '%PDF-') {
        errors.push(`Retained official document is not a PDF: ${localPath}.`);
      }
    } catch (error) {
      if (error.code === 'ENOENT') {
        errors.push(`Retained official document is missing: ${localPath}.`);
        return;
      }
      errors.push(`Could not inspect retained official document ${localPath}: ${error.message}.`);
    }
  }));

  return { documentedCount: documentedPaths.size, errors, retainedCount: allPaths.length };
}

async function validateActiveSeason({ repositoryRoot = REPOSITORY_ROOT } = {}) {
  const season = await readActiveYear(repositoryRoot);
  const dataRoot = path.join(repositoryRoot, 'src', 'assets', 'data', String(season));
  const annualReadme = await fs.readFile(path.join(dataRoot, 'README.md'), 'utf8');
  const domainEntries = await Promise.all(DOMAINS.map(async (domain) => {
    const domainRoot = path.join(dataRoot, domain);
    const [data, schema] = await Promise.all([
      readJson(path.join(domainRoot, `${domain}.json`)),
      readJson(path.join(domainRoot, `${domain}.schema.json`))
    ]);
    return [domain, { data, schema }];
  }));
  const domains = Object.fromEntries(domainEntries);
  const errors = DOMAINS.flatMap((domain) => validateSchema(domain, domains[domain].data, domains[domain].schema));
  let retainedDocuments = { retainedCount: 0 };
  if (errors.length === 0) {
    errors.push(...collectIntegrityErrors({
      meetsData: domains.meets.data,
      poolsData: domains.pools.data,
      season,
      teamsData: domains.teams.data
    }));
    retainedDocuments = await validateRetainedDocuments({
      annualReadme,
      dataRoot,
      meetsData: domains.meets.data,
      poolsData: domains.pools.data
    });
    errors.push(...retainedDocuments.errors);
  }

  return {
    counts: {
      pools: domains.pools.data.pools.length,
      regularMeets: domains.meets.data.regular_meets.length,
      retainedDocuments: retainedDocuments.retainedCount,
      specialMeets: domains.meets.data.special_meets.length,
      teams: domains.teams.data.teams.length
    },
    errors,
    season
  };
}

async function main() {
  const result = await validateActiveSeason();
  if (result.errors.length > 0) {
    console.error(`Active ${result.season} season data validation failed with ${result.errors.length} issue(s):`);
    result.errors.forEach((error) => console.error(`- ${error}`));
    process.exitCode = 1;
    return;
  }

  console.log(
    `Validated active ${result.season} season data: ${result.counts.pools} pools, ` +
    `${result.counts.teams} teams, ${result.counts.regularMeets} regular meets, ` +
    `${result.counts.specialMeets} special meets, and ${result.counts.retainedDocuments} retained official PDFs.`
  );
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  collectIntegrityErrors,
  validateActiveSeason,
  validateRetainedDocuments,
  validateSchema
};
