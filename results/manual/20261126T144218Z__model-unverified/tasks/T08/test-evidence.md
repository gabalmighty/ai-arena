# T08 — Mutation-sensitivity test evidence

**Subject under test:** `shipping.js` — the intentionally **buggy** function, **unchanged** (not edited to pass):
```js
function shippingCents(subtotalCents, region) {
  if (region === 'local') return subtotalCents > 5000 ? 0 : 500;
  return subtotalCents > 10000 ? 0 : 1000;
}
module.exports = { shippingCents };
```
**Tests:** `shipping.test.js`, built-in `node:test` + `node:assert/strict`. Tests **were not edited to match**
the bug; `shipping.js` **was not modified**.

## Executed command
```
node --test shipping.test.js        (cwd = tasks/T08, Node v22.16.0)
```
(Equivalent full-path invocation `node --test <abs path>/shipping.test.js` produces the same result.)

## Result (measured, actual output)
```
# tests 29
# pass 11
# fail 18
# cancelled 0
# skipped 0
# todo 0
RC=1
```
Full raw TAP output preserved in `test_log.txt`. **Failing test lines are NOT deleted; no repair to
`shipping.js` was attempted or applied.**

## At least one actual failing case (verbatim, trimmed of stack paths)
Off-by-one threshold — local free-shipping boundary (`subtotalCents === 5000` must be 0, buggy returns 500):
```
# Subtest: local threshold: 5000 -> 0 (from 5000 onward)
not ok 2 - local threshold: 5000 -> 0 (from 5000 onward)
  failureType: 'testCodeFailure'
  error: |-
    Expected values to be strictly equal:
    500 !== 0
  code: 'ERR_ASSERTION'
  operator: 'strictEqual'  expected: 0  actual: 500
```
Off-by-one threshold — international free-shipping boundary (`subtotalCents === 10000` must be 0, buggy returns 1000):
```
# Subtest: international threshold: 10000 -> 0 (from 10000 onward)
not ok 5 - international threshold: 10000 -> 0 (from 10000 onward)
  failureType: 'testCodeFailure'
  error: |-
    Expected values to be strictly equal:
    1000 !== 0
  code: 'ERR_ASSERTION'
  operator: 'strictEqual'  expected: 0  actual: 1000
```
Missing validation — boolean subtotal must throw, buggy silently computes:
```
# Subtest: invalid subtotal rejected: boolean true (bool is not int)
not ok 19 - invalid subtotal rejected: boolean true (bool is not int)
  error: 'Missing expected exception.'  code: 'ERR_ASSERTION'  operator: 'throws'
```
Missing validation — invalid region must throw, buggy treats any non-'local' as international:
```
# Subtest: invalid region rejected: unknown
not ok 23 - invalid region rejected: unknown
error: 'Missing expected exception.'  code: 'ERR_ASSERTION'  operator: 'throws'
```

## Mutation-detection success vs subject-under-test failure
- **This task is NOT marked FAILED.** The intentional buggy `shipping.js` **fails** the discriminating
  tests (RC=1, 18 failures) — that **is the success criterion**: my tests are **mutation-sensitive** and
  catch the planted defects. Per T08, "Do not label this task FAILED merely because the intentional buggy
  implementation triggers your tests."
- **Mutation-detection success** = the test suite would **pass on a correct implementation** and **fails on
  the buggy mutation**. The 11 currently-passing cases are the ones the bug happens not to break; the 18
  failing cases are exactly the discriminating ones.
- **Subject-under-test failure** = `shipping.js` itself is failing; that is expected here and is not my
  task's failure. I did **not** "fix" `shipping.js`; `shipping.js` is byte-for-byte the provided buggy code.

## Coverage in `shipping.test.js` (29 tests)
- **Threshold boundaries both sides:** local 4999→500 / 5000→0 / 5001→0; international 9999→1000 /
  10000→0 / 10001→0.
- **Normal cases:** local 0→500, small→500, large→0; international 0→1000, small→1000, large→0.
- **Invalid subtotals rejected (meaningful error):** negative, non-integer 1.5, NaN, Infinity, string,
  boolean `true`, boolean `false`, null, undefined. (Booleans are not integers; nonnegative required.)
- **Invalid region rejected (exactly "local"|"international"):** unknown `'intl'`, case `'LOCAL'`, empty
  `''`, `null`, `undefined`, whitespace `'local '`.
- **No side effects:** repeated calls give same result; inputs unchanged.

## What a CORRECT implementation would change vs the buggy one
1. **Threshold comparison `>` -> `>=`** for free shipping:
   `region==='local' ? (subtotal>=5000 ? 0 : 500) : (subtotal>=10000 ? 0 : 1000)`.
   Concretely: `shippingCents(5000,'local')` returns 500 today, should return **0**;
   `shippingCents(10000,'international')` returns 1000 today, should return **0**.
2. **Add input validation before computing:** require `Number.isInteger(subtotalCents)`, `subtotalCents >= 0`,
   `subtotalCents !== true/false` (booleans rejected; `typeof x==='number'`, not NaN/Infinity);
   require `region === 'local' || region === 'international'` exactly; **throw a meaningful `Error`**
   (e.g. `RangeError`/`TypeError`) on violation instead of silently computing.
3. **No side effects** retained; pure function (already true; keep it).

## Honesty
- Only Node built-ins used; nothing installed; no `shipping.js` edit; no test weakening. `shipping.js`
  verified unchanged (not rewritten). Failed outputs preserved above + `test_log.txt`.
- No real device/mobile claim; this tests shipping logic only.
