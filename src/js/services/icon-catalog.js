/**
 * Project-owned icon references for generated markup and intentional text glyphs.
 */
if (typeof globalThis.IconCatalog === 'undefined') {
  const ICON_NAMES = new Set([
    'book-open', 'calendar', 'clipboard-list', 'clock', 'facebook', 'globe',
    'home', 'info', 'mail', 'map', 'map-pin', 'message-circle', 'moon',
    'phone', 'pool', 'qr-code', 'runner', 'settings', 'shirt', 'shirt-plus',
    'sparkles', 'stopwatch', 'sun', 'swimmer', 'trophy', 'warning-triangle', 'x-brand'
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
    weatherHail: '🧊',
    weatherLightning: '⚡',
    weatherPartlyCloudy: '⛅',
    weatherRain: '🌧️',
    weatherSnow: '❄️',
    weatherStorm: '⛈️',
    weatherTornado: '🌪️',
    weatherUnknown: '🌤️'
  });
  const STATUS_GLYPH_NAMES = Object.freeze({
    closed: 'statusClosed',
    'closed-to-public': 'statusClosed',
    open: 'statusOpen',
    'practice-only': 'statusRestricted',
    restricted: 'statusRestricted',
    'schedule-not-found': 'statusUnavailable',
    'special-event': 'statusRestricted',
    'swim-meet': 'statusRestricted',
    unavailable: 'statusUnavailable'
  });

  /**
   * Get a project-owned text glyph by semantic name.
   * @param {string} name - Glyph name
   * @returns {string} Glyph text, or an empty string when unknown
   */
  function getTextGlyph(name) {
    return TEXT_GLYPHS[name] || '';
  }

  /**
   * Get the decorative glyph for a semantic pool status.
   * @param {string} kind - Pool status kind
   * @returns {string} Status glyph text
   */
  function getPoolStatusGlyph(kind) {
    return getTextGlyph(STATUS_GLYPH_NAMES[kind] || 'statusUnavailable');
  }

  /**
   * Render a project-owned SVG icon reference.
   * @param {string} name - Registered icon name
   * @param {string} className - Optional safe CSS class names
   * @returns {string} SVG markup, or an empty string when invalid
   */
  function render(name, className = '') {
    if (!ICON_NAMES.has(name)) return '';
    if (className && !/^[a-zA-Z0-9_-]+(?: [a-zA-Z0-9_-]+)*$/.test(className)) return '';
    const classAttribute = className ? `icon ${className}` : 'icon';
    return `<svg class="${classAttribute}" aria-hidden="true" focusable="false"><use href="#icon-${name}"></use></svg>`;
  }

  const IconCatalog = Object.freeze({ getPoolStatusGlyph, getTextGlyph, render });

  globalThis.IconCatalog = IconCatalog;
}
