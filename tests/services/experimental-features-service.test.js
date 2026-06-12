const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createLocalStorageMock } = require('../helpers/test-helpers.js');
const { loadBrowserModule } = require('../helpers/browser-module-loader.js');

const configurationPath = path.join(__dirname, '..', '..', 'src', 'assets', 'experimental-settings.json');
const publishedConfiguration = JSON.parse(fs.readFileSync(configurationPath, 'utf8'));

describe('ExperimentalFeaturesService', () => {
  it('loads and caches the reviewed experimental feature configuration', async () => {
    const { ExperimentalFeaturesService } = loadBrowserModule('experimental-features-service');
    let requestCount = 0;
    const fetchImplementation = async (url, options) => {
      requestCount += 1;
      assert.equal(url, 'assets/experimental-settings.json');
      assert.equal(options.cache, 'no-cache');
      return { ok: true, json: async () => publishedConfiguration };
    };

    const firstLoad = await ExperimentalFeaturesService.load(fetchImplementation);
    const secondLoad = await ExperimentalFeaturesService.load(fetchImplementation);

    assert.equal(requestCount, 1);
    assert.deepEqual(firstLoad, [{
      available: true,
      description: "See personalized details for your favorite team's next meet, including key times and host-pool guidance when available.",
      id: 'my-meet-day',
      label: 'My Meet Day'
    }]);
    assert.equal(firstLoad, secondLoad);
    assert.equal(Object.isFrozen(firstLoad), true);
    assert.equal(Object.isFrozen(firstLoad[0]), true);
  });

  it('rejects unknown, duplicate, malformed, and overly long feature records', () => {
    const { ExperimentalFeaturesService } = loadBrowserModule('experimental-features-service');
    const normalized = ExperimentalFeaturesService.normalizeConfiguration({
      features: [
        null,
        { id: 'unknown', label: 'Unknown', description: 'Unknown.', available: true },
        { id: 'my-meet-day', label: 'Too long', description: 'One. Two. Three. Four.', available: true },
        { id: 'my-meet-day', label: 10, description: 'Wrong label type.', available: true },
        { id: 'my-meet-day', label: 'Wrong description type', description: null, available: true },
        { id: 'my-meet-day', label: 'Wrong availability type', description: 'Wrong availability type.', available: 'yes' },
        { id: 'my-meet-day', label: ' ', description: 'Blank label.', available: true },
        { id: 'my-meet-day', label: 'Blank description', description: ' ', available: true },
        { id: 'my-meet-day', label: ' My Meet Day ', description: 'First. Second. Third.', available: false },
        { id: 'my-meet-day', label: 'Duplicate', description: 'Duplicate.', available: true }
      ]
    });

    assert.deepEqual(normalized, [{
      available: false,
      description: 'First. Second. Third.',
      id: 'my-meet-day',
      label: 'My Meet Day'
    }]);
    assert.deepEqual(ExperimentalFeaturesService.normalizeConfiguration(null), []);
    assert.deepEqual(ExperimentalFeaturesService.normalizeConfiguration({ features: 'invalid' }), []);
  });

  it('enables only an available feature selected in normalized device preferences', async () => {
    const storage = createLocalStorageMock();
    globalThis.localStorage = storage;
    try {
      const { ExperimentalFeaturesService, PreferencesService } = loadBrowserModule('experimental-features-service');
      const fetchImplementation = async () => ({ ok: true, json: async () => publishedConfiguration });

      assert.equal(await ExperimentalFeaturesService.isEnabled('my-meet-day', fetchImplementation), false);
      PreferencesService.save({ experimentalFeatures: ['my-meet-day'] });
      assert.equal(await ExperimentalFeaturesService.isEnabled('my-meet-day', fetchImplementation), true);
      assert.equal(await ExperimentalFeaturesService.isEnabled('unknown', fetchImplementation), false);

      ExperimentalFeaturesService.configurationPromise = null;
      const unavailableFetch = async () => ({
        ok: true,
        json: async () => ({ features: [{ ...publishedConfiguration.features[0], available: false }] })
      });
      assert.equal(await ExperimentalFeaturesService.isEnabled('my-meet-day', unavailableFetch), false);
    } finally {
      delete globalThis.localStorage;
    }
  });

  it('fails closed and permits retry after a configuration request fails', async () => {
    const { ExperimentalFeaturesService } = loadBrowserModule('experimental-features-service');

    await assert.rejects(
      ExperimentalFeaturesService.load(null),
      /cannot be loaded/
    );
    await assert.rejects(
      ExperimentalFeaturesService.load(async () => ({ ok: false, status: 503 })),
      /returned 503/
    );
    const recovered = await ExperimentalFeaturesService.load(async () => ({ ok: true, json: async () => publishedConfiguration }));
    assert.equal(recovered.length, 1);
  });
});