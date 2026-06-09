const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { SeasonService } = require('../../src/js/services/season-service');

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
  });
});
