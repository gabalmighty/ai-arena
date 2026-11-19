'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { shippingCents } = require('./shipping.js');

// Written against the desired contract (subtotals nonnegative integer cents;
// region exactly 'local' or 'international'; local: 500 below 5000 / 0 from
// 5000 onward; international: 1000 below 10000 / 0 from 10000 onward;
// invalid inputs throw; no side effects).
// The defective subject in shipping.js is intentionally different.

test('local: 500 below 5000, 0 from 5000 onward (boundaries)', () => {
  assert.equal(shippingCents(4999, 'local'), 500);
  assert.equal(shippingCents(5000, 'local'), 0);
  assert.equal(shippingCents(5001, 'local'), 0);
  assert.equal(shippingCents(0, 'local'), 500);
});

test('international: 1000 below 10000, 0 from 10000 onward (boundaries)', () => {
  assert.equal(shippingCents(9999, 'international'), 1000);
  assert.equal(shippingCents(10000, 'international'), 0);
  assert.equal(shippingCents(10001, 'international'), 0);
  assert.equal(shippingCents(0, 'international'), 1000);
});

test('normal cases', () => {
  assert.equal(shippingCents(100, 'local'), 500);
  assert.equal(shippingCents(20000, 'international'), 0);
  assert.equal(shippingCents(9999, 'local'), 0);
  assert.equal(shippingCents(10000, 'local'), 0);
});

test('invalid subtotal: must be a nonnegative integer (reject booleans)', () => {
  assert.throws(() => shippingCents(-1, 'local'), Error);
  assert.throws(() => shippingCents(-100, 'international'), Error);
  assert.throws(() => shippingCents(10.5, 'local'), Error);
  assert.throws(() => shippingCents(NaN, 'local'), Error);
  assert.throws(() => shippingCents(Infinity, 'local'), Error);
  assert.throws(() => shippingCents(true, 'local'), Error);
  assert.throws(() => shippingCents(false, 'international'), Error);
  assert.throws(() => shippingCents(undefined, 'local'), Error);
  assert.throws(() => shippingCents('100', 'local'), Error);
});

test('invalid region: must be exactly "local" or "international"', () => {
  assert.throws(() => shippingCents(100, 'Local'), Error);
  assert.throws(() => shippingCents(100, 'LOCAL'), Error);
  assert.throws(() => shippingCents(100, 'global'), Error);
  assert.throws(() => shippingCents(100, ''), Error);
  assert.throws(() => shippingCents(100, undefined), Error);
  assert.throws(() => shippingCents(100), Error);
});
