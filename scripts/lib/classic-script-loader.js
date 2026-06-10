const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const REPOSITORY_ROOT = path.resolve(__dirname, '..', '..');
const BROWSER_SOURCE_ROOT = path.join(REPOSITORY_ROOT, 'src', 'js');

function resolveBrowserScript(relativePath) {
  if (typeof relativePath !== 'string' || relativePath.trim() === '') {
    throw new TypeError('Classic-script paths must be non-empty strings.');
  }

  const normalizedPath = relativePath.replace(/\\/g, '/').replace(/^src\/js\//, '');
  if (path.isAbsolute(normalizedPath) || path.extname(normalizedPath) !== '.js') {
    throw new Error(`Classic-script path must identify a JavaScript file under src/js: ${relativePath}`);
  }

  const candidatePath = path.resolve(BROWSER_SOURCE_ROOT, normalizedPath);
  const relativeCandidatePath = path.relative(BROWSER_SOURCE_ROOT, candidatePath);
  if (relativeCandidatePath.startsWith('..') || path.isAbsolute(relativeCandidatePath)) {
    throw new Error(`Classic-script path escapes src/js: ${relativePath}`);
  }

  const resolvedPath = fs.realpathSync(candidatePath);
  const relativeResolvedPath = path.relative(BROWSER_SOURCE_ROOT, resolvedPath);
  if (relativeResolvedPath.startsWith('..') || path.isAbsolute(relativeResolvedPath)) {
    throw new Error(`Classic-script path escapes src/js: ${relativePath}`);
  }
  return resolvedPath;
}

function toHostValue(value, seen = new WeakMap()) {
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) return seen.get(value);

  if (Array.isArray(value)) {
    const result = [];
    seen.set(value, result);
    value.forEach(item => result.push(toHostValue(item, seen)));
    if (Object.isFrozen(value)) Object.freeze(result);
    else if (Object.isSealed(value)) Object.seal(result);
    else if (!Object.isExtensible(value)) Object.preventExtensions(result);
    return result;
  }

  const tag = Object.prototype.toString.call(value);
  if (tag === '[object Date]') return new Date(value.getTime());
  if (tag === '[object Map]') {
    const result = new Map();
    seen.set(value, result);
    value.forEach((item, key) => result.set(toHostValue(key, seen), toHostValue(item, seen)));
    return result;
  }
  if (tag === '[object Set]') {
    const result = new Set();
    seen.set(value, result);
    value.forEach(item => result.add(toHostValue(item, seen)));
    return result;
  }

  const result = {};
  seen.set(value, result);
  Reflect.ownKeys(value).forEach(key => {
    result[key] = toHostValue(value[key], seen);
  });
  if (Object.isFrozen(value)) Object.freeze(result);
  else if (Object.isSealed(value)) Object.seal(result);
  else if (!Object.isExtensible(value)) Object.preventExtensions(result);
  return result;
}

function createClassicScriptLoader(options = {}) {
  const sandbox = {};
  const context = vm.createContext(sandbox, { name: options.name || 'cnsl-classic-script' });
  vm.runInContext('globalThis.globalThis = globalThis; globalThis.window = globalThis; globalThis.self = globalThis;', context);

  function inject(values) {
    if (!values || typeof values !== 'object') return api;
    Object.entries(values).forEach(([name, value]) => {
      context[name] = value;
    });
    return api;
  }

  function bridge(names, hostScope = globalThis) {
    names.forEach(name => {
      Object.defineProperty(context, name, {
        configurable: true,
        enumerable: true,
        get: () => hostScope[name],
        set: value => { hostScope[name] = value; }
      });
    });
    return api;
  }

  function load(scriptPaths) {
    const paths = Array.isArray(scriptPaths) ? scriptPaths : [scriptPaths];
    paths.forEach(scriptPath => {
      const filename = resolveBrowserScript(scriptPath);
      const source = fs.readFileSync(filename, 'utf8');
      vm.runInContext(source, context, { filename });
    });
    return api;
  }

  function get(name) {
    return context[name];
  }

  function pick(names) {
    return Object.fromEntries(names.map(name => [name, get(name)]));
  }

  const api = Object.freeze({ bridge, context, get, inject, load, pick, toHostValue });
  inject(options.inject);
  bridge(options.bridge || []);
  return api;
}

module.exports = {
  BROWSER_SOURCE_ROOT,
  createClassicScriptLoader,
  resolveBrowserScript,
  toHostValue
};
