const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const posthtml = require('posthtml');
const { stripAuthoringComments } = require('../../scripts/lib/html-output.js');

describe('HTML output', () => {
  it('should strip source-only comments while preserving rendered markup and text', async () => {
    const source = [
      '<!-- Page region -->',
      '<main>',
      '  <p>Before<!-- inline note -->after</p>',
      '  <!--',
      '    Multiline authoring note.',
      '  -->',
      '  <section><p>Content</p></section>',
      '</main>'
    ].join('\n');

    const result = await posthtml()
      .use(stripAuthoringComments)
      .process(source);

    assert.doesNotMatch(result.html, /<!--/);
    assert.match(result.html, /<p>Beforeafter<\/p>/);
    assert.match(result.html, /<section><p>Content<\/p><\/section>/);
  });
});
