/**
 * Builds every page before finalizing the complete site build.
 *
 * @param {string[]} files Page source names to build.
 * @param {(file: string) => Promise<unknown>} buildPage Builds and writes one page.
 * @param {() => unknown} finalizeBuild Publishes artifacts that require every page.
 * @param {(error: unknown) => unknown} failBuild Handles any page build failure.
 * @returns {Promise<unknown>} The settled build coordination result.
 */
function coordinatePageBuilds(files, buildPage, finalizeBuild, failBuild) {
  const pageBuilds = files.map(file => Promise.resolve().then(() => buildPage(file)));
  return Promise.all(pageBuilds).then(finalizeBuild).catch(failBuild);
}

module.exports = Object.freeze({ coordinatePageBuilds });