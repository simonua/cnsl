const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { PoolHoursDisplay, context } = require('../helpers/browser-module-loader.js').loadBrowserModule('pool-hours-display');
const { PoolTransitionAction } = context;

const timeUtils = {
  formatActivityTypes: activities => activities.join(', '),
  getCurrentEasternTimeInfo: () => ({ isValid: true, minutes: 0 }),
  isCurrentTimeSlot: () => false,
  timeStringToMinutes: time => Number.parseInt(time, 10) * 60,
  MINUTES_PER_DAY: 1440
};

const viewModel = {
  poolId: 'pool"><script>',
  poolName: 'Long <Reach>',
  weekPickerId: 'week-picker-long-reach',
  weekStartText: 'June 15',
  weekEndText: 'June 21',
  hasDateRange: true,
  isTodayDisabled: false,
  isPreviousWeekDisabled: false,
  isNextWeekDisabled: false,
  weekStartInputValue: '2026-06-15',
  minDateInputValue: '2026-06-01',
  maxDateInputValue: '2026-06-30',
  poolStatus: { kind: 'open', color: 'green', icon: '<open>', status: 'Open <public>' },
  statusTransition: { action: 'opens', minutes: 15 },
  statusTooltip: 'Open <tip>',
  weekSchedule: [{
    day: 'Mon',
    timeSlots: [{ startTime: '12:00pm', endTime: '7:00pm', activities: ['Rec Swim'], accessStatus: 'public', notes: '' }],
    hasOverrides: false
  }],
  scheduleOptions: {
    weekStart: new Date(2026, 5, 15),
    today: new Date(2026, 5, 15),
    timeUtils,
    poolStatus: { color: 'green' }
  }
};

describe('PoolHoursDisplay', () => {
  it('renders the pool hours panel from a display-ready view model', () => {
    const html = PoolHoursDisplay.render(viewModel);

    assert.match(html, /class="pool-hours"/);
    assert.match(html, /Week of June 15 - June 21/);
    assert.match(html, /aria-label="Choose a week for Long &lt;Reach&gt;"/);
    assert.match(html, /data-status-action="opens"/);
    assert.match(html, /pool-status-countdown--opens/);
    assert.match(html, /data-pool-id="pool&quot;&gt;&lt;script&gt;"/);
    assert.match(html, /status-green/);
    assert.match(html, /Open &lt;public&gt;/);
    assert.doesNotMatch(html, /&lt;open&gt;/);
    assert.match(html, /<span class="tooltip-text">Open &lt;tip&gt;<\/span>/);
    assert.match(html, /min="2026-06-01" max="2026-06-30"/);
    assert.match(html, /pool-schedule-list/);
    assert.doesNotMatch(html, /<script>/i);
  });

  it('renders the retained schedule and availability fallback states', () => {
    const availabilityHtml = PoolHoursDisplay.renderAvailabilityMessage('<missing>');
    const missingHtml = PoolHoursDisplay.renderScheduleMissing();
    const timeUtilityHtml = PoolHoursDisplay.renderTimeUtilityMessage('<time>');

    assert.match(availabilityHtml, /&lt;missing&gt;/);
    assert.doesNotMatch(availabilityHtml, /<missing>/);
    assert.ok(missingHtml.length > 0);
    assert.match(timeUtilityHtml, /&lt;time&gt;/);
    assert.doesNotMatch(timeUtilityHtml, /<time>/);
  });

  it('uses safe defaults for unsupported status colors and missing view data', () => {
    const html = PoolHoursDisplay.render({ poolStatus: { color: 'purple' }, weekSchedule: [], scheduleOptions: {} });
    assert.match(html, /status-gray/);
    assert.match(html, /class="nav-btn calendar-btn"[^]*?disabled/);
    assert.match(html, /aria-label="[^"]+"/);
    assert.match(html, /tooltip-text/);
    assert.doesNotMatch(html, /data-status-action=/);
    assert.doesNotMatch(html, / min="| max="/);
    assert.match(PoolHoursDisplay.render(null), /status-gray/);
    assert.doesNotMatch(PoolHoursDisplay.render({ weekSchedule: null, scheduleOptions: null }), /data-status-action=/);
    assert.match(PoolHoursDisplay.render({ hasDateRange: true }), /min="" max=""/);
  });

  it('renders each disabled navigation state and rejects unsupported transition actions', () => {
    const html = PoolHoursDisplay.render({
      ...viewModel,
      isTodayDisabled: true,
      isPreviousWeekDisabled: true,
      isNextWeekDisabled: true,
      statusTransition: { action: 'waits', minutes: 10 }
    });

    assert.match(html, /today-btn"[^>]*disabled/);
    assert.match(html, /prev-week"[^>]*disabled/);
    assert.match(html, /next-week"[^>]*disabled/);
    assert.doesNotMatch(html, /data-status-action=/);
  });

  it('uses the closing action class for detailed closing countdowns', () => {
    const html = PoolHoursDisplay.render({
      ...viewModel,
      statusTransition: { action: 'closes', minutes: 90 }
    });

    assert.match(html, /pool-status-countdown--closes/);
    assert.match(html, /data-status-action="closes"/);
  });

  it('installs the display helper as a browser script global', () => {
    const sourcePath = path.join(__dirname, '..', '..', 'src', 'js', 'services', 'pool-hours-display.js');
    const source = fs.readFileSync(sourcePath, 'utf8');
    const context = {
      PoolTransitionAction,
      HtmlSafety: { escapeHtml: value => String(value).replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character])) },
      IconCatalog: { getPoolStatusGlyph: () => '⚫', render: () => '' },
      PoolScheduleDisplay: {
        render: () => '',
        formatPublicStatusTransition: (transition, options) => options ? 'Long countdown' : 'Countdown',
        getPublicStatusTransitionClass: () => 'pool-status-countdown'
      }
    };
    context.globalThis = context;
    context.self = context;
    context.window = context;
    vm.runInNewContext(source, context, { filename: sourcePath });

    assert.equal(typeof context.window.PoolHoursDisplay, 'function');
    assert.match(
      context.window.PoolHoursDisplay.render({ statusTransition: { action: 'waits' } }),
      /data-status-action="" aria-label="Long countdown">Countdown/
    );
  });
});
