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
  return new RegExp(`^src/assets/data/${safeSeason}/(pools/pool-schedules|meets/meet-schedules|teams/team-schedules)/[^/]+\\.pdf$`).test(documentPath);
}

function findUnexpectedChanges(documentPaths, season) {
  assertValidSeason(season);
  return documentPaths.filter(documentPath => documentPath && !isAllowedEvidencePath(documentPath, season));
}

function main() {
  const season = process.argv[2] || '';
  const documentPaths = fs.readFileSync(0, 'utf8').split(/\r?\n/).filter(Boolean);
  let unexpectedChanges;

  try {
    unexpectedChanges = findUnexpectedChanges(documentPaths, season);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
    return;
  }

  if (unexpectedChanges.length > 0) {
    console.error('The seasonal monitor modified protected annual structured material:');
    unexpectedChanges.forEach(documentPath => console.error(documentPath));
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

module.exports = { findUnexpectedChanges, isAllowedEvidencePath };
