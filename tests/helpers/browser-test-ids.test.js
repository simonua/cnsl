const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const BROWSER_TEST_ROOT = path.join(__dirname, '..', 'browser');
const REFERENCE_ID_PATTERN = /\[(?:AX|WF)-[^\]]+\]/g;

function collectSpecFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectSpecFiles(entryPath);
    return entry.name.endsWith('.spec.js') ? [entryPath] : [];
  });
}

describe('browser test reference IDs', () => {
  it('keeps every workflow and accessibility reference unique', () => {
    const references = collectSpecFiles(BROWSER_TEST_ROOT).flatMap(filePath => {
      const source = fs.readFileSync(filePath, 'utf8');
      return [...source.matchAll(REFERENCE_ID_PATTERN)].map(match => ({
        filePath: path.relative(BROWSER_TEST_ROOT, filePath),
        reference: match[0]
      }));
    });
    const duplicateReferences = references.filter((reference, index) => (
      references.findIndex(candidate => candidate.reference === reference.reference) !== index
    ));

    assert.deepEqual(duplicateReferences, []);
  });
});
