const { createClassicScriptLoader } = require('../lib/classic-script-loader.js');
const { readPackageVersion } = require('../lib/package-version.js');

const loader = createClassicScriptLoader({ inject: { APP_VERSION: readPackageVersion(), URL, URLSearchParams } });
loader.load([
  'config/app-config.js',
  'types/weather-alert-source.js',
  'services/weather-freshness-service.js',
  'services/weather-alert-service.js'
]);

module.exports = loader.get('WeatherAlertService');
