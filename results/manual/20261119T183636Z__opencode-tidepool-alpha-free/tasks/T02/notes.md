# T02 evidence notes

- **task:** T02 — Backend correctness, idempotency and state safety (Python).
- **status:** COMPLETED
- **started_utc:** 2026-11-19T10:48:46Z (measured; host local read 18:48:46Z, corrected with the measured host offset of +8:00)
- **finished_utc:** 2026-11-19T10:50:08Z
- **elapsed_seconds:** 82
All times in UTC (host local reads were 8 hours ahead of `[DateTimeOffset]::UtcNow`; offset +8:00 verified via `Get-TimeZone`).
- **files changed:** `tasks/T02/ledger.py` (repaired; the defective starter was written first, then replaced), `tasks/T02/test_ledger.py` (new). No other files modified.
- **commands run:**
  1. `py test_ledger.py` (defective starter) → output `.F.FFFF.`; `Ran 8 tests` / `FAILED (failures=5)`; exit status non-zero (PowerShell `$?` reported False).
  2. `py test_ledger.py` (repaired ledger.py) → output `........`; `Ran 8 tests` / `OK`; `EXIT_CODE=0` (measured `$LASTEXITCODE=0`).
  Interpreter: `py` (Python 3.13.1).
- **first failing tests on the starter (measured):**
  - `test_conflicting_replay_raises` — "ValueError not raised" (line 42): same event_id with different contents was accepted.
  - `test_invalid_amounts_and_types` — "ValueError not raised : cents=0 must be rejected" (line 52): invalid amounts accepted (`None` cents raises TypeError instead of ValueError, also not caught by the assertion).
  - `test_invalid_kind_ids_and_malformed_events` (line 59: kind "void" not rejected).
  - `test_refund_never_exceeds_charged_balance` (line 75: overdraw of 101 accepted; balance went negative).
  - `test_state_immutable_after_rejection` (line 88: rejected events mutated state).
  Passing on the starter: `test_two_invoices_are_independent`, `test_duplicate_replay_is_idempotent`, `test_charge_accumulates`.
- **fix:** `_validate_event()` now validates the event shape before any mutation: event must be a dict; `event_id`/`invoice_id` must be nonempty strings; `kind` must be "charge" or "refund"; `cents` must be a positive int (bool rejected). `seen` is now a dict mapping `event_id -> signature` (canonical tuple of `(repr(key), repr(value))` for the full event except `event_id`). Identical replay returns the current balance with no state change; same id with different contents raises ValueError; the refund-overdraw check runs before mutation; `balances`/`seen` are mutated only after all checks pass. Public API preserved: `Ledger()`, `apply(event) -> int`, `balance(invoice_id) -> int`.
- **repair attempts:** 1 (one repair of ledger.py; no further repairs needed).
- **final result (measured):** `Ran 8 tests` — 8 passed, 0 failed ("OK", exit code 0). Tests cover duplicates, conflicting replay, invalid amount/type, refund overdraw, state immutability after rejection, and two-invoice independence (≥6 required cases).
- **decision summary:** Chose the "write starter, observe failures, then repair" flow: the starter run produced 5 genuine failures (conflicting replay, invalid amounts, overdraw, state mutation), which the repaired implementation addresses with validation-before-mutation and a signature-based idempotency registry. Alternative considered: writing the corrected implementation directly; rejected because the contract asks to create the starter and then repair it, so both artifacts and their evolution are recorded. Validation: 8/8 tests pass on the repaired code; the failing set on the starter shows the tests discriminate. Remaining uncertainty: none beyond standard unittest behavior.
- **evidence type:** measured (test output + exit codes).
