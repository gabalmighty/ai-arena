# Research 01 — Proposed AI Arena evaluation design

**Status:** DESIGN PROPOSAL ONLY — not a released benchmark, schema, grading implementation or executable instructions.  
**Prepared:** 2026-11-11.  
**Intended runner:** OpenCode against disposable, offline-first engineering fixtures.

## 1. Evaluation objective and unit of comparison

AI Arena should answer: **which model/provider route can be trusted with which engineering role and task structure**, given limited free quotas and a 30–60 minute screening budget?

The experimental unit is **one isolated task attempt** with a known initial fixture, one exact model route, one OpenCode configuration, one prompt, a bounded tool/time budget, and independent post-run verification.

A complete profile must identify:

- provider/model identifier (and provider-reported backend identity or revision if supplied); never invent a model identity for anonymous or rotating endpoints;
- OpenCode version, agent name, tool list, permission rules, system/role instructions hash, reasoning variant and declared model context;
- benchmark/task revision and fixture baseline SHA;
- host operating system, language/toolchain versions and container image digest;
- start/end time, wall-clock duration, attempts, retries, timeouts, input/output token use and priced cost when independently available;
- task and role scores, safety flags, observed failures, evidence locations, and whether the result was reproduced.

**A model score is not portable across different harnesses.** Pin the harness and compare only within compatible conditions. An endpoint such as openrouter/free may rotate among models; list it as a **routing-policy experiment**, not as a distinct named model.

## 2. Track architecture

Separate **role**, **engineering domain**, **task structure**, **difficulty**, and **evidence level** as independent axes.

### Roles and evidence

| Role / use case | Typical task class | Independent evidence |
| --- | --- | --- |
| Repository Analyst | Locate source of behavior; impact map of a change | Correct paths, links to exact code, zero invented dependencies |
| Planner / Architect | Propose bounded design; surface tradeoffs and blockers | Pre-registered requirements rubric; blind human review for subjective matters |
| Builder — small fix | Patch isolated bug with constraints | Fail-to-pass + pass-to-pass tests; pristine reapplication; patch diff |
| Builder — feature | Add a small feature without collateral edits | Acceptance assertions, API compatibility, existing tests, change budget |
| Debugger | Diagnose failure logs and apply minimal repair | Correct root cause, clean rerun, no suppressed tests |
| Reviewer / Gatekeeper | Review a prewritten flawed PR | True-positive bugs, false positives, precise file/line, severity |
| Test Engineer | Write tests for latent bugs / edge cases | Tests fail on known buggy variant and pass on fixed variant; low false positives |
| Security Auditor | Discover an injected defect or unsafe design | Verified findings, risk attribution, no fabricated CVEs or insecure workaround |
| DevOps Engineer | Repair local CI, container, Kubernetes or deployment configuration | Lint + dry-run + controlled sandbox outcome and no destructive side effects |
| UI / Accessibility Engineer | Fix a React/Electron/mobile screen | Unit/integration plus browser screenshot or emulator where available |
| Documentation / Handoff | Produce actionable bounded summary | Claims backed by files, tests, and correct PASS/PARTIAL/BLOCKED boundaries |

**Architecture review and subjective UI aesthetic quality are not fully automatable.** Label them separately from objectively graded code tasks.

### Engineering domain packs

| Domain | Initial inexpensive fixtures | Evidence limit in the first pilot |
| --- | --- | --- |
| Web full-stack | TypeScript/React, Node API, auth flow, responsive layout, data migration | Node tests + isolated Playwright browser if installed |
| Mobile | Kotlin/Java Android or React Native: state, lifecycle, permission and offline behavior | Code/unit tests are not proof of real device UI; emulator-qualified badge only after emulator run |
| Desktop | Electron/TypeScript or .NET desktop: IPC, persistence, permissions, restart behavior | Headless tests are not proof of real desktop dialogs; GUI-qualified only after observed app run |
| DevOps | Dockerfile/Compose, CI YAML, Kubernetes manifests, rollback and health checks | Static validation / local sandbox first; no claim of actual cloud deployment |
| Shared backend | Python/Go/TS/Rust: APIs, race conditions, serialization and data integrity | Executable unit/integration tests in pinned environment |

Do not force a model to take a domain task if it lacks the needed interface (e.g., a text-only endpoint for a screenshot test). Report **NOT_APPLICABLE/UNSUPPORTED** and make the denominator explicit.

## 3. Structure and complexity controls

**Prompt structure:** Every tested capability should eventually have a **structured mode** (goal, input, expected behavior, strict scope and acceptance criteria) and a **realistic mode** (short issue-like request requiring clarification or inference). In realistic mode, deliberate ambiguity must be classified:

- **solvable ambiguity:** safe engineering choice is permitted, with explanation;
- **material missing prerequisite:** correct answer is BLOCKED / ask or report, not invented completion.

Do not accidentally penalize a model for refusing an impossible problem.

**Difficulty labels:** D1 (single-file reasoning), D2 (small code changes), D3 (cross-file tests and dependencies), D4 (multiple steps/feedback loop), D5 (higher-risk or complex). These are **AI Arena's proposed labels**, not a claim that the Reddit example established five levels. Do not treat D1-D5 as equal-time units; calibrate with human reference attempts before release.

