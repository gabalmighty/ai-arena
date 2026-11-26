'use strict';
// Discriminating tests for shippingCents. Does NOT modify shipping.js.
// Desired contract:
//   subtotalCents: nonnegative integer cents (booleans rejected; not NaN/Infinity/floats/strings)
//   region: exactly "local" | "international"
//   local:        500 cents below 5000; 0 from 5000 onward
//   international:1000 cents below 10000; 0 from 10000 onward
//   invalid inputs throw a meaningful error; no side effects.
// These tests are written to FAIL against the intentionally buggy implementation
// (off-by-one thresholds; missing input validation).
const test = require('node:test');
const assert = require('node:assert/strict');
const { shippingCents } = require('./shipping.js');

// ---------- threshold boundaries: local ----------
test('local threshold: 4999 -> 500', () => assert.equal(shippingCents(4999, 'local'), 500));
test('local threshold: 5000 -> 0 (from 5000 onward)', () => assert.equal(shippingCents(5000, 'local'), 0));
test('local threshold: 5001 -> 0', () => assert.equal(shippingCents(5001, 'local'), 0));

// ---------- threshold boundaries: international ----------
test('international threshold: 9999 -> 1000', () => assert.equal(shippingCents(9999, 'international'), 1000));
test('international threshold: 10000 -> 0 (from 10000 onward)', () => assert.equal(shippingCents(10000, 'international'), 0));
test('international threshold: 10001 -> 0', () => assert.equal(shippingCents(10001, 'international'), 0));

// ---------- normal cases ----------
test('local normal: 0 -> 500', () => assert.equal(shippingCents(0, 'local'), 500));
test('local normal: small subtotal -> 500', () => assert.equal(shippingCents(100, 'local'), 500));
test('local normal: large subtotal -> 0', () => assert.equal(shippingCents(99999, 'local'), 0));
test('international normal: 0 -> 1000', () => assert.equal(shippingCents(0, 'international'), 1000));
test('international normal: small subtotal -> 1000', () => assert.equal(shippingCents(100, 'international'), 1000));
test('international normal: large subtotal -> 0', () => assert.equal(shippingCents(99999, 'international'), 0));

// ---------- invalid subtotals rejected (meaningful error) ----------
test('invalid subtotal rejected: negative', () => assert.throws(() => shippingCents(-1, 'local'), /nonnegative|non-negative|subtotal|integer|number/i));
test('invalid subtotal rejected: -0? (nonnegative ok) vs negative', () => assert.throws(() => shippingCents(-100, 'international'), /nonnegative|non-negative|subtotal|integer|number/i));
test('invalid subtotal rejected: non-integer 1.5', () => assert.throws(() => shippingCents(1.5, 'local'), /integer|subtotal|number/i));
test('invalid subtotal rejected: NaN', () => assert.throws(() => shippingCents(NaN, 'local'), /integer|subtotal|number|finite/i));
test('invalid subtotal rejected: Infinity', () => assert.throws(() => shippingCents(Infinity, 'local'), /integer|subtotal|number|finite/i));
test('invalid subtotal rejected: string', () => assert.throws(() => shippingCents('100', 'local'), /integer|subtotal|number/i));
test('invalid subtotal rejected: boolean true (bool is not int)', () => assert.throws(() => shippingCents(true, 'local'), /integer|subtotal|number|boolean|bool/i));
test('invalid subtotal rejected: boolean false', () => assert.throws(() => shippingCents(false, 'local'), /integer|subtotal|number|boolean|bool/i));
test('invalid subtotal rejected: null', () => assert.throws(() => shippingCents(null, 'local'), /integer|subtotal|number/i));
test('invalid subtotal rejected: undefined', () => assert.throws(() => shippingCents(undefined, 'local'), /integer|subtotal|number/i));

// ---------- invalid region rejected (exactly local|international) ----------
test('invalid region rejected: unknown', () => assert.throws(() => shippingCents(100, 'intl'), /region/i));
test('invalid region rejected: case', () => assert.throws(() => shippingCents(100, 'LOCAL'), /region/i));
test('invalid region rejected: empty', () => assert.throws(() => shippingCents(100, ''), /region/i));
test('invalid region rejected: null', () => assert.throws(() => shippingCents(100, null), /region/i));
test('invalid region rejected: undefined', () => assert.throws(() => shippingCents(100, undefined), /region/i));
test('invalid region rejected: whitespace', () => assert.throws(() => shippingCents(100, 'local '), /region/i));

// ---------- no side effects ----------
test('no side effects: repeated calls same result; inputs unchanged', () => {
  const subtotal = 100;
  const region = 'local';
  const a = shippingCents(subtotal, region);
  const b = shippingCents(subtotal, region);
  assert.equal(a, b);
  assert.equal(subtotal, 100);
  assert.equal(region, 'local');
});
