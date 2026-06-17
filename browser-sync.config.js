module.exports = {
  files: [
    'src/views/**/*.html',
    'src/css/**/*.css',
    'src/js/**/*.js',
    'src/assets/data/2026/**/*.json'
  ],
  injectChanges: false,
  notify: false,
  open: false,
  port: 9090,
  reloadDebounce: 1250,
  reloadDelay: 2500,
  script: {
    domain: () => ''
  },
  server: 'out',
  watchEvents: ['add', 'change']
};
