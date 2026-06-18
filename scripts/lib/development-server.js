const path = require('path');

const DEVELOPMENT_BUILD_MARKER = path.join('tmp', 'development-build.txt');

module.exports = Object.freeze({ DEVELOPMENT_BUILD_MARKER });
