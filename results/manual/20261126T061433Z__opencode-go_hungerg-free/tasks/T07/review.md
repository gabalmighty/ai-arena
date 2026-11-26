# T07 — Read-only security and correctness review

The patch was treated as untrusted data and was **not executed or modified**. Findings below rely only on the shown lines and the stated requirements.

## F1 — Client-controlled header bypasses admin authentication

- **Lines:** 03.
- **Severity:** **P1** — a direct authorization bypass can expose privileged invoice functionality; no exploit against a real service was attempted.
- **Evidence/impact:** `req.headers['x-admin'] === 'yes'` makes admin status true for any caller that supplies the header, regardless of whether `req.user` exists or is authenticated.
- **Exploit/failure scenario:** An unauthenticated request sets `x-admin: yes`; `isAdmin` returns true and an invoice route relying on this check admits the caller.
- **Recommended fix:** Require an authenticated principal established by trusted middleware and authorize only its server-derived admin role, e.g. `return req.user?.authenticated === true && req.user.role === 'admin';` (adapt the authentication flag to the actual session contract). Do not use a request header as an authorization assertion.

## F2 — Webhook verification accepts only a truncated MAC prefix

- **Lines:** 07–08 (expected digest computed at 06).
- **Severity:** **P1** — the stated full-signature requirement is not met; the effective MAC check is only 32 bits, so forgery becomes a brute-force problem whose practical difficulty depends on request limits.
- **Evidence/impact:** `signature.startsWith(expected.slice(0, 8))` accepts any string beginning with eight matching hex characters and also accepts longer strings with that prefix; it never verifies the complete SHA-256 HMAC.
- **Exploit/failure scenario:** An attacker who can submit many candidate signatures needs roughly 2^32 guesses on average for a matching 32-bit prefix, rather than forging a full 256-bit MAC.
- **Recommended fix:** Validate the exact signature encoding and length, decode/compare the full expected digest, and use `crypto.timingSafeEqual` on equal-length buffers. Add replay protection separately if the webhook contract requires it.

## F3 — Invoice query is built by SQL string concatenation

- **Lines:** 11–12.
- **Severity:** **P1** — attacker-influenced identifiers can change query structure and defeat tenant/invoice scoping; full database compromise is not claimed without driver/deployment evidence.
- **Evidence/impact:** `tenantId` and `invoiceId` are interpolated directly inside quoted SQL literals with no parameter binding or escaping.
- **Exploit/failure scenario:** A value such as `x' OR '1'='1` can alter the `WHERE` predicate and return invoices outside the intended tenant or identifier, subject to the SQL client's configuration.
- **Recommended fix:** Use placeholders and pass values separately, e.g. `SELECT * FROM invoices WHERE tenant_id = ? AND id = ?` with a parameter array (or the driver's named-parameter equivalent). Select only required columns as defense in depth.

## F4 — Rate-limit comparison permits the sixth request

- **Lines:** 14–15.
- **Severity:** **P2** — a definite off-by-one violation of the explicit sixth-request blocking rule; broader security impact depends on what the limit protects.
- **Evidence/impact:** `requestCount > 6` remains false when `requestCount === 6`, so the sixth request is allowed and blocking starts with the seventh.
- **Exploit/failure scenario:** A caller sends six requests inside one window; all six pass even though the contract says the sixth must be blocked.
- **Recommended fix:** If `requestCount` is the count including the current request, use `requestCount >= 6`; otherwise adjust the counting convention and add boundary tests for counts five, six, and seven.

## Plausible concerns not claimed

- **Timing side channel in prefix comparison:** string prefix comparison may short-circuit, but remote measurability and exploitability are not established; it is included in F2's constant-time full-digest fix rather than inflated into another finding.
- **Webhook replay:** no timestamp, nonce, or replay contract is shown, so duplicate-delivery handling cannot be judged.
- **Secret strength, rotation, or logging:** valid secret storage is assumed and no logging/rotation code is present.
- **`SELECT *` data minimization:** the invoice schema and response serialization are absent, so actual overexposure is unknown.
- **Rate-limiter identity, storage, races, or distributed behavior:** only the threshold function is shown.
- **CSRF, session handling, or upstream authentication middleware:** those mechanisms and the route/API context are not present in the patch.

## Machine-readable summary

See [review.json](review.json). Four unique findings; no duplicate severity inflation.
