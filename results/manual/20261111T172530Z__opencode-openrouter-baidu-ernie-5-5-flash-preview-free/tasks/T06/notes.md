# T06 — DevOps configuration notes

## Checks actually executed

- Static inspection of `Dockerfile`, `.dockerignore` and `workflow.yml` only.
- `git diff --check` on the staged run folder (no whitespace errors expected; see the run log).
- Confirmed that the `docker` CLI is **not installed** on this host (`docker --version` returned "not recognized"). Therefore no image was built, no container was run, no registry pull was attempted, and no live deployment was performed.
- The workflow was not executed by GitHub Actions. `npm ci` and `npm test` were not run because this task directory intentionally has no `package.json` or test suite; the workflow's correctness is a static configuration claim.
- The remote starter URL `https://example.invalid/install.sh` was not downloaded or executed.

## Security and rollback observations

1. **Least privilege in CI.** `workflow.yml` sets `permissions: contents: read` and has no deployment job, cloud credentials, secret dumps, `curl | shell`, or write-capable token. A compromised test dependency therefore cannot push commits or publish releases through this workflow. The workflow only checks out, installs from the lockfile, and runs tests.

2. **Dependency and image pinning.** `Dockerfile` uses the specific Debian-bookworm Node 22.16.0 slim tag instead of `node:latest`, and `npm ci --omit=dev` installs exactly the committed lockfile without resolving new versions. `actions/checkout@v4` and `actions/setup-node@v4` remain mutable major tags because no action SHA could be verified offline; their immutability is **UNVERIFIED**. Pinning to full commit SHAs would require a network lookup and is not claimed here.

3. **Non-root runtime and smaller build context.** The image installs dependencies before copying application files, then switches to the built-in `node` user, so the application process does not run as root. `.dockerignore` excludes `.git`, `.env*`, key material, `node_modules`, caches, build output and generated `results`, reducing the chance that local secrets or host-only artifacts enter the image.

4. **Rollback path.** Roll back by redeploying the previously recorded image digest and the previous configuration revision, not by rebuilding `latest`. Keep database migrations backward compatible during the transition so the previous image can run against the current schema. If a release includes a signing-key change, retain the previous key for verification during a bounded overlap window rather than deleting it at cutover.

5. **Unverified operational limits.** This task does not qualify a live image, Kubernetes rollout, secret manager integration, resource limits, health checks, or production networking. The Dockerfile has no `HEALTHCHECK`; orchestration must supply probes. The absence of Docker on this host means image buildability and runtime behavior remain unverified.

## Rollback / change-control checklist before a real release

- Record the exact base-image digest and lockfile hash used for the release.
- Require an approved change record and an explicit production authorization gate.
- Run the test workflow and a container smoke test in a non-production environment.
- Keep the previous image digest deployable and verify a rollback in staging.
- Monitor error rate, latency and authentication failures; stop the rollout on threshold breach.