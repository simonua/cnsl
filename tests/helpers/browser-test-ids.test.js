const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const acorn = require('acorn');
const fs = require('node:fs');
const path = require('node:path');

const BROWSER_TEST_ROOT = path.join(__dirname, '..', 'browser');
const REFERENCE_ID_PATTERN = /\[(?:AX|WF)-[^\]]+\]/g;
const FORBIDDEN_SOURCE_PATTERNS = Object.freeze([{
  explanation: 'Use semantic readiness such as aria-busy="false" instead of mutable success copy.',
  pattern: /(?:Pool directory|Team directory|Meet schedule|Meet-day details) loaded\./g
}, {
  explanation: 'Wait for an observable state transition instead of a fixed delay.',
  pattern: /\.waitForTimeout\s*\(/g
}]);

function collectSpecFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectSpecFiles(entryPath);
    return entry.name.endsWith('.spec.js') ? [entryPath] : [];
  });
}

function collectAnnualDiscoveryViolations(source, filePath) {
  const syntaxTree = acorn.parse(source, { ecmaVersion: 'latest', locations: true, sourceType: 'script' });
  const annualBindings = new Set();

  for (const statement of syntaxTree.body) {
    if (statement.type !== 'VariableDeclaration') continue;
    for (const declaration of statement.declarations) {
      if (
        declaration.init?.type !== 'CallExpression'
        || declaration.init.callee?.type !== 'Identifier'
        || declaration.init.callee.name !== 'readAnnualData'
      ) continue;

      if (declaration.id.type === 'Identifier') annualBindings.add(declaration.id.name);
      if (declaration.id.type === 'ObjectPattern') {
        declaration.id.properties.forEach(property => {
          if (property.value?.type === 'Identifier') annualBindings.add(property.value.name);
        });
      }
    }
  }

  function hasAnnualRoot(node) {
    if (!node) return false;
    if (node.type === 'Identifier') return annualBindings.has(node.name);
    if (node.type === 'MemberExpression') return hasAnnualRoot(node.object);
    return node.type === 'CallExpression'
      && node.callee?.type === 'Identifier'
      && node.callee.name === 'readAnnualData';
  }

  const violations = [];
  function visit(node) {
    if (!node || typeof node !== 'object') return;
    if (
      node.type === 'CallExpression'
      && node.callee?.type === 'MemberExpression'
      && node.callee.computed === false
      && node.callee.property?.name === 'find'
      && hasAnnualRoot(node.callee.object)
    ) {
      violations.push({
        column: node.loc.start.column + 1,
        explanation: 'Use a fixture-owned identity instead of discovering a behavior scenario from active annual data.',
        filePath,
        line: node.loc.start.line
      });
    }

    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === 'object' && value.type) visit(value);
    }
  }
  visit(syntaxTree);
  return violations;
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

describe('browser test source contracts', () => {
  it('uses semantic readiness and observable waits', () => {
    const violations = collectSpecFiles(BROWSER_TEST_ROOT).flatMap(filePath => {
      const source = fs.readFileSync(filePath, 'utf8');
      return FORBIDDEN_SOURCE_PATTERNS.flatMap(({ explanation, pattern }) => (
        [...source.matchAll(pattern)].map(match => ({
          column: match.index - source.lastIndexOf('\n', match.index),
          explanation,
          filePath: path.relative(BROWSER_TEST_ROOT, filePath),
          line: source.slice(0, match.index).split('\n').length
        }))
      ));
    });

    assert.deepEqual(violations, []);
  });

  it('does not discover behavior scenarios from active annual records', () => {
    const violations = collectSpecFiles(BROWSER_TEST_ROOT).flatMap(filePath => {
      const source = fs.readFileSync(filePath, 'utf8');
      return collectAnnualDiscoveryViolations(source, path.relative(BROWSER_TEST_ROOT, filePath));
    });

    assert.deepEqual(violations, []);
  });
});
