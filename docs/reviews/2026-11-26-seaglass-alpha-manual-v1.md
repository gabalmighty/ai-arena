# Seaglass Alpha — MANUAL-V1 Gatekeeper review

**Review:** 2026-11-26T23:35:51.453+08:00 (Philippine time)  
**Candidate:** Seaglass Alpha, OpenCode Go — **owner-reported; exact route MODEL_UNVERIFIED**. [PR #6](https://github.com/gabalmighty/ai-arena/pull/6) · [Original report](../../results/manual/20261126T144218Z__model-unverified/REPORT.md) · [JSON scorecard](../../results/reviews/2026-11-26-seaglass-alpha-manual-v1.json)

**Artifact verdict: PASS WITH WARNINGS — 95.6/100, 9/9 assessed tasks.** This is a provisional owner-attributed model result, not independently authenticated model identity. The candidate explicitly withheld provider/model identity. Preserve original report and metrics unchanged.

## Task ratings

| Task | Score | Independent evidence / rationale |
| --- | ---: | --- |
| T01 Repository analysis | 95 | Correct mapping of verdict, scope, credentials, independent grading and publication. Minor incorrect claim that local selftest itself needs Docker: the function stages fixtures and calls checked_result locally. |
| T02 Python backend | 100 | 12/12 additional tests passed, including replay current balance, cross-invoice ID conflict, rejection atomicity, metadata mutation and integer/string extra-key distinction. |
| T03 Web markup | 95 | 9/10 additional checks passed. Escapes all five characters, accessible section/button and visible role label. Explicit empty strings give blank heading and role rather than Unknown. Empty vs absent is not explicitly defined; accessibility edge, not XSS. |
| T04 Mobile sync | 100 | 12/12 additional cases passed. Preserves last-occurrence ordering, conflict rules, optional value omission and malformed-record validation; clones values to avoid output aliasing. |
| T05 Desktop filesystem | 95 | 16/17 Linux cases passed; both real symlink checks passed and safe ..notes.txt accepted. Valid POSIX a:b.txt rejected by drive-letter check, a portability issue rather than a demonstrated escape. |
| T06 DevOps | 90 | Correct Node 22 slim, non-root, locked installs, contents: read, explicit Node setup, persist-credentials false and context exclusions. Mutable tags disclosed; static only. |
| T07 Security review | 90 | All four seeded defects found; correct 32-bit HMAC calculation. Claims of offline brute force and a timing oracle are not established by snippet, and P0/P1 labels should be calibrated to reachability and impact. |
| T08 Test engineering | 95 | Submitted suite detects 18 failures on buggy subject; all 29 pass on independently corrected reference. Candidate did not perform corrected control; tests constrain meaningful error wording, so not universally proven. |
| T09 Engineering judgment | 100 | All actions correctly BLOCKED; distinguishes opaque/stateless sessions, bounded key overlap and compromise exception, staging/authorization/rollback, injection ignored. Re-enabling old key during rollback must retain compromise exception. |
| **Mean** | **95.6** | 860/900 points, equal weights. |

## Independent reproduction

Six locally transcribed source files were verified byte-identical by Git blob hashes before execution (hashes in JSON). Python 3.13.5 and Node 22.16.0, Linux. Direct clone was unavailable due to network resolution, so connector text was used. Independently written tests passed **49/51** across T02 (12), T03 (10), T04 (12), T05 (17); the two failed checks are noted above. The exact shipping test file was run on the unchanged starter (**11 pass / 18 fail**, exit 1) and a separate contract-correct implementation (**29/29 pass**, exit 0). Correct reference uses descriptive Error messages naming subtotal and region. No other candidate test suite was rerun verbatim. Inspected submitted logs: T02 9/9 repaired vs 4/9 starter; T03 5/5 vs 1/5 starter; T04 8/8; T08 11/29 against buggy subject. T05 Windows 7/7 (junction fallback) is candidate-reported. T01/T06/T07/T09 static review. No live Docker, CI, browser/AT, mobile device, desktop GUI or cloud tests.

The prior reviews used evolving tests, not a frozen oracle. Ratings are diagnostic and not success probabilities. Prior results are unchanged. Public prior answers existed in the checkout; contamination cannot be excluded (no evidence of deliberate copying).

## Provenance and metrics

- Candidate engineering start 2026-11-26 22:42:18 PHT; finish 23:22:59 PHT; **2441s (40m41s)** reported. PR opened 23:28:20 PHT. No owner stopwatch supplied; elapsed is not independently attested.
- Candidate recorded MODEL_UNVERIFIED, null provider, null requested route, unknown fallback and unknown token/request/cost telemetry. Owner identifies the run as OpenCode Go Seaglass Alpha. No exact model ID inferred. Provisional rank is artifact-based; route-specific qualification requires externally recorded session metadata.
- PR #6 contained 27 added files, all in one run folder. Common credential-pattern scan returned zero matches; not comprehensive. GitHub confirms the dedicated PR and merge commit `0453abdae533a7a8e3f05355fb27280c9e542d4f`. Archived evidence only; no production code approval.

## Recommendation

Trial as supervised backend builder, mobile sync logic specialist, test engineer, repository analyst or planner. Mobile sync is a particularly good observed result: it accepts optional values correctly, unlike HungerG's earlier stricter implementation. Require independent web accessibility and cross-platform path checks, security reviewer oversight for quantitative/attack-feasibility claims, and real CI qualification. Its 95.6 matches Hy4's historical rating but does not establish equal real-world capability. Longer reported duration (40m41s) is not a quality bonus or penalty. Prioritize Baidu, HungerG and Hy4 for route-identified rotation, with Seaglass a promising additional candidate **once exact route is confirmed**. No model earns RECOMMENDED | PASSED from one public run.
