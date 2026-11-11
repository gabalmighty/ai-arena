# Research 01 — Coding-agent benchmark landscape

**Reviewed:** 2026-11-11 (Asia/Manila)  
**Scope:** What existing evaluations teach AI Arena before authoring any executable tasks.  
**Evidence status:** Desk research from linked primary websites, papers, and project documentation; **no AI Arena model has been run**. Numbers and current availability are time-sensitive.

## Executive conclusion

There is no single existing benchmark that answers our actual deployment question: **which free or low-cost model should be assigned to which engineering role through OpenCode, under what degree of structure, and with what risk?** Reuse the proven evaluation techniques, not one published leaderboard as a routing policy. Most benchmark leaderboards measure one harness and task distribution; a model may be useful for constrained reviews, tests, requirements, or narrow fixes while poor at autonomous implementation.

We should report results for each **provider route + model + OpenCode version + role/prompt mode + environment**, not as intrinsic model scores. Keep safety and failure modes visible even when headline tests pass.

## 1. Existing work and what to learn

| Source / benchmark | What it actually evaluates | Useful idea for AI Arena | Limitation for our goal |
| --- | --- | --- | --- |
| [SWE-bench](https://www.swebench.com/) / [SWE-bench Multilingual](https://www.swebench.com/multilingual) | Fixing real issues by modifying repository snapshots; compare issue-specific and regression tests. Multilingual: 300 cases from 42 repositories / 9 languages. | Broken repository at base revision, executable regression checks, language diversity | Larger and slower; real-world issue histories can contaminate model training; not a role-specific short-run suite |
| [SWE-bench Pro V2](https://labs.scale.com/leaderboard/swe_bench_pro_public_v2) ([dataset and protocol](https://huggingface.co/datasets/ScaleAI/SWE-bench_Pro/blob/main/README.md)) | Challenging long-horizon repository tasks; refreshed 2026-09-22 to 642 cases / 11 repositories, with a locked evaluation protocol | Validate tasks *before* ranking: reference patch pass, empty patch fail, instructions agree with grading; re-evaluate final diff on pristine image | Not a 30–60 minute suite; its original release had task-validity disputes; model and harness differ |
| [Aider Polyglot](https://aider.chat/docs/leaderboards/) ([method notes](https://aider.chat/docs/leaderboards/notes.html)) | 225 difficult in-place code edits across C++, Go, Java, JavaScript, Python, and Rust | Separate task correctness from edit-format compliance; measure first-try vs repair after feedback | Primarily isolated exercises, not maintenance, security, architecture, DevOps or reviews; different editor/harness |
| [Terminal-Bench 2.0](https://www.tbench.ai/?version=2.0) ([Epoch analysis](https://epoch.ai/benchmarks/terminal-bench)) | Terminal tool use in task-specific environments, agent-and-model combinations | Test actual shell/tool behavior; preserve agent identity in every score; environment state matters | Much more general than software engineering; may be operationally expensive |
| [Harbor](https://github.com/harbor-framework/harbor) ([task specification](https://github.com/harbor-framework/docs/blob/main/guides/creating-tasks.mdx)) | An execution framework: instruction, environment, resource limits, verifier, optional reference solution | Strong candidate for *fixture format concepts*: task instructions, environment isolation, independent verification, timeouts | A framework rather than a model score; AI Arena need not adopt it as runtime for v0 |
| [BigCodeBench](https://github.com/bigcode-project/bigcodebench) | Function-level coding with complex instructions and diverse libraries/tool calls; Complete and Instruct splits | Useful lightweight correctness checks and structured instruction-following | Misses repository navigation and preservation; GitHub project was archived 2026-07-20 |
| [SWE-Lancer](https://openai.com/index/swe-lancer/) | 1,400+ freelance software engineering tasks, plus managerial proposal selection | Separate implementation skill from decision/managerial judgment; tests for engineering tradeoffs | Broad, difficult, and costly for free-model screening |
| [SWE-bench Multimodal v2](https://www.swebench.com/multimodal) | Issues with screenshots, mocks, and other visual artifacts; 2026-09-01 v2 has 480 reproducible cases | Add visual UI tasks and cross-check rendered state, not only textual claims | Primarily software issue solving; browser/rendering setup is nontrivial |
| [CodeReviewBench](https://www.codereviewbench.com/) | Reviewing real changes against a labelled defect set (reported: 30 PRs, 121 bugs), precision and recall | Reward true positives and file/line evidence, penalize fabricated findings and duplicate reports | Vendor-specific Kodus review harness; its gold set and judge are not objective universal truth; limited sample |
| [kubernetes-sigs/devops-bench](https://github.com/kubernetes-sigs/devops-bench) | Agents taking actions against actual provisioned infrastructure and checking resulting state | State-based DevOps verification, teardown, chaos/failure injection, evaluate operational rules | Too costly/risky for the first pilot; AI Arena should begin with offline Kubernetes/Terraform/config fixtures |
| [AndroidWorld](https://github.com/google-research/android_world) | Android GUI agent control using an emulator; randomized, executable task states | Dynamic seeded variants and reproducible Android task state | Evaluates **GUI operation**, not Kotlin/Android source engineering; cannot substitute for coding fixtures |
| [OSWorld](https://os-world.github.io/) | Desktop app/computer-use operations and observable outcomes; OSWorld 2.0 announced June 2026 | Environment setup, observable state and human workflow relevance | Mostly computer-use, not desktop-app software development; distinct category |
| [WebArena](https://github.com/web-arena-x/webarena) | Stateful browser operations in a self-hosted website | Controllable browser state and outcome-based checks | Browser-agent operation is not the same as building a web app |
| [Google Research: Functionally Correct yet Vulnerable patches](https://research.google/pubs/when-correct-is-not-safe-can-we-trust-functionally-correct-patches-generated-by-code-agents-2/) | Security flaws that remain even when the functional test suite passes | Add security checks that are not satisfied merely by green unit tests | A research threat model, not a complete benchmark suite |

**Priority to adapt:** SWE-bench-style baseline and regression checks; Aider's edit-compliance concept; CodeReviewBench's precision/recall; Terminal-Bench's actual tool use; Harbor's isolated task contract; devops-bench's state checks. Treat UI/device benchmarks as ideas for later specialized packs, not as identical tasks.

## 2. What the Reddit post does and does not show

The referenced [r/LocalLLM discussion](https://www.reddit.com/r/LocalLLM/comments/1th9bx8/gpt_told_me_qwen35_4b_was_the_best_small_local/) compares 12 local models on one CPU-only setup using **five tests**, not a validated five-tier software-engineering difficulty scale. Its tasks probe uncertainty calibration, fabricated facts, syllogistic logic, missing data and chained physics reasoning. The author's most transferable idea is that apparent intelligence or benchmark rank may fail to predict **epistemic honesty, coherent stopping, or real-world reliability**.

### Valuable ideas to adapt, without copying those five prompts

- **Insufficient-information trap:** Agent should identify the missing project file or requirement rather than manufacture a fact, passing test or deployment state.
- **Fabrication trap:** Include an intentionally nonexistent API flag or dependency requirement; give credit for verifying it is unsupported.
- **Long-reasoning loop/exit behavior:** Enforce task and per-call timeouts; score whether the agent stops cleanly and states a blocker.
- **Correct process, wrong conclusion:** Compare completion claims to actual diff/tests, not just plausible reasoning.
- **Different modes:** Test well-structured and realistic under-specified engineering instructions separately.

### Research caution

It is an **informal, small, non-peer-reviewed community experiment**. Results apply to those exact prompts, quantizations, model inference settings and CPU hardware; they do **not** establish a general best model, nor tell us how a hosted model uses OpenCode's tools. Avoid reprinting its answer table as AI Arena evidence. Community enthusiasm and anecdotes are a *source of hypotheses*, not an evaluation oracle.

## 3. Benchmark design pitfalls already documented

### A. Contamination / memorization

In [OpenAI's 2026-02-23 analysis](https://openai.com/index/why-we-no-longer-evaluate-swe-bench-verified/), SWE-bench Verified was judged heavily contaminated at the frontier. A model can reproduce a known patch rather than reason through the task. Our public tasks will likewise become training material eventually. Therefore: publish task/version provenance; mark public scores as diagnostic; refresh tasks periodically; use randomized but valid seed variants; use optional controlled unseen holdouts for higher-confidence deployment gating; never pretend public tests are unlearnable.

### B. Broken grader / test-oracle problem

[OpenAI's 2026-07-08 audit](https://openai.com/index/separating-signal-from-noise-coding-evaluations/) estimated substantial invalidity in the original SWE-bench Pro task set. [Scale's 2026-09-22 V2 update](https://labs.scale.com/leaderboard/swe_bench_pro_public_v2) removed 89 tasks, corrected 69 inconsistent instructions, turned off agent-phase web access, and added a two-sided oracle check. Implications:

1. Every task must have a documented **failing baseline**, known passing reference fix, and independent regression tests.
2. Tests must measure required *behavior*, not an overly specific implementation.
3. Agent cannot edit the verifier, oracle, or final test environment.
4. Final changes should be **reapplied to a pristine container** before grading; do not accept tests only observed in the agent-controlled worktree.
5. Include checks for fake lockfile edits, caches, test deletion/skips, hard-coded outputs and misleading environment modifications.

### C. Green tests can still mean dangerous code

[Google Research's 2026 finding](https://research.google/pubs/when-correct-is-not-safe-can-we-trust-functionally-correct-patches-generated-by-code-agents-2/) describes functionally correct yet vulnerable patches. Do not score security entirely through unit tests. Add security-specific oracles, forbidden-change checks, dependency checks, and human review for risky changes.

### D. LLM judges are not ground truth

Research on [position bias](https://aclanthology.org/2025.ijcnlp-long.18/), [systematic judge bias](https://proceedings.iclr.cc/paper_files/paper/2025/hash/fdca08d371e4b6c031397909e20043bd-Abstract-Conference.html) and [code-judge sensitivity](https://doi.org/10.48550/arXiv.2604.16790) cautions against letting another LLM assign the whole score. Prefer tests, exact defect oracles, diff constraints and deterministic checks. For architecture/design judgment: blind model labels, pre-register rubric and examples, collect independent calibrated reviews, adjudicate disagreements, report uncertainty. Jev can advise on checkpoints but should never be the sole final grader of its own proposals.

### E. Harness / route / prompt confounds

Performance is always measured within a *specific* setup. The same model with a different agent, tool permissions, reasoning variant, context trimming, hidden system prompt, or provider route can behave differently. Report **the exact OpenCode and model route**, role instructions and permissions. Do not directly compare a model with more tools and more retries to one without; instead publish separate fair profiles.

### F. Platform coverage is not equivalent

A test that only inspects Kotlin source is not evidence of a working Android UI. A React component unit test is not evidence of a pixel-accurate responsive design. A Dockerfile linter is not a successful deployment. Each result should declare an **evidence level**: static analysis, unit/integration, headless browser or emulator, or live sandbox state (never production).

## 4. Gap analysis for AI Arena

Existing evaluations under-represent:

| Unanswered practical question | Proposed AI Arena signal |
| --- | --- |
| Can a weak generalist be a great narrow reviewer? | Per-role scores with distinct code-review gold bugs and false positives |
| Does a structured prompt rescue a model? | Same underlying requirement in both structured and under-specified prompt modes; do not allow solution leakage across modes |
| Can an agent follow exact patch limits? | Changed paths, patch size, forbidden files and diff/format checks |
| Does it recover after a failed test? | First-pass outcome and one controlled feedback/repair opportunity |
| Does it know when it does not know? | Missing prerequisite, invented API, unavailable verification trap |
| Can it work across web/mobile/desktop/DevOps? | Domain-specific synthetic projects, identical tools per comparable run |
| Does it become unreliable on multistep work? | Fixed multi-step scenario, instruction retention and completion within budget |
| Will it damage the repo? | Binary safety gate, preservation/regression checks, isolated worktree diff and audit trail |
| How often is it actually available free? | Rate limits, 429/503, retries, quota status and elapsed time recorded separately |
| Does it honestly report PASS/PARTIAL/BLOCKED? | Claims vs independently recorded evidence |

## 5. Strong recommendation for the next phase

Build an **original, small, OpenCode-native benchmark** with reproducible offline fixtures and independent scoring before integrating any outside benchmark task sets. Start with common engineering skills, then extend by domain (web, Android, desktop, DevOps). For the 30–60 minute budget, sample a few informative tasks per model; add repetition and broader language coverage as separate passes.

Do not use a single composite leaderboard as the routing decision. The *role matrix, safety outcome, confidence level and exact run profile* matter more than a global average.

See [evaluation design](2026-11-11-evaluation-design.md) for a proposed practical rubric and [source register](2026-11-11-source-register.md) for dates and citations.

---

**Evidence class:** Published project docs/papers and an explicitly labeled Reddit anecdote. **No first-hand benchmark execution**; no independent reproduction of third-party model scores. Sources last reviewed 2026-11-11.
