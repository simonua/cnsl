const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { escapeHtml } = require('../../scripts/lib/html-escaping.js');

describe('build HTML escaping', () => {
  it('escapes every HTML text and quoted-attribute delimiter', () => {
    assert.equal(
      escapeHtml('<script data-value="one">Tom & Jerry\'s</script>'),
      '&lt;script data-value=&quot;one&quot;&gt;Tom &amp; Jerry&#39;s&lt;/script&gt;'
    );
  });

  it('coerces non-string values without interpreting markup', () => {
    assert.equal(escapeHtml(2026), '2026');
    assert.equal(escapeHtml(null), 'null');
  });
});
