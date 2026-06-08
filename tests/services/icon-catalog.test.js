const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const IconCatalog = require('../../src/js/services/icon-catalog.js');

describe('IconCatalog', () => {
  it('renders allowlisted decorative SVG references', () => {
    assert.equal(
      IconCatalog.render('pool', 'detail-item__icon'),
      '<svg class="icon detail-item__icon" aria-hidden="true" focusable="false"><use href="#icon-pool"></use></svg>'
    );
    assert.match(IconCatalog.render('clock'), /class="icon"/);
    assert.match(IconCatalog.render('clock', 'one two'), /class="icon one two"/);
  });

  it('rejects unknown icon names and unsafe class names', () => {
    assert.equal(IconCatalog.render('unknown'), '');
    assert.equal(IconCatalog.render('pool', 'safe" onclick="bad'), '');
  });

  it('maps semantic pool status kinds to presentation glyphs', () => {
    assert.equal(IconCatalog.getTextGlyph('warning'), '⚠️');
    assert.equal(IconCatalog.getTextGlyph('missing'), '');
    assert.equal(IconCatalog.getPoolStatusGlyph('open'), '🟢');
    assert.equal(IconCatalog.getPoolStatusGlyph('practice-only'), '🟡');
    assert.equal(IconCatalog.getPoolStatusGlyph('closed'), '🔴');
    assert.equal(IconCatalog.getPoolStatusGlyph('unknown'), '⚫');
  });

  it('installs the catalog as a browser script global', () => {
    const sourcePath = path.join(__dirname, '..', '..', 'src', 'js', 'services', 'icon-catalog.js');
    const source = fs.readFileSync(sourcePath, 'utf8');
    const context = { window: {} };
    vm.runInNewContext(source, context, { filename: sourcePath });
    assert.equal(typeof context.window.IconCatalog.render, 'function');
  });
});