const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { resolveExtractionPaths } = require('../../scripts/extract-pdf-text');

describe('PDF text extraction', () => {
  it('mirrors a dated retained pool PDF beneath the temporary text root', () => {
    const repositoryRoot = path.resolve('fixture-repository');
    const paths = resolveExtractionPaths(
      'src/assets/data/2026/pools/pool-schedules/krp/2026-06-17/Kendall_Ridge.pdf',
      repositoryRoot
    );

    assert.equal(paths.inputPath, path.join(
      repositoryRoot,
      'src', 'assets', 'data', '2026', 'pools', 'pool-schedules', 'krp', '2026-06-17', 'Kendall_Ridge.pdf'
    ));
    assert.equal(paths.outputPath, path.join(
      repositoryRoot,
      'tmp', 'pdf-text', '2026', 'pools', 'pool-schedules', 'krp', '2026-06-17', 'Kendall_Ridge.txt'
    ));
  });

  it('rejects non-PDF and non-annual-data input paths', () => {
    const repositoryRoot = path.resolve('fixture-repository');

    assert.throws(() => resolveExtractionPaths('src/assets/data/2026/pools/pools.json', repositoryRoot), {
      message: 'Provide one retained annual PDF path.'
    });
    assert.throws(() => resolveExtractionPaths('outside.pdf', repositoryRoot), {
      message: 'The PDF must be beneath src/assets/data/.'
    });
  });
});
