const directoryScenarios = [
  {
    reference: 'POOLS',
    path: '/pools.html',
    list: '#poolList',
    status: '#poolListStatus',
    announcement: /Pool directory loaded\. 23 pools available\./,
    readyText: /Pool directory loaded\./,
    domains: ['meets', 'pools', 'teams'],
    surface: '.pool-card.collapsed',
    toggle: '.pool-header__toggle'
  },
  {
    reference: 'TEAMS',
    path: '/teams.html',
    list: '#teamList',
    status: '#teamListStatus',
    announcement: /Team directory loaded\./,
    readyText: /Team directory loaded\./,
    domains: ['meets', 'pools', 'teams'],
    surface: '.team-card.collapsed',
    toggle: '.team-header__toggle'
  },
  {
    reference: 'MEETS',
    path: '/meets.html',
    list: '#meetList',
    status: '#meetListStatus',
    announcement: /Meet schedule loaded\./,
    readyText: /Meet schedule loaded\./,
    domains: ['meets', 'pools', 'teams'],
    surface: '.meet-date-card.collapsed',
    toggle: '.meet-date-header__toggle'
  }
];

const publishedPagePaths = [
  '/index.html', '/pools.html', '/teams.html', '/meets.html', '/settings.html',
  '/my-meet-day.html', '/swim-meet-resources.html', '/lessons.html', '/whats-new.html', '/about.html', '/faq.html', '/offline.html'
];

module.exports = {
  directoryScenarios,
  publishedPagePaths
};
