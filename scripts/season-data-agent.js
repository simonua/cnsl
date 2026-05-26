'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');

const REPOSITORY_ROOT = path.resolve(__dirname, '..');
const USER_AGENT = 'CNSL-season-data-agent/1.0 (+https://github.com/simonua/cnsl)';
const REQUEST_TIMEOUT_MS = 30000;
const FETCH_CONCURRENCY = 6;

function sha256(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function normalizeHtml(content) {
  const visibleText = content
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();

  return visibleText || content.replace(/\s+/g, ' ').trim();
}

function normalizePageContent(content, fingerprint = 'visible-text') {
  if (fingerprint !== 'outdoor-pool-schedules') {
    return normalizeHtml(content);
  }

  const sectionMatch = content.match(/Outdoor Pools Schedule[\s\S]*?Indoor Pools Schedule/i);
  if (!sectionMatch) {
    return normalizeHtml(content);
  }

  const section = sectionMatch[0];
  const links = [...section.matchAll(/\bhref\s*=\s*["']([^"']+)["']/gi)]
    .map((match) => match[1].trim())
    .sort();

  return `${normalizeHtml(section)} ${[...new Set(links)].join(' ')}`.trim();
}

function parseReadmePdfSources(markdown) {
  const sources = [];
  const sourcePattern = /\[[^\]]+\]\((https?:\/\/[^)\s]+\.pdf)\)\s*\|\s*`([^`]+\.pdf)`/gi;
  let match = sourcePattern.exec(markdown);

  while (match) {
    const localPath = match[2].replace(/\\/g, '/');
    const domain = localPath.split('/')[0];
    if (['pools', 'meets', 'teams'].includes(domain)) {
      sources.push({
        domain,
        label: path.posix.basename(localPath),
        localPath,
        url: match[1]
      });
    }
    match = sourcePattern.exec(markdown);
  }

  return sources;
}

function addDocument(documentMap, document) {
  const existing = documentMap.get(document.url);
  if (!existing) {
    documentMap.set(document.url, document);
    return;
  }

  if (document.localPath && !existing.localPath) {
    existing.localPath = document.localPath;
  }
}

function addPage(pageMap, url, label, domain, fingerprint = 'visible-text') {
  if (!url) {
    return;
  }

  const existing = pageMap.get(url);
  if (existing) {
    if (!existing.domains.includes(domain)) {
      existing.domains.push(domain);
      existing.domains.sort();
    }
    return;
  }

  pageMap.set(url, { domains: [domain], fingerprint, label, url });
}

function collectSources({ annualReadme, meetsData, poolsData, teamsData }) {
  const documentMap = new Map();
  const pageMap = new Map();

  parseReadmePdfSources(annualReadme).forEach((document) => addDocument(documentMap, document));

  poolsData.pools.forEach((pool) => {
    const filename = decodeURIComponent(path.posix.basename(new URL(pool.scheduleUrl).pathname));
    addDocument(documentMap, {
      domain: 'pools',
      label: `${pool.name} pool schedule`,
      localPath: `pools/pool-schedules/${filename}`,
      url: pool.scheduleUrl
    });
    addPage(pageMap, pool.caUrl, `${pool.name} facility page`, 'pools');
  });

  addPage(pageMap, poolsData.caPoolGuideUrl, 'Columbia Association pool schedule page', 'pools', 'outdoor-pool-schedules');
  addPage(pageMap, poolsData.caPoolDirectoryUrl, 'Columbia Association pool directory', 'pools');

  const meetFilename = decodeURIComponent(path.posix.basename(new URL(meetsData.url).pathname));
  addDocument(documentMap, {
    domain: 'meets',
    label: 'CNSL meet schedule',
    localPath: `meets/meet-schedules/${meetFilename}`,
    url: meetsData.url
  });

  teamsData.teams.forEach((team) => {
    addPage(pageMap, team.url, `${team.name} home page`, 'teams');
    if (team.staff && team.staff.sourceUrl) {
      addPage(pageMap, team.staff.sourceUrl, `${team.name} staff page`, 'teams');
    }
    if (team.practice && team.practice.url) {
      addPage(pageMap, team.practice.url, `${team.name} practice schedule page`, 'teams');
    }
  });

  const leagueHomeMatch = annualReadme.match(/\[CNSL home page\]\((https?:\/\/[^)]+)\)/i);
  if (leagueHomeMatch) {
    addPage(pageMap, leagueHomeMatch[1], 'CNSL publication page', 'meets');
    addPage(pageMap, leagueHomeMatch[1], 'CNSL publication page', 'teams');
  }

  return {
    documents: [...documentMap.values()].sort((left, right) => left.url.localeCompare(right.url)),
    pages: [...pageMap.values()].sort((left, right) => left.url.localeCompare(right.url))
  };
}

function isDateWithinSeason(date, poolsData) {
  return date >= poolsData.seasonStartDate && date <= poolsData.seasonEndDate;
}

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

async function readState(statePath) {
  try {
    return await readJson(statePath);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

async function request(url, fetchImplementation) {
  const response = await fetchImplementation(url, {
    headers: {
      Accept: '*/*',
      'User-Agent': USER_AGENT
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });

  if (!response.ok) {
    throw new Error(`Official source returned HTTP ${response.status}: ${url}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

