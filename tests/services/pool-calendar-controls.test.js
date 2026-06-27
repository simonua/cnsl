const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadControls() {
  const sourcePath = path.join(__dirname, '..', '..', 'src', 'js', 'pool-calendar-controls.js');
  const source = fs.readFileSync(sourcePath, 'utf8');
  const context = { window: {} };
  Object.assign(context, context.globalThis || {}, context.window || {});
  context.globalThis = context; context.self = context; context.window = context;
  vm.runInNewContext(source, context, { filename: sourcePath });
  return context.window.PoolCalendarControls;
}

function createActions(calls) {
  return {
    toggleCard: button => calls.push(['toggle', button]),
    previousWeek: poolId => calls.push(['previous', poolId]),
    nextWeek: poolId => calls.push(['next', poolId]),
    today: poolId => calls.push(['today', poolId]),
    selectedWeek: (poolId, value) => calls.push(['selected', poolId, value])
  };
}

describe('PoolCalendarControls', () => {
  it('routes disclosure and calendar navigation clicks', () => {
    const controls = loadControls();
    const calls = [];
    const actions = createActions(calls);
    const navigation = { dataset: { poolId: 'bwp' } };
    const createTarget = className => ({
      classList: { contains: value => value === className },
      closest: selector => selector === '.pool-week-navigation' ? navigation : null
    });

    controls.handleClick({ target: createTarget('prev-week') }, actions);
    controls.handleClick({ target: createTarget('next-week') }, actions);
    controls.handleClick({ target: createTarget('today-btn') }, actions);

    const toggle = {};
    controls.handleClick({ target: { closest: selector => selector === '[data-pool-card-action="toggle"]' ? toggle : null } }, actions);
    assert.deepEqual(calls.map(call => call[0]), ['previous', 'next', 'today', 'toggle']);
  });

  it('expands a collapsed card before handling nested controls', () => {
    const controls = loadControls();
    const calls = [];
    const toggle = { getAttribute: () => 'false' };
    const card = { querySelector: () => toggle };
    const target = { closest: selector => selector === '[data-pool-card]' ? card : null };
    controls.handleClick({ target }, createActions(calls));
    assert.deepEqual(calls, [['toggle', toggle]]);
  });

  it('toggles an expanded card from its header and ignores unrelated clicks', () => {
    const controls = loadControls();
    const calls = [];
    const toggle = { getAttribute: () => 'true' };
    const card = { querySelector: () => toggle };
    const target = {
      classList: { contains: () => false },
      closest: selector => {
        if (selector === '[data-pool-card]') return card;
        if (selector === '[data-pool-card-header]') return {};
        return null;
      }
    };
    controls.handleClick({ target }, createActions(calls));
    assert.deepEqual(calls, [['toggle', toggle]]);

    const unrelated = { classList: { contains: () => false }, closest: () => null };
    assert.equal(controls.handleClick({ target: unrelated }, createActions(calls)), undefined);
  });

  it('opens the native week picker without runtime style attributes', () => {
    const controls = loadControls();
    let clicked = false;
    let shown = false;
    const picker = {
      classList: { add: value => { assert.equal(value, 'active'); } },
      click: () => { clicked = true; },
      showPicker: () => { shown = true; }
    };
    const navigation = { querySelector: () => picker };
    const button = { setAttribute: () => {} };
    controls.showPicker(button, navigation);
    assert.equal(picker.hidden, false);
    assert.equal(clicked, true);
    assert.equal(shown, true);
    assert.equal(controls.showPicker(button, { querySelector: () => null }), undefined);
  });

  it('opens the week picker from its delegated calendar control and supports focus fallback', () => {
    const controls = loadControls();
    let focused = false;
    const picker = {
      classList: { add: () => {} },
      click: () => {},
      focus: () => { focused = true; }
    };
    const navigation = {
      dataset: { poolId: 'bwp' },
      querySelector: () => picker
    };
    const target = {
      classList: { contains: value => value === 'calendar-btn' },
      closest: selector => selector === '.pool-week-navigation' ? navigation : null,
      setAttribute: () => {}
    };
    controls.handleClick({ target }, createActions([]));
    assert.equal(focused, true);
  });

  it('applies selected dates and returns focus to the calendar button', () => {
    const controls = loadControls();
    const calls = [];
    let focused = false;
    const button = { setAttribute: () => {}, focus: () => { focused = true; } };
    const navigation = { dataset: { poolId: 'bwp' }, querySelector: () => button };
    const picker = {
      value: '2026-06-15',
      classList: { contains: value => value === 'week-picker' },
      closest: () => navigation
    };
    controls.handleChange({ target: picker }, createActions(calls));
    assert.deepEqual(calls, [['selected', 'bwp', '2026-06-15']]);
    assert.equal(picker.hidden, true);
    assert.equal(focused, true);
    assert.equal(controls.handleChange({ target: { classList: { contains: () => false } } }, createActions(calls)), undefined);
    assert.equal(controls.handleChange({ target: { classList: { contains: () => true }, closest: () => null } }, createActions(calls)), undefined);

    const pickerWithoutButton = {
      value: '2026-06-22',
      classList: { contains: () => true },
      closest: () => ({ dataset: { poolId: 'bwp' }, querySelector: () => null })
    };
    controls.handleChange({ target: pickerWithoutButton }, createActions(calls));
    assert.deepEqual(calls.at(-1), ['selected', 'bwp', '2026-06-22']);
  });
});
