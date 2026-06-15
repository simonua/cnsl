const { test: base, expect } = require('@playwright/test');

const EXTERNAL_HTTP_REQUEST = /^https?:\/\/(?!(?:127\.0\.0\.1|localhost|\[::1\])(?::\d+)?(?:[/?#]|$))/i;

const test = base.extend({
  analyticsSimulation: [false, { option: true }],
  blockedExternalRequests: async ({ browserName: _browserName }, use) => {
    await use([]);
  },
  blockExternalNetwork: [async ({ context, analyticsSimulation, blockedExternalRequests }, use) => {
    if (analyticsSimulation) {
      await context.addInitScript(() => {
        Object.defineProperty(globalThis.navigator, 'webdriver', {
          configurable: true,
          value: false
        });
      });
    }

    await context.route(EXTERNAL_HTTP_REQUEST, route => {
      blockedExternalRequests.push(route.request().url());
      return route.abort('blockedbyclient');
    });

    await use();
  }, { auto: true }]
});

const analyticsTest = test.extend({ analyticsSimulation: true });

module.exports = { analyticsTest, expect, test };
