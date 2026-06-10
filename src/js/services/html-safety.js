/**
 * Encodes maintained or externally supplied values before they enter generated markup.
 */
if (typeof globalThis.HtmlSafety === 'undefined') {
  /** Escapes text and validates supported generated-markup destinations. */
  class HtmlSafety {
    /**
     * Escape a value for insertion into generated HTML text or attributes.
     * @param {*} value - Value to escape
     * @returns {string} HTML-escaped text
     */
    static escapeHtml(value) {
      if (value === null || value === undefined) return '';

      return String(value).replace(/[&<>'"]/g, character => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
      }[character]));
    }

    /**
     * Validate and escape an absolute HTTP or HTTPS URL.
     * @param {*} value - Candidate URL
     * @returns {string} Escaped normalized URL, or an empty string when invalid
     */
    static safeHttpUrl(value) {
      if (!value) return '';

      try {
        const url = new URL(String(value));
        if (url.protocol !== 'https:' && url.protocol !== 'http:') return '';
        return HtmlSafety.escapeHtml(url.href);
      } catch (_error) {
        return '';
      }
    }

    /**
     * Validate an email address and create a mail destination.
     * @param {*} value - Candidate email address
     * @returns {string} Mail URL, or an empty string when invalid
     */
    static safeMailtoUrl(value) {
      const email = String(value || '').trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return '';
      return `mailto:${encodeURIComponent(email).replace(/%40/g, '@')}`;
    }

    /**
     * Validate a telephone number and create a normalized call destination.
     * @param {*} value - Candidate telephone number
     * @returns {string} Telephone URL, or an empty string when invalid
     */
    static safeTelephoneUrl(value) {
      const phone = String(value || '').trim();
      if (!phone || !/^[+\d().\s-]+$/.test(phone)) return '';

      const normalizedPhone = phone.replace(/[^+\d]/g, '');
      return /\d/.test(normalizedPhone) ? `tel:${normalizedPhone}` : '';
    }
  }

  globalThis.HtmlSafety = HtmlSafety;
}
