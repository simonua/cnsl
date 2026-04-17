const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
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
      assert.equal(typeof status.isOpen, 'boolean');
      assert.equal(typeof status.status, 'string');
      assert.equal(typeof status.color, 'string');
      assert.equal(typeof status.icon, 'string');
    }
  });
});
