# AI Arena

**Real engineering tasks. Role-by-role scores. OpenCode only.**

AI Arena is an open, reproducible screening harness for AI coding models. It tests whether a specific **provider/model route, through OpenCode**, can perform safe, constrained software engineering in disposable environments. The latest model scores appear here; historical runs remain in [results/runs](results/runs/). All timestamps are explicit in Philippine time (UTC+08:00) and UTC.

> **Release status: v0.1.0 pilot.** Eight benchmark fixtures and deterministic grading oracles have passed baseline/reference qualification. **No live model evaluation has been conducted by the project maintainer in this release.** The Docker/OpenCode remote-provider path still requires a first on-machine smoke test. Public results are self-reported until independently reproduced.

<!-- ARENA:BEGIN -->
### Latest verified evaluations

> These are self-reported OpenCode harness runs, not independent third-party certifications. See each linked run. Models without an executed run remain **NOT TESTED**.

| Model route | Verdict | Score | Coverage | Run date (Asia/Manila) | Evidence |
| --- | --- | ---: | ---: | --- | --- |
| No results yet | **NOT TESTED** | — | 0/8 | — | — |

**Verdict gates:** RECOMMENDED | PASSED requires full coverage, ≥90 mean, ≥80 on each trial, at least two full repetitions, and zero safety violations. PASS WITH WARNINGS is full coverage with ≥70 mean but without full recommendation evidence. FAILED means <70 mean on a complete run or a critical scope violation. INCOMPLETE includes quotas, timeouts, authentication or missing tasks.

These scores do **not** establish real-device mobile/desktop reliability, live DevOps safety, or production readiness.
<!-- ARENA:END -->

## Planned Hyper-V deployment (no host Docker)

A native Windows Hyper-V laptop can host a disposable **Ubuntu 24.04 VM** that runs the existing AI Arena Docker containers **inside the Linux guest**, with no Docker Desktop, Python, Node, or OpenCode installation on Windows. The proposed one-time PowerShell + cloud-init + versioned golden-image deployment is documented in [Hyper-V disposable VM design](docs/infrastructure/2026-11-11-hyperv-disposable-vm-design.md).

The [first six free-model candidate matrix](models/first-six-free-2026-11-11.json) contains three OpenCode Go free routes and three OpenRouter `:free` routes, including the separately listed free ERNIE variant. The host VM scripts **have not been implemented or hardware-validated**. Treat this as the next engineering phase, not a runnable setup command. The direct Docker instructions below remain available for existing Linux users.

## Run it yourself

**Requirements:** Python 3.11+, Docker Desktop/Engine running in **Linux-container mode**, Internet access for the model provider, and an isolated API key for each provider. The scripts use only Python standard-library modules; Node 22, Python 3 and OpenCode v2 are installed in the Docker image. On Windows, run these commands in PowerShell (replace `python` with `py -3` if needed).

```sh
git clone https://github.com/gabalmighty/ai-arena.git
cd ai-arena
python arena.py selftest
python arena.py build
python arena.py doctor
```

**Prepare credentials locally**: create a Git-ignored `.arena-secrets.env` containing only `OPENCODE_GO_API_KEY=...` and `OPENROUTER_API_KEY=...` (use separate, spend-limited keys; no other credentials). **Never commit or paste keys into a task, GitHub, a public run artifact, or chat.** The runner passes only the selected provider's key to each ephemeral agent. Go usage may consume your paid plan's included allowance; **Go-included is not the same as a free model**. For strictly free OpenRouter tests, the runner rejects any model route not ending `:free`.

```sh
python arena.py catalog --group opencode-go --env-file .arena-secrets.env
python arena.py catalog --group openrouter --env-file .arena-secrets.env
```

Copy the **exact enabled model IDs** from those listings into a local copy of [models.example.json](models.example.json) named `models.local.json`. Use **three** `opencode-go/` routes and **three** `openrouter/...:free` routes. Check the provider's current catalog and eligibility first; model names, quotas, free offers and privacy terms change. No model is auto-substituted.

**One model at a time** (safest for limited free quotas):

