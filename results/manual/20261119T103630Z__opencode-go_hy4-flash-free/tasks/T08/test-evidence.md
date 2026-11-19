# T08 — Test evidence (mutation sensitivity)

`shipping.js` was created from the supplied defective starter and was **not modified**. The tests are discriminating; failing them is the intended, successful outcome for this task.

## Commands actually run

- Subject under test: `node --test shipping.test.js` (run from `tasks/T08`), stdout/stderr captured to `test-run.log`. **Exit code 1.**
- Discrimination check: the same `shipping.test.js` was copied into a temporary scratch directory together with a *throwaway correct implementation*, run there, and captured to `verification-correct-impl.log`. **Exit code 0.** The scratch directory was then deleted (`SCRATCH_REMOVED=True`). `tasks/T08/shipping.js` was never edited.

## Result against the defective subject (intentional failure)

```
# tests 7
# pass 3
# fail 4
ok 1 - normal local cases below the free-shipping threshold
not ok 2 - local free-shipping boundary is inclusive at 5000
ok 3 - normal international cases below the threshold
not ok 4 - international free-shipping boundary is inclusive at 10000
not ok 5 - invalid subtotal values throw
not ok 6 - invalid region values throw
ok 7 - function is side-effect free for repeated identical calls
```

First actual failing case — `local free-shipping boundary is inclusive at 5000` (`shipping.test.js:14:1`):

```
Expected values to be strictly equal:

500 !== 0

code: 'ERR_ASSERTION'
name: 'AssertionError'
expected: 0
actual: 500
operator: 'strictEqual'
```

The other failures are the international boundary (`1000 !== 0` at 10000) and the two validation tests (invalid subtotal/region values do not throw).

## Result against a correct implementation (discrimination proof)

```
# tests 7
# pass 7
# fail 0
```

Identical test file, different subject: all seven tests pass. This demonstrates the suite detects the specific defects rather than failing unconditionally.

## What a correct implementation would change

- Use `>=` instead of `>` at both thresholds (`subtotalCents >= 5000` for local, `>= 10000` for international), making free shipping start *at* the boundary.
- Validate the subtotal is a nonnegative integer and explicitly reject booleans (`typeof === 'number'`, `Number.isInteger`, `>= 0`); reject `NaN`/`Infinity`.
- Accept only the exact strings `local` or `international` and throw a meaningful `TypeError` otherwise.
- Keep the function pure (no input or global mutation); the repeated-call test confirms stable output.

## Decision record (T08)

- **Approach:** write black-box tests from the contract, run them on the buggy subject, then re-run on a throwaway correct implementation to prove mutation sensitivity.
- **Tradeoff:** did not weaken assertions to make the buggy subject pass; kept the subject file byte-for-byte as supplied.
- **Evidence:** `test-run.log`, `verification-correct-impl.log`; exit codes 1 and 0 respectively.
- **Confidence:** high — the pass/fail transition is measured, not assumed. Task status is **COMPLETED** despite the subject-under-test failures.
