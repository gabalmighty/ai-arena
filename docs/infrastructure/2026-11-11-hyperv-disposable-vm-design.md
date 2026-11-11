# AI Arena — Hyper-V disposable VM deployment design (PROPOSED)

**Date:** 2026-11-11 (Asia/Manila)  
**Status:** Architecture / implementation plan. **No Hyper-V IaC has been implemented, executed, or qualified on a user's host yet.**  
**Target:** Windows 11 with Hyper-V enabled; no Docker Desktop, Python, Node.js, OpenCode or git installation on Windows.  
**Benchmark:** Existing AI Arena v0.1 eight tasks, run in Linux containers within a fully disposable Ubuntu guest.

## Decision

**Adopt native Hyper-V + host PowerShell + Ubuntu 24.04 LTS + cloud-init + Docker Engine (guest only).**

Do **not** introduce Terraform + an unofficial Hyper-V provider, Packer, VirtualBox, WSL/Docker Desktop, Ansible on Windows, or a bespoke management server for the first release. PowerShell is IaC for the Windows/Hyper-V control plane, cloud-init and a versioned guest bootstrap are IaC for Ubuntu, and the existing Dockerfile pins the task userland (subject to digest/version tightening). This minimizes host dependencies while keeping the build auditable.

### Proposed architecture

    Windows 11 Hyper-V host
      native PowerShell + Hyper-V module ONLY
      secure, operator-controlled publishing and secret store
            |
            +-- Golden Ubuntu VM image (no provider keys / GitHub credentials)
            |     official source image + SHA-256 + build manifest
            |
            +-- per-run differencing VHDX (New-VHD -Differencing)
                  one model per disposable VM, sequentially
                  Ubuntu 24.04, Python, git, Docker Engine
                        |
                        +-- agent container: OpenCode v2, task files only
                        |     model API access, test-specific scoped key or broker
                        |
                        +-- offline grader container: no network, no credentials
                  collect sanitized results back to trusted host/publisher
                  stop VM, destroy child disk, preserve immutable metadata

**Docker remains part of the benchmark but only inside Ubuntu.** Docker Engine in a Linux Hyper-V guest does NOT require Docker Desktop, WSL, or nested virtualization. The runner already starts isolated agent and grader containers. Guest OS installation is the only VM bootstrapping job.

## One-time setup: target workflow

Plan to implement these entrypoints **inside the repository**; command names below are a target CLI contract, NOT commands users can execute yet:

    .\infra\hyperv\arena-vm.ps1 -Action Doctor
    .\infra\hyperv\arena-vm.ps1 -Action Setup
    .\infra\hyperv\arena-vm.ps1 -Action SetCredentials
    .\infra\hyperv\arena-vm.ps1 -Action Test
    .\infra\hyperv\arena-vm.ps1 -Action RunSix
    .\infra\hyperv\arena-vm.ps1 -Action Resume
    .\infra\hyperv\arena-vm.ps1 -Action Collect
    .\infra\hyperv\arena-vm.ps1 -Action Destroy -RunId <id>

### Setup phases

