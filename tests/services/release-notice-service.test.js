const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { createLocalStorageMock } = require('../helpers/test-helpers.js');
const ReleaseNoticeService = require('../../src/js/services/release-notice-service.js');

describe('ReleaseNoticeService', () => {
  describe('getStableVersionParts', () => {
    it('should accept only safe semantic stable version numbers', () => {
      assert.deepEqual(ReleaseNoticeService.getStableVersionParts('2.1.0'), [2, 1, 0]);
      assert.equal(ReleaseNoticeService.getStableVersionParts('02.1.0'), null);
      assert.equal(ReleaseNoticeService.getStableVersionParts('9007199254740992.0.0'), null);
      assert.equal(ReleaseNoticeService.getStableVersionParts(null), null);
    });
  });

  describe('getAnnouncementVersion', () => {
    it('should show only the major and minor version for a stable release', () => {
      assert.equal(ReleaseNoticeService.getAnnouncementVersion('2.1.7'), '2.1');
      assert.equal(ReleaseNoticeService.getAnnouncementVersion('2.2.0-beta.1'), null);
    });
  });

  describe('shouldShow', () => {
    it('should show the notice when no version has been acknowledged yet', () => {
      assert.equal(ReleaseNoticeService.shouldShow('2.1.0', null), true);
    });

    it('should show the notice for newer major and minor stable releases', () => {
      assert.equal(ReleaseNoticeService.shouldShow('3.0.0', '2.9.9'), true);
      assert.equal(ReleaseNoticeService.shouldShow('2.1.0', '2.0.9'), true);
    });

    it('should not show the notice for an acknowledged series or a patch within that series', () => {
      assert.equal(ReleaseNoticeService.shouldShow('2.1.0', '2.1.0'), false);
      assert.equal(ReleaseNoticeService.shouldShow('2.1.1', '2.1.0'), false);
    });

    it('should not show the notice for an older stable release', () => {
      assert.equal(ReleaseNoticeService.shouldShow('2.1.0', '2.2.0'), false);
    });

    it('should not show pre-release versions', () => {
      assert.equal(ReleaseNoticeService.shouldShow('2.2.0-beta.1', '2.1.0'), false);
      assert.equal(ReleaseNoticeService.shouldShow('2.2.0-alpha', null), false);
    });
  });

  describe('acknowledge', () => {
    it('should store the stable release acknowledged on this device', () => {
      const storage = createLocalStorageMock();

      assert.equal(ReleaseNoticeService.acknowledge(storage, 'cnsl_current_version', '2.1.0'), true);
      assert.equal(ReleaseNoticeService.readAcknowledgedVersion(storage, 'cnsl_current_version'), '2.1.0');
    });

    it('should not store a pre-release version', () => {
      const storage = createLocalStorageMock();

      assert.equal(ReleaseNoticeService.acknowledge(storage, 'cnsl_current_version', '2.2.0-beta.1'), false);
      assert.equal(ReleaseNoticeService.readAcknowledgedVersion(storage, 'cnsl_current_version'), null);
    });

    it('should fail safely when device storage is unavailable', () => {
      const unavailableStorage = {
        getItem: () => { throw new Error('storage denied'); },
        setItem: () => { throw new Error('storage denied'); }
      };

      assert.equal(ReleaseNoticeService.readAcknowledgedVersion(unavailableStorage, 'cnsl_current_version'), null);
      assert.equal(ReleaseNoticeService.readAcknowledgedVersion(null, 'cnsl_current_version'), null);
      assert.equal(ReleaseNoticeService.acknowledge(unavailableStorage, 'cnsl_current_version', '2.1.0'), false);
      assert.equal(ReleaseNoticeService.acknowledge(unavailableStorage, '', '2.1.0'), false);
    });
  });
});
