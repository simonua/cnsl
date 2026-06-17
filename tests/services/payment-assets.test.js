const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const PNG_SIGNATURE = '89504e470d0a1a0a';
const RGBA_COLOR_TYPE = 6;

function readPngMetadata(filename) {
  const assetPath = path.join(__dirname, '..', '..', 'src', 'assets', 'images', 'payment-methods', filename);
  const bytes = fs.readFileSync(assetPath);
  return {
    colorType: bytes[25],
    height: bytes.readUInt32BE(20),
    signature: bytes.subarray(0, 8).toString('hex'),
    width: bytes.readUInt32BE(16)
  };
}

describe('payment method assets', () => {
  it('keeps the optimized PayPal monogram as a transparent PNG', () => {
    assert.deepEqual(readPngMetadata('paypal-monogram-full-color.png'), {
      colorType: RGBA_COLOR_TYPE,
      height: 60,
      signature: PNG_SIGNATURE,
      width: 50
    });
  });

  it('keeps the optimized Venmo wordmark as a transparent PNG', () => {
    assert.deepEqual(readPngMetadata('venmo-wordmark-blue.png'), {
      colorType: RGBA_COLOR_TYPE,
      height: 36,
      signature: PNG_SIGNATURE,
      width: 190
    });
  });
});
