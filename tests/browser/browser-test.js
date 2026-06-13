const { test: base, expect } = require('@playwright/test');

const GOOGLE_ANALYTICS_REQUEST = /^https:\/\/(?:www\.googletagmanager\.com|(?:[a-z0-9-]+\.)?google-analytics\.com)\//i;

const test = base.extend({
  analyticsSimulation: [false, { option: true }],
  blockGoogleAnalytics: [async ({ context, analyticsSimulation }, use) => {
    if (analyticsSimulation) {
      await context.addInitScript(() => {
        Object.defineProperty(globalThis.navigator, 'webdriver', {
          configurable: true,
          value: false
        });
      });
      await use();
      return;
    }

    await context.route(GOOGLE_ANALYTICS_REQUEST, route => route.abort('blockedbyclient'));

    await use();
  }, { auto: true }]
});

const analyticsTest = test.extend({ analyticsSimulation: true });

module.exports = { analyticsTest, expect, test };
