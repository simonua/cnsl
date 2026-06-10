const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { HtmlSafety } = require('../helpers/browser-module-loader.js').loadBrowserModule('html-safety');

describe('HtmlSafety', () => {
  describe('escapeHtml', () => {
    it('encodes text and attribute delimiters', () => {
      assert.equal(
        HtmlSafety.escapeHtml('<img src="x" onerror=\'bad\'>&'),
        '&lt;img src=&quot;x&quot; onerror=&#39;bad&#39;&gt;&amp;'
      );
    });

    it('returns an empty string for missing values', () => {
      assert.equal(HtmlSafety.escapeHtml(null), '');
      assert.equal(HtmlSafety.escapeHtml(undefined), '');
    });
  });

  describe('safeHttpUrl', () => {
    it('allows HTTP links and encodes attribute-breaking characters', () => {
      assert.equal(
        HtmlSafety.safeHttpUrl('https://example.com/path?label=a&b=two'),
        'https://example.com/path?label=a&amp;b=two'
      );
    });

    it('rejects executable and malformed destinations', () => {
      assert.equal(HtmlSafety.safeHttpUrl(''), '');
      assert.equal(HtmlSafety.safeHttpUrl('http://example.com/path'), 'http://example.com/path');
      assert.equal(HtmlSafety.safeHttpUrl('javascript:alert(1)'), '');
      assert.equal(HtmlSafety.safeHttpUrl('not a URL'), '');
    });
  });

  describe('contact destinations', () => {
    it('builds safe mail links with readable valid addresses', () => {
      assert.equal(HtmlSafety.safeMailtoUrl('coach@example.org'), 'mailto:coach@example.org');
      assert.equal(HtmlSafety.safeMailtoUrl(null), '');
      assert.equal(HtmlSafety.safeMailtoUrl('coach@example.org\r\nBcc:bad@example.org'), '');
    });

    it('normalizes phone destinations and rejects injected values', () => {
      assert.equal(HtmlSafety.safeTelephoneUrl('(410) 555-0100'), 'tel:4105550100');
      assert.equal(HtmlSafety.safeTelephoneUrl(null), '');
      assert.equal(HtmlSafety.safeTelephoneUrl('+'), '');
      assert.equal(HtmlSafety.safeTelephoneUrl('410-555-0100 onclick=bad'), '');
    });
  });

  describe('browser registration', () => {
    it('installs the safety encoder as a browser script global', () => {
      const sourcePath = path.join(__dirname, '..', '..', 'src', 'js', 'services', 'html-safety.js');
      const source = fs.readFileSync(sourcePath, 'utf8');
      const context = { window: {} };
      Object.assign(context, context.globalThis || {}, context.window || {});
      context.globalThis = context; context.self = context; context.window = context;
      vm.runInNewContext(source, context, { filename: sourcePath });
      assert.equal(typeof context.window.HtmlSafety, 'function');
    });
  });
});
