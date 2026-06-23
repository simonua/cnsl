const { defineConfig, devices } = require('@playwright/test');
const os = require('node:os');

const MIN_PLAYWRIGHT_WORKERS = 2;
const MAX_PLAYWRIGHT_WORKERS = 3;
const CI_WORKER_COUNTS = new Set(['1', '2']);
const PROGRESS_REPORTER = require.resolve('./scripts/playwright-progress-reporter.js');
const PLAYWRIGHT_SERVER_PORT = Number(process.env.CNSL_PLAYWRIGHT_PORT || 4173);
const PLAYWRIGHT_SERVER_URL = `http://127.0.0.1:${PLAYWRIGHT_SERVER_PORT}`;

function getPlaywrightWorkerCount() {
  const requestedWorkerCount = process.env.CNSL_PLAYWRIGHT_WORKERS;
  if (process.env.CI && CI_WORKER_COUNTS.has(requestedWorkerCount)) {
    return Number(requestedWorkerCount);
  }

  const availableParallelism = typeof os.availableParallelism === 'function'
    ? os.availableParallelism()
    : os.cpus().length;
  const scaledWorkerCount = Math.floor(availableParallelism / 4);

  return Math.min(MAX_PLAYWRIGHT_WORKERS, Math.max(MIN_PLAYWRIGHT_WORKERS, scaledWorkerCount));
}

module.exports = defineConfig({
  testDir: './tests/browser',
  outputDir: './test-results/browser',
  globalSetup: require.resolve('./scripts/playwright-global-setup.js'),
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [['github'], ['list'], [PROGRESS_REPORTER]]
    : [['list'], [PROGRESS_REPORTER]],
  workers: getPlaywrightWorkerCount(),
  timeout: 15000,
  expect: {
    timeout: 10000
  },
  use: {
    baseURL: PLAYWRIGHT_SERVER_URL,
    reducedMotion: 'reduce',
    serviceWorkers: 'block',
    trace: 'retain-on-failure'
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], channel: 'chromium' }
    }
  ],
  webServer: {
    command: `pnpm exec http-server ./out -p ${PLAYWRIGHT_SERVER_PORT} -c-1`,
    url: `${PLAYWRIGHT_SERVER_URL}/index.html`,
    reuseExistingServer: !process.env.CI,
    stdout: 'ignore',
    stderr: 'pipe'
  }
});
