const fs = require('node:fs');
const path = require('node:path');

const PACKAGE_VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const REPOSITORY_ROOT = path.resolve(__dirname, '..', '..');

function validatePackageVersion(version) {
  if (typeof version !== 'string' || !PACKAGE_VERSION_PATTERN.test(version)) {
    throw new Error(`package.json version ${String(version)} must use MAJOR.MINOR.PATCH format.`);
  }
  return version;
}

function readPackageVersion(packagePath = path.join(REPOSITORY_ROOT, 'package.json')) {
  const packageMetadata = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  return validatePackageVersion(packageMetadata.version);
}

function createBrowserConfigSource(version, appConfigSource) {
  const validatedVersion = validatePackageVersion(version);
  if (typeof appConfigSource !== 'string' || appConfigSource.length === 0) {
    throw new TypeError('Application configuration source must be a non-empty string.');
  }
  const normalizedSource = appConfigSource.endsWith('\n') ? appConfigSource : `${appConfigSource}\n`;
  return `Object.defineProperty(globalThis, 'APP_VERSION', { configurable: false, enumerable: true, value: ${JSON.stringify(validatedVersion)}, writable: false });\n${normalizedSource}`;
}

module.exports = {
  PACKAGE_VERSION_PATTERN,
  createBrowserConfigSource,
  readPackageVersion,
  validatePackageVersion
};
