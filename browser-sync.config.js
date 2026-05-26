module.exports = {
  files: ['out', 'out/**/*'],
  notify: false,
  open: false,
  port: 9090,
  reloadDebounce: 1250,
  script: {
    domain: () => ''
  },
  server: 'out',
  watchEvents: ['add', 'change']
};
