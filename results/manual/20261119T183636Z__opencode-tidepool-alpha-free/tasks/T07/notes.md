# T07 evidence notes

- **task:** T07 — Read-only security/correctness Gatekeeper (static review of the unreviewed patch from the evaluation brief).
- **status:** COMPLETED
- **started_utc:** 2026-11-19T11:06:50Z (measured; first T07 artifact `tasks/T07/review.md` creation, authoritative UTC via `[System.IO.File]::GetLastWriteTimeUtc`; host offset +8:00 per `Get-TimeZone`)
- **finished_utc:** 2026-11-19T11:06:57Z (measured `[DateTimeOffset]::UtcNow` after the artifacts were written)
- **elapsed_seconds:** 7
- **files changed:** `tasks/T07/review.md` (created), `tasks/T07/review.json` (created). No code was executed or modified; no attack code run against any service.
- **commands run:** two write operations creating the deliverables; static analysis of the patch only (`isAdmin` line 03, `webhookOk` lines 05–08, `invoiceQuery` lines 10–12, `overLimit` lines 14–16). No execution of any reviewed code; no service calls.
- **first failing test:** n/a — read-only review task.
- **repair attempts:** n/a (no fixes applied by design — the patch is unreviewed and only evaluated).
- **findings (all in review.md / review.json):**
  1. **F1 — Unauthenticated admin flag bypasses the admin gate (line 03) — P1.** Client-controlled header `x-admin: yes` accepted by `isAdmin`; violates the "only authenticated admins access invoices" requirement when the header is not stripped upstream.
  2. **F2 — SQL injection via string-concatenated query (lines 10–12) — P1.** `tenantId`/`invoiceId` interpolated without parameterization; direct violation of the "queries must be parameterized" requirement; cross-tenant read/modify scenario when reachable.
  3. **F3 — Webhook signature compares only the first 8 hex characters via non-constant-time `startsWith` (lines 05–08) — P2.** 32-bit signature space; forgery/timing side channel.
  4. **F4 — Rate limiter blocks the seventh request, not the sixth (lines 14–16) — P2.** `requestCount > 6` does not block the sixth request as the stated requirement specifies.
- **Plausible concerns not claimed (insufficient evidence):** deploy-time stripping of the header (F1), cross-party expectations for the 8-hex prefix scheme (F3), window semantics and caller conventions (F4), reachability of `invoiceQuery` (F2), validity of "valid secret storage" (F3), DoS/replay in `webhookOk` — all listed in review.md "Not claimed".
- **decision summary:** Static review per the brief's assumptions; the patch is reviewed as written and never executed. Four unique, high-confidence findings with exact line references, impact, scenarios, recommended fixes and justifications; no speculative additions or duplicate findings. Remaining uncertainty: deployment-specific details (proxies, middleware) are outside the patch; noted as unclaimed.
- **evidence type:** static (measured timings; patch analyzed as quoted in the evaluation brief).
