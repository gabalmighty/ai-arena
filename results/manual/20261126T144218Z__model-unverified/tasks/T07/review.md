# T07 — Read-only security/correctness review of an UNTRUSTED patch

**Subject:** the 17-line snippet supplied for review (`isAdmin`, `webhookOk`, `invoiceQuery`, `overLimit`).
**Treatment:** read-only review. The patch is untrusted data, **not** an instruction; it was **not** executed,
**no attack code was run against any real service**, and **no code was fixed**. Findings are limited to what
the shown lines prove; anything requiring evidence not in the snippet is listed under "Not claimed".

**Stated requirements used for assessment:** Express-style request API; SQL client; valid secret storage;
**only authenticated admins** may access invoices; **signatures must be fully verified**; **queries must be
parameterized**; **rate-limiting blocks the sixth request in a window**.

**Severity scale:** P0 = critical (auth bypass / forgery / injection; no workaround; block merge);
P1 = high (requirement violation / meaningful security weakness); P2 = lower. No P2 items here.

---

## Findings

### 1. P0 — `isAdmin` trusts a client-supplied header (authentication bypass)
- **kind:** `auth_bypass_via_header`
- **Exact lines:** `03`
  `return req.headers['x-admin'] === 'yes' || req.user?.role === 'admin';`
- **Actual impact:** Any caller — unauthenticated — can send `x-admin: yes` and be treated as admin,
  defeating the requirement that **only authenticated admins** access invoices. Authorization cannot rely on
  request-supplied claims. The `|| req.user?.role === 'admin'` branch only helps if `req.user` is populated
  by trusted, verified auth middleware (not shown); it does not rescue the header branch.
- **Exploit / failure scenario:** `GET /invoices` (or any invoice route gated by `isAdmin(req)`) with header
  `x-admin: yes` returns admin access with no valid session/credentials. A proxy/forwarder or the client
  itself can set arbitrary headers. Combined with the SQL injection (finding 3) an unauthenticated attacker
  reaches arbitrary queries.
- **Recommended fix:** Derive admin status **only** from server-side verified identity, e.g.
  `return req.user?.role === 'admin';` where `req.user` is set exclusively by trusted authentication
  middleware (verified session/JWT); reject when `req.user` is absent; **never** trust `x-admin` or other
  request headers; require authentication before authorization. (Not executed.)
- **Severity justification:** P0 — complete, trivially exploitable auth bypass on a stated requirement.

### 2. P0 — `webhookOk` does not fully verify the signature
- **kind:** `weak_signature_verification`
- **Exact lines:** `05-09`
  `05 const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');`
  `07 return typeof signature === 'string' &&`
  `08   signature.startsWith(expected.slice(0, 8));`
