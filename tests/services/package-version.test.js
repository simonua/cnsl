const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const packageMetadata = require('../../package.json');
const { createBrowserConfigSource, readPackageVersion, validatePackageVersion } = require('../../scripts/lib/package-version.js');

describe('package version', () => {
  it('should read the repository package version', () => {
    assert.equal(readPackageVersion(), packageMetadata.version);
  });

  it('should require strict semantic versions', () => {
    assert.equal(validatePackageVersion('2.26.8'), '2.26.8');
    ['2.26', 'v2.26.8', '2.26.8-beta.1', '02.26.8'].forEach((version) => {
      assert.throws(() => validatePackageVersion(version), /MAJOR\.MINOR\.PATCH/);
    });
  });

  it('should generate browser configuration with an immutable package version', () => {
    const context = {};
    const configSource = 'globalThis.CONFIG_LOADED = globalThis.APP_VERSION;\n';
    vm.runInNewContext(createBrowserConfigSource(packageMetadata.version, configSource), context);

    assert.equal(context.APP_VERSION, packageMetadata.version);
    assert.equal(Object.getOwnPropertyDescriptor(context, 'APP_VERSION').writable, false);
    assert.equal(context.CONFIG_LOADED, packageMetadata.version);
  });

  it('should require application configuration source', () => {
    ['', null].forEach((source) => {
      assert.throws(() => createBrowserConfigSource(packageMetadata.version, source), /non-empty string/);
    });
  });
});
