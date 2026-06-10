const fs = require('node:fs');
const path = require('node:path');
const { parse } = require('acorn');

const FORBIDDEN_IDENTIFIERS = Object.freeze(new Map([
  ['__dirname', 'Node.js path global'],
  ['__filename', 'Node.js path global'],
  ['exports', 'CommonJS export'],
  ['module', 'CommonJS module global'],
  ['process', 'Node.js process global'],
  ['require', 'CommonJS import']
]));

function walk(node, visit, parent = null) {
  if (!node || typeof node.type !== 'string') return;
  visit(node, parent);
  Object.values(node).forEach(value => {
    if (Array.isArray(value)) {
      value.forEach(child => walk(child, visit, node));
    } else if (value && typeof value.type === 'string') {
      walk(value, visit, node);
    }
  });
}

function isNonReferenceIdentifier(node, parent) {
  return parent && (
    (parent.type === 'Property' && parent.key === node && !parent.computed)
    || (parent.type === 'MethodDefinition' && parent.key === node && !parent.computed)
    || (parent.type === 'MemberExpression' && parent.property === node && !parent.computed)
    || (parent.type === 'LabeledStatement' && parent.label === node)
  );
}

function isNodeEnvironmentGuard(node) {
  return node.type === 'UnaryExpression'
    && node.operator === 'typeof'
    && node.argument.type === 'Identifier'
    && ['module', 'process', 'require', 'window'].includes(node.argument.name);
}

function assertBrowserOnly(source, relativePath) {
  const tree = parse(source, { ecmaVersion: 2023, sourceType: 'script' });
  const violations = new Set();

  walk(tree, (node, parent) => {
    if (isNodeEnvironmentGuard(node)) violations.add('Node-only environment guard');
    if (node.type !== 'Identifier' || isNonReferenceIdentifier(node, parent)) return;
    const violation = FORBIDDEN_IDENTIFIERS.get(node.name);
    if (violation) violations.add(violation);
  });

  if (violations.size > 0) {
    throw new Error(`${relativePath} contains production-forbidden Node.js code: ${[...violations].join(', ')}`);
  }
}

function validateBrowserJavaScript(sourceDirectory, baseDirectory = sourceDirectory) {
  fs.readdirSync(sourceDirectory, { withFileTypes: true }).forEach(entry => {
    const sourcePath = path.join(sourceDirectory, entry.name);
    if (entry.isDirectory()) {
      validateBrowserJavaScript(sourcePath, baseDirectory);
      return;
    }
    if (path.extname(entry.name) !== '.js') return;

    const relativePath = path.relative(baseDirectory, sourcePath).replace(/\\/g, '/');
    assertBrowserOnly(fs.readFileSync(sourcePath, 'utf8'), relativePath);
  });
}

function copyBrowserJavaScript(sourceDirectory, destinationDirectory, baseDirectory = sourceDirectory) {
  fs.mkdirSync(destinationDirectory, { recursive: true });
  fs.readdirSync(sourceDirectory, { withFileTypes: true }).forEach(entry => {
    const sourcePath = path.join(sourceDirectory, entry.name);
    const destinationPath = path.join(destinationDirectory, entry.name);
    if (entry.isDirectory()) {
      copyBrowserJavaScript(sourcePath, destinationPath, baseDirectory);
      return;
    }

    const relativePath = path.relative(baseDirectory, sourcePath).replace(/\\/g, '/');
    if (path.extname(entry.name) === '.js') {
      assertBrowserOnly(fs.readFileSync(sourcePath, 'utf8'), relativePath);
    }
    fs.copyFileSync(sourcePath, destinationPath);
  });
}

module.exports = {
  assertBrowserOnly,
  copyBrowserJavaScript,
  validateBrowserJavaScript
};