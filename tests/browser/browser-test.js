const { test: base, expect } = require('@playwright/test');
const AppConfig = require('../../scripts/adapters/app-config.js');

const EXTERNAL_HTTP_REQUEST = /^https?:\/\/(?!(?:127\.0\.0\.1|localhost|\[::1\])(?::\d+)?(?:[/?#]|$))/i;

const test = base.extend({
  analyticsSimulation: [false, { option: true }],
  firstVisit: [false, { option: true }],
  blockedExternalRequests: async ({ browserName: _browserName }, use) => {
    await use([]);
  },
  prepareBrowserContext: [async ({ context, analyticsSimulation, blockedExternalRequests, firstVisit }, use) => {
    if (!firstVisit) {
      await context.addInitScript(storageKey => {
        localStorage.setItem(storageKey, 'true');
      }, AppConfig.WELCOME_DIALOG_DISMISSED_STORAGE_KEY);
    }

    if (analyticsSimulation) {
      await context.addInitScript(({ deploymentMetaName, productionDeployment }) => {
        Object.defineProperty(globalThis.navigator, 'webdriver', {
          configurable: true,
          value: false
        });
        const querySelector = globalThis.Document.prototype.querySelector;
        globalThis.Document.prototype.querySelector = function querySelectorWithAnalyticsSimulation(selector) {
          if (selector === `meta[name="${deploymentMetaName}"]`) {
            return { content: productionDeployment };
          }
          return Reflect.apply(querySelector, this, [selector]);
        };
      }, {
        deploymentMetaName: AppConfig.ANALYTICS_DEPLOYMENT_META_NAME,
        productionDeployment: AppConfig.ANALYTICS_DEPLOYMENT_MODES.PRODUCTION
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
