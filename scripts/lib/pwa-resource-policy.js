const CACHE_ON_USE_SCRIPT_RESOURCES = Object.freeze([
  'js/flyer-preview.js',
  'js/lessons-browser.js',
  'js/my-meet-day.js',
  'js/services/lesson-provider-service.js'
]);

const INSTALL_CRITICAL_PAGES = Object.freeze([
  'index.html',
  'meets.html',
  'offline.html',
  'pools.html',
  'settings.html',
  'teams.html'
]);

module.exports = { CACHE_ON_USE_SCRIPT_RESOURCES, INSTALL_CRITICAL_PAGES };