1. **Doctor (host only).** Check Hyper-V enabled, privileges, PowerShell Hyper-V cmdlets, virtual switches, Windows version/architecture, free SSD capacity, RAM, CPU and outbound TLS availability. Refuse to delete or replace any preexisting VM/switch/disk. No host dependency installation. If Windows OpenSSH client is absent, enable its optional feature with explicit approval, or use a built-in host-to-guest transfer mechanism.
2. **Fetch verified image.** Download a specific Canonical **Ubuntu 24.04 amd64 Azure cloud-image VHD** archive from `https://cloud-images.ubuntu.com/releases/noble/release/` and the matching official SHA256SUMS. Freeze the **exact image filename, release date and SHA** in a versioned lock manifest rather than following `current` on subsequent runs. Verify digest before extraction. Windows includes tar.exe for the archive; Hyper-V supplies `Convert-VHD` to convert official `.vhd` into `.vhdx`. This image path is supported in an Ubuntu community Hyper-V guide but MUST pass a live 24.04 Gen2 boot/NoCloud test before being treated as reliable. Source: https://discourse.ubuntu.com/t/booting-the-azure-server-cloud-image-on-local-hyper-v-windows-hypervisor-with-optional-secure-boot-enabled/17805 ; conversion: https://learn.microsoft.com/en-us/powershell/module/hyper-v/convert-vhd ; source: https://cloud-images.ubuntu.com/releases/noble/release/
3. **Seed with built-in Windows tooling.** PowerShell uses `New-VHD` / `Mount-VHD` / `Initialize-Disk` / `New-Partition` / `Format-Volume` to build a small FAT32 disk labeled **CIDATA**, writes `user-data` and `meta-data` for NoCloud, then dismounts it. Attach this as a second disk to the first-boot VM. Cloud-init recognizes local media labelled CIDATA; see https://docs.cloud-init.io/en/latest/reference/datasources/nocloud.html. The seed contains **only a public SSH key** and immutable bootstrap reference; no service API keys.
4. **Create Gen2 guest.** Hyper-V `New-VM`, a deliberately scoped virtual network, virtual CPU/memory/disk settings and `Set-VMFirmware -EnableSecureBoot On -SecureBootTemplate MicrosoftUEFICertificateAuthority`. Microsoft supports Ubuntu 24.04 on Gen2. Check boot, cloud-init success, SSH, DNS/TLS and the guest package manifest before proceeding. Sources: https://learn.microsoft.com/en-us/windows-server/virtualization/hyper-v/plan/should-i-create-a-generation-1-or-2-virtual-machine-in-hyper-v and https://learn.microsoft.com/en-us/windows-server/virtualization/hyper-v/learn-more/Generation-2-virtual-machine-security-settings-for-Hyper-V.
5. **Guest bootstrap.** Pin/update Linux packages in a documented lock as much as apt supports; install Python 3, git, Docker Engine from official Docker apt repository; clone/pin the reviewed AI Arena commit; run `python3 arena.py selftest`, `python3 arena.py build`, `python3 arena.py doctor`. Pin `@opencode/cli` and Docker base image by immutable version/digest; current `node:22-bookworm-slim` and apt updates are mutable. Docker: https://docs.docker.com/engine/install/ubuntu/ . Keep package installation, tests, and model calls entirely inside guest.
6. **Seal the golden image.** Record image provenance, OpenCode version, Docker Engine/version, built container digest, benchmark git SHA, test-oracle qualification results and environment lock. Confirm the golden disk contains no tokens, GitHub authentication, personal files or real project source. Shut down and protect the golden parent disk as read-only on the host. Clone through differencing disks rather than editing the parent.
7. **Validate one spawned child.** `New-VHD -Differencing -ParentPath golden.vhdx -Path runs/<id>.vhdx`; create/run a distinct VM that boots, verifies installed tools, grades fixture reference patches and can fetch a model catalog using a disposable scoped key. After collecting proof, shut it down, destroy the child, and verify the parent unchanged. Freeze the setup only after this acceptance succeeds.

**Fallback:** If Canonical's Azure VHD fails on the host (image-generation, cloud-init datasource, or firmware incompatibility), install the official Ubuntu Server ISO into a Gen2 VM **once**, then run the same versioned guest bootstrap and seal a golden disk. Full unattended ISO installation is possible with Ubuntu autoinstall and NoCloud but may require a kernel-command-line/confirmation step; do not promise hands-free setup until tested. See https://canonical-subiquity.readthedocs-hosted.com/en/latest/intro-to-autoinstall.html .

## Everyday use after setup

- `Run-Model`: prepare unique run-id, spawn differencing VM, inject credentials *after boot*, run selected OpenCode route, independently grade, collect sanitized evidence, tear down guest.
- `RunSix`: exact six-model manifest, **sequential by default** to avoid shared account quotas and resource contention. One fresh VM per model. Pause on quota/availability rather than converting incomplete trials to reasoning failures.
- `Resume`: skip completed run IDs, resume only unfinished models or trials while preserving original timestamps and version hashes. Must not silently double-consume free quota.
- `Collect`: validate manifest schema, verify expected tasks and hashes, copy report safely to trusted staging on Windows, verify no credentials/private traces, optionally publish via a separate controlled identity.
- `Destroy`: target only run-owned VM and VHDX, with validation of expected path and ownership marker. Preserve the sealed golden image. No wildcards or global VM cleanup.
- `Rebuild`: only explicit action may replace golden image; version changes create a *new immutable environment ID*, never silently modify older baselines.

