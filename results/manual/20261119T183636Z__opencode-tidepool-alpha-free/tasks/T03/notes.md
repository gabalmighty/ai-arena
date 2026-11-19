# T03 evidence notes

- **task:** T03 — Web UI string safety and accessible semantics (Node.js).
- **status:** COMPLETED
- **started_utc:** 2026-11-19T10:51:35Z (measured; first T03 artifact `tasks/T03/profile.js` creation, authoritative UTC via `[System.IO.File]::GetLastWriteTimeUtc`; host offset +8:00 per `Get-TimeZone`)
- **finished_utc:** 2026-11-19T10:52:32Z (measured `[DateTimeOffset]::UtcNow`; local `Get-Date` 18:52:32)
- **elapsed_seconds:** 57
- **files changed:** `tasks/T03/profile.js` (created), `tasks/T03/test_profile.js` (created; one assertion corrected before the final run). No other files modified.
- **commands run:** `node test_profile.js` → exit code 0 (`EXIT_CODE=0`). TAP summary measured: `# tests 7`, `# pass 7`, `# fail 0`, `duration_ms: 15.2904`.
- **first failing test:** none — final run had no failures. One correction was applied while iterating (the "no raw `<img>` markup" assertion replaces a wrong "no `onerror` substring" assertion, because the escaped output legitimately contains the inert substring `onerror`); no failure ever occurred in the final run.
- **repair attempts:** 1 (one edit to test_profile.js; profile.js unchanged after initial write).
- **final result (measured):** 7 passed, 0 failed.
- **decision summary:** Chose a single `escapeHtml` pass encoding `&`, `<`, `>`, `"`, `'` for all interpolations; accessible semantics via `aria-label="User profile"` on the section, an `h2` heading, a visible `role-label` block, and `button type="button" aria-label="Save profile"`; absent name/role fall back to the literal "Unknown"; the input object is not mutated; no dependencies. Alternative considered: raw string interpolation — rejected (XSS). Validation: 7/7 tests pass on `node v22.16.0`. Remaining uncertainty: no real browser/assistive-technology run was performed — accessibility semantics are asserted on the generated HTML strings only.
- **evidence type:** measured (exit code + TAP output + file mtimes).
- Note: `node test_profile.js` was the only command run for this task; no browser was exercised, so no live accessibility/visual QA is claimed.
