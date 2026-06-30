const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createLocalStorageMock } = require('../helpers/test-helpers.js');
const { WelcomeDialogService } = require('../helpers/browser-module-loader.js').loadBrowserModule('welcome-dialog-service');

describe('WelcomeDialogService', () => {
  describe('shouldShow', () => {
    it('should show the welcome until it has been dismissed on this device', () => {
      const storage = createLocalStorageMock();

      assert.equal(WelcomeDialogService.shouldShow(storage, 'cnsl_settings_notice_dismissed'), true);
      storage.setItem('cnsl_settings_notice_dismissed', 'true');
      assert.equal(WelcomeDialogService.shouldShow(storage, 'cnsl_settings_notice_dismissed'), false);
    });

    it('should show the welcome when storage cannot be read', () => {
      const unavailableStorage = { getItem: () => { throw new Error('storage denied'); } };

      assert.equal(WelcomeDialogService.shouldShow(unavailableStorage, 'cnsl_settings_notice_dismissed'), true);
      assert.equal(WelcomeDialogService.shouldShow(null, 'cnsl_settings_notice_dismissed'), true);
    });
  });

  describe('dismiss', () => {
    it('should permanently store dismissal on this device', () => {
      const storage = createLocalStorageMock();

      assert.equal(WelcomeDialogService.dismiss(storage, 'cnsl_settings_notice_dismissed'), true);
      assert.equal(storage.getItem('cnsl_settings_notice_dismissed'), 'true');
      assert.equal(WelcomeDialogService.shouldShow(storage, 'cnsl_settings_notice_dismissed'), false);
    });

    it('should fail safely when storage is unavailable', () => {
      const unavailableStorage = { setItem: () => { throw new Error('storage denied'); } };

      assert.equal(WelcomeDialogService.dismiss(unavailableStorage, 'cnsl_settings_notice_dismissed'), false);
      assert.equal(WelcomeDialogService.dismiss(null, 'cnsl_settings_notice_dismissed'), false);
      assert.equal(WelcomeDialogService.dismiss(unavailableStorage, ''), false);
    });
  });

  describe('browser registration', () => {
    it('installs welcome dialog logic as a browser script global', () => {
      const sourcePath = path.join(__dirname, '..', '..', 'src', 'js', 'services', 'welcome-dialog-service.js');
      const source = fs.readFileSync(sourcePath, 'utf8');
      const context = { window: {} };
      Object.assign(context, context.globalThis || {}, context.window || {});
      context.globalThis = context; context.self = context; context.window = context;
      vm.runInNewContext(source, context, { filename: sourcePath });
      assert.equal(typeof context.window.WelcomeDialogService, 'function');
    });
  });
});
