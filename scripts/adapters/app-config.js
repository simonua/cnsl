const { createClassicScriptLoader } = require('../lib/classic-script-loader.js');
const { readPackageVersion } = require('../lib/package-version.js');

const loader = createClassicScriptLoader({ inject: { APP_VERSION: readPackageVersion(), URL, URLSearchParams } });
loader.load('config/app-config.js');

module.exports = loader.get('AppConfig');
