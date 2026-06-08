const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Meet = require('../../src/js/models/meet.js');
const Team = require('../../src/js/models/team.js');
const PoolMeetScheduleService = require('../../src/js/services/pool-meet-schedule-service.js');

const meetTimes = {
  dualMeets: { start: '07:00', end: '12:00' },
  timeTrials: { start: '07:00', end: '12:00' }
};

describe('PoolMeetScheduleService', () => {
  it('projects Time Trials and hosted dual meets into semantic pool overrides', () => {
    const pools = [{ id: 'krp', name: 'Kendall Ridge', scheduleOverrides: [] }];
    const teams = [new Team({ name: 'Kendall Ridge Krakens', timeTrialsPool: 'Kendall Ridge' })];
    const meets = [
      new Meet({ date: '2026-06-06', name: 'Time Trials', timeWindowKey: 'timeTrials' }, meetTimes),
      new Meet({ date: '2026-06-20', name: 'Dual Meet #2', home_team: 'Long Reach', visiting_team: 'Pointers Run', location: 'Kendall Ridge Pool' }, meetTimes, 'dualMeets')
    ];

    PoolMeetScheduleService.applyMeetOverrides(pools, teams, meets);

    assert.deepEqual(pools[0].scheduleOverrides.map(override => ({
      date: override.startDate,
      hours: override.hours[0]
    })), [{
      date: '2026-06-20',
      hours: { weekDays: ['Sat'], types: ['Dual Meet #2'], accessStatus: 'swim-meet', startTime: '7:00am', endTime: '12:00pm', meetDate: '2026-06-20', meetPoolId: 'krp' }
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

  it('replaces recurring and dated pool-guide meet placeholders with authoritative meet records', () => {
    const pools = [{
      name: 'Kendall Ridge',
      schedulePeriods: [{ hours: [
        { weekDays: ['Sat'], types: ['Swim Meet'], accessStatus: 'swim-meet', startTime: '7:00am', endTime: '12:00pm' },
        { weekDays: ['Sat'], types: ['Laps'], accessStatus: 'public', startTime: '12:00pm', endTime: '8:30pm' }
      ] }],
      scheduleOverrides: [{
        startDate: '2026-06-06',
        endDate: '2026-06-06',
        reason: 'Pool guide placeholder',
        hours: [
          { weekDays: ['Sat'], types: ['Swim Meet'], accessStatus: 'swim-meet', startTime: '7:00am', endTime: '12:00pm' },
          { weekDays: ['Sat'], types: ['Laps'], accessStatus: 'public', startTime: '12:00pm', endTime: '7:00pm' }
        ]
      }, {
        startDate: '2026-06-13',
        endDate: '2026-06-13',
        reason: 'Pool guide placeholder',
        hours: [{ weekDays: ['Sat'], types: ['Swim Meet'], accessStatus: 'swim-meet', startTime: '7:00am', endTime: '12:00pm' }]
      }, {
        startDate: '2026-07-09',
        endDate: '2026-07-09',
        reason: 'Village Pool Party',
        hours: [{ weekDays: ['Thu'], types: ['Pool Party'], accessStatus: 'public', startTime: '6:00pm', endTime: '8:30pm' }]
      }]
    }];
    const teams = [new Team({ name: 'Kendall Ridge Krakens', timeTrialsPool: 'Kendall Ridge' })];
    const meets = [new Meet({ date: '2026-06-06', name: 'Time Trials', timeWindowKey: 'timeTrials' }, meetTimes)];

    PoolMeetScheduleService.applyMeetOverrides(pools, teams, meets);

    assert.deepEqual(pools[0].schedulePeriods[0].hours.map(hour => hour.accessStatus), ['public']);
    assert.deepEqual(pools[0].scheduleOverrides.map(override => ({
      date: override.startDate,
      reason: override.reason,
      accessStatuses: override.hours.map(hour => hour.accessStatus)
    })), [{
      date: '2026-06-06',
      reason: 'Time Trials',
      accessStatuses: ['public', 'swim-meet']
    }, {
      date: '2026-07-09',
      reason: 'Village Pool Party',
      accessStatuses: ['public']
    }]);
  });

  it('rejects unusable records and formats schedule values safely', () => {
    assert.equal(PoolMeetScheduleService.createOverride({}, null), null);
    assert.equal(PoolMeetScheduleService.createOverride({ date: '2026-99-99' }, { startMinutes: 0, endMinutes: 1 }), null);
    assert.equal(PoolMeetScheduleService.getWeekday('bad'), null);
    assert.equal(PoolMeetScheduleService.formatScheduleTime(-1), '');
    assert.equal(PoolMeetScheduleService.formatScheduleTime(1.5), '');
    assert.equal(PoolMeetScheduleService.formatScheduleTime(0), '12:00am');
    assert.equal(PoolMeetScheduleService.formatScheduleTime(12 * 60), '12:00pm');
    assert.equal(PoolMeetScheduleService.formatScheduleTime(13 * 60 + 5), '1:05pm');
    assert.equal(PoolMeetScheduleService.normalizePoolName(' Kendall Ridge Pool '), 'kendall ridge');
    assert.equal(PoolMeetScheduleService.normalizePoolName(), '');
  });

  it('preserves non-meet records and merges generated hours into matching overrides', () => {
    const unchanged = { hours: [{ accessStatus: 'public' }] };
    const noHours = { name: 'No hours' };
    assert.equal(PoolMeetScheduleService.removePublishedMeetSlots(null), null);
    assert.equal(PoolMeetScheduleService.removePublishedMeetSlots([noHours])[0], noHours);
    assert.equal(PoolMeetScheduleService.removePublishedMeetSlots([unchanged])[0], unchanged);

    const authored = [{ startDate: '2026-06-06', endDate: '2026-06-06', reason: 'Hours', hours: [{ accessStatus: 'public' }] }];
    const generated = [{ startDate: '2026-06-06', endDate: '2026-06-06', reason: 'Meet', hours: [{ accessStatus: 'swim-meet' }] }];
    const merged = PoolMeetScheduleService.mergeGeneratedOverrides(authored, generated);
    assert.equal(merged[0].reason, 'Meet');
    assert.deepEqual(merged[0].hours.map(hour => hour.accessStatus), ['public', 'swim-meet']);
    assert.deepEqual(PoolMeetScheduleService.removeUnconfirmedMeetPlaceholders(authored, generated), authored);
  });

  it('handles absent collections, unknown pools, and standalone special meet records', () => {
    assert.deepEqual([...PoolMeetScheduleService.getOverridesByPool()], []);
    const meet = {
      date: '2026-06-06',
      name: '',
      getKnownTimingWindow: () => ({ startMinutes: 7 * 60, endMinutes: 12 * 60 }),
      getTimeWindowKey: () => 'other'
    };
    assert.deepEqual([...PoolMeetScheduleService.getOverridesByPool([], [], [meet])], []);
    const override = PoolMeetScheduleService.createOverride(meet, meet.getKnownTimingWindow(), 'bad id');
    assert.equal(override.reason, 'Swim Meet');
    assert.equal(Object.hasOwn(override.hours[0], 'meetDate'), false);
  });

  it('installs the service as a browser script global', () => {
    const sourcePath = path.join(__dirname, '..', '..', 'src', 'js', 'services', 'pool-meet-schedule-service.js');
    const source = fs.readFileSync(sourcePath, 'utf8');
    const context = { window: {} };
    vm.runInNewContext(source, context, { filename: sourcePath });

    assert.equal(context.window.PoolMeetScheduleService.formatScheduleTime(60), '1:00am');
  });
});