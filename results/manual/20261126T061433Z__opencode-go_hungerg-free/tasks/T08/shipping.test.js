const test = require('node:test');
const assert = require('node:assert/strict');
const { shippingCents } = require('./shipping');

test('local below 5000 costs 500', () => {
  assert.equal(shippingCents(4999, 'local'), 500);
});

test('local exactly 5000 is free', () => {
  assert.equal(shippingCents(5000, 'local'), 0);
});

test('local above 5000 is free', () => {
  assert.equal(shippingCents(5001, 'local'), 0);
});

test('international below 10000 costs 1000', () => {
  assert.equal(shippingCents(9999, 'international'), 1000);
});

test('international exactly 10000 is free', () => {
  assert.equal(shippingCents(10000, 'international'), 0);
});

test('international above 10000 is free', () => {
  assert.equal(shippingCents(10001, 'international'), 0);
});

test('zero subtotal is valid for local', () => {
  assert.equal(shippingCents(0, 'local'), 500);
});

test('zero subtotal is valid for international', () => {
  assert.equal(shippingCents(0, 'international'), 1000);
});

const invalidSubtotals = [
  ['negative', -1],
  ['fractional', 1.5],
  ['true boolean', true],
  ['false boolean', false],
  ['NaN', Number.NaN],
  ['Infinity', Number.POSITIVE_INFINITY],
  ['numeric string', '6000'],
  ['null', null],
  ['undefined', undefined],
];

for (const [label, value] of invalidSubtotals) {
  test(`rejects ${label} subtotal`, () => {
    assert.throws(() => shippingCents(value, 'local'), /subtotal/i);
  });
}

const invalidRegions = [
  ['unsupported', 'other'],
  ['wrong case', 'LOCAL'],
  ['empty', ''],
];

for (const [label, value] of invalidRegions) {
  test(`rejects ${label} region`, () => {
    assert.throws(() => shippingCents(100, value), /region/i);
  });
}

test('repeated calls are deterministic', () => {
  assert.equal(shippingCents(1234, 'local'), 500);
  assert.equal(shippingCents(1234, 'local'), 500);
});
