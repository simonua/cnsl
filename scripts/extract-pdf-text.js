'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPOSITORY_ROOT = path.resolve(__dirname, '..');

/**
 * Derive the temporary text path that mirrors a retained annual PDF path.
 * @param {string} inputPath - Retained PDF path
 * @param {string} repositoryRoot - Repository root
 * @returns {{ inputPath: string, outputPath: string }} Resolved extraction paths
 */
function resolveExtractionPaths(inputPath, repositoryRoot = REPOSITORY_ROOT) {
  if (!inputPath || path.extname(inputPath).toLowerCase() !== '.pdf') {
    throw new Error('Provide one retained annual PDF path.');
  }

  const dataRoot = path.join(repositoryRoot, 'src', 'assets', 'data');
  const resolvedInputPath = path.resolve(repositoryRoot, inputPath);
  const relativeInputPath = path.relative(dataRoot, resolvedInputPath);
  if (!relativeInputPath || relativeInputPath.startsWith(`..${path.sep}`) || path.isAbsolute(relativeInputPath)) {
    throw new Error('The PDF must be beneath src/assets/data/.');
  }

  return {
    inputPath: resolvedInputPath,
    outputPath: path.join(
      repositoryRoot,
      'tmp',
      'pdf-text',
      relativeInputPath.slice(0, -path.extname(relativeInputPath).length) + '.txt'
    )
  };
}

/**
 * Extract searchable text from one retained annual PDF.
 * @param {string[]} argumentsList - Command-line arguments
 * @returns {void}
 */
function main(argumentsList = process.argv.slice(2)) {
  if (argumentsList.length !== 1) {
    throw new Error('Usage: pnpm run extract:pdf -- <retained-pdf-path>');
  }

  const paths = resolveExtractionPaths(argumentsList[0]);
  if (!fs.statSync(paths.inputPath).isFile()) {
    throw new Error(`PDF does not exist: ${argumentsList[0]}`);
  }
  fs.mkdirSync(path.dirname(paths.outputPath), { recursive: true });

  const cliPath = require.resolve('pdftotext-wasm/bin.js');
  const result = spawnSync(process.execPath, [cliPath, '-layout', '-eol', 'unix', paths.inputPath, paths.outputPath], {
    stdio: 'inherit'
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`PDF text extraction failed with exit code ${result.status}.`);
  }

  console.log(`Extracted text to ${path.relative(REPOSITORY_ROOT, paths.outputPath).split(path.sep).join('/')}`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { main, resolveExtractionPaths };
