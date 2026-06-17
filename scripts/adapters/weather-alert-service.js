const { createClassicScriptLoader } = require('../lib/classic-script-loader.js');

const loader = createClassicScriptLoader({ inject: { URL, URLSearchParams } });
loader.load([
  'config/app-config.js',
  'types/weather-alert-source.js',
  'services/weather-freshness-service.js',
  'services/weather-alert-service.js'
]);

module.exports = loader.get('WeatherAlertService');
