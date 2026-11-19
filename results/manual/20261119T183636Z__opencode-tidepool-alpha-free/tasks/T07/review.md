# T07 — Code review (gatekeeper) — static review of an unreviewed patch

Scope and assumptions (from the evaluation brief):
- Patch under review: quoted in evaluation §T07; treated as untrusted data; **not executed** (no attack code run against real services; static review only).
- Assumptions given: Express-style request API and SQL client; valid secret storage; requirement that only authenticated admins access invoices; signatures must be fully verified; queries must be parameterized; rate-limiting blocks the sixth request in a window.
- Method: manual static inspection of the four functions as written (`isAdmin`, `webhookOk`, `invoiceQuery`, `overLimit`).

## Findings

### F1 — Unauthenticated admin flag bypasses the admin gate — **P1**
- **Actual impact:** any client can self-declare administrative access by sending the client-controlled header `x-admin: yes`; `isAdmin` accepts it as an authentication signal. Under the stated requirement ("only authenticated admins access invoices"), the gate is bypassable by anyone who can reach the endpoint, because the header is not tied to any verified authentication.
- **Exact relevant line:** line 03 — `return req.headers['x-admin'] === 'yes' || req.user?.role === 'admin';`
- **Exploit/failure scenario:** an attacker sends a request with header `x-admin: yes`; `isAdmin(req)` returns true; admin-level invoice operations execute (reaching `invoiceQuery`, see F2). If a proxy or middleware strips the header, the bypass fails — whether that holds is deployment-dependent and not verifiable from this patch alone.
- **Recommended fix:** derive the role from an authenticated claim only (`req.user` set by verified auth middleware, `req.user?.role === 'admin'`); if the header path cannot be justified upstream, remove it.
- **Severity justification:** P1 — a real, high-confidence privilege-escalation path on the admin surface; mitigations are unverifiable from the patch.

### F2 — SQL injection via string-concatenated invoice query — **P1**
- **Actual impact:** `tenantId` and `invoiceId` are interpolated directly into the SQL string. An attacker controlling either value can execute arbitrary SQL against the `invoices` table — e.g., read another tenant's invoices, modify rows, or pivot via database-specific syntax. Magnitude depends on reachability (F1 removes a likely reachability barrier by making the caller "admin").
- **Exact relevant lines:** lines 10–12 — `invoiceQuery` builds `"SELECT * FROM invoices WHERE tenant_id='" + tenantId + "' AND id='" + invoiceId + "'"` by concatenation.
- **Exploit/failure scenario:** `invoiceQuery("a' OR '1'='1", "b")` produces `SELECT * FROM invoices WHERE tenant_id='a' OR '1'='1' AND id='b'` — the OR clause returns rows the tenant did not own (classic injection via string concatenation).
- **Recommended fix:** parameterize the query with the SQL client's prepared-statement API (placeholders such as `?`/`$1`, values passed out-of-band); validate inputs as nonempty strings as defense in depth.
- **Severity justification:** P1 — direct violation of the stated requirement "queries must be parameterized"; a concrete unauthorized-data-access scenario when reachable; consistent with standard SQLi severity practice.

### F3 — Webhook signature compares only the first 8 hex characters, non-constant-time — **P2**
- **Actual impact:** the signature is only the first 8 hex characters (32 bits) of the HMAC-SHA256 digest, compared with `startsWith`. Forgery requires brute-forcing a 32-bit space (~2^32 attempts — trivial on modern hardware), and the timing side channel may leak prefix information. Any caller that trusts `webhookOk` to authenticate a webhook accepts weaker assurance than the "signatures must be fully verified" requirement states.
- **Exact relevant lines:** lines 05–08 — `webhookOk` builds `expected` as the hex digest of `crypto.createHmac('sha256', secret).update(rawBody)` and returns `typeof signature === 'string' && signature.startsWith(expected.slice(0, 8))`.
- **Recommended fix:** compare the full HMAC digest with `crypto.timingSafeEqual` after validating types and length; reject missing or malformed signatures explicitly.
- **Severity justification:** P2 — weak signature entropy plus a timing side channel; real impact only if a caller acts on the result and an attacker can brute force or use the oracle; the flaw is genuine but bounded.

### F4 — Rate limiter blocks the seventh request, not the sixth — **P2**
- **Actual impact:** the limiter admits one more request per window than the stated requirement ("rate-limiting blocks the sixth request in a window"): `overLimit(6)` returns `6 > 6` → false under the common convention that `requestCount` includes the current request, so the 6th request is allowed and the 7th is blocked. The sixth request is not blocked as specified.
- **Exact relevant lines:** lines 14–16 — `overLimit(requestCount) { return requestCount > 6; }`.
- **Recommended fix:** align the semantics with the requirement, e.g., `requestCount >= 6` or adjust the caller's convention; if the window guarantee is meant to be enforced here, the window/state mechanism is not visible in this function (see "Not claimed").
- **Severity justification:** P2 — an off-by-one in a protection control; one extra request per window exceeds the limit; low severity.

## Not claimed (insufficient evidence from the patch alone)

- **F1 exploitability:** whether the header survives proxies/other middleware and whether other middleware sets `req.user` is not visible from this patch; the header path is removed as the conservative fix.
- **F3 intentional scheme:** whether the truncated 8-hex prefix is an intentional cross-party scheme; other components may expect the same prefix — cannot verify from here.
- **F4 window semantics:** the window enforcement, the value of `requestCount` at call time, and the sliding/fixed-window behavior are outside this function; the off-by-one is relative to the stated requirement under the common counting convention.
- **Reachability of `invoiceQuery`:** the route/endpoint and surrounding middleware are not in this patch.
- **"Valid secret storage":** whether the `secret` passed to `webhookOk` actually resides in validated storage is outside this patch (the function only receives it as an argument).
- **DoS/replay in `webhookOk`:** `update(rawBody)` with attacker-controlled size is noted as a plausible concern only, not asserted.