async function mapWithLimit(items, limit, callback) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await callback(items[index]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

function safeDataPath(dataRoot, localPath) {
  const normalized = path.posix.normalize(localPath);
  if (normalized.startsWith('../') || path.posix.isAbsolute(normalized)) {
    throw new Error(`Unsafe annual data document path: ${localPath}`);
  }
  return path.join(dataRoot, ...normalized.split('/'));
}

function createState(season, observations, acceptedOn) {
  return {
    season,
    acceptedOn,
    pages: observations.map(({ domains, label, sha256: checksum, url }) => ({
      domains,
      label,
      sha256: checksum,
      url
    }))
  };
}

function formatReport({ changes, checkedOn, season }) {
  const affectedDomains = [...new Set(changes.flatMap((change) => change.domains || [change.domain]))].sort();
  const rows = changes.map((change) => {
    const domains = (change.domains || [change.domain]).join(', ');
    const evidence = change.localPath
      ? `src/assets/data/${season}/${change.localPath}`
      : '.github/data-agent/source-state.json';
    return `| ${domains} | [${change.label}](${change.url}) | ${change.kind} | \`${evidence}\` |`;
  });
  const guidance = {
    meets: `- [ ] Review the official meet schedule evidence and update \`src/assets/data/${season}/meets/meets.json\` if dates, locations, or matchups changed.`,
    pools: `- [ ] Review pool schedules, directory entries, and facility amenities; update \`src/assets/data/${season}/pools/pools.json\` if published values changed.`,
    teams: `- [ ] Review practice assignments and public team, staff, and practice-schedule pages; update \`src/assets/data/${season}/teams/teams.json\` if supported fields changed.`
  };

  return [
    '# Seasonal Source Update Detected',
    '',
    `Checked official public sources for active season \`${season}\` on ${checkedOn}.`,
    '',
    'This pull request records changed official evidence. Source documents are refreshed automatically; JSON remains subject to review and transcription against the repository schemas.',
    '',
    '## Detected Changes',
    '',
    '| Domain | Source | Change | Evidence in this PR |',
    '| --- | --- | --- | --- |',
    ...rows,
    '',
    '## Data Review Checklist',
    '',
    ...affectedDomains.map((domain) => guidance[domain]),
    `- [ ] After accepting reviewed application data, update \`OFFICIAL_SOURCE_CHECKED_ON\` in \`src/js/config/app-config.js\` and record the same accepted source-check date in \`src/assets/data/${season}/README.md\` so the FAQ reports data currency.`,
    '- [ ] Run `pnpm run validate:data`, `pnpm test`, `pnpm run lint`, and `pnpm run build` after completing any transcription.',
    '',
    'The nightly monitor pauses while this pull request is open so reviewer changes on this branch are not replaced by automation.',
    ''
  ].join('\n');
}

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

async function monitorSources({
  apply = false,
  fetchImplementation = fetch,
  initialize = false,
  repositoryRoot = REPOSITORY_ROOT,
  seasonOnly = false,
  today = new Date().toISOString().slice(0, 10)
} = {}) {
  const season = await readActiveYear(repositoryRoot);
  const dataRoot = path.join(repositoryRoot, 'src', 'assets', 'data', String(season));
  const statePath = path.join(repositoryRoot, '.github', 'data-agent', 'source-state.json');
  const reportPath = path.join(repositoryRoot, '.github', 'data-agent', 'update-report.md');
  const [annualReadme, meetsData, poolsData, teamsData] = await Promise.all([
    fs.readFile(path.join(dataRoot, 'README.md'), 'utf8'),
    readJson(path.join(dataRoot, 'meets', 'meets.json')),
    readJson(path.join(dataRoot, 'pools', 'pools.json')),
    readJson(path.join(dataRoot, 'teams', 'teams.json'))
  ]);

  if (seasonOnly && !isDateWithinSeason(today, poolsData)) {
    return { changed: false, season, skipped: true, today };
  }

  const state = await readState(statePath);
  if (!initialize && !state) {
    throw new Error('No source fingerprint baseline exists. Run node scripts/season-data-agent.js --initialize once for the active season.');
  }
  if (!initialize && state.season !== season) {
    throw new Error(`The source fingerprint baseline is for ${state.season}, but active season is ${season}. Reinitialize it after season rollover review.`);
  }

  const sources = collectSources({ annualReadme, meetsData, poolsData, teamsData });
  async function observePage(source) {
    const content = await request(source.url, fetchImplementation);
    return { ...source, sha256: sha256(normalizePageContent(content.toString('utf8'), source.fingerprint)) };
  }

  const pageObservations = await mapWithLimit(sources.pages, FETCH_CONCURRENCY, observePage);
  const documentObservations = await mapWithLimit(sources.documents, FETCH_CONCURRENCY, async (source) => {
    const localFile = safeDataPath(dataRoot, source.localPath);
    const remoteContent = await request(source.url, fetchImplementation);
    if (remoteContent.subarray(0, 5).toString('ascii') !== '%PDF-') {
      throw new Error(`Official PDF source returned non-PDF content: ${source.url}`);
    }

    let existingContent;
    try {
      existingContent = await fs.readFile(localFile);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
      existingContent = null;
    }
    return {
      ...source,
      changed: !existingContent || sha256(existingContent) !== sha256(remoteContent),
      localFile,
      remoteContent
    };
  });

  const documentChanges = documentObservations
    .filter((observation) => observation.changed)
    .map((observation) => ({ ...observation, kind: 'Official document content changed' }));

  if (initialize) {
    if (documentChanges.length > 0) {
      throw new Error('Stored official documents no longer match their public URLs. Run the monitor with --update and review the resulting changes before establishing a baseline.');
    }
    const verificationObservations = await mapWithLimit(sources.pages, FETCH_CONCURRENCY, observePage);
    const unstablePages = pageObservations.filter((observation, index) => {
      return observation.sha256 !== verificationObservations[index].sha256;
    });
    if (unstablePages.length > 0) {
      throw new Error(`Public page fingerprints were not stable across two requests: ${unstablePages.map((page) => page.url).join(', ')}`);
    }
    await writeJson(statePath, createState(season, pageObservations, today));
    return { changed: false, initialized: true, pages: pageObservations.length, season, today };
  }

  const previousPages = new Map(state.pages.map((page) => [page.url, page]));
  const pageCandidates = pageObservations.filter((observation) => {
    const previous = previousPages.get(observation.url);
    return !previous || previous.sha256 !== observation.sha256;
  });
  const pageConfirmations = await mapWithLimit(pageCandidates, FETCH_CONCURRENCY, observePage);
  const confirmedByUrl = new Map(pageConfirmations.map((observation) => [observation.url, observation]));
  const unstablePageUrls = new Set(pageCandidates
    .filter((observation) => confirmedByUrl.get(observation.url).sha256 !== observation.sha256)
    .map((observation) => observation.url));
  if (unstablePageUrls.size > 0) {
    console.log(`Ignored ${unstablePageUrls.size} transient public-page response difference(s).`);
  }
  const pageChanges = pageCandidates
    .filter((observation) => !unstablePageUrls.has(observation.url))
    .map((observation) => ({
      ...observation,
      kind: previousPages.has(observation.url) ? 'Public page content changed' : 'New monitored page source'
    }));
  const currentPageUrls = new Set(pageObservations.map((observation) => observation.url));
  state.pages
    .filter((page) => !currentPageUrls.has(page.url))
    .forEach((page) => pageChanges.push({ ...page, kind: 'Page source no longer referenced' }));

  const changes = [...documentChanges, ...pageChanges];
  if (apply && changes.length > 0) {
    await Promise.all(documentChanges.map(async (change) => {
      await fs.mkdir(path.dirname(change.localFile), { recursive: true });
      await fs.writeFile(change.localFile, change.remoteContent);
    }));
    if (pageChanges.length > 0) {
      const acceptedPageObservations = pageObservations
        .filter((observation) => !unstablePageUrls.has(observation.url) || previousPages.has(observation.url))
        .map((observation) => unstablePageUrls.has(observation.url) ? previousPages.get(observation.url) : observation);
      await writeJson(statePath, createState(season, acceptedPageObservations, today));
    }
    await fs.mkdir(path.dirname(reportPath), { recursive: true });
    await fs.writeFile(reportPath, formatReport({ changes, checkedOn: today, season }));
  }

  return { changed: changes.length > 0, changes, season, today };
}

function parseArguments(argumentsList) {
  const options = { apply: false, initialize: false, seasonOnly: false };
  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    if (argument === '--update') {
      options.apply = true;
    } else if (argument === '--initialize') {
      options.initialize = true;
    } else if (argument === '--season-only') {
      options.seasonOnly = true;
    } else if (argument === '--date' && argumentsList[index + 1]) {
      options.today = argumentsList[index + 1];
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }
  return options;
}

async function writeActionOutputs(result) {
  if (!process.env.GITHUB_OUTPUT) {
    return;
  }
  const output = [
    `changed=${result.changed ? 'true' : 'false'}`,
    `season=${result.season}`,
    `skipped=${result.skipped ? 'true' : 'false'}`
  ].join('\n');
  await fs.appendFile(process.env.GITHUB_OUTPUT, `${output}\n`);
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const result = await monitorSources(options);
  await writeActionOutputs(result);

  if (result.initialized) {
    console.log(`Initialized ${result.pages} public-page fingerprints for the ${result.season} season.`);
  } else if (result.skipped) {
    console.log(`The ${result.season} season is not active on ${result.today}; no public sources were checked.`);
  } else if (result.changed) {
    console.log(`Detected ${result.changes.length} changed official source(s) for the ${result.season} season.`);
    result.changes.forEach((change) => {
      console.log(`- ${change.kind}: ${change.url}`);
    });
  } else {
    console.log(`No official source changes detected for the ${result.season} season.`);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  collectSources,
  formatReport,
  isDateWithinSeason,
  monitorSources,
  normalizeHtml,
  normalizePageContent,
  parseReadmePdfSources,
  sha256
};