**Time horizon:** Short (2–5 min), medium (5–10 min), and bounded multistep (up to ~15 min). Most tasks should finish well under 10 minutes. Long-loop behavior is measured within a strict timeout rather than by waiting indefinitely.

**Repetition:** One first-pass run gives a **provisional diagnostic**, not a reliability claim. Repeat important role/task cells at least 3 times on different seeds before certifying suitability; show sample size and uncertainty. First attempt, repaired attempt and repeated fresh attempt are distinct metrics. Record temperature/reasoning settings if supported; do not assume perfect determinism.

**Order effects:** Run each comparison in a fresh session/worktree; counterbalance task order. Do not give a model the answer from its earlier mode. Structured-vs-realistic delta should ideally use equivalent but non-identical seeded tasks, not a copied prompt/solution.

## 4. 30–60 minute pilot target

The first suite should be a **quick capability screen**, not a complete software-engineering certification. Example *target budget* for one route (to be calibrated, not yet implemented):

| Candidate slice | Approx. cap | What we learn |
| --- | ---: | --- |
| Repository comprehension + source evidence | 4 min | Navigational honesty |
| Structured constrained defect fix | 8 min | Builder suitability |
| Realistic ambiguous defect diagnosis | 7 min | Inference and abstention |
| Failed-test repair | 7 min | Debugging and tool feedback |
| Seeded-diff code review | 5 min | Finding genuine bugs vs false positives |
| Edge-case test design | 5 min | Test Engineer suitability |
| Offline DevOps/config issue | 5 min | Reliability under operational constraints |
| Truthful completion and missing-information check | 3 min | Reporting and calibration |
| Setup/teardown/verification overhead allowance | 6 min | Total ~50 minutes |

These are **planning allocations, not measured execution times**. Provider latency can make a scheduled wall-time screen incomplete. Report incomplete coverage rather than claim a full score. Mobile, desktop, browser visual and advanced security tasks should be separate optional packs with comparable budgets.

Do not run all models in parallel by default: free provider caps, shared machine contention and throttling make the comparison worse. Sequential or carefully rate-limited scheduling with fixed concurrency should be the default.

## 5. Scoring: independent role cards, not a deceptive total average

Proposed per-task record:

| Field | Meaning |
| --- | --- |
| outcome | PASS, PARTIAL, FAIL, UNSAFE, INCOMPLETE, INVALID_TASK, PROVIDER_LIMIT, PROVIDER_ERROR, UNSUPPORTED |
| score_0_100 | Role-specific quality score **only if assessable** |
| critical_safety | Boolean with evidence |
| functional_pass | Independent failing-to-passing checks |
| regressions | New failures in previously passing assertions |
| scope_violations | Out-of-bounds edits, skipped tests, unauthorized files/actions |
| claims_verified | Factual completion statements actually supported by logs/artifacts |
| attempts / repair | First-pass vs repaired-pass outcome |
| time_and_tokens | Observed use or null if unavailable |
| confidence | provisional, replicated, or insufficient evidence |

### Candidate rubrics (must be calibrated against reference solutions)

| Role family | Proposal for 100-point scoring |
| --- | --- |
| Builder / Debugger | 50 behavior & hidden acceptance; 20 regression/preservation; 15 scope & requirements; 10 truthful evidence; 5 efficiency |
| Reviewer / Security Auditor | 45 weighted bug recall; 25 precision (avoid false positives); 15 exact localization/actionability; 10 severity prioritization; 5 evidence/calibration |
| Test Engineer | 40 catches known defect variants; 25 material edge-case coverage; 15 avoids invalid/flaky assertions; 10 preservation & scope; 10 evidence |
| Planner / Architect | 30 requirements; 25 risk/constraints; 25 feasibility/tradeoff soundness; 15 verifiable plan; 5 calibrated uncertainty, with blinded human adjudication |
| DevOps | 50 correct sandbox final state; 20 safe rollback/no collateral changes; 15 config/scope/least privilege; 10 verified evidence; 5 efficiency |

These are **proposals**, not tested weights. Do not compare a 90-point Reviewer score with a 90-point Builder score as if they measure identical skills. Within a role, publish task-level scores, median, pass rate, n, confidence, prompt structure, domain and time.

For review, count **unique confirmed defects**; do not reward repeated comments about the same underlying bug. Weight by verified impact, not scary language. A model finding 1 real P0 and 10 invented P0s is not a good Gatekeeper. If gold defects are uncertain, send to adjudication rather than scoring mechanically.

### Noncompensating safety gate

A benchmark model must never obtain access to production assets. Additionally, any evidenced **critical safety violation** — attempting a forbidden push, deleting unrelated files, exposing credentials, deliberately bypassing tests/security, editing verifier/solution artifacts, or creating dangerous operational state — marks the task **UNSAFE** and **disqualifies autonomous write-role recommendation** until separately reviewed. It cannot be offset by a high quality average. Distinguish attempted action from an actually executed action in the evidence.

For less severe scope mistakes, record a proportional penalty and visible reason. Do not quietly erase bad trials from denominators.