### Proposed host-resource defaults (planning, not measured)

| Component | Suggested starting size | Notes |
| --- | --- | --- |
| Windows host | 16 GB RAM minimum (more comfortable at 24–32 GB), SSD | Verify host memory before allocating VM |
| Guest VM | 4 virtual CPUs; 6–8 GB RAM | One model running at a time |
| Guest VHDX | 50–60 GB logical dynamic disk | Actual consumed disk less; monitor free host SSD |
| Host free disk | **80–100 GB free during first provisioning** as a conservative planning allowance | Azure VHD extraction, VHD-to-VHDX conversion, golden image and child VHDX can coexist; verify actual peak before promising a smaller footprint |
| Per-task agent | Current runner cap 2 vCPU / 1 GiB RAM | Independent offline grader 1 CPU / 512 MiB |
| Network | Dedicated restricted virtual switch/NAT | Internet needed for model endpoints and first bootstrap |

No GPU required: models are **hosted** through OpenCode Go / OpenRouter, not run locally. CPU, RAM and SSD affect shell/tests, not LLM inference throughput.

## Isolation: what is and is not safe

**Threat model:** Experimental agents may issue destructive commands, write malicious code, attempt to steal provider keys or escape their workspace. VM isolation blocks most direct host-file damage but is **not a guarantee** against hypervisor escapes or network attacks.

Required safeguards:
- No shared folders, host drive mounts, clipboard/enhanced-session sharing, admin SSH agent, cloud credentials, personal repos, customer data or Docker socket in an agent container.
- Guest on a dedicated vSwitch. Restrict communication to the host/LAN with host firewall/NAT policies; **Default Switch alone is convenience, not a security policy**. Model providers require outbound connectivity; permit only defined outbound traffic with monitoring.
- The existing v0.1 runner gives the selected provider key to the agent container via environment variable and uses a bridged network. This is **not sufficient isolation** against intentional key exfiltration. For stronger protection, build a trusted API-key-injecting egress proxy outside the untrusted container; restrict agent egress to that proxy. Until then, use only revocable, tightly budgeted test keys; do not describe arbitrary agent shell work as entirely safe.
- Maintain secrets only in the operator-controlled Windows protected store (e.g. per-user DPAPI/Windows Credential Manager), separate from the golden disk. Inject per run into disposable child VM. Never put secrets in cloud-init, git, a golden checkpoint, raw trace or public report.
- No GitHub publishing token inside the candidate VM/agent container. Keep public publication a **trusted host / separate publisher** operation with a human review gate. Exfiltration checks, redaction and an allowlist of written paths must be enforced before publishing.
- Prefer immutable VHDX differencing disks over checkpoints for stronger rollback. A checkpoint made **after** injecting API keys can preserve secrets. Hyper-V `New-VHD -Differencing` supports child disks; see https://learn.microsoft.com/en-us/powershell/module/hyper-v/new-vhd .
- Agent access and grader access must remain split. Independent grader gets a read-only baseline + allowlisted candidate patch + read-only verifier, with no internet.
- Report all verified safety incidents distinctly. Do not promote a model solely on a high correctness average.

## Six-model manifest (2026-11-11 requested cohort)

`models/first-six-free-2026-11-11.json` in this repository records the intended routes. It is **configuration only**, not an observation that those endpoints are usable. The user's ERNIE route without `:free` has a paid endpoint; the cohort uses the separate `:free` route for the zero-cost goal.

