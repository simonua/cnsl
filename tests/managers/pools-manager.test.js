const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createSamplePoolsManagerData, suppressConsole } = require('../helpers/test-helpers.js');
const { PoolsManager } = require('../helpers/browser-module-loader.js').loadBrowserModule('pools-manager');

describe('PoolsManager', () => {
  let manager;

  beforeEach(() => {
    manager = new PoolsManager();
  });

  it('loads the published collection as Pool models', () => {
    const source = createSamplePoolsManagerData();
    suppressConsole(() => manager.loadData(source));

    const pools = manager.getAllPools();
    assert.equal(manager.isDataLoaded(), true);
    assert.equal(pools.length, source.pools.length);
    assert.equal(pools.every(pool => pool.constructor.name === 'Pool'), true);
    assert.deepEqual(pools.map(pool => pool.name), source.pools.map(pool => pool.name));
  });

  it('returns an empty collection for unusable input and after clearing', () => {
    manager.loadData(null);
    assert.equal(manager.isDataLoaded(), false);
    assert.deepEqual(manager.getAllPools(), []);

    manager.loadData(createSamplePoolsManagerData());
    manager.clearData();
    assert.equal(manager.isDataLoaded(), false);
    assert.deepEqual(manager.getAllPools(), []);
  });

  it('installs the manager as a browser script global', () => {
    const sourcePath = path.join(__dirname, '..', '..', 'src', 'js', 'managers', 'pools-manager.js');
    const source = fs.readFileSync(sourcePath, 'utf8');
    const context = { window: {}, Pool: class {} };
    Object.assign(context, context.globalThis || {}, context.window || {});
    context.globalThis = context; context.self = context; context.window = context;
    vm.runInNewContext(source, context, { filename: sourcePath });

    assert.equal(typeof context.window.PoolsManager, 'function');
  });
});
