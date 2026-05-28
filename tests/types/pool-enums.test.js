const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { PoolNames, PoolStatus } = require('../../src/js/types/pool-enums.js');

describe('PoolNames', () => {
  it('defines known pool name constants', () => {
    assert.equal(PoolNames.BRYANT_WOODS, 'Bryant Woods');
    assert.equal(PoolNames.KENDALL_RIDGE, 'Kendall Ridge');
  });

  it('pool names are strings', () => {
    const names = Object.values(Object.getOwnPropertyDescriptors(PoolNames))
      .filter(d => typeof d.value === 'string')
      .map(d => d.value);
    assert.ok(names.length > 0, 'Should have at least one pool name');
    for (const name of names) {
      assert.equal(typeof name, 'string');
      assert.ok(name.length > 0);
    }
  });

  it('lists, validates, and normalizes compatibility pool names', () => {
    assert.equal(PoolNames.getAllPoolNames().length, 23);
    assert.equal(PoolNames.isValidPoolName('Bryant Woods'), true);
    assert.equal(PoolNames.isValidPoolName('Unknown Pool'), false);
    assert.equal(PoolNames.toEnumName("Macgill's Common"), 'MACGILLS_COMMON');
  });
});

describe('PoolStatus', () => {
  it('defines OPEN status', () => {
    assert.equal(PoolStatus.OPEN.isOpen, true);
    assert.equal(PoolStatus.OPEN.status, 'Open Now');
    assert.equal(PoolStatus.OPEN.color, 'green');
  });

  it('defines CLOSED status', () => {
    assert.equal(PoolStatus.CLOSED.isOpen, false);
    assert.equal(PoolStatus.CLOSED.status, 'Closed');
    assert.equal(PoolStatus.CLOSED.color, 'red');
  });

  it('defines RESTRICTED status', () => {
    assert.equal(PoolStatus.RESTRICTED.isOpen, true);
    assert.equal(PoolStatus.RESTRICTED.color, 'yellow');
  });

  it('defines PRACTICE_ONLY status', () => {
    assert.equal(PoolStatus.PRACTICE_ONLY.isOpen, true);
  });

  it('defines SWIM_MEET status', () => {
    assert.equal(PoolStatus.SWIM_MEET.isOpen, true);
  });

  it('defines SCHEDULE_NOT_FOUND status', () => {
    assert.equal(PoolStatus.SCHEDULE_NOT_FOUND.isOpen, false);
    assert.equal(PoolStatus.SCHEDULE_NOT_FOUND.color, 'gray');
  });

  it('all statuses have required properties', () => {
    const statuses = [
      PoolStatus.OPEN, PoolStatus.CLOSED, PoolStatus.RESTRICTED,
      PoolStatus.PRACTICE_ONLY, PoolStatus.CLOSED_TO_PUBLIC,
      PoolStatus.SWIM_MEET, PoolStatus.SCHEDULE_NOT_FOUND
    ];
    for (const status of statuses) {
      assert.equal(Object.isFrozen(status), true);
      assert.equal(typeof status.isOpen, 'boolean');
      assert.equal(typeof status.status, 'string');
      assert.equal(typeof status.color, 'string');
      assert.equal(typeof status.icon, 'string');
    }
  });
});

describe('browser registration', () => {
  it('installs pool names and statuses as browser globals', () => {
    const sourcePath = path.join(__dirname, '..', '..', 'src', 'js', 'types', 'pool-enums.js');
    const source = fs.readFileSync(sourcePath, 'utf8');
    const context = { window: {} };
    vm.runInNewContext(source, context, { filename: sourcePath });
    assert.equal(typeof context.window.PoolNames, 'function');
    assert.equal(typeof context.window.PoolStatus, 'function');
  });
});
