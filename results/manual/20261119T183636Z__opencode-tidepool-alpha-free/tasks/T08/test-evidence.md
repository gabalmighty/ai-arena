# T08 — test evidence (mutation sensitivity)

- **Subject under test:** `tasks/T08/shipping.js` — the defective function, kept unmodified (public API `shippingCents(subtotalCents, region)`).
- **Executed test command (measured):** `node shipping.test.js` — run from `tasks\T08` (Node v22.16.0). Exit code 1.
- **Counts (measured):** `# tests 5`, `# pass 1`, `# fail 4`.
- **First failing tests and actual output (measured):**
  1. `not ok 1 - local: 500 below 5000, 0 from 5000 onward (boundaries)` — `Expected values to be strictly equal: 500 !== 0` (the failing case is `shippingCents(5000, 'local')`: the subject returns 500 where the contract requires 0 — the `>` vs `>=` boundary mutation).
  2. `not ok 2 - international: 1000 below 10000, 0 from 10000 onward (boundaries)` — `Expected values to be strictly equal: 1000 !== 0` (the failing case is `shippingCents(10000, 'international')`: subject returns 1000 where the contract requires 0).
  3. `not ok 4 - invalid subtotal: must be a nonnegative integer (reject booleans)` — `Missing expected exception (Error).` (first failing case: `shippingCents(-1, 'local')` — the subject does not throw for negative subtotals; it also accepts `Infinity`, `NaN`, booleans and non-string types).
  4. `not ok 5 - invalid region: must be exactly "local" or "international"` — `Missing expected exception (Error).` (first failing case: `shippingCents(100, 'Local')` — the subject treats any non-`'local'` value as international instead of rejecting it).
- **Passing on the defective subject:** `ok 3 - normal cases`.
- **What a correct implementation would change (explanation):** subject-under-test defects: (a) boundary comparisons use `>` instead of `>=` — local at subtotal 5000 returns 500 (contract: 0), international at subtotal 10000 returns 1000 (contract: 0); (b) no input validation — negative, non-integer, NaN, Infinity and boolean subtotals and non-`'local'`/`'international'` regions are accepted (contract: throw a meaningful Error). A contract-compliant implementation shape:
  ```javascript
  function shippingCents(subtotalCents, region) {
    if (!Number.isInteger(subtotalCents) || subtotalCents < 0) {
      throw new Error('subtotalCents must be a nonnegative integer');
    }
    if (region !== 'local' && region !== 'international') {
      throw new Error('region must be "local" or "international"');
    }
    if (region === 'local') return subtotalCents >= 5000 ? 0 : 500;
    return subtotalCents >= 10000 ? 0 : 1000;
  }
  ```
- **Mutation-detection success vs subject failure:** the tests are intentionally written for the desired contract and are expected to fail against the defective subject; the measured failures above show the tests discriminate both subject mutations (`>` vs `>=` boundaries and the missing validation). This is mutation-sensitivity success, not a claim of a pass.

Note: `shipping.js` was not edited at any point (verified by the fact that all files in `tasks/T08` were created once and never modified after the test run).
