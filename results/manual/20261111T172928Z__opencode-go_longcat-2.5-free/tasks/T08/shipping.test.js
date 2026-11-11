'use strict';

// T08 mutation-sensitivity tests — run with: node --test shipping.test.js
// These tests encode the DESIRED contract. They are expected to FAIL against
// the defective shipping.js on purpose: the task is to write discriminating
// tests, not to make the buggy implementation pass.

const test = require('node:test');
const assert = require('node:assert/strict');
const { shippingCents } = require('./shipping');

// --- Threshold boundaries -------------------------------------------------

test('local shipping is 500 cents below 5000', () => {
  assert.equal(shippingCents(0, 'local'), 500);
  assert.equal(shippingCents(4999, 'local'), 500);
});

test('local shipping is 0 cents from 5000 onward (boundary)', () => {
  assert.equal(shippingCents(5000, 'local'), 0);
  assert.equal(shippingCents(5001, 'local'), 0);
});

test('international shipping is 1000 cents below 10000', () => {
  assert.equal(shippingCents(0, 'international'), 1000);
  assert.equal(shippingCents(9999, 'international'), 1000);
});

test('international shipping is 0 cents from 10000 onward (boundary)', () => {
  assert.equal(shippingCents(10000, 'international'), 0);
  assert.equal(shippingCents(10001, 'international'), 0);
});

// --- Normal cases ---------------------------------------------------------

test('normal local and international cases', () => {
  assert.equal(shippingCents(2500, 'local'), 500);
  assert.equal(shippingCents(7500, 'international'), 1000);
  assert.equal(shippingCents(1, 'local'), 500);
  assert.equal(shippingCents(1, 'international'), 1000);
});

// --- Invalid arguments ----------------------------------------------------

test('rejects negative subtotals', () => {
  assert.throws(() => shippingCents(-1, 'local'), /nonnegative|negative|integer/i);
  assert.throws(() => shippingCents(-1, 'international'), /nonnegative|negative|integer/i);
});

test('rejects boolean subtotals (boolean is not an integer here)', () => {
  assert.throws(() => shippingCents(true, 'local'), TypeError);
  assert.throws(() => shippingCents(false, 'international'), TypeError);
});

test('rejects non-integer and non-number subtotals', () => {
  assert.throws(() => shippingCents(1000.5, 'local'), TypeError);
  assert.throws(() => shippingCents('1000', 'local'), TypeError);
  assert.throws(() => shippingCents(NaN, 'local'), TypeError);
  assert.throws(() => shippingCents(Infinity, 'international'), TypeError);
});

test('rejects regions other than exactly "local" or "international"', () => {
  assert.throws(() => shippingCents(1000, 'moon'), /region|local|international/i);
  assert.throws(() => shippingCents(1000, 'Local'), /region|local|international/i);
  assert.throws(() => shippingCents(1000, ''), /region|local|international/i);
  assert.throws(() => shippingCents(1000, null), /region|local|international/i);
  assert.throws(() => shippingCents(1000), /region|local|international/i);
});

// --- Purity ---------------------------------------------------------------

test('is pure: repeated calls return the same value', () => {
  const first = shippingCents(4999, 'local');
  const second = shippingCents(4999, 'local');
  assert.equal(first, second);
});