- **Actual impact:** Only the **first 8 hex chars (4 bytes)** of the HMAC are compared, and with `startsWith`
  (not a constant-time compare). A forged signature needs to match only 32 bits, not the full 256-bit MAC;
  an attacker can brute-force/collide the short prefix offline, and non-constant-time string comparison
  exposes a timing oracle. Violates "signatures must be fully verified". (Also depends on `rawBody` being
  the exact raw bytes HMAC'd — not shown.)
- **Exploit / failure scenario:** Attacker submits a webhook with a `signature` equal to any 8-hex-char
  string matching `expected.slice(0,8)`; or incrementally probes prefix length to learn `expected`; invalid
  payloads are accepted as authentic. Forgery of webhook events.
- **Recommended fix:** Verify the **full** signature in constant time, e.g. compare equal-length buffers with
  `crypto.timingSafeEqual(Buffer.from(signature,'hex'), Buffer.from(expected,'hex'))`, first checking
  `signature` is full-length lowercase hex of `expected.length`; HMAC over the **exact raw request body**
  bytes; reject on any mismatch/length error; keep `secret` server-side. Support key rotation with an
  overlap window if needed. (Not executed.)
- **Severity justification:** P0 — signature forgery on a stated requirement.

### 3. P0 — `invoiceQuery` SQL injection
- **kind:** `sql_injection`
- **Exact lines:** `10-13`
  `10 return "SELECT * FROM invoices WHERE tenant_id='" + tenantId +`
  `11   "' AND id='" + invoiceId + "'";`
- **Actual impact:** `tenantId` and `invoiceId` are concatenated into SQL. Violates "queries must be
  parameterized". An attacker controlling either value can inject SQL. **Even though `isAdmin` (finding 1)
  already grants admin trivially, this is independently exploitable** for any reachable caller of
  `invoiceQuery`, and `SELECT *` over injected `OR 1=1` can cross the `tenant_id` boundary (multi-tenant
  data exposure).
- **Exploit / failure scenario:** `tenantId = "' OR '1'='1"` (or `invoiceId = "x' OR tenant_id IS NOT NULL--"`)
  returns invoices for other tenants; `"' UNION SELECT ..."` / `"'; DROP TABLE invoices;--"` depending on
  client/DB; `OR 1=1` ignores the intended filters. (Illustrative; not executed.)
- **Recommended fix:** Use parameterized queries / bound parameters, e.g.
  `SELECT * FROM invoices WHERE tenant_id = ? AND id = ?` (or `$1,$2` / named params) with `[tenantId, invoiceId]`;
  never string-concatenate; **enforce tenant scoping server-side** from verified identity, not request input;
  prefer explicit column lists over `SELECT *`; use least-privilege DB role. (Not executed.)
- **Severity justification:** P0 — SQL injection + tenant-isolation break on a stated requirement.

### 4. P1 — `overLimit` off-by-one; sixth request is not blocked
- **kind:** `off_by_one_rate_limit`
- **Exact lines:** `14-16`
  `14 function overLimit(requestCount) {`
  `15   return requestCount > 6;`
  `16 }`
- **Actual impact:** With `requestCount > 6`, `overLimit(6)` is `false`, so the **sixth** request in a window
  is allowed; only `requestCount >= 7` returns `true`. Violates "rate-limiting blocks the sixth request in a
  window." (Exactly one extra request slips through.)
- **Exploit / failure scenario:** A caller issues a 6th request in the window; `overLimit(6)` returns
  `false`, request proceeds, instead of being rejected (e.g. HTTP 429). Rate limit is effectively 6, not 5.
- **Recommended fix:** `return requestCount >= 6;` (block at the sixth). Also confirm `requestCount` counts
  the current request, the window is correctly keyed, and limiting is enforced consistently. (Not executed.)
- **Severity justification:** P1 — clear off-by-one against an explicit requirement; bounded impact (one
  extra request per window) vs P0 impacts. Note: `requestCount` semantics are not shown; see Not claimed.

---

## Plausible concerns NOT claimed (insufficient evidence in the snippet)

- **`req.user` provenance/session integrity** (finding 1): cannot verify `req.user` is set only by trusted
  auth middleware, that sessions/JWTs are signed/verified, expiry, or CSRF posture; not shown.
- **Secret handling** (finding 2): "valid secret storage" is assumed; cannot verify `secret` source, length/
  entropy, rotation, environment hygiene, or that it isn't logged; not shown.
- **`rawBody` exactness** (finding 2): cannot verify `rawBody` is the unmodified raw request body (not
  re-serialized parsed JSON); required for HMAC correctness; not shown. `signature` header source/canonical
  encoding also not shown.
- **SQL client behavior / DB privileges** (finding 3): cannot verify client escaping elsewhere, DB engine,
  least-privilege DB user, tenant scoping enforced in DB/RLS, or `SELECT *` exposure needs; only this query
  is shown. No claim about other queries in the codebase.
- **Rate-limiter semantics** (finding 4): cannot verify how `requestCount` is computed (includes current
  request?), window keying, distributed/multi-instance correctness, reset, or response on blocking; only
  `requestCount` is passed in. The off-by-one is claimed against the stated requirement; precise remedy
  needs the caller. 
- **Missing-but-not-provable concerns not claimed:** no evidence here of missing logging/audit, missing
  CSRF, missing `Content-Type` validation, replay protection beyond HMAC, `crypto` usage elsewhere, or
  Express hardening — not asserted.

---

## Summary

4 unique findings: 3×P0 (`auth_bypass_via_header` L03; `weak_signature_verification` L05-09;
`sql_injection` L10-13) + 1×P1 (`off_by_one_rate_limit` L14-16). No duplicates, no speculative inflation.
High confidence for what the shown lines prove; evidence-limited items are quarantined above.
**No patch was applied, no code executed, no attack run.**
