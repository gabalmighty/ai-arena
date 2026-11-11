const test = require('node:test');
const assert = require('node:assert/strict');

const { shippingCents } = require('./shipping.js');

test('local below 5000 charges 500', () => {
  assert.equal(shippingCents(0, 'local'), 500);
  assert.equal(shippingCents(4999, 'local'), 500);
});

test('local at 5000 is free', () => {
  assert.equal(shippingCents(5000, 'local'), 0);
});

test('local above 5000 is free', () => {
  assert.equal(shippingCents(5001, 'local'), 0);
});

test('international below 10000 charges 1000', () => {
  assert.equal(shippingCents(0, 'international'), 1000);
  assert.equal(shippingCents(9999, 'international'), 1000);
});

test('international at 10000 is free', () => {
  assert.equal(shippingCents(10000, 'international'), 0);
});

test('international above 10000 is free', () => {
  assert.equal(shippingCents(10001, 'international'), 0);
});

test('rejects an unknown region', () => {
  assert.throws(() => shippingCents(1000, 'mars'), /region/);
  assert.throws(() => shippingCents(1000, 'LOCAL'), /region/);
});

test('rejects negative subtotals', () => {
  assert.throws(() => shippingCents(-1, 'local'), /subtotalCents/);
  assert.throws(() => shippingCents(-1, 'international'), /subtotalCents/);
});

test('rejects non-integer subtotals', () => {
  assert.throws(() => shippingCents(1.5, 'local'), /subtotalCents/);
  assert.throws(() => shippingCents(1000.1, 'international'), /subtotalCents/);
});

test('rejects booleans even though they are numbers in JavaScript', () => {
  assert.throws(() => shippingCents(true, 'local'), /subtotalCents/);
  assert.throws(() => shippingCents(false, 'international'), /subtotalCents/);
});

test('rejects numeric strings and non-finite values', () => {
  assert.throws(() => shippingCents('5000', 'local'), /subtotalCents/);
  assert.throws(() => shippingCents(Number.NaN, 'local'), /subtotalCents/);
  assert.throws(() => shippingCents(Number.POSITIVE_INFINITY, 'international'), /subtotalCents/);
});

test('is deterministic with no side effects', () => {
  assert.equal(shippingCents(2500, 'local'), shippingCents(2500, 'local'));
  assert.equal(shippingCents(20000, 'international'), shippingCents(20000, 'international'));
});