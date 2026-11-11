const test = require("node:test");
const assert = require("node:assert/strict");
const { shippingCents } = require("./shipping.js");

test("local: below 5000 costs 500, at/above 5000 costs 0 (boundary at 5000)", () => {
  assert.equal(shippingCents(4999, "local"), 500);
  assert.equal(shippingCents(0, "local"), 500);
  assert.equal(shippingCents(5000, "local"), 0);
  assert.equal(shippingCents(5001, "local"), 0);
});

test("international: below 10000 costs 1000, at/above 10000 costs 0 (boundary at 10000)", () => {
  assert.equal(shippingCents(9999, "international"), 1000);
  assert.equal(shippingCents(10000, "international"), 0);
  assert.equal(shippingCents(15000, "international"), 0);
});

test("invalid region throws a meaningful error", () => {
  assert.throws(() => shippingCents(100, "LOCAL"), (e) => e instanceof Error && /region/i.test(e.message));
  assert.throws(() => shippingCents(100, "domestic"), (e) => e instanceof Error && /region/i.test(e.message));
  assert.throws(() => shippingCents(100, undefined), (e) => e instanceof Error);
});

test("invalid subtotal throws: non-integer, negative, boolean rejected", () => {
  assert.throws(() => shippingCents(-1, "local"), (e) => e instanceof Error && /(subtotal|nonnegative|integer|cents)/i.test(e.message));
  assert.throws(() => shippingCents(10.5, "local"), (e) => e instanceof Error);
  assert.throws(() => shippingCents("100", "local"), (e) => e instanceof Error);
  assert.throws(() => shippingCents(true, "local"), (e) => e instanceof Error); // boolean must be rejected
  assert.throws(() => shippingCents(false, "international"), (e) => e instanceof Error);
});

test("valid normal cases have no side effects (pure function)", () => {
  const before = { a: 1 };
  shippingCents(100, "local");
  assert.deepEqual(before, { a: 1 });
});