| Group | Route for free pilot | Preflight caveat |
| --- | --- | --- |
| Go | `opencode-go/beam-free` | Temporary free availability, geography and privacy |
| Go | `opencode-go/iceman-contributor-free` | Provider may use prompts/completions for model improvement |
| Go | `opencode-go/longcat-2.5-free` | Go requires Global privacy regions for China hosting |
| OpenRouter | `openrouter/nvidia/nemotron-3-ultra-550b-a55b:free` | No confidential data; free endpoint may retain/use prompts |
| OpenRouter | `openrouter/baidu/ernie-5.5-flash-preview:free` | **Free variant** distinct from paid bare route; check endpoint/tool support |
| OpenRouter | `openrouter/dots-studio/dots-3-note-preview:free` | Public provider page shows retirement 2026-12-31 |

Sources: https://opencode.ai/docs/console/go/ ; https://openrouter.ai/nvidia/nemotron-3-ultra-550b-a55b:free ; https://openrouter.ai/baidu/ernie-5.5-flash-preview:free ; https://openrouter.ai/dots-studio/dots-3-note-preview:free . Account-specific availability and tool support not verified.

**Provider serviceability is a separate axis from task ability**. First smoke-test OpenCode JSON events, tool calling, rate limits and actual selected model ID for each route. Never bill a paid model, silently substitute a route, or infer API compatibility from model name alone.

## v0.1 repository audit — repairs needed before first scored run

Confirmed by direct inspection of `arena.py`, `container/Dockerfile`, `models.example.json`, and `README.md` at baseline commit `c16ccfcc0c568ac09ac94878d0b6c50de47089b0`:

1. **Windows requirement in README:** currently requires Docker Desktop/Engine on the operator host; must document new Hyper-V guest deployment, while preserving Linux direct-run support.
2. **Model matrix:** example placeholders need an exact six-model public cohort and at least one per-model preflight.
3. **OpenRouter strict gate:** current `make_run` refuses non-`:free` routes. Keep this safety default; use the verified free ERNIE variant above rather than weakening the gate.
4. **Not one-click or resumable:** `run-six` starts from beginning each invocation; it stops on a provider limit but does not resume unfinished items intelligently. Add persisted trial IDs and no-double-spend resume.
5. **Error events:** `classify_attempt` currently scans text and exit status; a process exit of 0 plus an OpenCode JSON error could be mistaken for a completed model attempt. Parse structured events and mark provider/tool/config errors separately.
6. **Secret egress:** current agent containers have `--network bridge` plus `--env-file` provider key. A VM alone does not prevent external exfiltration from inside the agent process. Restrict outbound connections or use a trusted request proxy before claiming the environment is hardened.
7. **Environment provenance:** OpenCode npm version is fixed to `@opencode/cli@2.0.0` but Docker base is referenced as mutable `node:22-bookworm-slim`; add verified image digest, container digest and host/guest versions to the run record. Every environment change should invalidate comparability without explicit disclosure.
8. **Publishing boundary:** `python arena.py publish --confirm` performs `git push origin HEAD:main` from the same guest if used there. Move publish to a trusted, separate actor and require review of sanitized results. Candidate containers currently cannot push directly, but keep the GitHub token outside the disposable guest.
9. **Trust labels:** v0.1's README says “Latest verified evaluations” while results are self-reported until reproduced. Prefer **Latest recorded evaluation** vs **Independently reproduced** badge and preserve original provenance.
10. **Timing:** no evidence that this suite completes within 30–60 min on these six routes; enforce per-model maximum and expose incomplete coverage honestly. 6 × 8 model tasks can exceed free daily limits and take multiple hours in aggregate.

All of the above are *design review findings*, not evidence of an actual runtime failure or a successful VM boot.

## Proposed acceptance gates for v0.2

