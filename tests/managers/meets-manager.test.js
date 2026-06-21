const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createSampleMeetsData, suppressConsole } = require('../helpers/test-helpers.js');
const { Meet, MeetsManager } = require('../helpers/browser-module-loader.js').loadBrowserModule('meets-manager');

describe('MeetsManager', () => {
  let manager;

  beforeEach(() => {
    manager = new MeetsManager();
  });

  it('loads regular and special meets as models with their timing windows', () => {
    const source = createSampleMeetsData();
    suppressConsole(() => manager.loadData(source));

    const meets = manager.getAllMeets();
    assert.equal(manager.isDataLoaded(), true);
    assert.equal(meets.length, source.regular_meets.length);
    assert.equal(meets.every(meet => meet instanceof Meet), true);
    assert.equal(meets[0].getTimeWindowKey(), 'dualMeets');
    assert.equal(meets[0].getDisplayTime(), '7:00 AM - 12:00 PM');
  });

  it('loads special meets without participating teams', () => {
    manager.loadData({ special_meets: [
      { date: '2026-07-25', name: 'All City', location: 'Columbia' },
      { date: '2026-07-26', location: 'League Facility' }
    ] });

    assert.equal(manager.getAllMeets().length, 2);
    assert.equal(manager.getAllMeets()[0].isSpecialMeet(), true);
    assert.equal(manager.getAllMeets()[1].name, '');
    assert.equal(manager.getAllMeets()[1].location, 'League Facility');
  });

  it('does not mark an empty document as loaded and clears loaded models', () => {
    manager.loadData({ regular_meets: [], special_meets: [] });
    assert.equal(manager.isDataLoaded(), false);
    assert.deepEqual(manager.getAllMeets(), []);

    manager.loadData(createSampleMeetsData());
    manager.clearData();
    assert.equal(manager.isDataLoaded(), false);
    assert.deepEqual(manager.getAllMeets(), []);
  });

  it('installs the manager as a browser script global', () => {
    const sourcePath = path.join(__dirname, '..', '..', 'src', 'js', 'managers', 'meets-manager.js');
    const source = fs.readFileSync(sourcePath, 'utf8');
    const context = { window: {}, Meet };
    Object.assign(context, context.globalThis || {}, context.window || {});
    context.globalThis = context; context.self = context; context.window = context;
    vm.runInNewContext(source, context, { filename: sourcePath });

    assert.equal(typeof context.window.MeetsManager, 'function');
  });
});
