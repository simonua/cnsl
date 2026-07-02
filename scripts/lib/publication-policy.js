const path = require('node:path');

const REQUIRED_ROOT_STATIC_FILES = Object.freeze([
  'browserconfig.xml',
  'CNAME',
  'LICENSE',
  'manifest.webmanifest',
  'robots.txt',
  'sitemap.xml'
]);

const SITE_VERIFICATION_SOURCE_DIRECTORY = path.join('src', 'site-verification');
const SITE_VERIFICATION_FILES = Object.freeze([
  'BingSiteAuth.xml',
  'b95676755a0a47f2965553d9f994f87f.txt',
  'google3dd9d57115818ebb.html'
]);

const ROOT_ICON_ALIASES = Object.freeze({
  'apple-touch-icon-120x120-precomposed.png': path.join('src', 'assets', 'favicons', 'apple-touch-icon.png'),
  'apple-touch-icon-120x120.png': path.join('src', 'assets', 'favicons', 'apple-touch-icon.png'),
  'apple-touch-icon-precomposed.png': path.join('src', 'assets', 'favicons', 'apple-touch-icon.png'),
  'apple-touch-icon.png': path.join('src', 'assets', 'favicons', 'apple-touch-icon.png'),
  'favicon.ico': path.join('src', 'assets', 'favicons', 'favicon.ico')
});

module.exports = {
  REQUIRED_ROOT_STATIC_FILES,
  ROOT_ICON_ALIASES,
  SITE_VERIFICATION_FILES,
  SITE_VERIFICATION_SOURCE_DIRECTORY
};