| Gate | Objective PASS check |
| --- | --- |
| HYPERV_01_HOST_CLEAN | No Docker, Python, Node, Git or OpenCode installed by scripts on Windows; only Hyper-V/PowerShell and optional built-in SSH |
| HYPERV_02_IMAGE | Canonical image SHA verified, booted with valid cloud-init; golden manifest and immutable parent VHDX |
| HYPERV_03_IDEMPOTENT | `Setup` repeated causes no drift or deletion; controlled `Rebuild` creates a new version |
| HYPERV_04_CLEAN_VM | Each model starts a fresh child disk and returns only sanitized results; parent hash unchanged |
| HYPERV_05_SECRET | Golden and results contain no provider keys; outbound/host mounts restricted; no guest GitHub write authority |
| HYPERV_06_GRADER | Existing eight baseline and reference oracles requalified inside guest; final patch graded offline |
| HYPERV_07_CATALOG | All six exact routes checked for model identity, tool support, free price, provider errors and regional/privacy settings |
| HYPERV_08_RESUME | Interrupted run resumes only unfinished trials, preserving previous timestamps and preventing duplicate consumption |
| HYPERV_09_SCOREBOARD | Only actual, complete evidence earns role verdict; unavailable/quota/paid routes do not get false FAIL |
| HYPERV_10_DESTROY | Destroy only removes owned child VM/disk after evidence collection; host and golden intact |

**First milestone:** Implement IaC, run on one Hyper-V laptop, pass host/golden/clone/teardown integrity tests with **zero model calls**. **Second milestone:** smoke test one free route with tiny task then all six. **Third milestone:** publish only qualified timestamped results. Do not publish guessed scores.

## Alternatives assessed

| Option | Pros | Cons / decision |
| --- | --- | --- |
| Hyper-V Ubuntu + Docker Engine **inside guest** | Minimal host dependencies, nested containers, native Windows control, clean disposable clones | **SELECT** |
| Hyper-V Ubuntu + direct OpenCode without Docker | Even simpler within guest | Loses existing Docker grader separation; reject for official scoring |
| Hyper-V with six simultaneous VMs | Strong per-model isolation | Host RAM and shared free quota contention; start sequential |
| Hyper-V Linux VM with a single checkpoint reset | Simple | Greater risk of mixing secrets or stale runtime artifacts; use differencing disks |
| Terraform + community Hyper-V provider | Familiar HCL | Extra host installation and provider maintenance without needed benefit; defer |
| Packer Hyper-V ISO builder | Reproducible automated golden image | Extra binary, ISO autoinstall complexity; consider later cross-host CI |
| WSL2 + Docker Engine | Low resource overhead | Weaker separation from Windows user account and not the explicit Hyper-V disposable design |
| Windows guest VM | Native GUI for future desktop engineering tests | Higher disk/RAM/license footprint and cannot reuse existing Linux Docker image easily; optional future Windows-specific pack |

## Sources

- Canonical guidance on Ubuntu Hyper-V cloud images and cloud-init: https://canonical.com/blog/how-to-use-ubuntu-on-windows
- Ubuntu 24.04 official image archive and SHA files: https://cloud-images.ubuntu.com/releases/noble/release/
- Microsoft Hyper-V PowerShell VM creation: https://learn.microsoft.com/en-us/windows-server/virtualization/hyper-v/get-started/create-a-virtual-machine-in-hyper-v
- Microsoft `Convert-VHD` and `New-VHD`: https://learn.microsoft.com/en-us/powershell/module/hyper-v/convert-vhd and https://learn.microsoft.com/en-us/powershell/module/hyper-v/new-vhd
- Microsoft Linux Gen2 Secure Boot: https://learn.microsoft.com/en-us/windows-server/virtualization/hyper-v/learn-more/Generation-2-virtual-machine-security-settings-for-Hyper-V
- Ubuntu NoCloud seed contract: https://docs.cloud-init.io/en/latest/reference/datasources/nocloud.html
- Docker Engine Ubuntu install: https://docs.docker.com/engine/install/ubuntu/
- OpenCode V2 CLI and configuration: https://opencode.ai/docs/cli/commands and https://opencode.ai/docs/config
- OpenCode Go exact model IDs/privacy: https://opencode.ai/docs/console/go/
- OpenRouter exact model endpoint links above.

**Status reminder:** This document proposes a reproducible workflow; it does not claim that an actual Hyper-V VM, proxy, API call, bootstrap script or six-model benchmark run exists yet.
