# T07 — Review of untrusted patch (read-only)

Scope: evaluated the 17-line excerpt as a reviewer. No code was executed, fixed, or run against any service. Assumptions given by the task: Express-style request API, SQL client, valid secret storage; only authenticated admins may access invoices; signatures must be fully verified; queries must be parameterized; rate limiting must block the **sixth** request in a window.

## Confirmed findings

### F1 — Client-controlled header grants admin (P0) — line 03

- **Impact:** complete authorization bypass for invoice access.
- **Scenario:** an unauthenticated caller sends `x-admin: yes`; the `||` short-circuits and `isAdmin(req)` returns true regardless of `req.user`. Any route gated by this function serves invoices to that caller.
- **Fix:** remove the header entirely and derive privilege only from an authenticated, verified identity: `return req.user?.role === 'admin'` behind auth middleware that populates `req.user` from a verified session/token.
- **Severity justification (P0):** a single arbitrary header defeats the stated "only authenticated admins" control with no credentials — direct unauthorized data access.

### F2 — Webhook HMAC only partially verified (P1) — lines 06–08

- **Impact:** webhook signature forgery is feasible; verification is not "fully verified" as required.
- **Scenario:** only the first 8 hex characters (16 bits) of the HMAC are compared via `signature.startsWith(expected.slice(0, 8))`. An attacker who can submit repeated requests can brute-force a matching 16-bit prefix (~2^16 trials) and pass. `startsWith` is also not constant-time, leaking comparison timing.
- **Fix:** require `signature` to be a full-length hex string and compare the entire digest with `crypto.timingSafeEqual`, e.g. compare buffers of equal length after validating `signature` format.
- **Severity justification (P1):** forgery is practical but needs many attempts and a reachable webhook endpoint; impact is limited to webhook-triggered actions, so below the trivial one-request admin bypass.

### F3 — SQL injection through concatenated identifiers (P1) — lines 10–12

- **Impact:** tenant boundary bypass and arbitrary read of the invoices table.
- **Scenario:** a value such as `x' OR '1'='1` in `invoiceId` closes the quoted literal and alters the WHERE clause, so `SELECT * FROM invoices ...` returns rows from other tenants. This directly contradicts the "queries must be parameterized" requirement.
- **Fix:** use bound parameters and pass values separately, e.g. `SELECT * FROM invoices WHERE tenant_id = $1 AND id = $2` with `[tenantId, invoiceId]` (dialect-appropriate placeholders).
- **Severity justification (P1):** high-confidentiality impact (cross-tenant invoice disclosure) but requires a reachable call path and is partially mitigated if F1 is independently fixed; still a definite requirement violation.

### F4 — Rate limiter allows the sixth request (P2) — lines 14–15

- **Impact:** the sixth request in a window is accepted instead of blocked; requirement mismatch.
- **Scenario:** with `requestCount === 6`, `6 > 6` is false, so `overLimit(6)` returns false and the request proceeds. Only the seventh is blocked.
- **Fix:** `return requestCount >= 6;` (assuming `requestCount` counts attempts already made in the window).
- **Severity justification (P2):** deterministic one-request overshoot; a real correctness bug but low impact compared with authentication and injection flaws.

## Plausible concerns NOT claimed (insufficient evidence)

- Whether `req.user` is actually set by verified authentication middleware — not shown in the excerpt, so no independent "missing auth" finding is made.
- Whether a counter and time-window implementation exists around `overLimit` — only the predicate is visible; no claim about window logic, keying, or distributed state.
- Whether the database enforces tenant isolation (row-level security) below this query — unknown.
- Whether webhook secret rotation, body-size limits, or replay protection exist elsewhere — not visible.
- Whether callers validate `tenantId` / `invoiceId` types before building the query — not visible.

## Decision record (T07)

- **Approach:** mapped each explicit requirement to the exact lines that violate it; kept findings unique and non-duplicative.
- **Tradeoff:** did not inflate the count with speculative issues; grouped timing-unsafe comparison with the truncated-HMAC finding.
- **Evidence:** static reading of the 17-line excerpt only; no attack code executed.
- **Confidence:** high for F1, F3, F4; high for the truncation defect in F2, medium on the exact brute-force effort (depends on endpoint rate limits not shown).
