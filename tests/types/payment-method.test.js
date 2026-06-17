const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const activeTeamSchema = require('../../src/assets/data/2026/teams/teams.schema.json');
const { PaymentMethod } = require('../helpers/browser-module-loader.js').loadBrowserModule('payment-method');

describe('PaymentMethod', () => {
  it('defines one immutable canonical value set', () => {
    assert.deepEqual(Array.from(PaymentMethod.getValues()), ['cash', 'credit', 'other', 'paypal', 'venmo']);
    assert.equal(PaymentMethod.CASH, 'cash');
    assert.equal(PaymentMethod.CREDIT, 'credit');
    assert.equal(PaymentMethod.OTHER, 'other');
    assert.equal(PaymentMethod.PAYPAL, 'paypal');
    assert.equal(PaymentMethod.VENMO, 'venmo');
    assert.equal(Object.isFrozen(PaymentMethod), true);
  });

  it('validates and filters annual payment methods without repairing unsupported data', () => {
    assert.equal(PaymentMethod.isValid(PaymentMethod.PAYPAL), true);
    assert.equal(PaymentMethod.isValid('PayPal'), false);
    assert.equal(PaymentMethod.isValid(null), false);
    assert.deepEqual(
      Array.from(PaymentMethod.filterValid(['venmo', 'PayPal', 'cash', 'venmo', 'paypal'])),
      ['venmo', 'cash', 'paypal']
    );
    assert.deepEqual(Array.from(PaymentMethod.filterValid(null)), []);
  });

  it('stays aligned with the active annual team schema', () => {
    const schemaValues = activeTeamSchema.definitions.HomeMeetConcessions
      .properties.paymentMethods.items.enum;

    assert.deepEqual([...schemaValues].sort(), Array.from(PaymentMethod.getValues()).sort());
  });
});
