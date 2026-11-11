# Research 01 — Source and evidence register

**Evidence cutoff:** 2026-11-11, Asia/Manila.  
**Purpose:** Keep verifiable links, release dates, source type and the exact lessons that motivated the proposed AI Arena methodology. This is not a citation of AI Arena's own test results; **none have been run**.

## Evidence policy

- **P — Primary source:** Official benchmark project, dataset, source repository, vendor documentation or original research article.
- **C — Community anecdote:** Useful to generate test ideas, not a trustworthy cross-model ranking.
- **S — Secondary coverage:** Useful context, but prefer the official source if describing current limits, results, or supported CLI flags.
- Dates describe the source's posted/release update when known, and **checked** is the date we inspected it, not proof its content will remain unchanged.
- Public pages are mutable. When implementing an executable benchmark, pin GitHub commits/container digests and task-set versions; do not rely on live homepages as reproducible data.

## Evaluations and implementation frameworks

| ID | Class | Source / directly reviewed link | Date or scope confirmed | Why it matters |
| --- | --- | --- | --- | --- |
| B01 | P | [SWE-bench official](https://www.swebench.com/) and [dataset documentation](https://www.swebench.com/SWE-bench/guides/datasets/) | 2026 site; Verified/Lite/Full variants | Repository patch and regression grading baseline |
| B02 | P | [SWE-bench Multilingual](https://www.swebench.com/multilingual) | 300 issues, 42 repositories, 9 languages | Generalization beyond Python; fail-to-pass/pass-to-pass |
| B03 | P | [SWE-bench Pro V2](https://labs.scale.com/leaderboard/swe_bench_pro_public_v2) and [dataset protocol](https://huggingface.co/datasets/ScaleAI/SWE-bench_Pro/blob/main/README.md) | Revised 2026-09-22: 642 tasks / 11 repos | Locked evaluation, valid task oracle, pristine re-grading, no web leakage |
| B04 | P | [Aider Polyglot leaderboard](https://aider.chat/docs/leaderboards/) and [notes](https://aider.chat/docs/leaderboards/notes.html) | 225 tasks, 6 languages | First-try vs retry results; format fidelity; cost/reliability |
| B05 | P | [Terminal-Bench](https://www.tbench.ai/?version=2.0); [Epoch benchmark description](https://epoch.ai/benchmarks/terminal-bench) | Version 2.0 | Test real tool use; measure model + harness pair, not model alone |
| B06 | P | [Harbor framework](https://github.com/harbor-framework/harbor) and [creating tasks](https://github.com/harbor-framework/docs/blob/main/guides/creating-tasks.mdx) | Current task format in docs | Independent instruction, environment, tests, optional oracle solution |
| B07 | P | [BigCodeBench](https://github.com/bigcode-project/bigcodebench) | Archived 2026-07-20 on GitHub | More complex instruction-following; not a repo-maintenance substitute |
| B08 | P | [SWE-Lancer introduction](https://openai.com/index/swe-lancer/) | Released 2025-02-18; dataset update 2025-07 | Implementation and managerial-decision tasks |
| B09 | P | [SWE-bench Multimodal](https://www.swebench.com/multimodal) | V2 release 2026-09-01; 480 tasks | Visual debugging and UI requirements |
| B10 | P | [CodeReviewBench](https://www.codereviewbench.com/) | Site reports 30 PRs, 121 bugs, 2 modes | Precision, recall, localization and judge limitations |
| B11 | P | [Kubernetes SIGs devops-bench](https://github.com/kubernetes-sigs/devops-bench) | Current GitHub repository | Infrastructure state checks, operational risks, teardown |
| B12 | P | [AndroidWorld](https://github.com/google-research/android_world) | Original 116 Android GUI tasks; dynamic variants | Device-state reproducibility; **not** Android source engineering |
| B13 | P | [OSWorld](https://os-world.github.io/) | OSWorld 2.0 announced 2026-06-26 | Desktop environment-state evaluation; **not** desktop code correctness |
| B14 | P | [WebArena](https://github.com/web-arena-x/webarena) | Self-hostable web environment | State-controlled browser workflows; distinct from web app authoring |

## Benchmark validity, risk and judging

| ID | Class | Source | Publication/update | Research implication |
| --- | --- | --- | --- | --- |
| V01 | P | [OpenAI: Why we no longer evaluate SWE-bench Verified](https://openai.com/index/why-we-no-longer-evaluate-swe-bench-verified/) | 2026-02-23 | Public benchmark contamination; beware memorized patches |
| V02 | P | [OpenAI: Separating signal from noise in coding evaluations](https://openai.com/index/separating-signal-from-noise-coding-evaluations/) | 2026-07-08 | Original benchmark task/grader errors can distort scores |
| V03 | P | [Scale: SWE-bench Pro V2 protocol](https://labs.scale.com/leaderboard/swe_bench_pro_public_v2) | 2026-09-22 | Removed 89 invalid cases, corrected 69 instruction contradictions, clean image re-grading |
| V04 | P | [Google Research: Functionally correct yet vulnerable patches](https://research.google/pubs/when-correct-is-not-safe-can-we-trust-functionally-correct-patches-generated-by-code-agents-2/) | ACL 2026 | Passing functional tests need not mean secure code |
| V05 | P | [Judging the Judges: Position Bias](https://aclanthology.org/2025.ijcnlp-long.18/) | IJCNLP/AACL 2025 | Randomize order / blind labels for qualitative decisions |
| V06 | P | [Justice or Prejudice? Quantifying Biases in LLM-as-a-Judge](https://proceedings.iclr.cc/paper_files/paper/2025/hash/fdca08d371e4b6c031397909e20043bd-Abstract-Conference.html) | ICLR 2025 | Multiple forms of judge bias |
| V07 | P | [Bias in the Loop: Auditing LLM-as-a-Judge for SE](https://doi.org/10.48550/arXiv.2604.16790) | arXiv preprint submitted 2026-04-18 | Code judgment can swing with presentation even if code unchanged |

The two SWE-bench Pro audit reports above refer to **different dates and versions**. Do not imply the v2 corrections existed in the original release or that every past score is directly comparable. The benchmark landscape notes those differences explicitly.

## OpenCode and provider documentation

| ID | Class | Source | Snapshot fact / rationale |
| --- | --- | --- | --- |
| O01 | P | [OpenCode CLI commands](https://opencode.ai/docs/cli/commands) | Per-run model and agent, NDJSON format, model listing, sanitized session export, stats |
| O02 | P | [OpenCode model selection](https://opencode.ai/docs/models) | Project availability, session precedence, free-model flag, variants |
| O03 | P | [OpenCode agent configurations](https://opencode.ai/docs/agents) | Read-only reviewer, permissions, V2 step limit |
| O04 | P | [OpenCode permissions](https://opencode.ai/docs/permissions) | Shell uses host authority; rules and version differences |
| O05 | P | [OpenCode providers](https://opencode.ai/docs/cli/providers) | Explicit authentication and model selection (do not publish credentials) |
| O06 | P | [OpenCode console models, privacy, deprecated models](https://opencode.ai/docs/console/models) | **Crouton Alpha Free deprecated 2026-11-09**; free-model availability/privacy caveats |
| O07 | P | [OpenCode Go](https://opencode.ai/go/) | Subscription model and evolving catalog; don't assume Go and generic free endpoints share quotas |
| R01 | P | [OpenRouter free-model collection/FAQ](https://openrouter.ai/collections/free-models/) | Free variants: documented 20/minute, 50/day or 1,000/day with qualified credit history; failed requests count |
| R02 | P | [OpenRouter account/rate limits](https://openrouter.ai/docs/api_reference/limits) | Account-level budget and rate mechanisms, 429 handling, API key status |
| R03 | P | [OpenRouter model routing](https://openrouter.ai/collections/free-models/) | openrouter/free can select a different backend per request, so is not one named model |

Provider docs are live and may evolve. **Do not interpret catalog data as a successful authentication or proof of a specific user's entitlement.** No user-local OpenCode query was performed in this research phase.

## Community inspiration (not benchmark ground truth)

| ID | Class | Source | Use |
| --- | --- | --- | --- |
| C01 | C | [r/LocalLLM: GPT told me Qwen3.5 4B was the best small local model. My benchmark says otherwise](https://www.reddit.com/r/LocalLLM/comments/1th9bx8/gpt_told_me_qwen35_4b_was_the_best_small_local/) | Five informal tests on 12 local models; useful ideas: fabricated authority, missing variables, loop detection and output honesty. Not evidence for ranking hosted OpenCode coding agents |

The Reddit post does **not** establish five tiers of engineering difficulty; it describes five test batteries. Our proposed D1–D5 levels are independent proposed labels.

## Research findings vs what is still unverified

| Statement | Evidence status |
| --- | --- |
| OpenCode has documented CLI routes suitable for a future automated evaluation harness | Official docs inspected |
| Reproducible repo-editing, review, terminal and DevOps benchmark designs exist | Official project/docs inspected |
| Existing public coding benchmarks have documented contamination and grader-validity risks | Primary 2026 research and benchmark updates inspected |
| Named free OpenCode models and OpenRouter free limits exist publicly | Public catalogs inspected on the date above |
| User's OpenCode CLI version, exact enabled model list, quota, privacy settings | **Not checked** |
| Candidate free models actually pass any task in our planned test suite | **Not checked** |
| Proposed pilot can finish in 30–60 min on each provider | **Not measured; requires calibration** |
| Benchmark scripts, tasks, fixtures, or executable evaluator are already released here | **False: research only** |

## License and attribution caution

AI Arena may link to research and adapt *ideas* freely, but copying third-party tasks, reference patches, fixtures, data or benchmark machinery is a separate **license and attribution** question. Inspect each source's LICENSE and asset terms at the version selected before redistribution. Write original challenges whenever practical. Do not publicly commit answers from a private benchmark or publish third-party proprietary evaluation data.

**Maintainer decision needed before public contributions:** choose a license for AI Arena's original code and docs and any future fixture content; no license has been selected here without explicit approval.

---

Research reviewed: **2026-11-11**. The set is an initial curated literature scan, not a claim of exhaustive coverage. Suggested re-review cadence: before each benchmark major version and whenever free-model availability or provider policy changes.
