const directoryScenarios = [
  {
    reference: 'POOLS',
    path: '/pools.html',
    list: '#poolList',
    item: '.pool-card',
    domains: ['meets', 'pools', 'teams'],
    surface: '.pool-card.collapsed',
    toggle: '.pool-header__toggle'
  },
  {
    reference: 'TEAMS',
    path: '/teams.html',
    list: '#teamList',
    item: '.team-card',
    domains: ['meets', 'pools', 'teams'],
    surface: '.team-card.collapsed',
    toggle: '.team-header__toggle'
  },
  {
    reference: 'MEETS',
    path: '/meets.html',
    list: '#meetList',
    item: '.meet-date-card',
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
