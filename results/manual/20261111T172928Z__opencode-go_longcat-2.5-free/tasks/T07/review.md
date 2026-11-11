# T07 — Security / correctness review of an untrusted patch

Reviewer posture: read-only. The patch was **not** executed, fixed, or tested
against any live service. Findings are static-analysis judgements about the
supplied code and the stated requirements (authenticated admins only, full
signature verification, parameterized queries, rate limit blocks the sixth
request).

## Findings

### F1 — Admin authorization can be spoofed with a client-supplied header (P0)

- **Lines:** 02–04, decisive line **03**.
- **Actual impact:** Any unauthenticated or low-privilege client can gain admin
  privileges by sending `x-admin: yes`. The requirement is that *only
  authenticated admins* access invoices; a request header is fully controlled by
  the caller and cannot establish identity or role.
- **Exploit scenario:** `curl -H 'x-admin: yes' https://host/invoices/...` — the
  header short-circuits the `||`, so `isAdmin` returns `true` regardless of
  `req.user`. If this guard protects invoice routes, the caller reads any
  tenant's invoices.
- **Recommended fix:** Delete the header branch. Authorize only from a
  server-verified session/JWT: `return Boolean(req.user && req.user.role === 'admin')`.
  If a trusted reverse proxy must supply the signal, the proxy has to
  authenticate and *overwrite* (never accept from the client) that header, and
  the app should only trust it from the proxy's network path. Add an
  authorization test that omits `req.user` and sets the header.
- **Severity justification:** P0 — direct authentication/authorization bypass of
  a stated access-control requirement, trivially exploitable.

### F2 — Webhook signature is only partially verified (truncated HMAC) (P0)

- **Lines:** 05–09, decisive lines **07–08**.
- **Actual impact:** Only the first 8 hex characters (32 bits) of the 256-bit HMAC
  are compared, and the comparison is a prefix test on the caller's string. An
  attacker needs to guess 32 bits, and any trailing bytes after a valid prefix are
  ignored. The stated requirement is that signatures be **fully verified**.
- **Exploit scenario:** An attacker who obtains or brute-forces the first 8 hex
  characters of a valid HMAC (e.g. by observing repeated webhooks and
  brute-forcing 2^32 candidates, feasible offline) can forge a signature such as
  `"<first8chars><arbitrary garbage>"`, which passes `startsWith`. The webhook is
  then accepted and its (unverified) payload is processed.
- **Recommended fix:** Compare the **full** digest using a constant-time
  comparison: `const a = Buffer.from(signature, 'utf8'); const b = Buffer.from(expected, 'utf8'); return a.length === b.length && crypto.timingSafeEqual(a, b);`.
  Reject non-string, wrong-length, or non-hex signatures explicitly.
- **Severity justification:** P0 — defeats a stated cryptographic guarantee and
  enables request forgery; 32 bits is not a meaningful security margin.

### F3 — SQL injection in the invoice query (P0)

- **Lines:** 10–13, decisive lines **11–12**.
- **Actual impact:** `tenantId` and `invoiceId` are concatenated directly into a
  SQL string. The requirement is that queries be parameterized. This permits
  classic SQL injection, including cross-tenant data exposure and, depending on
  the database, data modification or exfiltration.
- **Exploit scenario:** `invoiceQuery("' OR '1'='1", "' OR '1'='1")` produces
  `SELECT * FROM invoices WHERE tenant_id='' OR '1'='1' AND id='' OR '1'='1'`,
  returning invoices for every tenant. A `UNION`-based payload could read other
  tables.
- **Recommended fix:** Use bound parameters with the client's placeholder syntax
  (e.g. `invoices.where({ tenant_id: tenantId, id: invoiceId })` in an ORM, or
  `"SELECT * FROM invoices WHERE tenant_id = ? AND id = ?"` with
  `query(sql, [tenantId, invoiceId])`). Never interpolate request values into SQL.
- **Severity justification:** P0 — directly violates a stated requirement and
  allows unauthorized data access.

### F4 — Rate-limit threshold is off by one (P1)

- **Lines:** 14–16, decisive line **15**.
- **Actual impact:** `requestCount > 6` allows six requests through and blocks the
  seventh. The requirement is that the **sixth** request in a window is blocked.
- **Failure scenario:** Under a brute-force or scraping attempt, the attacker gets
  one extra request per window (6 instead of 5), weakening the control. Combined
  with F1/F3, that extra request can be a costly one.
- **Recommended fix:** Block at the stated boundary: `return requestCount >= 6;`
  (assuming `requestCount` includes the current request). If the caller instead
  passes the count of *prior* requests, use `> 5`; either way, add a boundary unit
  test asserting the sixth request is blocked and the fifth is allowed.
- **Severity justification:** P1 — a real correctness defect against a stated
  requirement, but it is a one-request relaxation rather than a complete bypass.

## Plausible concerns not claimed (insufficient evidence)

- **`req.user` provenance/trust:** the review assumes `req.user` is populated by a
  verified session. If it can be influenced by client input, F1 is worse; there is
  not enough evidence in the patch to claim that.
- **Time-window semantics of `overLimit`:** the function takes only a count, so
  the windowing may happen in the caller. Without the caller, a missing-window
  bug cannot be asserted.
- **Timing side channel in `startsWith`:** relevant but subsumed by F2's
  truncation; not counted separately to avoid inflating the finding list.
- **General absence of rate limiting on admin endpoints:** out of scope for this
  patch's stated requirements.
- **`module.exports` exposing all helpers:** not a defect by itself; noted only
  because it widens the import surface.

## Method note

No code was executed and no attack was run against any service. Line numbers refer
to the patch as supplied in the task prompt. Severity labels are the reviewer's
calibrated judgement, not a standardized scoring system.
