const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  assertBrowserOnly,
  copyBrowserJavaScript
} = require('../../scripts/validate-browser-javascript.js');

describe('validate browser JavaScript', () => {
  it('accepts browser-only application scripts', () => {
    const modules = [
      'src/js/types/schedule-state.js',
      'src/js/services/time-utils.js',
      'src/js/models/pool.js',
      'src/js/services/data-manager.js'
    ];

    modules.forEach(relativePath => {
      const source = fs.readFileSync(path.join(__dirname, '..', '..', relativePath), 'utf8');
      assert.doesNotThrow(() => assertBrowserOnly(source, relativePath));
    });
  });

  it('rejects CommonJS and Node.js runtime code', () => {
    assert.throws(() => assertBrowserOnly('process.cwd();', 'unsafe.js'), /Node\.js process global/);
    assert.throws(() => assertBrowserOnly("require('./unsafe.js');", 'unsafe.js'), /CommonJS import/);
    assert.throws(() => assertBrowserOnly('module.exports = {};', 'unsafe.js'), /CommonJS module global/);
    assert.throws(() => assertBrowserOnly("if (typeof window === 'undefined') {}", 'unsafe.js'), /Node-only environment guard/);
  });

  it('ignores Node.js words in comments, strings, and property names', () => {
    const source = "// require('test')\nconst value = { module: 'module.exports' }; value.exports;";
    assert.doesNotThrow(() => assertBrowserOnly(source, 'safe.js'));
  });

  it('copies validated scripts byte-for-byte', () => {
    const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cnsl-browser-copy-'));
    const sourceDirectory = path.join(temporaryRoot, 'source');
    const destinationDirectory = path.join(temporaryRoot, 'destination');
    fs.mkdirSync(sourceDirectory);
    const source = 'globalThis.Feature = class Feature {};\n';
    fs.writeFileSync(path.join(sourceDirectory, 'feature.js'), source);

    try {
      copyBrowserJavaScript(sourceDirectory, destinationDirectory);
      assert.equal(fs.readFileSync(path.join(destinationDirectory, 'feature.js'), 'utf8'), source);
    } finally {
      fs.rmSync(temporaryRoot, { force: true, recursive: true });
    }
  });
});