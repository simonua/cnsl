const { appendFileSync, readFileSync } = require('node:fs');
const { execFileSync } = require('node:child_process');
const { validatePackageVersion } = require('./lib/package-version.js');

const VERSION_TAG_PATTERN = /^v?(\d+)\.(\d+)\.(\d+)$/;

function compareVersions(left, right) {
  const leftParts = left.split('.').map(Number);
  const rightParts = right.split('.').map(Number);
  for (let index = 0; index < leftParts.length; index += 1) {
    const difference = leftParts[index] - rightParts[index];
    if (difference !== 0) return difference;
  }
  return 0;
}

function parseVersionTag(tag) {
  const match = VERSION_TAG_PATTERN.exec(tag);
  return match ? `${Number(match[1])}.${Number(match[2])}.${Number(match[3])}` : undefined;
}

function selectRelease({ currentTags, previousTags, packageVersion }) {
  validatePackageVersion(packageVersion);
  const currentVersions = [...new Set(currentTags.map(parseVersionTag).filter(Boolean))];
  if (currentVersions.length > 1) {
    throw new Error(`The deployed commit has multiple version tags: ${currentVersions.join(' ')}.`);
  }
  if (currentVersions[0] && currentVersions[0] !== packageVersion) {
    throw new Error(`Version tag ${currentVersions[0]} does not match package.json version ${packageVersion}.`);
  }
  if (currentVersions[0]) return { releaseVersion: '', shouldTag: false };

  const previousVersions = [...new Set(previousTags.map(parseVersionTag).filter(Boolean))].sort(compareVersions);
  const previousVersion = previousVersions.at(-1);
  if (!previousVersion) return { releaseVersion: packageVersion, shouldTag: true };

  const comparison = compareVersions(packageVersion, previousVersion);
  if (comparison < 0) {
    throw new Error(`Version ${packageVersion} must not be lower than previous released version ${previousVersion}.`);
  }
  return comparison === 0 ? { releaseVersion: '', shouldTag: false } : { releaseVersion: packageVersion, shouldTag: true };
}

function gitLines(...argumentsList) {
  const output = execFileSync('git', argumentsList, {
    encoding: 'utf8'
  }).trim();
  return output ? output.split(/\r?\n/) : [];
}

function writeOutput(name, value) {
  appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
}

function main() {
  const deploySha = process.env.DEPLOY_SHA;
  if (!deploySha || !process.env.GITHUB_OUTPUT) throw new Error('DEPLOY_SHA and GITHUB_OUTPUT are required.');

  const packageVersion = JSON.parse(readFileSync('package.json', 'utf8')).version;
  const currentTags = gitLines('tag', '--points-at', deploySha);
  const currentTagSet = new Set(currentTags);
  const previousTags = gitLines('tag', '--merged', deploySha).filter((tag) => !currentTagSet.has(tag));
  const release = selectRelease({ currentTags, previousTags, packageVersion });
  writeOutput('release_version', release.releaseVersion);
  writeOutput('should_tag', String(release.shouldTag));
  console.log(release.shouldTag ? `::notice::Version ${release.releaseVersion} is eligible for an automatic release tag.` : `::notice::package.json version remains ${packageVersion}; no release tag is required.`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`::error::${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}

module.exports = { compareVersions, parseVersionTag, selectRelease };
