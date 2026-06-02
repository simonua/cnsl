/**
 * Project-owned icon references for generated markup and intentional text glyphs.
 */
if (typeof window === 'undefined' || !window.IconCatalog) {
  const ICON_NAMES = new Set([
    'book-open', 'calendar', 'clipboard-list', 'clock', 'facebook', 'globe',
    'home', 'info', 'mail', 'map', 'map-pin', 'message-circle', 'moon',
    'phone', 'pool', 'qr-code', 'runner', 'settings', 'shirt', 'shirt-plus',
    'sparkles', 'stopwatch', 'sun', 'swimmer', 'trophy', 'warning-triangle'
  ]);
  const TEXT_GLYPHS = Object.freeze({
    error: '❌',
    statusClosed: '🔴',
    statusOpen: '🟢',
    statusRestricted: '🟡',
    statusUnavailable: '⚫',
    time: '🕐',
    warning: '⚠️',
    weatherClear: '☀️',
    weatherCloudy: '☁️',
    weatherFog: '🌫️',
    weatherPartlyCloudy: '⛅',
    weatherRain: '🌧️',
    weatherSnow: '❄️',
    weatherStorm: '⛈️',
    weatherUnknown: '🌤️'
  });
  const STATUS_GLYPH_NAMES = Object.freeze({
    closed: 'statusClosed',
    'closed-to-public': 'statusClosed',
    open: 'statusOpen',
    'practice-only': 'statusRestricted',
    restricted: 'statusRestricted',
    'schedule-not-found': 'statusUnavailable',
    'swim-meet': 'statusRestricted',
    unavailable: 'statusUnavailable'
  });

  function getTextGlyph(name) {
    return TEXT_GLYPHS[name] || '';
  }

  function getPoolStatusGlyph(kind) {
    return getTextGlyph(STATUS_GLYPH_NAMES[kind] || 'statusUnavailable');
  }

  function render(name, className = '') {
    if (!ICON_NAMES.has(name)) return '';
    if (className && !/^[a-zA-Z0-9_-]+(?: [a-zA-Z0-9_-]+)*$/.test(className)) return '';
    const classAttribute = className ? `icon ${className}` : 'icon';
    return `<svg class="${classAttribute}" aria-hidden="true" focusable="false"><use href="#icon-${name}"></use></svg>`;
  }

  const IconCatalog = Object.freeze({ getPoolStatusGlyph, getTextGlyph, render });

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = IconCatalog;
  }
  if (typeof window !== 'undefined') {
    window.IconCatalog = IconCatalog;
  }
}