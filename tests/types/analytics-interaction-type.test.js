const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {
  AnalyticsExternalLinkPurpose,
  AnalyticsInteractionType
} = require('../helpers/browser-module-loader.js').loadBrowserModule('analytics-interaction-type');

describe('AnalyticsInteractionType', () => {
  it('defines the supported interaction categories as an immutable enum', () => {
    assert.deepEqual(Object.keys(AnalyticsInteractionType), [
      'BANNER',
      'DIRECTORY_DETAIL_OPEN',
      'EXPERIMENTAL_FEATURE_CHANGE',
      'EXTERNAL_LINK',
      'FIXED_SETTING_CHANGE',
      'INSTALL',
      'PUBLISHED_SETTING_CHANGE',
      'RESOURCE',
      'SHARE'
    ]);
    assert.equal(Object.isFrozen(AnalyticsInteractionType), true);
  });

  it('defines immutable external-link purposes shared by producers and analytics', () => {
    assert.equal(AnalyticsExternalLinkPurpose.POOL_PAGE, 'pool_page');
    assert.equal(AnalyticsExternalLinkPurpose.POOL_SCHEDULE, 'pool_schedule');
    assert.equal(Object.isFrozen(AnalyticsExternalLinkPurpose), true);
  });

  it('installs the enum as a browser global', () => {
    const sourcePath = path.join(__dirname, '..', '..', 'src', 'js', 'types', 'analytics-interaction-type.js');
    const source = fs.readFileSync(sourcePath, 'utf8');
    const context = {};
    context.globalThis = context;
    context.self = context;
    context.window = context;
    vm.runInNewContext(source, context, { filename: sourcePath });
    assert.equal(context.window.AnalyticsExternalLinkPurpose.POOL_SCHEDULE, 'pool_schedule');
    assert.equal(context.window.AnalyticsInteractionType.DIRECTORY_DETAIL_OPEN, 'directory_detail_open');
  });
});
