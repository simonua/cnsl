const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { PoolStatus } = require('../helpers/browser-module-loader.js').loadBrowserModule('pool-enums');

describe('PoolStatus', () => {
  it('defines OPEN status', () => {
    assert.equal(PoolStatus.OPEN.kind, 'open');
    assert.equal(PoolStatus.OPEN.isOpen, true);
    assert.equal(PoolStatus.OPEN.status, 'Open Now');
    assert.equal(PoolStatus.OPEN.color, 'green');
  });

  it('defines CLOSED status', () => {
    assert.equal(PoolStatus.CLOSED.kind, 'closed');
    assert.equal(PoolStatus.CLOSED.isOpen, false);
    assert.equal(PoolStatus.CLOSED.status, 'Closed');
    assert.equal(PoolStatus.CLOSED.color, 'red');
  });

  it('defines RESTRICTED status', () => {
    assert.equal(PoolStatus.RESTRICTED.kind, 'restricted');
    assert.equal(PoolStatus.RESTRICTED.isOpen, true);
    assert.equal(PoolStatus.RESTRICTED.color, 'yellow');
  });

  it('defines PRACTICE_ONLY status', () => {
    assert.equal(PoolStatus.PRACTICE_ONLY.kind, 'practice-only');
    assert.equal(PoolStatus.PRACTICE_ONLY.isOpen, true);
    assert.equal(PoolStatus.PRACTICE_ONLY.status, 'Closed to the public');
    assert.equal(PoolStatus.PRACTICE_ONLY.color, 'yellow');
  });

  it('defines CLOSED_TO_PUBLIC status', () => {
    assert.equal(PoolStatus.CLOSED_TO_PUBLIC.kind, 'closed-to-public');
    assert.equal(PoolStatus.CLOSED_TO_PUBLIC.isOpen, false);
    assert.equal(PoolStatus.CLOSED_TO_PUBLIC.status, 'Closed to the public');
    assert.equal(PoolStatus.CLOSED_TO_PUBLIC.color, 'red');
  });

  it('defines SWIM_MEET status', () => {
    assert.equal(PoolStatus.SWIM_MEET.kind, 'swim-meet');
    assert.equal(PoolStatus.SWIM_MEET.isOpen, true);
  });

  it('defines SCHEDULE_NOT_FOUND status', () => {
    assert.equal(PoolStatus.SCHEDULE_NOT_FOUND.kind, 'schedule-not-found');
    assert.equal(PoolStatus.SCHEDULE_NOT_FOUND.isOpen, false);
    assert.equal(PoolStatus.SCHEDULE_NOT_FOUND.color, 'gray');
  });

  it('defines STATUS_NOT_APPLICABLE as a neutral state', () => {
    assert.equal(PoolStatus.STATUS_NOT_APPLICABLE.kind, 'status-not-applicable');
    assert.equal(PoolStatus.STATUS_NOT_APPLICABLE.isOpen, false);
    assert.equal(PoolStatus.STATUS_NOT_APPLICABLE.status, 'Current status not applicable');
    assert.equal(PoolStatus.STATUS_NOT_APPLICABLE.color, 'gray');
  });

  it('all statuses have required properties', () => {
    const statuses = [
      PoolStatus.OPEN, PoolStatus.CLOSED, PoolStatus.RESTRICTED,
      PoolStatus.PRACTICE_ONLY, PoolStatus.CLOSED_TO_PUBLIC,
      PoolStatus.SWIM_MEET, PoolStatus.STATUS_NOT_APPLICABLE,
      PoolStatus.SCHEDULE_NOT_FOUND
    ];
    for (const status of statuses) {
      assert.equal(Object.isFrozen(status), true);
      assert.equal(typeof status.kind, 'string');
      assert.equal(typeof status.isOpen, 'boolean');
      assert.equal(typeof status.status, 'string');
      assert.equal(typeof status.color, 'string');
      assert.equal('icon' in status, false);
    }
  });
});

describe('browser registration', () => {
  it('installs pool statuses as browser globals', () => {
    const sourcePath = path.join(__dirname, '..', '..', 'src', 'js', 'types', 'pool-enums.js');
    const source = fs.readFileSync(sourcePath, 'utf8');
    const context = {};
    context.globalThis = context;
    context.self = context;
    context.window = context;
    vm.runInNewContext(source, context, { filename: sourcePath });
    assert.equal(context.window.PoolNames, undefined);
    assert.equal(typeof context.window.PoolStatus, 'function');
  });
});
