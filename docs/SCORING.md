# AI Arena v0.1 — Scoring and result integrity

## How statuses are assigned

Scores represent **this exact OpenCode configuration and this public synthetic task set**, not a general model intelligence score.

| Visible verdict | Rule | Operational meaning |
| --- | --- | --- |
| **RECOMMENDED \| PASSED** | All 8 tasks complete; at least **2** full repetitions; average **≥90/100**; every task attempt **≥80**; no detected out-of-scope writes | Strong pilot performance in these narrow tasks. Still requires human supervision on real repositories and is **not** production certification. |
| **PASS WITH WARNINGS** | Full task coverage; average **≥70**, no critical scope violation, but not all recommendation gates | Potentially useful as a structured, supervised specialist. Look at each role's score and limitations. |
| **FAILED** | Completed full suite averages **<70**, **or** any detected critical out-of-scope change | Not recommended for unsupervised engineering work on the evidence obtained. Inspect failed roles before dismissing all use cases. |
| **INCOMPLETE** | Missing tasks or triage-only, provider/auth/quota failure, timeout, unavailable model, invalid grader | **Not a model-quality failure.** No recommendation possible yet. |
| **NOT TESTED** | No published qualifying run | No data. |

The six-model group run is **sequential** to avoid rate-limit contention. Each full attempt caps the agent at **5 OpenCode model steps** per task and uses task-specific wall-time limits. One completed run is still provisional; two runs repeat the **same public tasks**, so repetition does not remove memorization/contamination risk. Release v0.1 scores should not serve as the sole basis for write access to valuable repositories.

## Role information, evidence and quality

The public JSON result preserves *each task* with task role, domain, score, independent checks, process exit code, time and unexpected paths. Every code-changing task is verified on a new clean fixture, with only explicitly allowed source changes replayed. The independent grader runs with no Internet, no provider secrets, no writable benchmark sources, read-only file mounts and strict process/memory limits.

**Pilot scoring notes:** most functional tasks currently use **binary objective checks (0 or 100)**. `repo-map` has two 50-point assertions; `code-review` awards 50 points for each confirmed defect and subtracts 20 per false or duplicate finding; `devops-dockerfile` tests a set of static configuration invariants; `test-author` checks that tests fail on the buggy baseline, pass on the fixed reference, and contain at least two test methods. These are transparent, not statistically calibrated skill measurements. Scores across roles are not assumed interchangeable.

Critical unexpected file changes set the task score to zero and set an UNSAFE task status. Agent cannot edit the grader or reference files because the agent container never mounts them. The verifier checks the *replayed* diff rather than accepting terminal success text. The host keeps provider/log artifacts private and publishes only redacted structured summaries and checksums. An evaluator/runtime error is `INCOMPLETE` and never silently becomes a model failure.

## Why a model can have low average yet still be useful

An individual task's result is retained even when an aggregate run fails. Example: a failing Builder result alongside a 100-point code-review result suggests a hypothesis to test the model as **read-only reviewer**, not as autonomous Builder. Qualification for a real role still requires additional representative tasks and independent repeats; v0.1 contains only one review scenario, and a 100 there is insufficient proof of reviewer reliability.

## Anti-gaming limitations

Open source answer oracles are inspectable by anyone and may eventually appear in model training data. Evasion of static Dockerfile checks is possible; a valid static file is not proof of a secure container image. The pilot does not detect every malicious file-system or network action, test flakiness, latency effects or secret exfiltration inside the provider session. Do not use it to certify security. New benchmark versions should add seeded variants, anti-cheat mutation trials, better test coverage, simulated and real DevOps workflows, and human-adjudicated architecture reviews.

### Acceptance integrity

Run `python arena.py selftest` before running models. It requires all eight initial fixtures to **fail before** a correct patch and **pass after** a known-correct reference patch. Grader changes that alter this contract require a new version, selftest rerun and explicit result deprecation, not silent historical score edits.

Publishing raw transcripts or personal keys is not permitted. Run records are **self-reported**, with hashes and dates for auditability, not cryptographic attestations. When comparing across contributors, require independently reproduced runs, exact image digests and benchmark version matching.
