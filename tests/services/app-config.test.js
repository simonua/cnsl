const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

describe('app-config', () => {
  it('rejects a loaded browser constant that conflicts with published configuration', () => {
    const sourcePath = path.join(__dirname, '..', '..', 'src', 'js', 'config', 'app-config.js');
    const source = fs.readFileSync(sourcePath, 'utf8');
    const context = { globalThis: { YEAR: 2025 } };

    assert.throws(() => vm.runInNewContext(source, context, { filename: sourcePath }), /configured YEAR does not match/);
  });
});