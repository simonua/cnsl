const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const Meet = require('../../src/js/models/meet.js');
const Team = require('../../src/js/models/team.js');
const PoolMeetScheduleService = require('../../src/js/services/pool-meet-schedule-service.js');

const meetTimes = {
  dualMeets: { start: '07:00', end: '12:00' },
  timeTrials: { start: '07:00', end: '12:00' }
};

describe('PoolMeetScheduleService', () => {
  it('projects Time Trials and hosted dual meets into semantic pool overrides', () => {
    const pools = [{ name: 'Kendall Ridge', scheduleOverrides: [] }];
    const teams = [new Team({ name: 'Kendall Ridge Krakens', timeTrialsPool: 'Kendall Ridge' })];
    const meets = [
      new Meet({ date: '2026-06-06', name: 'Time Trials', timeWindowKey: 'timeTrials' }, meetTimes),
      new Meet({ date: '2026-06-20', name: 'Dual Meet #2', location: 'Kendall Ridge Pool' }, meetTimes, 'dualMeets')
    ];

    PoolMeetScheduleService.applyMeetOverrides(pools, teams, meets);

    assert.deepEqual(pools[0].scheduleOverrides.map(override => ({
      date: override.startDate,
      hours: override.hours[0]
    })), [{
      date: '2026-06-20',
      hours: { weekDays: ['Sat'], types: ['Swim Meet'], accessStatus: 'swim-meet', startTime: '7:00am', endTime: '12:00pm' }
    }, {
      date: '2026-06-06',
      hours: { weekDays: ['Sat'], types: ['Swim Meet'], accessStatus: 'swim-meet', startTime: '7:00am', endTime: '12:00pm' }
    }]);
  });

  it('preserves authored overrides and replaces prior generated records without duplicating shared pools', () => {
    const authoredOverride = { startDate: '2026-06-01', source: 'ca-published' };
    const pools = [{ name: 'Huntington', scheduleOverrides: [authoredOverride] }];
    const teams = [new Team({ timeTrialsPool: 'Huntington' }), new Team({ timeTrialsPool: 'Huntington' })];
    const meets = [new Meet({ date: '2026-06-06', name: 'Time Trials', timeWindowKey: 'timeTrials' }, meetTimes)];

    PoolMeetScheduleService.applyMeetOverrides(pools, teams, meets);
    PoolMeetScheduleService.applyMeetOverrides(pools, teams, meets);

    assert.equal(pools[0].scheduleOverrides.length, 2);
    assert.equal(pools[0].scheduleOverrides[0], authoredOverride);
    assert.equal(pools[0].scheduleOverrides[1].source, PoolMeetScheduleService.GENERATED_SOURCE);
  });

  it('rejects unusable records and formats schedule values safely', () => {
    assert.equal(PoolMeetScheduleService.createOverride({}, null), null);
    assert.equal(PoolMeetScheduleService.getWeekday('bad'), null);
    assert.equal(PoolMeetScheduleService.formatScheduleTime(-1), '');
    assert.equal(PoolMeetScheduleService.formatScheduleTime(13 * 60 + 5), '1:05pm');
    assert.equal(PoolMeetScheduleService.normalizePoolName(' Kendall Ridge Pool '), 'kendall ridge');
  });
});