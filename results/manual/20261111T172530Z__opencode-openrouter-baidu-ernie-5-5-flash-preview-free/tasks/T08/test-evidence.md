# T08 — Test evidence

## Executed command

Working directory: `tasks/T08`

```text
node --test shipping.test.js
```

Return code: **1** (tests failed, as intended for the defective subject under test).

## Result counts

- Tests run: **12**
- Passed: **5**
- Failed: **7**

The passing tests are the non-boundary normal cases and the determinism check. The failing tests are exactly the contract violations in the supplied `shipping.js`: both threshold boundaries, the unknown-region case, and all five invalid-input cases.

## Actual failing output (excerpt)

```text
# Subtest: local at 5000 is free
not ok 2 - local at 5000 is free
  ---
  error: |-
    Expected values to be strictly equal:

    500 !== 0

  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected: 0
  actual: 500
  operator: 'strictEqual'
  ...
# Subtest: international at 10000 is free
not ok 5 - international at 10000 is free
  ---
  error: |-
    Expected values to be strictly equal:

    1000 !== 0

  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected: 0
  actual: 1000
  operator: 'strictEqual'
  ...
# Subtest: rejects an unknown region
not ok 7 - rejects an unknown region
  ---
  error: 'Missing expected exception.'
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  operator: 'throws'
  ...
# Subtest: rejects booleans even though they are numbers in JavaScript
not ok 10 - rejects booleans even though they are numbers in JavaScript
  ---
  error: 'Missing expected exception.'
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  operator: 'throws'
  ...
1..12
# tests 12
# pass 5
# fail 7
```

## What a correct implementation would change

1. **Strict input validation.** Accept only `typeof subtotalCents === 'number'`, `Number.isInteger(subtotalCents)`, and `subtotalCents >= 0`. Reject booleans explicitly (`true`/`false` are not valid cent amounts), numeric strings, `NaN`, and infinities with a meaningful `Error` mentioning `subtotalCents`. Accept only the exact strings `'local'` and `'international'` for `region`, rejecting every other value with an error mentioning `region`.
2. **Inclusive thresholds.** Use `subtotalCents >= 5000` for local and `subtotalCents >= 10000` for international, so the boundary value is free. The supplied `>` comparisons incorrectly charge 500/1000 at exactly 5000/10000.
3. **Preserve purity.** Keep the function free of I/O, global state and mutation; the determinism test already passes and should continue to pass.

## Mutation-detection interpretation

This is a **successful mutation-detection result**, not a failed task. The test suite is intentionally discriminating: it kills the boundary mutants (`>` instead of `>=`), the missing-validation mutants, and the invalid-region fallthrough mutant. `shipping.js` was deliberately left in its supplied defective form; no repair was attempted, because the deliverable is a discriminating test suite plus this evidence. The subject-under-test failure and the test-engineering success are separate claims.

## Not verified

No browser, server, payment provider or production tax/shipping service was exercised. The tests are pure Node.js unit tests for the stated cents/region contract only; they do not establish real-world shipping rates, currency rounding, tax rules or carrier availability.