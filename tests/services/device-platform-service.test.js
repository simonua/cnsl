const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const DevicePlatformService = require('../../src/js/services/device-platform-service.js');

describe('DevicePlatformService', () => {
  it('detects Android and iOS devices from browser capabilities', () => {
    assert.equal(DevicePlatformService.getPlatform({ userAgent: 'Mozilla/5.0 (Linux; Android 15; Mobile)' }), 'android');
    assert.equal(DevicePlatformService.getPlatform({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)' }), 'ios');
    assert.equal(DevicePlatformService.getPlatform({ platform: 'MacIntel', maxTouchPoints: 5 }), 'ios');
  });

  it('keeps unsupported devices and installed display mode distinct', () => {
    assert.equal(DevicePlatformService.getPlatform({ userAgent: 'Mozilla/5.0 (Windows NT 10.0)' }), 'other');
    assert.equal(DevicePlatformService.isMobilePlatform('other'), false);
    assert.equal(DevicePlatformService.isMobilePlatform('android'), true);
    assert.equal(DevicePlatformService.isStandalone(false, false), false);
    assert.equal(DevicePlatformService.isStandalone(true, false), true);
    assert.equal(DevicePlatformService.isStandalone(false, true), true);
  });
});