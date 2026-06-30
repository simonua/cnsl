const HTML_ESCAPES = Object.freeze({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
});

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => HTML_ESCAPES[character]);
}

function requireText(value, fieldName) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Search directory summary requires ${fieldName}.`);
  }
  return value.trim();
}

function createSummaryNode({ heading, headingId, intro, items }) {
  return {
    tag: 'section',
    attrs: {
      class: 'search-directory-summary',
      'aria-labelledby': headingId
    },
    content: [
      {
        tag: 'h2',
        attrs: { class: 'search-directory-summary__heading', id: headingId },
        content: [escapeHtml(heading)]
      },
      {
        tag: 'p',
        attrs: { class: 'search-directory-summary__intro' },
        content: [escapeHtml(intro)]
      },
      {
        tag: 'ul',
        attrs: { class: 'search-directory-summary__list' },
        content: items
      }
    ]
  };
}

function createItemNode({ detail, name, url }) {
  return {
    tag: 'li',
    attrs: { class: 'search-directory-summary__item' },
    content: [
      {
        tag: 'a',
        attrs: { href: url },
        content: [escapeHtml(name)]
      },
      {
        tag: 'span',
        attrs: { class: 'search-directory-summary__detail' },
        content: [escapeHtml(detail)]
      }
    ]
  };
}

function byName(firstRecord, secondRecord) {
  return firstRecord.name.localeCompare(secondRecord.name);
}

function createPoolSummaryNode(pools, year) {
  const items = pools.map(pool => {
    const name = requireText(pool.name, 'pool name');
    const location = pool.location || {};
    const street = requireText(location.street, `${name} street address`);
    const city = requireText(location.city, `${name} city`);
    const state = requireText(location.state, `${name} state`);
    const zip = requireText(location.zip, `${name} ZIP code`);
    return {
      detail: `${street}, ${city}, ${state} ${zip}`,
      name: `${name} Pool`,
      sortName: name,
      url: `pool-${requireText(pool.id, `${name} ID`)}.html`
    };
  }).sort((firstItem, secondItem) => firstItem.sortName.localeCompare(secondItem.sortName))
    .map(createItemNode);

  return createSummaryNode({
    heading: `${year} Columbia Association Outdoor Pools`,
    headingId: 'poolDirectorySummaryTitle',
    intro: 'Browse pool names and Columbia addresses while current hours and schedules load. Each name opens a pool information page.',
    items
  });
}

function createTeamSummaryNode(teams, year) {
  const items = teams.map(team => {
    const name = requireText(team.name, 'team name');
    if (!Array.isArray(team.homePools) || team.homePools.length === 0) {
      throw new Error(`Search directory summary requires home pools for ${name}.`);
    }
    const homePools = team.homePools.map(pool => requireText(pool, `${name} home pool`));
    return {
      detail: `Home ${homePools.length === 1 ? 'pool' : 'pools'}: ${homePools.join(', ')}`,
      name,
      url: `team-${requireText(team.id, `${name} ID`)}.html`
    };
  }).sort(byName).map(createItemNode);

  return createSummaryNode({
    heading: `${year} Columbia Neighborhood Swim League Teams`,
    headingId: 'teamDirectorySummaryTitle',
    intro: 'Browse CNSL teams and home pools while practice details load. Each name opens a team information page.',
    items
  });
}

module.exports = { createPoolSummaryNode, createTeamSummaryNode };
