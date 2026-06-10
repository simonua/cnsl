const { createClassicScriptLoader } = require('../lib/classic-script-loader.js');

const loader = createClassicScriptLoader({ inject: { URL, URLSearchParams } });
loader.load([
  'config/app-config.js',
  'services/icon-catalog.js',
  'services/time-utils.js',
  'types/schedule-state.js',
  'services/team-schedule-service.js'
]);

module.exports = loader.get('TeamScheduleService');
