# Research 01 — OpenCode compatibility, free models and model provenance

**As-of:** 2026-11-11 (Asia/Manila). **Research only.** We have NOT inspected this user's local OpenCode model catalog, authenticated sessions, billing, provider settings or credentials. The catalog below is a *public documentation snapshot*, not a claim that any endpoint works for a particular account.

## 1. OpenCode is the common harness

Official docs: [CLI commands](https://opencode.ai/docs/cli/commands), [models](https://opencode.ai/docs/models), [agents](https://opencode.ai/docs/agents), [permissions](https://opencode.ai/docs/permissions), [provider connection](https://opencode.ai/docs/cli/providers).

The official CLI supports:
- selecting a model per run instead of changing defaults;
- choosing an agent/role, attaching files, and emitting newline-delimited JSON events;
- inspecting configured models and usage statistics;
- exporting a session with a sanitize option;
- explicit permissions for shell/file/edit access and a per-agent model-step limit.

**Discovery commands only (not an AI Arena benchmark run):**

    opencode --version
    opencode models
    opencode models --help
    opencode run --help
    opencode stats --help

The documentation explicitly gives the pattern below for a **future**, individually isolated runner:

    opencode run --model PROVIDER/MODEL --agent AGENT_NAME --format json "TASK_INSTRUCTION"

Do not run an untrusted model with broad shell permissions just to test it. The eventual runner must supply an isolated fixture directory, an explicit role policy, a new session for each task, a bounded runtime and a separate offline grader. The examples above are not final runnable benchmark commands; task scripts have not been created.

**Version alert:** The present OpenCode V2 docs use plural **permissions** and the **shell** action; V1 used different keys. Follow the installed version's help/schema. The official docs caution that shell permissions are *not* a substitute for OS isolation because the process uses host authority. A benchmark will pin one supported OpenCode release, and archive the version string with each run.

**Identity alert:** The root default model may fall back when unavailable; an active session may also retain an earlier selected model. Ensure the requested and resolved route are verified, and do not silently score a fallback under the original model's name. The script must use the explicit per-run model argument; if exact resolution is not observable, mark identification uncertain.

## 2. OpenCode public free-model snapshot

Source: [official OpenCode console model and privacy documentation](https://opencode.ai/docs/console/models) (reviewed 2026-11-11). The page lists these **examples** among current free offerings:

| Model as documented | Model ID as documented | Availability or policy caveat |
| --- | --- | --- |
| GLM-5.3-Flash Free | glm-5.3-flash-free | Limited time; documented zero retention/no model training |
| DeepSeek V4.1 Flash Free | deepseek-v4.1-flash-free | Limited time; documented zero retention/no model training |
| MiniMax M3.1 Flash Free | minimax-m3.1-flash-free | Limited time; documented zero retention/no model training |
| MiMo-V2.6-Flash Free | mimo-v2.6-flash-free | Limited time; feedback/model-improvement program |
| Nemotron 3 Ultra Free | nemotron-3-ultra-free | Trial use; do not submit confidential or personal data |
| Nemotron 3.5 Lightning Free | nemotron-3.5-lightning-free | Trial use; do not submit confidential or personal data |
| Nemotron 3.5 Super VL Free | nemotron-3.5-super-vl-free | Trial use; check multimodal interface and privacy |
| Big Pickle | big-pickle | Stealth/anonymous, feedback/data-improvement conditions |
| Iceman Free | iceman-free | Stealth/anonymous, feedback/data-improvement conditions |
| Inkling 2 Small Free | inkling-2-small-free | Provider retention/training terms; regional exclusions |
| Beam Free | beam-free | 30-day safety retention; regional exclusions |
| Flint 40B Free | flint-40b-free | Model improvement / retention caveats |
| LongCat 2.5 Free | longcat-2.5-free | Documented 100 requests/day; hosted in China |
| Jev 1.13 Free | jev-1.13-free | Specialized endpoint; do **not** assume standard code editing/tool capability |

The provider prefix (for example, opencode/ versus opencode-go/) is not shown in this table because the connected account's configured catalog and exact provider routing must be verified locally. Do not guess model strings from display names; **the runner must record the literal provider/model identifier returned by OpenCode**. Current model availability can change without notice.

### Important deprecation

OpenCode's official deprecations table lists **Crouton Alpha Free — 2026-11-09** and **Pulse Alpha Free — 2026-11-06**. At the time of this research, Crouton is **not a dependable current test target**, even if a previous engineering stack still lists opencode-go/crouton-alpha-free. It may appear in stale caches or third-party lists; verify actual request success rather than assuming it is available. For historical comparison, store the route and deprecation status, but do not invent measurements.

Do not assert the identity of a stealth/codename model unless the provider officially identifies its backend and revision. A model renamed or replaced behind a stable route may no longer be comparable; store documented revision/response metadata when available.

## 3. OpenRouter free-model snapshot

Sources: [OpenRouter free collection](https://openrouter.ai/collections/free-models/) and [rate-limit documentation](https://openrouter.ai/docs/api_reference/limits), reviewed 2026-11-11.

OpenRouter documents the following general policy for IDs ending in **:free**:

| Condition | Publicly documented cap |
| --- | --- |
| Free variant without the qualifying historical credit purchase | 20 requests/minute; 50 requests/day |
| Once account has purchased at least the qualifying amount (OpenRouter says $10, applied from $9 to absorb fees) | 20 requests/minute; up to 1,000 requests/day |
| Failed requests | May count against the daily free cap |
| Other $0 models | May have different provider/account requirements or per-model caps |

These are provider-stated policies **not** verified account entitlements. Different free endpoints can have independent throttling or change without advance notice. Discover request budget and usage counters where the provider exposes them. Do not spread load across accounts/keys to circumvent provider terms.

OpenRouter also advertises **openrouter/free** as an automatic free-model router. This is NOT a stable named model. Treat it as a **route/availability policy**, with backend identity tracked where reported; do not list it as a single comparable model in a pure model leaderboard.

**Model identity and cost are distinct:** $0 billed does not mean unlimited, stable, private, or suitable for tool-calling. Check structured tool support, context limits, endpoint reliability, retention/training policy and country eligibility before a run.

## 4. Quotas vs an OpenCode coding task

One OpenCode task can trigger **multiple model requests**: reading code, deciding an edit, receiving tool output, fixing tests and generating a final summary. Thus 50 free requests/day emphatically does **not** mean 50 completed AI Arena tasks/day.

A quota-aware scheduler should:

1. Discover currently available **exact** model IDs for the connected workspace/project.
2. Check endpoint support for tool calls and required vision inputs.
3. Run the inexpensive compatibility preflight first (one isolated tiny task, short timeout).
4. Track real request counts; reject or defer a full run if remaining budget cannot reasonably finish it.
5. Use limited retries for transient 429/5xx only; never change a candidate's model silently.
6. Record a quota-limited/incomplete result, not a zero-quality score, if the service runs out.
7. Space requests to avoid contention. Never promise all models can fit into one hour or one day.

**Important comparison bias:** Faster-but-unsafe, slow-but-correct, and unavailable-but-capable should not be collapsed into one number. Separate quality, reliability, latency, safety and serviceability. Cost- and speed-normalized comparisons should be a separate view from equal-budget quality comparisons.

## 5. Privacy and experimental containment

Because the project is public and includes free/possibly training-permitted endpoints, initial fixtures must be **synthetic, public, and free of secrets**. Never send source code from customer, production or private company repositories to an endpoint unless its data processing has been explicitly approved for that material.

The official OpenCode console documentation distinguishes zero-retention free endpoints from provider endpoints that collect prompts for model improvement or training, and lists regional restrictions for some models. Record the selected endpoint's data policy **at run time** rather than infer it from the term "free."

Keep each model's work within a disposable container or truly isolated checkout with an unprivileged operating-system user. Do not attach personal SSH keys, GitHub tokens, cloud accounts, real databases or workstation home directories. Agent-level permissions are a secondary guard, not the primary sandbox.

Public evidence must be **sanitized**. OpenCode currently documents **opencode session export SESSION_ID --sanitize**, but sanitized is not a guarantee that an independent user-authored prompt or code file cannot contain personal information. Public report publication requires an additional audit for credentials, tokens, proprietary content and internal paths.

## 6. Controlled direct-model vs assisted-workflow experiments

A benchmark should distinguish:

| Profile | Comparison goal |
| --- | --- |
| **Direct** | Candidate model does its own reasoning and allowed tool work through one fixed OpenCode role |
| **Structured** | Same candidate, same budget and tools, but detailed task decomposition/acceptance guidance |
| **Assisted** | Candidate uses a separate planner/advisor (e.g. Jev) or subagents under a separately recorded workflow |

Never attribute an assisted workflow's result solely to the candidate model. External advisor calls can use different provider quota/cost and may substantially change outcomes. If tested, publish assistant/advisor identity, checkpoints, separate spend, step budget and exact prompt policy as a **different category**.

Likewise, benchmark a standalone decision endpoint in the **Planner / Managerial Decision** track rather than unfairly assigning it a full Builder challenge requiring file editing.

## 7. Snapshot and next validation

| Claim | Research status |
| --- | --- |
| OpenCode can target a model/agent from the CLI and provide machine-readable output | **Verified in official docs** |
| OpenCode models catalog is project/account-dependent | **Verified in official docs** |
| Official OpenCode console lists current temporary free offerings | **Verified as public snapshot; user's actual access not checked** |
| Crouton Alpha Free listed deprecated 2026-11-09 | **Verified in official docs** |
| OpenRouter free limits of 20/min, 50/day or 1,000/day qualified | **Verified in OpenRouter collection FAQ; user's actual cap not checked** |
| A task on an OpenCode Go provider uses the same policy as an OpenRouter free task | **Not established; must not assume** |
| Any particular candidate safely uses tools, makes valid patches, or handles long tasks | **Not tested** |

No API keys or credentials should be entered into GitHub, reports, example commands or public task definitions. Do not run tests in CI using the repo maintainer's authenticating personal account.

Sources additionally include [OpenCode Go](https://opencode.ai/go/), [provider connection](https://opencode.ai/docs/cli/providers), [OpenCode V2 agent steps](https://opencode.ai/docs/agents), [OpenCode session export](https://opencode.ai/docs/cli/commands). Links and dates are preserved in [source register](2026-11-11-source-register.md).
