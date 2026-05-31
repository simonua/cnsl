const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const PoolDirectoryService = require('../../src/js/services/pool-directory-service.js');

describe('PoolDirectoryService', () => {
  it('accepts only supported availability filters', () => {
    assert.equal(PoolDirectoryService.isAvailabilityFilter('open-now'), true);
    assert.equal(PoolDirectoryService.isAvailabilityFilter('opens-soon'), true);
    assert.equal(PoolDirectoryService.isAvailabilityFilter('unknown'), false);
  });

  it('formats and orders feature labels through supplied groups', () => {
    const groups = () => [{ features: ['wifi', 'shallow', 'ada compliant'] }];
    assert.deepEqual(PoolDirectoryService.sortFeaturesForDisplay([], groups), ['ada compliant', 'shallow', 'wifi']);
    assert.equal(PoolDirectoryService.formatFeatureLabel('wifi'), 'Wi-Fi');
    assert.equal(PoolDirectoryService.formatFeatureLabel('lap lanes'), 'Lap lanes');
  });

  it('adds distances without mutating records and leaves missing locations untouched', () => {
    const pools = [{ name: 'Nearby', location: { lat: 39.2, lng: -76.8 } }, { name: 'Unknown' }];
    const withDistances = PoolDirectoryService.addDistances(pools, { lat: 39.2, lng: -76.8 });

    assert.equal(withDistances[0].distance, 0);
    assert.equal(withDistances[0].name, pools[0].name);
    assert.equal(Object.hasOwn(pools[0], 'distance'), false);
    assert.equal(withDistances[1], pools[1]);
  });

  it('returns original records without coordinates and supports flat coordinate records', () => {
    const pools = [{ name: 'Flat', lat: 39.2, lng: -76.8 }, null];
    assert.equal(PoolDirectoryService.addDistances(pools, null), pools);
    const withDistances = PoolDirectoryService.addDistances(pools, { lat: 39.2, lng: -76.8 });
    assert.equal(withDistances[0].distance, 0);
    assert.equal(withDistances[1], null);
  });

  it('installs the service as a browser script global', () => {
    const sourcePath = path.join(__dirname, '..', '..', 'src', 'js', 'services', 'pool-directory-service.js');
    const source = fs.readFileSync(sourcePath, 'utf8');
    const context = { window: {} };
    vm.runInNewContext(source, context, { filename: sourcePath });

    assert.equal(typeof context.window.PoolDirectoryService, 'function');
  });
});
