const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createLocalStorageMock } = require('../helpers/test-helpers.js');
const SettingsNoticeService = require('../../src/js/services/settings-notice-service.js');

describe('SettingsNoticeService', () => {
  describe('shouldShow', () => {
    it('should show the reminder until it has been dismissed on this device', () => {
      const storage = createLocalStorageMock();

      assert.equal(SettingsNoticeService.shouldShow(storage, 'cnsl_settings_notice_dismissed'), true);
      storage.setItem('cnsl_settings_notice_dismissed', 'true');
      assert.equal(SettingsNoticeService.shouldShow(storage, 'cnsl_settings_notice_dismissed'), false);
    });

    it('should show the reminder when storage cannot be read', () => {
      const unavailableStorage = { getItem: () => { throw new Error('storage denied'); } };

      assert.equal(SettingsNoticeService.shouldShow(unavailableStorage, 'cnsl_settings_notice_dismissed'), true);
      assert.equal(SettingsNoticeService.shouldShow(null, 'cnsl_settings_notice_dismissed'), true);
    });
  });

  describe('dismiss', () => {
    it('should permanently store dismissal on this device', () => {
      const storage = createLocalStorageMock();

      assert.equal(SettingsNoticeService.dismiss(storage, 'cnsl_settings_notice_dismissed'), true);
      assert.equal(storage.getItem('cnsl_settings_notice_dismissed'), 'true');
      assert.equal(SettingsNoticeService.shouldShow(storage, 'cnsl_settings_notice_dismissed'), false);
    });

    it('should fail safely when storage is unavailable', () => {
      const unavailableStorage = { setItem: () => { throw new Error('storage denied'); } };

      assert.equal(SettingsNoticeService.dismiss(unavailableStorage, 'cnsl_settings_notice_dismissed'), false);
      assert.equal(SettingsNoticeService.dismiss(null, 'cnsl_settings_notice_dismissed'), false);
      assert.equal(SettingsNoticeService.dismiss(unavailableStorage, ''), false);
    });
  });

  describe('browser registration', () => {
    it('installs settings notice logic as a browser script global', () => {
      const sourcePath = path.join(__dirname, '..', '..', 'src', 'js', 'services', 'settings-notice-service.js');
      const source = fs.readFileSync(sourcePath, 'utf8');
      const context = { window: {} };
      vm.runInNewContext(source, context, { filename: sourcePath });
      assert.equal(typeof context.window.SettingsNoticeService, 'function');
    });
  });
});
