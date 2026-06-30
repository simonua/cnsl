const { DEVELOPMENT_BUILD_MARKER } = require('./scripts/lib/development-server.js');

module.exports = {
  // posthtml.js writes this stable marker only after the complete output is ready.
  files: [DEVELOPMENT_BUILD_MARKER],
  injectChanges: false,
  notify: false,
  open: false,
  port: 3100,
  reloadDebounce: 250,
  reloadDelay: 0,
  script: {
    domain: () => ''
  },
  server: 'out',
  watchEvents: ['add', 'change']
};
