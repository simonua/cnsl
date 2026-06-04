const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

describe('app-config', () => {
  it('publishes an accepted official-source timestamp and Eastern display labels', () => {
    const config = require('../../src/js/config/app-config.js');

    assert.match(config.OFFICIAL_SOURCE_CHECKED_AT, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}-(?:04|05):00$/);
    assert.match(config.OFFICIAL_SOURCE_CHECKED_LABEL, /^[A-Z][a-z]+ \d{1,2}, \d{4} at \d{1,2}:\d{2} [AP]M E[DS]T$/);
    assert.match(config.OFFICIAL_SOURCE_CHECKED_SHORT_LABEL, /^[A-Z][a-z]{2} \d{1,2}, \d{4}, \d{1,2}:\d{2} [AP]M E[DS]T$/);
  });

  it('rejects a loaded browser constant that conflicts with published configuration', () => {
    const sourcePath = path.join(__dirname, '..', '..', 'src', 'js', 'config', 'app-config.js');
    const source = fs.readFileSync(sourcePath, 'utf8');
    const context = { globalThis: { YEAR: 2025 } };

    assert.throws(() => vm.runInNewContext(source, context, { filename: sourcePath }), /configured YEAR does not match/);
  });
});