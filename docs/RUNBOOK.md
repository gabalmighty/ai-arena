# Runbook — AI Arena v0.1

**This is a free/included-usage model test harness, not a set of production deployment instructions.**

## First-run checklist (Windows 10/11, PowerShell or Linux/macOS)

1. Install Python 3.11+, Docker Desktop (Linux containers) or Docker Engine, Git and Internet access to model endpoints. Run `docker info` and confirm it succeeds. Do **not** use a confidential source repository as the test directory.
2. Clone `https://github.com/gabalmighty/ai-arena` into a new directory. Run `python arena.py selftest`. All eight baseline/reference tests should print `QUALIFIED`; this uses host Python and Node 22 for offline selftest (Node must be installed on the host or use Docker to run the selftest inside the prepared image). Then run `python arena.py build` followed by `python arena.py doctor`. Docker builds the pinned OpenCode 2.0.0 CLI environment on Node 22 with Python 3; the first image build downloads official packages.
3. Create a **local uncommitted** `.arena-secrets.env` containing only the two selected providers' *dedicated test credentials*: `OPENCODE_GO_API_KEY=...` and `OPENROUTER_API_KEY=...`. No quotes unless required; no unrelated tokens. The file name is gitignored. For Go, use your **included plan** allowance: not necessarily a free endpoint. Restrict keys at the provider where supported. `opencode-go` env-key loading and the full V2 Docker path still require live qualification on the user's OpenCode Go workspace; the CLI can return AUTH_ERROR if credentials are not supported or enabled.
4. Run `python arena.py catalog --group opencode-go --env-file .arena-secrets.env`, then for OpenRouter. Use only exact visible routes. Pick three distinct Go models from your authorized included/free catalog and three actual `openrouter/...:free` routes. A successful catalog listing does not guarantee inference success or free quota.
5. Copy `models.example.json` to `models.local.json` (ignored by Git) and replace all six placeholders with exact model IDs. Check each route and pricing again in the provider dashboard. Do **not** use `openrouter/free` as a model: it can resolve to different backends.
6. For an inexpensive preflight: `python arena.py run --group openrouter --model openrouter/EXACT-MODEL:free --env-file .arena-secrets.env --profile triage`. This tests three roles, records a timestamped INCOMPLETE result and is not eligible for recommendation. For the complete eight-task diagnosis, rerun without triage.
7. Run each model individually or use `python arena.py run-six --matrix models.local.json --env-file .arena-secrets.env --consent-go-included`. The batch runs sequentially and stops **the affected model** after an unavailable/limit/authentication/safety incident. It does not resume that model automatically on another day. Use individual runs on later days when free quotas refresh; an exhausted run remains INCOMPLETE and preserved in history.
8. Review `README.md`, `results/latest.json`, `results/runs/*.json` and **private** `.arena-private/<run_id>/*attempt.log`. If real fixes were incorrect or the grader seems flawed, do not publish a recommendation. Files under `.arena-private` must remain private. Run `python arena.py publish --confirm` from a Git clone with a configured human Git credential to publish the README/results. No API key is passed to the publisher and agent containers never mount .git.

### Command quick reference

| Command | Effect |
| --- | --- |
| `python arena.py selftest` | Offline task-oracle qualification (not a model evaluation) |
| `python arena.py build` | Build isolated OpenCode agent/verifier Docker image |
| `python arena.py doctor` | Check Docker availability and built image only |
| `python arena.py catalog --group ... --env-file ...` | List currently exposed exact route IDs, using only one key |
| `python arena.py run --group ... --model ... --env-file ...` | One model, one full eight-task screening run |
| `python arena.py run-six --matrix models.local.json --env-file ... --consent-go-included` | Sequential group of exactly three Go and three OpenRouter free routes |
| `python arena.py report` | Rebuild latest results and README without provider calls |
| `python arena.py publish --confirm` | Explicit human-host Git commit/push to main, never an agent action |

## Data retention and verification

