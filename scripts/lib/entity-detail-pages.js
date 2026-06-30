const ENTITY_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
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
    throw new Error(`Entity detail pages require ${fieldName}.`);
  }
  return value.trim();
}

function requireEntityId(value, fieldName) {
  const id = requireText(value, fieldName);
  if (!ENTITY_ID_PATTERN.test(id)) {
    throw new Error(`Entity detail pages require a safe ${fieldName}: ${id}.`);
  }
  return id;
}

function requireHttpsUrl(value, fieldName) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`Entity detail pages require a valid ${fieldName}.`);
  }
  if (url.protocol !== 'https:') {
    throw new Error(`Entity detail pages require an HTTPS ${fieldName}.`);
  }
  return url.href;
}

function createJsonLd(value) {
  return JSON.stringify(value, null, 2).replace(/</g, '\\u003c');
}

function createBreadcrumbs(homePageUrl, collectionName, collectionPath, pageName, pageUrl) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${homePageUrl}/` },
      { '@type': 'ListItem', position: 2, name: collectionName, item: `${homePageUrl}/${collectionPath}` },
      { '@type': 'ListItem', position: 3, name: pageName, item: pageUrl }
    ]
  };
}

function createPageSource({ canonicalUrl, collectionLabel, collectionUrl, description, details, entity, heading, title }) {
  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      entity,
      createBreadcrumbs(
        canonicalUrl.split('/').slice(0, 3).join('/'),
        collectionLabel,
        collectionUrl,
        heading,
        canonicalUrl
      )
    ]
  };
  const safeTitle = escapeHtml(title);
  const safeDescription = escapeHtml(description);
  return `<extends src="base.html">
  <block name="metadata">
    <title>${safeTitle}</title>
    <meta name="description" content="${safeDescription}" />
    <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />
    <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${safeTitle}" />
    <meta property="og:description" content="${safeDescription}" />
    <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
    <meta name="twitter:title" content="${safeTitle}" />
    <meta name="twitter:description" content="${safeDescription}" />
    <script type="application/ld+json">${createJsonLd(structuredData)}</script>
  </block>
  <block name="content">
    <nav class="entity-breadcrumbs" aria-label="Breadcrumb">
      <ol>
        <li><a href="index.html">Home</a></li>
        <li><a href="${escapeHtml(collectionUrl)}">${escapeHtml(collectionLabel)}</a></li>
        <li aria-current="page">${escapeHtml(heading)}</li>
      </ol>
    </nav>
    <h1>${escapeHtml(heading)}</h1>
    <div class="container entity-detail">
      ${details}
    </div>
  </block>
</extends>
`;
}

function createDefinitionList(items) {
  const rows = items.map(({ label, value }) => `        <dt>${escapeHtml(label)}</dt>\n        <dd>${value}</dd>`).join('\n');
  return `      <dl class="entity-detail__facts">\n${rows}\n      </dl>`;
}

function createPoolPage(pool, homePageUrl, year) {
  const id = requireEntityId(pool.id, 'pool ID');
  const name = requireText(pool.name, `${id} pool name`);
  const officialUrl = requireHttpsUrl(pool.caUrl, `${name} official URL`);
  const location = pool.location || {};
  const address = {
    street: requireText(location.street, `${name} street address`),
    city: requireText(location.city, `${name} city`),
    state: requireText(location.state, `${name} state`),
    zip: requireText(location.zip, `${name} ZIP code`)
  };
  const filename = `pool-${id}.html`;
  const canonicalUrl = `${homePageUrl}/${filename}`;
  const heading = `${name} Pool`;
  const description = `${heading} address, features, ${year} schedule links, and official Columbia Association information in Columbia, Maryland.`;
  const facts = [
    { label: 'Address', value: escapeHtml(`${address.street}, ${address.city}, ${address.state} ${address.zip}`) },
    ...(pool.phone ? [{ label: 'Phone', value: `<a href="tel:${escapeHtml(String(pool.phone).replace(/[^+\d]/g, ''))}">${escapeHtml(pool.phone)}</a>` }] : []),
    ...(Number.isFinite(pool.laneCount) ? [{ label: 'Pool', value: escapeHtml(`${pool.laneCount} lanes${pool.laneLength ? `, ${pool.laneLength} ${pool.laneLengthUnits || ''}`.trim() : ''}`) }] : []),
    ...(Array.isArray(pool.features) && pool.features.length > 0
      ? [{ label: 'Features', value: escapeHtml(pool.features.join(', ')) }]
      : [])
  ];
  const links = [
    `<a href="${escapeHtml(officialUrl)}" target="_blank" rel="noopener noreferrer">Official pool information</a>`,
    ...(pool.scheduleUrl ? [`<a href="${escapeHtml(requireHttpsUrl(pool.scheduleUrl, `${name} schedule URL`))}" target="_blank" rel="noopener noreferrer">Official ${year} schedule</a>`] : []),
    ...(location.googleMapsUrl ? [`<a href="${escapeHtml(requireHttpsUrl(location.googleMapsUrl, `${name} map URL`))}" target="_blank" rel="noopener noreferrer">Open map</a>`] : [])
  ];
  const entity = {
    '@type': 'SportsActivityLocation',
    '@id': `${canonicalUrl}#pool`,
    name: heading,
    url: canonicalUrl,
    sameAs: officialUrl,
    address: {
      '@type': 'PostalAddress',
      streetAddress: address.street,
      addressLocality: address.city,
      addressRegion: address.state,
      postalCode: address.zip,
      addressCountry: 'US'
    },
    ...(pool.phone ? { telephone: pool.phone } : {}),
    ...(Number.isFinite(location.lat) && Number.isFinite(location.lng) ? {
      geo: { '@type': 'GeoCoordinates', latitude: location.lat, longitude: location.lng }
    } : {}),
    ...(Array.isArray(pool.features) ? {
      amenityFeature: pool.features.map(feature => ({ '@type': 'LocationFeatureSpecification', name: feature, value: true }))
    } : {})
  };
    const details = `${createDefinitionList(facts)}
      <ul class="entity-detail__actions">${links.map(link => `<li>${link}</li>`).join('')}</ul>
      <p><a href="pools.html?pool=${encodeURIComponent(id)}">View current hours and details in the pool directory</a></p>`;
  return {
    canonicalUrl,
    filename,
    source: createPageSource({
      canonicalUrl,
      collectionLabel: 'Pools & Hours',
      collectionUrl: 'pools.html',
      description,
      details,
      entity,
      heading,
      title: `${heading}: ${year} Hours & Schedule`
    })
  };
}

