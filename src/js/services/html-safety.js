/**
 * Encodes maintained or externally supplied values before they enter generated markup.
 */
if (typeof window === 'undefined' || !window.HtmlSafety) {
  class HtmlSafety {
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

    static safeMailtoUrl(value) {
      const email = String(value || '').trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return '';
      return `mailto:${encodeURIComponent(email)}`;
    }

    static safeTelephoneUrl(value) {
      const phone = String(value || '').trim();
      if (!phone || !/^[+\d().\s-]+$/.test(phone)) return '';

      const normalizedPhone = phone.replace(/[^+\d]/g, '');
      return /\d/.test(normalizedPhone) ? `tel:${normalizedPhone}` : '';
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = HtmlSafety;
  }

  if (typeof window !== 'undefined') {
    window.HtmlSafety = HtmlSafety;
  }
}