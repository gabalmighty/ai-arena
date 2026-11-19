'use strict';
// Discriminating tests for the shippingCents contract. These are EXPECTED to
// fail against the deliberately defective shipping.js; shipping.js is unchanged.
const test = require('node:test');
const assert = require('node:assert/strict');
const { shippingCents } = require('./shipping');

test('normal local cases below the free-shipping threshold', () => {
  assert.equal(shippingCents(0, 'local'), 500);
  assert.equal(shippingCents(1000, 'local'), 500);
  assert.equal(shippingCents(4999, 'local'), 500);
});

test('local free-shipping boundary is inclusive at 5000', () => {
  assert.equal(shippingCents(5000, 'local'), 0);
  assert.equal(shippingCents(5001, 'local'), 0);
});

test('normal international cases below the threshold', () => {
  assert.equal(shippingCents(0, 'international'), 1000);
  assert.equal(shippingCents(9999, 'international'), 1000);
});

test('international free-shipping boundary is inclusive at 10000', () => {
  assert.equal(shippingCents(10000, 'international'), 0);
  assert.equal(shippingCents(10001, 'international'), 0);
});

test('invalid subtotal values throw', () => {
  for (const bad of [-1, 1.5, true, false, '100', NaN, Infinity]) {
    assert.throws(() => shippingCents(bad, 'local'), /subtotal|integer|cents/i,
      'expected rejection for ' + String(bad));
  }
});

test('invalid region values throw', () => {
  for (const bad of ['LOCAL', 'express', '', undefined, null, 5]) {
    assert.throws(() => shippingCents(1000, bad), /region/i,
      'expected rejection for region ' + String(bad));
  }
});

test('function is side-effect free for repeated identical calls', () => {
  const a = shippingCents(4999, 'local');
  const b = shippingCents(4999, 'local');
  assert.equal(a, b);
  assert.equal(shippingCents(4999, 'local'), 500);
});
