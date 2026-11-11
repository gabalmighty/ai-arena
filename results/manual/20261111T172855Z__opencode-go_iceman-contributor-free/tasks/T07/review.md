# T07 — Read-only security/correctness Gatekeeper review

Scope: untrusted patch under review (not executed, not fixed). Assumptions from prompt applied (Express-style request API, SQL client, valid secret storage, authenticated admins only, full signature verification, parameterized queries, rate-limiting blocks the sixth request in a window).

## Findings (high-confidence)

### P0 — Authentication bypass via client-controlled header (`isAdmin`)
- **Impact:** Any caller who can set request headers can obtain admin access without a valid authenticated admin identity, enabling unauthorized access to invoices and other admin-only actions.
- **Exact relevant line(s):** 03
- **Exploit/failure scenario:** A non-admin (or unauthenticated) client sends `x-admin: yes` and `isAdmin(req)` returns `true`, bypassing intended admin checks based on trusted authentication state.
- **Recommended fix:** Remove trust in `x-admin`. Determine admin status only from authenticated, server-verified identity/claims (e.g. `req.user?.role === 'admin'` after proper auth middleware) and deny by default when identity is absent/unverified.
- **Severity justification (P0):** Direct authorization bypass with immediate, high-impact access to protected resources.

### P0 — Incomplete webhook signature verification allows forgery/guessing (`webhookOk`)
- **Impact:** Attackers may forge or brute-force acceptable webhook signatures because only an 8-hex-character prefix is compared and comparison is not constant-time, risking acceptance of spoofed webhook events.
- **Exact relevant line(s):** 06–08
- **Exploit/failure scenario:** An attacker crafts requests with signatures whose first 8 hex chars match `expected.slice(0, 8)` (search space 16^8) or uses timing side channels to incrementally learn prefix bytes; `webhookOk` returns `true` for a body not authentically signed with the full secret-derived HMAC.
- **Recommended fix:** Require the full HMAC signature to match exactly using a constant-time comparison over equal-length buffers/strings (e.g. compute expected digest and `crypto.timingSafeEqual` on decoded/byte buffers). Reject malformed/missing signatures. (Operationally, also validate encoding and replay protections as applicable—separately from this function contract.)
- **Severity justification (P0):** Breaks integrity/authenticity of inbound webhooks; forged events can trigger privileged or destructive business actions.

### P0 — SQL injection via string-concatenated query (`invoiceQuery`)
- **Impact:** Untrusted `tenantId`/`invoiceId` values can alter query structure, enabling data exfiltration, cross-tenant access, or modification depending on DB permissions.
- **Exact relevant line(s):** 10–12
- **Exploit/failure scenario:** `invoiceId` such as `' OR '1'='1` or a tenant/value containing quotes/comments changes the WHERE clause, potentially returning invoices outside the intended tenant or bypassing filters.
- **Recommended fix:** Use parameterized/prepared queries or a safe query builder with bound parameters (e.g. placeholders for `tenant_id` and `id`) and enforce tenant scoping in trusted server-side logic. Never interpolate raw values into SQL.
- **Severity justification (P0):** Classic injection with potential confidentiality/integrity breach and tenant isolation failure.

### P1 — Rate-limit threshold off-by-one (`overLimit`)
- **Impact:** The sixth request in a window is not blocked as required, weakening abuse/bruteforce protections and violating the stated policy.
- **Exact relevant line(s):** 14–15
- **Exploit/failure scenario:** When `requestCount` is exactly `6`, `overLimit` returns `false` (`6 > 6` is false), so the sixth request is allowed even though the requirement states rate-limiting must block the sixth request in a window.
- **Recommended fix:** Change condition to block at the required threshold (e.g. `return requestCount >= 6;` if count includes the current request) and align semantics/tests with the window-count definition.
- **Severity justification (P1):** Security-control correctness bug that permits extra requests beyond policy; impact depends on endpoint sensitivity but requirement is explicitly violated.

## Plausible concerns not claimed (insufficient evidence)
- **Replay/idempotency of webhooks:** No timestamp/nonce/event-id handling shown in this snippet; I did not claim a replay vulnerability because the surrounding protocol and storage contract are not provided.
- **Error handling/logging behavior:** Absence of logging/metrics/error paths is not shown as a defect with specific impact in this isolated code.
- **Multi-tenant authorization beyond query construction:** While `invoiceQuery` is injectable, broader enforcement (middleware, row-level policies) is outside the snippet and not asserted.
- **Request count source/windowing correctness:** Only the comparison logic is evidenced; counter reset/window implementation is unknown.
