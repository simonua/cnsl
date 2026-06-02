const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const PoolHoursDisplay = require('../../src/js/services/pool-hours-display.js');

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
    assert.match(html, /data-pool-id="pool&quot;&gt;&lt;script&gt;"/);
    assert.match(html, /status-green/);
    assert.match(html, /🟢 Open &lt;public&gt;/);
    assert.doesNotMatch(html, /&lt;open&gt;/);
    assert.match(html, /<span class="tooltip-text">Open &lt;tip&gt;<\/span>/);
    assert.match(html, /Opens in 15 min/);
    assert.match(html, /min="2026-06-01" max="2026-06-30"/);
    assert.match(html, /pool-schedule-list/);
    assert.doesNotMatch(html, /<script>/);
  });

  it('renders the retained schedule and availability fallback states', () => {
    assert.match(PoolHoursDisplay.renderAvailabilityMessage('<missing>'), /&lt;missing&gt;/);
    assert.match(PoolHoursDisplay.renderScheduleMissing(), /Schedule TBD/);
    assert.match(PoolHoursDisplay.renderTimeUtilityMessage('<time>'), /&lt;time&gt;/);
  });

  it('uses safe defaults for unsupported status colors and missing view data', () => {
    const html = PoolHoursDisplay.render({ poolStatus: { color: 'purple' }, weekSchedule: [], scheduleOptions: {} });
    assert.match(html, /status-gray/);
    assert.match(html, /class="nav-btn calendar-btn"[^]*?disabled/);
  });

  it('installs the display helper as a browser script global', () => {
    const sourcePath = path.join(__dirname, '..', '..', 'src', 'js', 'services', 'pool-hours-display.js');
    const source = fs.readFileSync(sourcePath, 'utf8');
    const context = {
      window: {},
      HtmlSafety: { escapeHtml: value => String(value).replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character])) },
      IconCatalog: { getPoolStatusGlyph: () => '⚫', render: () => '' },
      PoolScheduleDisplay: { render: () => '', formatPublicStatusTransition: () => '', getPublicStatusTransitionClass: () => 'pool-status-countdown' }
    };
    vm.runInNewContext(source, context, { filename: sourcePath });

    assert.equal(typeof context.window.PoolHoursDisplay, 'function');
  });
});
