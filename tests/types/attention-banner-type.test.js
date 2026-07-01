const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { AttentionBannerType } = require('../helpers/browser-module-loader.js').loadBrowserModule('attention-banner-type');

describe('AttentionBannerType', () => {
  it('publishes one immutable owner for supported banner types', () => {
    assert.deepEqual(Object.fromEntries(Object.entries(AttentionBannerType.VALUES)), {
      INFORMATION: 'information',
      WARNING: 'warning'
    });
    assert.equal(Object.isFrozen(AttentionBannerType.VALUES), true);
  });

  it('accepts only supported semantic types', () => {
    assert.equal(AttentionBannerType.isSupported(AttentionBannerType.VALUES.INFORMATION), true);
    assert.equal(AttentionBannerType.isSupported(AttentionBannerType.VALUES.WARNING), true);
    assert.equal(AttentionBannerType.isSupported('error'), false);
    assert.equal(AttentionBannerType.isSupported(null), false);
  });
});
