const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const PoolWeekStateService = require('../../src/js/services/pool-week-state-service.js');

describe('PoolWeekStateService', () => {
  it('initializes an independent Monday-based week for each pool', () => {
    const firstWeek = PoolWeekStateService.getWeekStart('week-state-first', new Date(2026, 5, 17));
    const secondWeek = PoolWeekStateService.getWeekStart('week-state-second', new Date(2026, 5, 21));

    assert.equal(firstWeek.getDate(), 15);
    assert.equal(secondWeek.getDate(), 15);
    assert.notEqual(firstWeek, secondWeek);
    assert.equal(PoolWeekStateService.getWeekStart('week-state-first'), firstWeek);
  });

  it('moves a stored week forward and backward without changing the stored original reference', () => {
    const poolId = 'week-state-move';
    const firstWeek = PoolWeekStateService.getWeekStart(poolId, new Date(2026, 5, 17));
    const previousWeek = PoolWeekStateService.moveWeekStart(poolId, -7);
    const nextWeek = PoolWeekStateService.moveWeekStart(poolId, 7);

    assert.equal(firstWeek.getDate(), 15);
    assert.equal(previousWeek.getDate(), 8);
    assert.equal(nextWeek.getDate(), 15);
    assert.notEqual(previousWeek, firstWeek);
  });

  it('stores selected and current weeks only from valid calendar values', () => {
    const poolId = 'week-state-selected';
    PoolWeekStateService.getWeekStart(poolId, new Date(2026, 5, 17));

    const selectedWeek = PoolWeekStateService.setSelectedWeekStart(poolId, '2026-06-18');
    assert.equal(selectedWeek.getDate(), 15);
    assert.equal(PoolWeekStateService.setSelectedWeekStart(poolId, '2026-02-30'), null);
    assert.equal(PoolWeekStateService.getWeekStart(poolId).getDate(), 15);

    const todayWeek = PoolWeekStateService.setTodayWeekStart(poolId, new Date(2026, 5, 21));
    assert.equal(todayWeek.getDate(), 15);
  });

  it('installs the service as a browser script global', () => {
    const sourcePath = path.join(__dirname, '..', '..', 'src', 'js', 'services', 'pool-week-state-service.js');
    const source = fs.readFileSync(sourcePath, 'utf8');
    const context = { window: {}, PoolCalendarService: {} };
    vm.runInNewContext(source, context, { filename: sourcePath });

    assert.equal(typeof context.window.PoolWeekStateService, 'function');
  });
});