```sh
python arena.py run --group openrouter --model openrouter/EXACT-MODEL:free --env-file .arena-secrets.env
python arena.py run --group opencode-go --model opencode-go/EXACT-MODEL --env-file .arena-secrets.env --consent-go-included
```

**Automated six-model sweep** (sequential; stop and resume manually if daily quotas are exhausted):

```sh
python arena.py run-six --matrix models.local.json --env-file .arena-secrets.env --consent-go-included
```

For a small low-quota connection check before committing to the complete suite, add `--profile triage`. Triage results are **INCOMPLETE** by design; they are never presented as recommendations. For a higher-confidence full sweep, add `--repeats 2` (this doubles request consumption, and still reuses public fixtures).

After a run, the script creates sanitized per-task summaries in `results/runs/`, updates `results/latest.json` and regenerates this README's current leaderboard. Raw model transcripts remain in `.arena-private/`, which is Git-ignored. **Publication is a separate explicit action** from the human-operated host, never from a candidate model:

```sh
python arena.py publish              # safe preview; does not push
python arena.py publish --confirm    # commits only README/results and pushes main
```

See [the detailed runbook](docs/RUNBOOK.md) for Windows setup, provider authentication caveats, quota strategy, security considerations and recovery. See [scoring and integrity](docs/SCORING.md) before interpreting a recommendation.

## Eight initial challenges

| Task | Role | Domain | Evidence |
| --- | --- | --- | --- |
| `repo-map` | Repository Analyst | Backend | Exact source mapping |
| `python-refund` | Builder / Debugger | Backend | Executable independent tests |
| `web-escape` | Web Builder | Web | Executable HTML escaping tests |
| `mobile-outbox` | Mobile Logic Builder | Mobile logic | Executable JS tests — not a device test |
| `desktop-path` | Desktop Logic Builder | Desktop logic | Executable JS tests — not an Electron GUI test |
| `devops-dockerfile` | DevOps Config Engineer | Docker | Static checks — not live deployment |
| `code-review` | Reviewer / Gatekeeper | Security review | Known-defect recall and false positives |
| `test-author` | Test Engineer | Backend | Buggy-versus-fixed mutation testing |

[Challenge definitions and answer-oracle fixtures](challenges/v0.1.json) are versioned together. Agents see *only* their task files and instructions—not these hidden verification definitions. Because all tasks are open source, this is a **public diagnostic benchmark**, not a contamination-proof private exam. Qualitative UI, long-horizon features, real mobile emulators, desktop GUIs, security exploitation, and production DevOps are **not certified** by this pilot.

## Methodology and transparency

The host stages a clean synthetic fixture, invokes the named model through pinned OpenCode inside an ephemeral, nonprivileged Docker container, captures changed files and the private transcript, then **copies only allowlisted changes** onto a new pristine baseline. A separate offline Docker container runs the deterministic grader with no network, no credentials and no model access. Unapproved file changes disqualify the task; provider quota errors are not scored as incorrect answers. Baseline/reference qualification can be rerun with `python arena.py selftest` without models or Docker.

The safety boundary is the container, **not** OpenCode tool permissions. Because the agent needs network access to call its provider, it could technically make other outbound connections, and its provider key exists in its process environment. Use **dedicated, revocable, quota-capped testing keys**, no private project mounts, and an egress-controlled Docker network for adversarial models. Do not run as a privileged container or mount the Docker socket.

### Research source of truth

- [Benchmark landscape](docs/research/2026-11-11-benchmark-landscape.md)
- [Evaluation design](docs/research/2026-11-11-evaluation-design.md)
- [OpenCode & free-model availability](docs/research/2026-11-11-opencode-model-availability.md)
- [Research evidence register](docs/research/2026-11-11-source-register.md)

## Status and contributions

AI Arena v0.1.0 is a first practical screen, not a declaration that any model is production-safe. A recommendation requires both a sufficient score and safety/coverage gates. We preserve all timestamped runs; any corrected task must increment the benchmark version and flag results from the old grader. Candidate models cannot edit grader code or publish results.

Original AI Arena harness, synthetic fixtures and documentation use the [MIT license](LICENSE). See [licensing notes](docs/RUNBOOK.md#licensing) for third-party task restrictions.
