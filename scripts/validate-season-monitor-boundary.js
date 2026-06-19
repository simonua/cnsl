'use strict';

const fs = require('node:fs');

function assertValidSeason(season) {
  if (!/^\d{4}$/.test(season)) {
    throw new Error(`Invalid season output: ${season}`);
  }
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isAllowedEvidencePath(documentPath, season) {
  assertValidSeason(season);
  const safeSeason = escapeRegExp(season);
  const poolEvidence = new RegExp(`^src/assets/data/${safeSeason}/pools/pool-schedules/[a-z0-9_-]+/(\\d{4}-\\d{2}-\\d{2})/[^/]+\\.pdf$`);
  const otherEvidence = new RegExp(`^src/assets/data/${safeSeason}/(meets/meet-schedules|teams/team-schedules)/[^/]+\\.pdf$`);
  const poolMatch = documentPath.match(poolEvidence);
  if (poolMatch) {
    const date = new Date(`${poolMatch[1]}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === poolMatch[1];
  }
  return otherEvidence.test(documentPath);
}

function isAllowedBaselinePath(documentPath) {
  return documentPath === '.github/automation/season-data-monitor/source-state.json';
}

function findUnexpectedChanges(documentPaths, season, mode = 'evidence') {
  assertValidSeason(season);
  const isAllowedPath = mode === 'baseline'
    ? isAllowedBaselinePath
    : (documentPath) => isAllowedEvidencePath(documentPath, season);
  if (!['baseline', 'evidence'].includes(mode)) {
    throw new Error(`Invalid season monitor boundary mode: ${mode}`);
  }
  return documentPaths.filter(documentPath => documentPath && !isAllowedPath(documentPath));
}

function main() {
  const season = process.argv[2] || '';
  const mode = process.argv[3] || 'evidence';
  const documentPaths = fs.readFileSync(0, 'utf8').split(/\r?\n/).filter(Boolean);
  let unexpectedChanges;

  try {
    unexpectedChanges = findUnexpectedChanges(documentPaths, season, mode);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
    return;
  }

  if (unexpectedChanges.length > 0) {
    console.error('The seasonal monitor modified paths outside its permitted automation boundary:');
    unexpectedChanges.forEach(documentPath => console.error(documentPath));
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

module.exports = { findUnexpectedChanges, isAllowedBaselinePath, isAllowedEvidencePath };
