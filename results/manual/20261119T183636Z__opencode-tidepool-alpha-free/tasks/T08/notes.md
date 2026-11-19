# T08 evidence notes

- **task:** T08 — Test engineering and mutation sensitivity (Node.js).
- **status:** COMPLETED (by design: the subject stays defective; the tests are written for the desired contract and are expected to fail against it).
- **started_utc:** 2026-11-19T11:08:29Z (measured; first T08 artifact `tasks/T08/shipping.js` creation, UTC mtime)
- **finished_utc:** 2026-11-19T11:09:50Z (measured `[DateTimeOffset]::UtcNow` after the test run; local `Get-Date` 19:09:50)
- **elapsed_seconds:** 81
- **files changed:** `tasks/T08/shipping.js` (defective starter, unmodified), `tasks/T08/shipping.test.js` (created), `tasks/T08/test-evidence.md` (created), `tasks/T08/notes.md` (this file).
- **commands run:** `node shipping.test.js` — measured exit code 1.
- **first failing test(s):** measured — `local: 500 below 5000, 0 from 5000 onward (boundaries)` (`500 !== 0` at the 5000 boundary), `international: 1000 below 10000, 0 from 10000 onward (boundaries)` (`1000 !== 0` at the 10000 boundary), `invalid subtotal: must be a nonnegative integer (reject booleans)` (missing exception, first case `shippingCents(-1, 'local')`), `invalid region: must be exactly "local" or "international"` (missing exception, first case `shippingCents(100, 'Local')`). See `test-evidence.md` for the full measured TAP output.
- **repair attempts:** 0 (by design — shipping.js is intentionally left defective).
- **final result (measured):** `# tests 5`, `# pass 1`, `# fail 4`, exit code 1.
- **decision summary:** Wrote the defective `shipping.js` exactly as the given starter (no changes to the subject). Wrote `shipping.test.js` against the desired contract: both threshold boundaries (4999/5000/5001 local; 9999/10000/10001 international), invalid subtotal types/values (negative, fractional, NaN, Infinity, boolean, undefined, non-string) and invalid regions ('Local', 'LOCAL', 'global', '', undefined, missing). Ran `node shipping.test.js`: 1 pass / 4 fail — the failures discriminate the two subject mutations (`>` vs `>=` boundaries and missing validation); the passing test is the normal cases. The expected failure is documented in test-evidence.md; the task is NOT a pass. Remaining uncertainty: none beyond standard node:test behavior on this host.
- **evidence type:** measured (exit code + TAP output + file mtimes).
