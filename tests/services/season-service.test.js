const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { SeasonService } = require('../helpers/browser-module-loader.js').loadBrowserModule('season-service');

describe('SeasonService', () => {
  describe('getOffSeasonWindow', () => {
    it('starts after the final pool day and ends on the Friday before Memorial Day', () => {
      assert.deepEqual(SeasonService.getOffSeasonWindow('2026-09-07'), {
        startDate: '2026-09-08',
        endDate: '2027-05-28'
      });
      assert.deepEqual(SeasonService.getOffSeasonWindow('2025-09-01'), {
        startDate: '2025-09-02',
        endDate: '2026-05-22'
      });
    });

    it('rejects invalid published dates', () => {
      assert.equal(SeasonService.getOffSeasonWindow('2026-02-30'), null);
      assert.equal(SeasonService.getOffSeasonWindow('not-a-date'), null);
    });
  });

  describe('isOffSeason', () => {
    it('includes both off-season boundaries and excludes adjacent days', () => {
      assert.equal(SeasonService.isOffSeason('2025-09-01', new Date('2025-09-02T12:00:00-04:00')), true);
      assert.equal(SeasonService.isOffSeason('2025-09-01', new Date('2026-05-22T12:00:00-04:00')), true);
      assert.equal(SeasonService.isOffSeason('2025-09-01', new Date('2025-09-01T12:00:00-04:00')), false);
      assert.equal(SeasonService.isOffSeason('2025-09-01', new Date('2026-05-23T12:00:00-04:00')), false);
    });

    it('returns false when the published season end is absent', () => {
      assert.equal(SeasonService.isOffSeason(), false);
    });
  });

  describe('browser registration', () => {
    it('installs the service as a browser script global', () => {
      const sourcePath = path.join(__dirname, '..', '..', 'src', 'js', 'services', 'season-service.js');
      const source = fs.readFileSync(sourcePath, 'utf8');
      const context = { window: {} };
      Object.assign(context, context.globalThis || {}, context.window || {});
      context.globalThis = context; context.self = context; context.window = context;
      vm.runInNewContext(source, context, { filename: sourcePath });

      assert.equal(typeof context.window.SeasonService, 'function');
    });
  });
});