Each task's fixture is recreated in a host temporary directory and mounted as the **only writable project tree** of an unprivileged container. Container credentials consist of one selected provider key; neither git credential files nor private source repositories are mounted. The process exits after the task or a watchdog timeout. The runner checks changed paths against the task's allowlist, and replays only those paths onto a fresh pristine tree. A **separate** Docker container with `--network none`, `--read-only`, `--cap-drop ALL`, limited memory/PIDs and no secrets runs the verifier. A task cannot change its verifier from inside the agent container.

The agent still has **network access to the public provider**, and it can inspect its own model API key in its environment. This setup is **not** an egress-restricted malware sandbox and cannot prevent an actively malicious model/tool command from sending that isolated key to another host. Use disposable revocable credentials, provider-side hard spending caps, and if needed an externally managed outbound allowlist proxy. Never run this with real customer data, production credentials, Docker socket mounts or CI deployment tokens. This is an explicit residual risk, not a hidden guarantee.

Raw logs are stored only under `.arena-private` and excluded by `.gitignore`; redacted summaries are written to `results/runs`. Before `publish`, inspect summaries for private information: model output could contain unexpected text even when source fixtures are synthetic. **No public hosting automation** currently runs these models, and no GitHub Actions minutes are used by the default workflow.

## Limits, timing and fairness

The suite is intended to take roughly 30–60 minutes **per model**, not for all six combined. Individual task timeout ranges from 240 to 360 seconds. Models call their provider multiple times per task (up to five OpenCode steps in this release), so an account-level quota of fifty requests/day can be exhausted by one complete model and sometimes before that. This is a *ceiling*, not a guaranteed request count. Three OpenRouter free models can take several days under a shared daily cap. No rate-limit bypass or account hopping is implemented.

OpenCode Go is **not necessarily free**: included subscription traffic consumes plan limits. The runner requires explicit `--consent-go-included` to make this distinction visible. OpenRouter candidates must use `:free` routes; changing routes or provider failure during a run is a new experiment, not permission to score the old model under a fallback. The harness records per-task duration, provider-state errors, changed-path hashes, version/checksums and a timestamp.

A single completed run qualifies at best **PASS WITH WARNINGS**. `--repeats 2` can meet the pilot repetition gate if scores remain high, but repeated identical public tasks are still less independent than genuinely new variants. **Do not treat pilot recommended as permission for unsupervised changes in production.**

## Troubleshooting

- **No Docker daemon / image:** Start Docker Desktop in Linux-container mode, then `python arena.py build`.
- **Missing Node for local selftest:** Install Node 22 or run the offline selftest with Docker after building the image. Live grading already includes Node.
- **AUTH_ERROR:** Your Docker sandbox has only the key supplied through `.arena-secrets.env`, not your workstation's saved OpenCode credentials. Verify exact provider route, correct key, workspace entitlement and OpenCode CLI compatibility without mounting the workstation's auth database into the container. The official CLI's provider-specific environment support may evolve.
- **UNAVAILABLE:** The model may have been retired or disabled. Re-run catalog, and create a **new** run with another exact ID; do not pretend a fallback is the same model.
- **PROVIDER_LIMIT / 429:** Stop; preserve the INCOMPLETE timestamped record. Retry as a new run after the provider quota resets. Free-model request limits are account-level and can vary.
- **TIMEOUT:** Local watchdog kills the named Docker container; if Docker itself is unavailable, inspect `docker ps -a` and remove stale `arena_agent_*` containers only after checking they belong to this test.
- **INCOMPLETE:** Do not reinterpret as FAILED. Use the per-task provider state and private trace to understand the blocker.
- **Model performance too easy/hard:** Do not change graders without bumping benchmark version and performing baseline/reference qualification again. Keep older runs in the archive.
- **Publish Git conflict:** Synchronize the local branch with GitHub and re-generate report before retrying. The `publish` command does not force-push or overwrite remote history.

## Licensing

AI Arena's original code, fixtures and documentation are published under the repository's [MIT license](../LICENSE) to support cloning, reuse, modification, independent testing and contributions. Third-party linked benchmarks are **not** relicensed, and no third-party benchmark fixtures were copied into this pilot. Confirm original source and licensing before accepting external fixture contributions.