function createTeamPage(team, homePageUrl, year) {
  const id = requireEntityId(team.id, 'team ID');
  const name = requireText(team.name, `${id} team name`);
  const officialUrl = requireHttpsUrl(team.url, `${name} official URL`);
  if (!Array.isArray(team.homePools) || team.homePools.length === 0) {
    throw new Error(`Entity detail pages require home pools for ${name}.`);
  }
  const homePools = team.homePools.map(pool => requireText(pool, `${name} home pool`));
  const practicePools = Array.isArray(team.practicePools)
    ? team.practicePools.map(pool => requireText(pool, `${name} practice pool`))
    : [];
  const filename = `team-${id}.html`;
  const canonicalUrl = `${homePageUrl}/${filename}`;
  const description = `${name} home pools, practice locations, ${year} schedule links, and official CNSL team information in Columbia, Maryland.`;
  const facts = [
    { label: homePools.length === 1 ? 'Home pool' : 'Home pools', value: escapeHtml(homePools.join(', ')) },
    ...(practicePools.length > 0 ? [{ label: practicePools.length === 1 ? 'Practice pool' : 'Practice pools', value: escapeHtml(practicePools.join(', ')) }] : [])
  ];
  const links = [
    `<a href="${escapeHtml(officialUrl)}" target="_blank" rel="noopener noreferrer">Official team website</a>`,
    ...(team.calendarUrl ? [`<a href="${escapeHtml(requireHttpsUrl(team.calendarUrl, `${name} calendar URL`))}" target="_blank" rel="noopener noreferrer">Official team calendar</a>`] : []),
    ...(team.practice?.url ? [`<a href="${escapeHtml(requireHttpsUrl(team.practice.url, `${name} practice URL`))}" target="_blank" rel="noopener noreferrer">Official practice information</a>`] : [])
  ];
  const entity = {
    '@type': 'SportsTeam',
    '@id': `${canonicalUrl}#team`,
    name,
    url: canonicalUrl,
    sameAs: officialUrl,
    sport: 'Swimming',
    memberOf: { '@type': 'SportsOrganization', name: 'Columbia Neighborhood Swim League' },
    location: homePools.map(pool => ({ '@type': 'Place', name: `${pool} Pool` }))
  };
    const details = `${createDefinitionList(facts)}
      <ul class="entity-detail__actions">${links.map(link => `<li>${link}</li>`).join('')}</ul>
      <p><a href="teams.html?team=${encodeURIComponent(id)}">View practices and team details in the team directory</a></p>`;
  return {
    canonicalUrl,
    filename,
    source: createPageSource({
      canonicalUrl,
      collectionLabel: 'Swim Teams',
      collectionUrl: 'teams.html',
      description,
      details,
      entity,
      heading: name,
      title: `${name}: ${year} CNSL Swim Team`
    })
  };
}

function createEntityDetailPages({ homePageUrl, pools, teams, year }) {
  const safeHomePageUrl = requireHttpsUrl(homePageUrl, 'home-page URL').replace(/\/$/, '');
  if (!Array.isArray(pools) || !Array.isArray(teams)) {
    throw new Error('Entity detail pages require pool and team collections.');
  }
  return [
    ...pools.map(pool => createPoolPage(pool, safeHomePageUrl, year)),
    ...teams.map(team => createTeamPage(team, safeHomePageUrl, year))
  ];
}

module.exports = { createEntityDetailPages };
