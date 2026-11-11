# T07 — Security/correctness review

**Scope and assumptions:** Static review of the supplied 17-line patch only. Assumed an Express-style request API, a SQL client, valid secret storage, an authenticated-admin requirement for invoices, full webhook signature verification, parameterized SQL, and a rate limit that blocks the sixth request in a window. No code was executed against any service. Line numbers refer to the supplied patch.

## Findings

### 1. Client-controlled admin header bypasses authentication — P0

- **Lines:** 03
- **Impact:** `isAdmin(req)` returns true for any request that sets `x-admin: yes`, regardless of authentication. This directly defeats the requirement that only authenticated admins access invoices.
- **Exploit/failure scenario:** An unauthenticated caller sends `GET /invoices` with `x-admin: yes`; the header is ordinary client input, so the check succeeds and the invoice route treats the caller as an admin.
- **Recommended fix:** Derive admin status exclusively from a server-validated session or signed token (for example `req.user.role` populated by trusted authentication middleware). Ignore client-supplied role headers entirely and fail closed when `req.user` is absent.
- **Severity justification:** P0 — a trivial unauthenticated authorization bypass on invoice access.

### 2. Webhook HMAC is only partially compared — P1

- **Lines:** 05–08 (especially 08)
- **Impact:** `webhookOk` compares only the first 8 hexadecimal characters of the expected SHA-256 HMAC (`expected.slice(0, 8)`) using `startsWith`. A caller can pass a short signature such as `abcd1234` and only needs to match 32 bits instead of the full 256-bit digest. The comparison is also not constant-time.
- **Exploit/failure scenario:** An attacker who can submit webhook requests repeatedly has a 1-in-2^32 chance per guess of passing the prefix check; with enough requests this becomes feasible. The missing full-length check means the function accepts truncated signatures that should be rejected. A local timing measurement was not performed, so the timing side channel is noted but not separately claimed.
- **Recommended fix:** Require the signature to be a string of exactly 64 hexadecimal characters and compare all 64 characters with `crypto.timingSafeEqual(Buffer.from(signature, 'hex'), expectedBuffer)` after validating lengths. Reject any mismatch; do not use prefix comparison.
- **Severity justification:** P1 — signature verification is incomplete and forgeable with substantial but not trivial effort; it is not a direct unauthenticated bypass like finding 1.

### 3. SQL injection in invoice lookup — P0

- **Lines:** 10–13 (especially 11–12)
- **Impact:** `invoiceQuery` concatenates `tenantId` and `invoiceId` directly into SQL. Any quote in either value changes the query structure, allowing authentication/authorization bypass and arbitrary row disclosure.
- **Exploit/failure scenario:** A tenant ID such as `x' OR '1'='1` produces `WHERE tenant_id='x' OR '1'='1' AND id='...'`, which can return rows outside the caller's tenant. A crafted invoice ID can similarly alter the predicate or inject additional SQL depending on the client's capabilities.
- **Recommended fix:** Use a parameterized query, for example `SELECT * FROM invoices WHERE tenant_id = $1 AND id = $2`, and pass `[tenantId, invoiceId]` as bound parameters. Validate both values as expected identifier types before querying.
- **Severity justification:** P0 — SQL injection exposes cross-tenant invoice data and can escalate to broader database compromise depending on the SQL client's permissions.

### 4. Rate limit permits the sixth request — P2

- **Lines:** 14–16
- **Impact:** `overLimit` returns true only when `requestCount > 6`. If `requestCount` is the number of requests in the current window, the sixth request has count 6 and is allowed; the limit is only enforced on the seventh request. The requirement is to block the sixth.
- **Exploit/failure scenario:** A client sends six requests in a window and all six succeed; the control is off by one. Repeated across windows, this doubles the intended per-window allowance at the boundary.
- **Recommended fix:** Change the predicate to `requestCount >= 6` (or `>= RATE_LIMIT`) and define explicitly whether `requestCount` includes the current request. Add tests for counts 5, 6 and 7.
- **Severity justification:** P2 — a real control bypass, but limited to one extra request per window rather than a direct data or authentication compromise.

## Plausible concerns not claimed (insufficient evidence)

- The webhook signature comparison may leak timing information because `startsWith` is not constant-time, but no timing measurement was performed; this is folded into finding 2 rather than counted separately.
- Webhook replay protection cannot be assessed because the patch shows no timestamp, nonce, or event-ID freshness check; the surrounding route may supply one.
- The rate limiter's storage and atomicity are not shown; a non-atomic read/increment could allow races, but that is an assumption about code not present.
- `req.user?.role` depends on authentication middleware that is not supplied; the review assumes it is trustworthy only when populated by that middleware, not when set from a client header.
- No request-body size limit, SQL client permission model, or logging/redaction policy is visible, so those are not scored.