const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  createPoolSummaryNode,
  createTeamSummaryNode
} = require('../../scripts/lib/search-directory-summary.js');

function getListItems(summaryNode) {
  return summaryNode.content.find(node => node.tag === 'ul').content;
}

describe('search directory summary', () => {
  it('creates sorted pool links with escaped names and complete addresses', () => {
    const summary = createPoolSummaryNode([
      {
        id: 'zulu',
        name: 'Zulu',
        caUrl: 'https://example.com/zulu',
        location: { street: '2 Main St', city: 'Columbia', state: 'MD', zip: '21045' }
      },
      {
        id: 'alpha',
        name: 'Alpha & <Pool>',
        caUrl: 'https://example.com/alpha?source=directory',
        location: { street: '1 Main & Oak', city: 'Columbia', state: 'MD', zip: '21044' }
      }
    ], 2026);
    const items = getListItems(summary);

    assert.equal(summary.tag, 'section');
    assert.equal(summary.attrs['aria-labelledby'], 'poolDirectorySummaryTitle');
    assert.equal(items[0].content[0].content[0], 'Alpha &amp; &lt;Pool&gt; Pool');
    assert.equal(items[0].content[0].attrs.href, 'pool-alpha.html');
    assert.equal(items[0].content[0].attrs.target, undefined);
    assert.equal(items[0].content[1].content[0], '1 Main &amp; Oak, Columbia, MD 21044');
    assert.equal(items[1].content[0].content[0], 'Zulu Pool');
  });

  it('creates sorted team links with singular and plural home-pool labels', () => {
    const summary = createTeamSummaryNode([
      { id: 'two', name: 'Two Pools', url: 'https://example.com/two', homePools: ['North', 'South'] },
      { id: 'one', name: 'One Pool', url: 'https://example.com/one', homePools: ['Central'] }
    ], 2026);
    const items = getListItems(summary);

    assert.equal(summary.attrs['aria-labelledby'], 'teamDirectorySummaryTitle');
    assert.equal(items[0].content[0].content[0], 'One Pool');
    assert.equal(items[0].content[1].content[0], 'Home pool: Central');
    assert.equal(items[0].content[0].attrs.href, 'team-one.html');
    assert.equal(items[1].content[1].content[0], 'Home pools: North, South');
  });

  it('rejects incomplete records', () => {
    assert.throws(
      () => createPoolSummaryNode([{
        name: 'Missing ID',
        caUrl: 'https://example.com',
        location: { street: '1 Main St', city: 'Columbia', state: 'MD', zip: '21044' }
      }], 2026),
      /Missing ID ID/
    );
    assert.throws(
      () => createTeamSummaryNode([{ id: 'no-home', name: 'No Home', url: 'https://example.com', homePools: [] }], 2026),
      /home pools for No Home/
    );
  });
});
