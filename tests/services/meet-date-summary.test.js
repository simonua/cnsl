const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { createMeetDateSummaryNode } = require('../../scripts/lib/meet-date-summary.js');

function getCards(summaryNode) {
  return summaryNode.content.filter(node => node.tag === 'article');
}

function getToggle(cardNode) {
  return cardNode.content[0].content[0].content[0].content[0];
}

function getMeetName(cardNode) {
  return cardNode.content[0].content[0].content[1].content[0];
}

describe('meet date summary', () => {
  it('creates one sorted collapsed card for each published date', () => {
    const summary = createMeetDateSummaryNode({
      regular_meets: [
        { date: '2026-06-20', name: 'Dual Meet #2' },
        { date: '2026-06-13', name: 'Dual Meet #1' },
        { date: '2026-06-13', name: 'Another matchup' }
      ],
      special_meets: [{ date: '2026-06-06', name: 'Time Trials' }]
    });
    const cards = getCards(summary);

    assert.deepEqual(cards.map(card => card.attrs['data-meet-date']), [
      '2026-06-06',
      '2026-06-13',
      '2026-06-20'
    ]);
    assert.equal(cards[0].attrs.id, 'meet-date-2026-06-06');
    assert.equal(getToggle(cards[0]).content[0].attrs.datetime, '2026-06-06');
    assert.equal(getToggle(cards[0]).content[0].content[0], 'Saturday, June 6, 2026');
    assert.equal(getToggle(cards[1]).attrs['aria-controls'], 'meet-details-2026-06-13');
    assert.equal(getMeetName(cards[1]), 'Dual Meet #1');
    assert.equal(cards[1].attrs.class, 'meet-date-card collapsed');
    const template = summary.content.at(-1);
    const templateCard = template.content[0];
    assert.equal(template.tag, 'template');
    assert.equal(template.attrs.id, 'meetDateCardTemplate');
    assert.equal(templateCard.attrs.id, undefined);
    assert.equal(getToggle(templateCard).content[0].attrs.datetime, undefined);
  });

  it('escapes published names and rejects invalid records', () => {
    const summary = createMeetDateSummaryNode({
      regular_meets: [{ date: '2026-06-13', name: '<img src=x onerror=alert(1)> & Meet' }],
      special_meets: []
    });

    assert.equal(getMeetName(getCards(summary)[0]), '&lt;img src=x onerror=alert(1)&gt; &amp; Meet');
    assert.throws(
      () => createMeetDateSummaryNode({ regular_meets: [{ date: 'June 13', name: 'Meet' }], special_meets: [] }),
      /valid meet date/
    );
    assert.throws(
      () => createMeetDateSummaryNode({ regular_meets: [], special_meets: [] }),
      /at least one published meet/
    );
  });
});
