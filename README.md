# AI Arena

**OpenCode-first, role-specific evaluation of AI models for software engineering.**

AI Arena is a public project to discover **what a model can safely and reliably do**, not merely how high it ranks on a general benchmark. Its intended workloads are web applications, mobile applications, desktop applications, backend systems, and DevOps.

> **Current status — Research Phase 01 (2026-11-11).** The research is published; the executable benchmark suite has **not** been built or run. The tables below are not model scores.

## Latest run

| Field | Value |
| --- | --- |
| Latest completed evaluation | **None yet** |
| Models tested by AI Arena | **0** |
| Benchmark version | **Not released** |
| Current phase | Research and protocol design |
| First results | Not yet available |

Once evaluations exist, this section will contain the **latest verified run**, with task coverage, provider/model IDs, harness revision, per-role results, confidence, failures, and a link to immutable run artifacts. Earlier runs will move to a versioned archive without losing their evidence. No fabricated or unverified scores.

## Research — source of truth

| Document | Purpose |
| --- | --- |
| [Benchmark landscape](docs/research/2026-11-11-benchmark-landscape.md) | Existing projects, tradeoffs, primary sources, the Reddit example, and lessons |
| [Evaluation design](docs/research/2026-11-11-evaluation-design.md) | Proposed tracks, role scoring, safety gates, fair comparisons, test validity, and the 30–60 minute goal |
| [OpenCode & model availability](docs/research/2026-11-11-opencode-model-availability.md) | CLI feasibility, identity and provenance, provider limits, privacy and deprecations |
| [Source register](docs/research/2026-11-11-source-register.md) | Primary links, evidence dates, and verification ledger |

**This is research and a proposal, not a runnable benchmark.** Challenges, fixture repositories, offline graders, runner scripts, and scores must pass a separate implementation and validation phase before anyone uses the scores to route engineering work.

## What we intend to measure

AI Arena will report a **role-by-role suitability matrix**, preserving special strengths even where a model's overall average is weak. Candidate roles include Planner, Repository Analyst, Builder, Debugger, Reviewer/Gatekeeper, Test Engineer, Security Auditor, DevOps Engineer, and Documentation/Handoff. Tests will distinguish tightly structured from underspecified requests and short from multi-step work.

We will also measure whether a model preserves existing code, identifies missing information, produces evidence, respects scope, uses tools correctly, recovers from failing tests, and stops when it should.

## Core principles

1. **Never test on production or on a valuable working tree.** Use disposable, isolated copies of synthetic or appropriately licensed fixtures. No live deployments, credentials, or GitHub push access.
2. **Judge artifacts, not confident claims.** Run tests and inspect patches independently, on a pristine environment outside agent control.
3. **Do not let a high average erase a useful specialization.** Publish independent role, difficulty, structure, reliability, and safety views.
4. **Do not treat quota failures as wrong answers.** Record rate limits, outages, exhaustion, and hard model errors distinctly.
5. **Make comparisons reproducible.** Pin task versions, baseline commits, test conditions, OpenCode version, exact provider/model route, settings, and budgets.
6. **Audit the benchmark itself.** A reference solution must pass and an empty patch must fail the intended task before release.

## Planned repository layout (not implemented)

- docs/research/ — evidence and source reviews (now present)
- docs/protocol/ — approved evaluation methodology and versioned schemas
- challenges/ — original task statements and disposable fixtures
- evaluator/ — isolated execution and scoring, never agent-editable
- runner/ — OpenCode adapter and orchestration
- results/ — machine-readable runs and evidence
- archive/ — historical run reports and deprecated task revisions

The first implementation should be a small, independently verified pilot rather than an expensive all-model sweep. A single model's initial diagnostic session should aim for **30–60 minutes**; not every platform can be completely tested in one session.

## Public participation and reuse

The intention is that anybody can clone the **future released suite**, use their own OpenCode providers, run it against disposable fixtures, and publish comparable results. Do **not** submit API keys, private code, personal data, private model traces, or confidential project material. Repository license and contribution rules still need an explicit maintainer decision before the task set is opened for contributions.

## Integrity notice

Published tasks eventually risk being included in model training data. Results on public tasks are **practical diagnostics**, not proof of general intelligence. Periodic task refreshes, reproducible randomized variants, and optional private holdout evaluations are recommended for higher-confidence claims.

Last research review: **2026-11-11 (Asia/Manila)**.