### Efficiency and free quota

Report quality, wall time, requests, token usage, timeouts, quota availability, errors and effective cost separately. **Do not score a 429 or quota exhaustion as an incorrect algorithmic answer**. The user still needs the operational failure rate to route work: maintain a separate *serviceability* measure (successful task-start/completion within quota) alongside quality conditional on service availability.

## 6. Harness and safety contract

**Absolutely do not run experimental models on the actual valuable project worktree.** Every trial starts from a pinned seed commit in a disposable container or equivalent isolated checkout.

Minimum isolation requirements for implementation:

1. No production GitHub token, SSH agent, cloud secret, environment secret, user home mount, or outbound network beyond the minimum authenticated model endpoint.
2. No git push, remote publishing, destructive deploys, external production resource mutation or CI execution under production credentials.
3. Read-only or tightly scoped role permissions. A Reviewer should not be able to edit; a Builder should only modify an allowlisted fixture. Disable subagents or tightly pin/record them for fair comparisons.
4. Captured baseline: clean initial git status, dependency lock, expected failing and passing tests, fixture checksum.
5. Resource caps: process wall-clock, per-step/turn budget, CPU/memory/disk, network and test timeout. An external watchdog should kill stalled sessions.
6. Record stdout/stderr, non-secret OpenCode structured events, final git status, diff, changed paths and exit status. Redact any credentials/tokens before writing public artifacts.
7. Verifier runs **after agent completion in a separately controlled pristine image** with exactly the diff; agent-visible tests alone never determine PASS.
8. Benchmark integrity: a known reference patch must pass, empty patch fail, mutation/negative tests catch easy cheats, and each test task is reviewed for rubric contradiction or nondeterminism.
9. Freeze and archive versioned task definitions; if a grader is broken, retract/flag affected scores and rerun on repaired version, rather than silently regrade.
10. Never leak private holdout answers or proprietary source into a public run; maintain a public open-task pack that any user can reproduce.

Offline DevOps fixtures should not get arbitrary cloud credentials or actual cluster admin privilege. Do not confuse OpenCode permission rules with a security sandbox: **the OS/container boundary is the real isolation**.

## 7. Report schema and routing recommendations

The latest public README should ultimately show a **role suitability heatmap** and separate model cards. Suggested status vocabulary:

- **ELIGIBLE (replicated):** meets role quality threshold and has no critical safety violations across required repeated tasks, with stated evidence level.
- **CONDITIONAL:** strong at a narrow task class, but needs an approved structured prompt, read-only access, human reviewer, or reduced scope.
- **REVIEW REQUIRED:** insufficient runs, mixed results, or unresolved risk.
- **NOT RECOMMENDED for role:** reproducibly low performance or a safety incident.
- **UNAVAILABLE:** deprecated, quota-exhausted or not enabled; do not confuse with failed reasoning.

These are deployment recommendations, *not personality labels or a claim about permanent model capability*.

Public run package planned: machine-readable manifest, per-task trace metadata (sanitized), diff/checksums, verifier outputs, graded scorecard, identified limitations, provider failure events, exact sources/version, and a short human summary. A published result must be reproducible without exposing secrets. Archive previous reports by run ID and date, never overwrite an earlier row without an explicit correction notice.

## 8. Before authoring the first challenge

Gates to agree and independently validate in implementation phase:

| Gate | Acceptance |
| --- | --- |
| Protocol freeze | Clear role definitions, exact eligibility thresholds, deterministic scoring where feasible |
| Fixture qualification | Reference passes; empty patch fails; baseline regression suite passes; no network/secret dependency |
| Anti-cheat | Verifier isolated; unapproved files/actions blocked; final diff replayed on pristine state |
| Fairness | Fixed OpenCode version, known model IDs, same eligible tools and budgets; distinct variant profiles |
| Observability | Quota/error/timeout distinguished; true elapsed duration and model identity recorded |
| Reproduction | Another machine can build the fixture and reproduce grader result using original diff |
| Ethical/public release | Original or appropriately licensed source; no confidential customer/work material; contribution/license review |

**Not yet decided:** Final task count, exact rubric weights, eligibility threshold, whether to adopt Harbor containers versus a simpler OpenCode runner, permitted languages and emulators, and license. This document records the research-informed default proposal, not final policy.

---

**Core sources:** [SWE-bench Multilingual](https://www.swebench.com/multilingual), [SWE-bench Pro V2](https://labs.scale.com/leaderboard/swe_bench_pro_public_v2), [Aider](https://aider.chat/docs/leaderboards/), [Terminal-Bench](https://www.tbench.ai/?version=2.0), [Harbor](https://github.com/harbor-framework/docs/blob/main/guides/creating-tasks.mdx), [devops-bench](https://github.com/kubernetes-sigs/devops-bench), [OpenCode permissions](https://opencode.ai/docs/permissions), [code-judge bias](https://doi.org/10.48550/arXiv.2604.16790), [FCV paper](https://research.google/pubs/when-correct-is-not-safe-can-we-trust-functionally-correct-patches-generated-by-code-agents-2/). More in [source register](2026-11-11-source-register.md).
