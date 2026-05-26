'use strict';

const fs = require('node:fs');

const REFACTORING_PLAN_PATH = 'docs/refactoring-plan.md';

function parseChangedFiles(input) {
  return input
    .split(/\r?\n/)
    .filter(Boolean)
    .map(line => {
      const [status, ...paths] = line.split('\t');
      return { line, paths, status };
    });
}

function findUnexpectedChanges(changes) {
  if (changes.length === 0) {
    return ['No refactoring plan modification was found.'];
  }

  return changes
    .filter(change => change.status !== 'M' || change.paths.length !== 1 || change.paths[0] !== REFACTORING_PLAN_PATH)
    .map(change => change.line);
}

function main() {
  const changes = parseChangedFiles(fs.readFileSync(0, 'utf8'));
  const unexpectedChanges = findUnexpectedChanges(changes);

  if (unexpectedChanges.length > 0) {
    console.error('Pull requests that update the refactoring plan may modify docs/refactoring-plan.md only:');
    unexpectedChanges.forEach(change => console.error(change));
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

module.exports = { findUnexpectedChanges, parseChangedFiles };
