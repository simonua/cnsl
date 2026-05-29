'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');
const { parseReadmePdfSources } = require('./season-data-agent');
const { TeamScheduleService } = require('../src/js/services/team-schedule-service');

const DOMAINS = Object.freeze(['pools', 'meets', 'teams']);
const REPOSITORY_ROOT = path.resolve(__dirname, '..');

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
    validateHttpsUrl(errors, `${pool.name} CA source URL`, pool.caUrl);
    validateHttpsUrl(errors, `${pool.name} schedule URL`, pool.scheduleUrl);
    validateHttpsUrl(errors, `${pool.name} Google Maps URL`, pool.location && pool.location.googleMapsUrl);
    [...pool.schedules, ...(pool.scheduleOverrides || [])].forEach((schedule, index) => {
      const label = `${pool.name} schedule entry ${index + 1}`;
      validateSeasonDate(errors, `${label} start date`, schedule.startDate, season);
      validateSeasonDate(errors, `${label} end date`, schedule.endDate, season);
      validateDateRange(errors, label, schedule.startDate, schedule.endDate);
    });
  });

  teams.forEach((team) => {
    validateHttpsUrl(errors, `${team.name} public URL`, team.url);
    if (team.resultsUrl) {
      validateHttpsUrl(errors, `${team.name} results URL`, team.resultsUrl);
    }
    if (team.calendarUrl) {
      validateHttpsUrl(errors, `${team.name} calendar URL`, team.calendarUrl);
    }
    if (team.booster && team.booster.url) {
      validateHttpsUrl(errors, `${team.name} booster URL`, team.booster.url);
    }
    validateHttpsUrl(errors, `${team.name} staff source URL`, team.staff.sourceUrl);
    if (team.practice && team.practice.url) {
      validateHttpsUrl(errors, `${team.name} practice URL`, team.practice.url);
    }
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
    [...team.homePools, ...team.practicePools, team.timeTrialsPool].filter(Boolean).forEach((poolName) => {
      if (!poolNames.has(poolName)) {
        errors.push(`${team.name} references unknown pool: ${poolName}.`);
      }
    });
  });

  validateHttpsUrl(errors, 'Meet source URL', meetsData.url);
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

async function validateRetainedDocuments({ annualReadme, dataRoot, meetsData, poolsData }) {
  const errors = [];
  const documentedSources = parseReadmePdfSources(annualReadme);
  const documentedPaths = new Set(documentedSources.map((source) => source.localPath));
  documentedSources.forEach((source) => {
    validateHttpsUrl(errors, `Annual README source URL for ${source.localPath}`, source.url);
  });
  const requiredPaths = poolsData.pools
    .map((pool) => localPdfPathFromUrl('pools', 'pool-schedules', pool.scheduleUrl))
    .filter(Boolean);
  const meetPdfPath = localPdfPathFromUrl('meets', 'meet-schedules', meetsData.url);
  if (meetPdfPath) {
    requiredPaths.push(meetPdfPath);
    if (!documentedPaths.has(meetPdfPath)) {
      errors.push(`Annual README does not document retained meet source PDF: ${meetPdfPath}.`);
    }
  }

  const allPaths = [...new Set([...requiredPaths, ...documentedPaths])];
  const sourceFolders = [
    ['pools', 'pool-schedules'],
    ['meets', 'meet-schedules'],
    ['teams', 'team-schedules']
  ];
  const storedPaths = [];
  await Promise.all(sourceFolders.map(async ([domain, folder]) => {
    try {
      const entries = await fs.readdir(path.join(dataRoot, domain, folder), { withFileTypes: true });
      entries
        .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.pdf'))
        .forEach((entry) => storedPaths.push(`${domain}/${folder}/${entry.name}`));
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }));
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
