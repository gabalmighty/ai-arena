# T08 — Test engineering evidence (intentional buggy subject)

## Executed test command
```powershell
Set-Location "C:\Illustrados\ai-arena-iceman\results\manual\20261111T172855Z__opencode-go_iceman-contributor-free\tasks\T08"
node --test shipping.test.js
```
- Exit code: **1** (tests failed against the provided buggy `shipping.js`, as intended)

## Actual failing cases and output (excerpt)
- **Fail (boundary, local):** `local: below 5000 costs 500, at/above 5000 costs 0 (boundary at 5000)`
  - `AssertionError [ERR_ASSERTION]: Expected values to be strictly equal: 500 !== 0` at `shipping.test.js:8:10` (`assert.equal(shippingCents(5000, "local"), 0)`) — buggy impl uses `> 5000` so 5000 still returns 500.
- **Fail (boundary, international):** `international: below 10000 costs 1000, at/above 10000 costs 0 (boundary at 10000)`
  - `AssertionError ... 1000 !== 0` at `shipping.test.js:14:10` (`shippingCents(10000, "international")`) — buggy impl uses `> 10000`.
- **Fail (invalid region):** `invalid region throws a meaningful error`
  - `AssertionError [ERR_ASSERTION]: Missing expected exception.` at `shipping.test.js:19:10` — buggy impl does not validate region.
- **Fail (invalid subtotal):** `invalid subtotal throws: non-integer, negative, boolean rejected`
  - `AssertionError [ERR_ASSERTION]: Missing expected exception.` at `shipping.test.js:25:10` — buggy impl does not validate subtotal type/value (accepts negatives/non-integers/booleans).

## Counts
- **Tests:** 5
- **Passing:** 1 (`valid normal cases have no side effects (pure function)`)
- **Failing:** 4
- **Cancelled/Skipped:** 0

## Mutation-detection vs subject-under-test
- **Mutation-detection success (test quality):** The new tests discriminate the defective implementation by catching off-by-one boundaries at 5000/10000 and missing input validation (region and subtotal, including boolean rejection). These are meaningful contract checks, not vacuous assertions.
- **Subject-under-test failure:** `shipping.js` is intentionally unchanged and defective per contract; its failure is expected and does **not** indicate the test suite is wrong. Task outcome should be interpreted as "tests correctly detect bugs" rather than "implementation passes."

## What a correct implementation would change
A correct implementation would (1) validate `region` is exactly `"local"` or `"international"` and throw a meaningful `Error` otherwise, (2) validate `subtotalCents` is a nonnegative integer (`Number.isInteger`) and reject booleans/non-numbers/negatives with a meaningful `Error`, (3) for local: return `500` when `subtotalCents < 5000` and `0` when `subtotalCents >= 5000`, (4) for international: return `1000` when `subtotalCents < 10000` and `0` when `subtotalCents >= 10000`, and (5) remain pure with no side effects. With those fixes, all tests above would be expected to pass.
