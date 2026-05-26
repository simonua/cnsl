const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { findUnexpectedChanges, parseChangedFiles } = require('../../scripts/validate-refactoring-audit-boundary');

describe('refactoring audit boundary', () => {
  describe('parseChangedFiles', () => {
    it('should parse Git name-status output for validation', () => {
      assert.deepEqual(parseChangedFiles('M\tdocs/refactoring-plan.md\nA\tsrc/js/new-feature.js\n'), [
        { line: 'M\tdocs/refactoring-plan.md', paths: ['docs/refactoring-plan.md'], status: 'M' },
        { line: 'A\tsrc/js/new-feature.js', paths: ['src/js/new-feature.js'], status: 'A' }
      ]);
    });
  });

  describe('findUnexpectedChanges', () => {
    it('should allow only a modification to the existing refactoring plan', () => {
      assert.deepEqual(findUnexpectedChanges(parseChangedFiles('M\tdocs/refactoring-plan.md\n')), []);
    });

    it('should reject extra files, plan deletion, and plan renames', () => {
      assert.deepEqual(findUnexpectedChanges(parseChangedFiles([
        'M\tdocs/refactoring-plan.md',
        'A\tsrc/js/new-feature.js',
        'D\tdocs/refactoring-plan.md',
        'R100\tdocs/refactoring-plan.md\tdocs/retired-plan.md'
      ].join('\n'))), [
        'A\tsrc/js/new-feature.js',
        'D\tdocs/refactoring-plan.md',
        'R100\tdocs/refactoring-plan.md\tdocs/retired-plan.md'
      ]);
    });

    it('should reject an empty diff', () => {
      assert.deepEqual(findUnexpectedChanges([]), ['No refactoring plan modification was found.']);
    });
  });
});
