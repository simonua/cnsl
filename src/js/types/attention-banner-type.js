/**
 * Defines the supported semantic attention-banner types.
 */
class AttentionBannerType {
  static VALUES = Object.freeze({
    INFORMATION: 'information',
    WARNING: 'warning'
  });

  /**
   * Determines whether a value is a supported attention-banner type.
   * @param {*} value - Candidate banner type
   * @returns {boolean} Whether the value is supported
   */
  static isSupported(value) {
    return Object.values(AttentionBannerType.VALUES).includes(value);
  }
}

Object.freeze(AttentionBannerType);
globalThis.AttentionBannerType = AttentionBannerType;
