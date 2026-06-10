const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { DevicePlatformService } = require('../helpers/browser-module-loader.js').loadBrowserModule('device-platform-service');

describe('DevicePlatformService', () => {
  it('detects Android and iOS devices from browser capabilities', () => {
    assert.equal(DevicePlatformService.getPlatform({ userAgent: 'Mozilla/5.0 (Linux; Android 15; Mobile)' }), 'android');
    assert.equal(DevicePlatformService.getPlatform({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)' }), 'ios');
    assert.equal(DevicePlatformService.getPlatform({ platform: 'MacIntel', maxTouchPoints: 5 }), 'ios');
  });

  it('keeps unsupported devices and installed display mode distinct', () => {
    assert.equal(DevicePlatformService.getPlatform(), 'other');
    assert.equal(DevicePlatformService.getPlatform({ userAgent: { toString: () => 'Android' } }), 'android');
    assert.equal(DevicePlatformService.getPlatform({ userAgent: 'Mozilla/5.0 (Windows NT 10.0)' }), 'other');
    assert.equal(DevicePlatformService.isMobilePlatform('other'), false);
    assert.equal(DevicePlatformService.isMobilePlatform('android'), true);
    assert.equal(DevicePlatformService.isMobilePlatform('ios'), true);
    assert.equal(DevicePlatformService.isStandalone(false, false), false);
    assert.equal(DevicePlatformService.isStandalone(true, false), true);
    assert.equal(DevicePlatformService.isStandalone(false, true), true);
    assert.equal(DevicePlatformService.isStandalone(true, true), true);
  });

  it('installs the service as a browser script global', () => {
    const sourcePath = path.join(__dirname, '..', '..', 'src', 'js', 'services', 'device-platform-service.js');
    const source = fs.readFileSync(sourcePath, 'utf8');
    const context = { window: {} };
    Object.assign(context, context.globalThis || {}, context.window || {});
    context.globalThis = context; context.self = context; context.window = context;
    vm.runInNewContext(source, context, { filename: sourcePath });

    assert.equal(context.window.DevicePlatformService.getPlatform(), 'other');
  });
});
