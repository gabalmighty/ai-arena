# T08 — Test evidence: mutation sensitivity of `shipping.test.js`

## Subject under test

`shipping.js` was copied verbatim from the task and **was not edited**. It is the
intentionally defective baseline:

```js
function shippingCents(subtotalCents, region) {
  if (region === 'local') return subtotalCents > 5000 ? 0 : 500;
  return subtotalCents > 10000 ? 0 : 1000;
}
```

## Executed command

```
node --test shipping.test.js
```

Run in `tasks/T08/` on Microsoft Windows NT 10.0.26200.0, Node v24.19.0.
Process exit code: **1** (failures present, as intended).

## Actual result

```
✔ local shipping is 500 cents below 5000
✖ local shipping is 0 cents from 5000 onward (boundary)
✔ international shipping is 1000 cents below 10000
✖ international shipping is 0 cents from 10000 onward (boundary)
✔ normal local and international cases
✖ rejects negative subtotals
✖ rejects boolean subtotals (boolean is not an integer here)
✖ rejects non-integer and non-number subtotals
✖ rejects regions other than exactly "local" or "international"
✔ is pure: repeated calls return the same value
ℹ tests 10
ℹ pass 4
ℹ fail 6
```

**Passing: 4. Failing: 6. Total: 10.**

## One actual failing case (verbatim output)

```
✖ local shipping is 0 cents from 5000 onward (boundary) (0.4999ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:

  500 !== 0

      at TestContext.<anonymous> (.../tasks/T08/shipping.test.js:20:10)
    ...
    actual: 500,
    expected: 0,
```

A second boundary failure is `1000 !== 0` for the international threshold, and
four invalid-input cases fail with `Missing expected exception` because the
defective function returns a price instead of throwing.

## Interpretation — mutation detection vs. subject failure

- **Mutation-detection success:** the suite discriminates the defective
  implementation. Six distinct mutations are caught: two threshold boundaries
  (`>` vs `>=`) and four categories of missing input validation.
- **Subject-under-test failure:** `shipping.js` does **not** satisfy the desired
  contract. This is expected and intentional; the task is to write tests that
  expose the defect, not to make the buggy code pass. **This task is not a
  failure of the test suite.**

## What a correct implementation would change

1. **Boundaries:** use `subtotalCents >= 5000` for local and
   `subtotalCents >= 10000` for international (or keep `>` but compare against
   `4999`/`9999`), so the threshold values themselves are free.
2. **Subtotal validation:** reject values that are not nonnegative integers.
   `Number.isInteger(subtotalCents) && subtotalCents >= 0` is the core check;
   `Number.isInteger(true)` is `false`, so booleans are rejected without a
   special case.
3. **Region validation:** require `region === 'local' || region === 'international'`
   explicitly, and throw a meaningful error otherwise. The current fall-through
   treats every unknown region as international.
4. **Error quality:** throw `TypeError` (or a descriptive `RangeError`) with a
   message naming the offending argument, rather than silently returning a price.
5. **Purity:** keep the function free of I/O and global mutation; the existing
   repeated-call test and code inspection support this (no side-effect surface
   exists in the function body).

## Honest limitations

- No browser, no external test framework and no coverage tool was used; the
  built-in `node:test` runner is the only executor.
- The "purity" test is weak (it only checks repeatability); purity is primarily
  established by inspecting the function body, which contains no I/O or global
  access.
