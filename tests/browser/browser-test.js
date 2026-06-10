const { test: base, expect } = require('@playwright/test');

const GA4_MEASUREMENT_ID = 'G-ZMBPYQKLQP';
const GOOGLE_ANALYTICS_REQUEST = /^https:\/\/(?:www\.googletagmanager\.com|(?:[a-z0-9-]+\.)?google-analytics\.com)\//i;

const test = base.extend({
  blockGoogleAnalytics: [async ({ context }, use) => {
    if (process.env.CNSL_BLOCK_GOOGLE_ANALYTICS !== 'true') {
      await use();
      return;
    }

    await context.addInitScript(measurementId => {
      globalThis[`ga-disable-${measurementId}`] = true;
    }, GA4_MEASUREMENT_ID);
    await context.route(GOOGLE_ANALYTICS_REQUEST, route => route.abort('blockedbyclient'));

    await use();
  }, { auto: true }]
});

module.exports = { expect, test };
