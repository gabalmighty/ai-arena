# T08 — Mutation-detection evidence

## Subject and command

`shipping.js` is the intentionally defective starter and was **not edited**. Executed from `tasks/T08`:

```text
node --test shipping.test.js
```

The command exited **1**, as expected for a discriminating suite against the defective subject.

## Actual result

```text
# Subtest: local exactly 5000 is free
not ok 2 - local exactly 5000 is free
  error: 'Expected values to be strictly equal:\n\n  500 !== 0'
  expected: 0
  actual: 500

# Subtest: international exactly 10000 is free
not ok 5 - international exactly 10000 is free
  error: 'Expected values to be strictly equal:\n\n  1000 !== 0'
  expected: 0
  actual: 1000

1..21
# tests 21
# suites 0
# pass 7
# fail 14
# cancelled 0
# skipped 0
# todo 0
```

The first failing case was **local exactly 5000 is free** (`500 !== 0`). Twelve additional failures were missing-exception assertions for invalid subtotals/regions; the other threshold failure was international exactly 10000 (`1000 !== 0`). The seven passing cases cover below/above-threshold behavior, zero subtotals, and deterministic repeated calls.

## Interpretation

- **Test/mutation-detection outcome: successful.** The suite distinguishes the defective implementation from the desired contract at both exact boundaries and across invalid input classes.
- **Subject-under-test outcome: failing by design.** The subject still has `>` rather than `>=` at both free-shipping thresholds, treats every non-`local` region as international, and performs no subtotal/region validation. The nonzero test command exit is therefore expected and is not labeled a task failure.
- **Repair attempts:** 0; changing the subject would violate the task.

## What a correct implementation would change

1. Validate `subtotalCents` with `Number.isInteger(subtotalCents) && subtotalCents >= 0`; this rejects booleans, fractions, `NaN`, infinities, strings, `null`, and `undefined` with a meaningful subtotal error.
2. Validate that `region` is exactly `local` or `international`, throwing a meaningful region error otherwise.
3. Use `subtotalCents >= 5000` for local free shipping and `subtotalCents >= 10000` for international free shipping, preserving 500/1000-cent charges below those thresholds.
4. Remain side-effect free; the current function body is statically free of external writes, but the tests do not claim exhaustive runtime side-effect analysis.
