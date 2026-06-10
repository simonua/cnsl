const { createClassicScriptLoader } = require('../lib/classic-script-loader.js');

const loader = createClassicScriptLoader({ inject: { URL, URLSearchParams } });
loader.load('config/app-config.js');

module.exports = loader.get('AppConfig');
