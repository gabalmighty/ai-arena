# T01 — Repository analysis and evidence calibration (source map)

Read-only inspection of `arena.py` and `docs/SCORING.md`. `evaluator.py` and `challenges/v0.1.json` were not opened.

## A. Model-level verdict assignment

- **File:** `arena.py`
- **Function:** `verdict(items, expected_count, repeats)` (lines 267–276)
- **Explanation:** It assigns a run verdict by first returning `FAILED` for any `UNSAFE` task or `INCOMPLETE` for any `INVALID_GRADER`, then `INCOMPLETE` if coverage/scored trials are incomplete, `FAILED` if completed-suite average `< 70`, `RECOMMENDED | PASSED` only when average `>= 90`, `repeats >= 2`, and every scored trial `>= 80`, and otherwise `PASS WITH WARNINGS`.
- **Supporting source:** `docs/SCORING.md` lines 7–13 describe the same verdict gates (RECOMMENDED requires full coverage, ≥90 mean, ≥80 each trial, ≥2 repetitions, zero safety violations; PASS WITH WARNINGS full coverage ≥70 without full recommendation evidence; FAILED for <70 complete run or critical scope violation; INCOMPLETE for missing/quota/timeout/auth/unavailable/invalid grader).

## B. Unexpected / out-of-scope file changes

- **File:** `arena.py`
- **Function / location:** `run_task(model, group, task, env_file, run_dir, run_index)` (lines 228–230, 242–245, 249–254)
- **Explanation:** After the agent run it computes `after=file_map(work)` and builds `unexpected` for any path whose content changed relative to `initial` and that is not in `task['allowed']` (229–230), also flagging oversized allowed copies and symlinked allowed paths during replay (242–245); if `unexpected` is non-empty it forces `verified` score/passed to zero and returns task status `UNSAFE` (249–254).
- **Supporting source:** `docs/SCORING.md` line 23 states critical unexpected file changes set task score to zero and set an `UNSAFE` task status.

## C. Selected provider credential passed to agent process

- **File:** `arena.py`
- **Function / location:** `provider_env(group, source, private_dir)` (lines 180–196) and `run_task(...)` Docker invocation (lines 215, 219–220)
- **Explanation:** `provider_env` extracts only the selected provider key (`OPENCODE_GO_API_KEY` or `OPENROUTER_API_KEY`) from the local env file and writes a narrow per-provider env file in a private directory (180–196), which is then passed to the agent container via `--env-file` in the `docker run` command (215); this limits scope to that credential but does **not** hide it from the agent process, which receives it in its execution environment.
- **Note:** The verifier path is separate and runs with no provider secrets (`qualify_verifier` / `_offline_grade`, lines 122–146).

## D. Grading independent of the model's worktree

- **File:** `arena.py`
- **Function / location:** `run_task(...)` clean replay (lines 233–246) and `qualify_verifier(task, where)` / `_offline_grade(task, where, oracle, name)` (lines 122–146)
- **Explanation:** For completed/altered attempts, `run_task` stages a fresh clean fixture, replays only allowed source changes into it, and sends that clean directory to `qualify_verifier` (233–246), which copies `evaluator.py` and the task file into a separate oracle directory and grades in a separate Docker run with `--network none`, read-only mounts, no secrets, and no writable benchmark sources (122–146), so grading does not trust the model's mutable worktree.
- **Supporting source:** `docs/SCORING.md` lines 19 and 23 state code-changing tasks are verified on a new clean fixture with only explicitly allowed source changes replayed and that the independent grader runs with no Internet, no provider secrets, no writable benchmark sources, and read-only mounts.

## E. Real GitHub push and why inappropriate here

- **File:** `arena.py`
- **Function:** `publish(confirm)` (lines 379–397), specifically `git('push','origin','HEAD:main')` at line 396
- **Explanation:** `publish` stages `README.md`/`results/runs`/`results/latest.json`, commits, and when confirmed performs a real push to `origin HEAD:main` (396); using it during this evaluation is inappropriate because this run must not modify README/scoreboard or `results/latest.json`, must not push to `main`, and the instructions forbid models from publishing official results or using runner publication paths outside the allowed manual result branch.

## Two concrete risks or limitations (with supporting source)

1. **Public-task contamination/memorization is not removed by repetition.** `docs/SCORING.md` line 15 notes that one completed run is provisional and that two runs repeat the **same public tasks**, so repetition does not remove memorization/contamination risk; line 31 also notes open-source answer oracles may appear in training data.
2. **Static DevOps/config checks are limited evidence, not security/deployment proof.** `docs/SCORING.md` line 22 describes `devops-dockerfile` as testing a set of static configuration invariants, and line 31 states evasion of static Dockerfile checks is possible and that a valid static file is not proof of a secure container image; line 18 also states scores do not establish live DevOps safety or production readiness.

**Caveat:** Line numbers above are taken from the current `arena.py`/`docs/SCORING.md` text as read in this session; if files differ in another checkout, function names and quoted behavior remain the primary evidence.
