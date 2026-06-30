const { createClassicScriptLoader } = require('../lib/classic-script-loader.js');
const { readPackageVersion } = require('../lib/package-version.js');

const loader = createClassicScriptLoader({ inject: { APP_VERSION: readPackageVersion(), URL, URLSearchParams } });
loader.load([
  'config/app-config.js',
  'services/icon-catalog.js',
  'services/time-utils.js',
  'types/schedule-state.js',
  'services/team-schedule-service.js'
]);

module.exports = loader.get('TeamScheduleService');
