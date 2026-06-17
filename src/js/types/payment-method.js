/**
 * Canonical payment methods accepted by recurring home-meet concessions.
 */

/** @typedef {'cash'|'credit'|'other'|'paypal'|'venmo'} PaymentMethodValue */

if (typeof globalThis.PaymentMethod === 'undefined') {
  /** Defines and validates the payment-method values shared by annual data and My Meet Day. */
  class PaymentMethod {
    /** @type {PaymentMethodValue} */
    static CASH = 'cash';
    /** @type {PaymentMethodValue} */
    static CREDIT = 'credit';
    /** @type {PaymentMethodValue} */
    static OTHER = 'other';
    /** @type {PaymentMethodValue} */
    static PAYPAL = 'paypal';
    /** @type {PaymentMethodValue} */
    static VENMO = 'venmo';

    /**
     * Returns every canonical payment method in stable display-neutral order.
     * @returns {PaymentMethodValue[]} Canonical payment methods
     */
    static getValues() {
      return [
        PaymentMethod.CASH,
        PaymentMethod.CREDIT,
        PaymentMethod.OTHER,
        PaymentMethod.PAYPAL,
        PaymentMethod.VENMO
      ];
    }

    /**
     * Checks whether a value is a canonical payment method.
     * @param {*} value - Value to validate
     * @returns {boolean} Whether the value is supported
     */
    static isValid(value) {
      return PaymentMethod.getValues().includes(value);
    }

    /**
     * Filters an annual-data value to unique canonical methods while preserving source order.
     * @param {*} values - Candidate payment-method collection
     * @returns {PaymentMethodValue[]} Valid unique payment methods
     */
    static filterValid(values) {
      if (!Array.isArray(values)) return [];
      return [...new Set(values.filter(value => PaymentMethod.isValid(value)))];
    }
  }

  Object.freeze(PaymentMethod);
  globalThis.PaymentMethod = PaymentMethod;
}
