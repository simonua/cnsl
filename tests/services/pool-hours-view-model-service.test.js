const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { PoolHoursViewModelService, PoolCalendarService } = require('../helpers/browser-module-loader.js').loadBrowserModule('pool-hours-view-model-service');

describe('PoolHoursViewModelService', () => {
  it('builds the display model and enriches only semantic practice slots', () => {
    const weekStart = new Date(2026, 5, 15);
    const pool = { id: 'long-reach', name: 'Long Reach' };
    const poolModel = {
      name: 'Long Reach',
      getCurrentStatus: () => ({ kind: 'open', status: 'Open', color: 'green', icon: '🟢' }),
      getWeekScheduleForDate: receivedWeekStart => {
        assert.equal(receivedWeekStart, weekStart);
        return [{
          day: 'Mon',
          timeSlots: [
            { accessStatus: 'practice-only', startTime: '5:00pm', endTime: '6:00pm' },
            { accessStatus: 'public', startTime: '6:00pm', endTime: '7:00pm' }
          ]
        }];
      },
      getValidDateRange: () => ({ startDate: new Date(2026, 5, 1), endDate: new Date(2026, 5, 30) }),
      getPublicStatusTransitionToday: () => ({ action: 'closes', minutes: 90 })
    };
    const timeUtils = { getCurrentEasternTimeInfo: () => ({ date: '2026-06-16' }) };
    const teamScheduleService = {
      getDetailedPracticeTeamNames: (teams, poolName, date, slot, receivedTimeUtils) => {
        assert.deepEqual(teams, [{ name: 'Barracudas' }]);
        assert.equal(poolName, 'Long Reach');
        assert.equal(date.getDate(), 15);
        assert.equal(slot.accessStatus, 'practice-only');
        assert.equal(receivedTimeUtils, timeUtils);
        return ['Barracudas'];
      }
    };

    const viewModel = PoolHoursViewModelService.build(pool, poolModel, {
      weekStart,
      timeUtils,
      practiceTeams: [{ name: 'Barracudas' }],
      layout: 'calendar',
      teamScheduleService,
      isFavoriteTeamLabel: name => name === 'Barracudas',
      getStatusTooltip: kind => `tooltip:${kind}`
    });

    assert.equal(viewModel.poolId, 'long-reach');
    assert.equal(viewModel.weekPickerId, 'week-picker-long-reach');
    assert.equal(viewModel.weekStartText, 'June 15');
    assert.equal(viewModel.weekEndText, 'June 21');
    assert.equal(viewModel.isPreviousWeekDisabled, false);
    assert.equal(viewModel.isNextWeekDisabled, false);
    assert.equal(viewModel.weekStartInputValue, '2026-06-15');
    assert.equal(viewModel.statusTooltip, 'tooltip:open');
    assert.deepEqual(viewModel.weekSchedule[0].timeSlots[0].practiceTeamNames, ['Barracudas']);
    assert.deepEqual(viewModel.weekSchedule[0].timeSlots[0].favoritePracticeTeamNames, ['Barracudas']);
    assert.equal(Object.hasOwn(viewModel.weekSchedule[0].timeSlots[1], 'practiceTeamNames'), false);
    assert.equal(viewModel.scheduleOptions.layout, 'calendar');
    assert.equal(viewModel.scheduleOptions.weekStart, weekStart);
    assert.equal(viewModel.scheduleOptions.today.getDate(), 16);
    assert.equal(viewModel.scheduleOptions.timeUtils, timeUtils);
  });

  it('keeps the existing unavailable status and empty schedule fallbacks when model access fails', () => {
    const errors = [];
    const poolModel = {
      name: 'Broken Pool',
      getCurrentStatus: () => { throw new Error('status failed'); },
      getWeekScheduleForDate: () => { throw new Error('schedule failed'); },
      getValidDateRange: () => null,
      getPublicStatusTransitionToday: () => null
    };

    const viewModel = PoolHoursViewModelService.build({ name: 'Broken Pool' }, poolModel, {
      weekStart: new Date(2026, 5, 15),
      timeUtils: { getCurrentEasternTimeInfo: () => ({ date: '2026-06-16' }) },
      onError: (operation, poolName) => errors.push([operation, poolName])
    });

    assert.equal(viewModel.poolStatus.kind, 'unavailable');
    assert.deepEqual(viewModel.weekSchedule, []);
    assert.deepEqual(errors, [['status', 'Broken Pool'], ['week schedule', 'Broken Pool']]);
    assert.equal(viewModel.poolId, 'Broken Pool');
    assert.equal(viewModel.poolName, 'Broken Pool');
    assert.equal(viewModel.hasDateRange, false);
    assert.equal(viewModel.isTodayDisabled, true);
    assert.equal(viewModel.isPreviousWeekDisabled, true);
    assert.equal(viewModel.isNextWeekDisabled, true);
    assert.equal(viewModel.minDateInputValue, '');
    assert.equal(viewModel.maxDateInputValue, '');
    assert.equal(viewModel.statusTooltip, 'Status unknown');
  });

  it('normalizes absent records, malformed schedules, and optional practice dependencies', () => {
    const poolModel = {
      name: 'Fallback Pool',
      getCurrentStatus: () => ({ kind: 'closed' }),
      getWeekScheduleForDate: () => null,
      getValidDateRange: () => null,
      getPublicStatusTransitionToday: () => null
    };
    const options = {
      weekStart: new Date(2026, 5, 15),
      timeUtils: { getCurrentEasternTimeInfo: () => ({ date: '2026-06-16' }) }
    };

    const viewModel = PoolHoursViewModelService.build(null, poolModel, options);
    assert.equal(viewModel.poolId, undefined);
    assert.equal(viewModel.poolName, 'this pool');
    assert.deepEqual(viewModel.weekSchedule, []);
    assert.equal(PoolHoursViewModelService.reportError('status', poolModel, new Error('ignored')), undefined);

    const slots = PoolHoursViewModelService.enrichPracticeTeamNames(
      [{ day: 'Mon' }, { day: 'Tue', timeSlots: [{ accessStatus: 'practice-only' }] }],
      poolModel.name,
      options.weekStart,
      [],
      options.timeUtils,
      null
    );
    assert.deepEqual(slots[0].timeSlots, []);
    assert.equal(slots[1].timeSlots[0].accessStatus, 'practice-only');
    assert.deepEqual(PoolHoursViewModelService.getWeekSchedule({
      name: 'Default Collaborator',
      getWeekScheduleForDate: () => [{ day: 'Mon', timeSlots: [] }]
    }, options.weekStart), [{ day: 'Mon', timeSlots: [] }]);
  });

  it('installs the service as a browser script global', () => {
    const sourcePath = path.join(__dirname, '..', '..', 'src', 'js', 'services', 'pool-hours-view-model-service.js');
    const source = fs.readFileSync(sourcePath, 'utf8');
    const context = { window: {}, PoolCalendarService, TeamScheduleService: {} };
    Object.assign(context, context.globalThis || {}, context.window || {});
    context.globalThis = context; context.self = context; context.window = context;
    vm.runInNewContext(source, context, { filename: sourcePath });

    assert.equal(typeof context.window.PoolHoursViewModelService, 'function');
  });
});
