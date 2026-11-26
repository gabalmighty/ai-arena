# T06 — Offline DevOps repair notes

## Delivered configuration

- `Dockerfile` uses the specific `node:22.16.0-bookworm-slim` tag, copies `package.json` and `package-lock.json` before application files, runs `npm ci --omit=dev`, clears npm's cache, and switches to the image's non-root `node` user before `node server.js`.
- `.dockerignore` excludes Git/GitHub metadata, `.env*`, secrets, dependencies, logs, caches, coverage, build output, temporary files, and generated `results`.
- `workflow.yml` is test-only: `contents: read`, checkout without persisted credentials, Node 22.16.0, `npm ci`, and `npm test`; it has no deploy command, curl-to-shell step, write permission, secret reference, or credential dump.

## Security and rollback observations

1. **Non-root runtime reduces impact but is not a complete sandbox.** `USER node` limits the process's default privileges; production should additionally consider a read-only root filesystem, dropped capabilities, resource limits, and only required network access. Those controls were not added or tested here because the task deliverable is a Dockerfile, not a deployment manifest.
2. **Lockfile installation improves reproducibility, not immutability.** `npm ci` honors the committed lockfile, while the Node tag and action major tags can still move or be retagged; before production, verify the image/action digests and record the exact resolved artifacts.
3. **Context exclusion reduces accidental secret/result disclosure.** Ignoring `.env*`, `secrets`, `.git`, dependencies, and generated results keeps common sensitive or irrelevant material out of the build context, but reviewers must still inspect tracked files because `.dockerignore` cannot make a deliberately tracked secret safe.
4. **Rollback requires an immutable previous artifact.** Preserve the last known-good image digest, application configuration, and release manifest; define health/error-budget gates and a tested rollback command before any real rollout. No previous artifact or rollback pipeline was available in this benchmark, so rollback readiness is **UNVERIFIED**.
5. **CI is intentionally non-deploying and low-privilege.** A test workflow should not hold deployment credentials; promotion should be a separately authorized job with protected environments and auditable approval. The checkout/setup-node major tags are retained because no real action SHA could be verified offline, so their revision immutability is **UNVERIFIED**.

## Checks actually executed

- Static assertion command (Node built-ins, run from `tasks/T06`) checked the specific base tag, manifest-before-source copy order, `npm ci --omit=dev`, non-root user, startup command, required ignore patterns, read-only workflow permission, `npm ci`, `npm test`, and absence of `write-all`, `curl`, secret references, `kubectl`, and `docker push`.
- Final static check output: `Static T06 assertions passed: Dockerfile, .dockerignore, workflow.yml`; exit code **0**.
- An earlier inline `node -e` attempt exited **1** because Windows native argument parsing passed `--chown=node:node` as a Node option; the same assertions were rerun through a PowerShell here-string/stdin and passed. This was a command-transport issue, not a configuration defect.
- `docker --version` exited **1**: Docker was not recognized as an installed command.
- No image build, container run, repository `npm ci`/`npm test`, deployment, remote script download, or network verification was performed. YAML was statically inspected, not parsed by a YAML library. Therefore image existence, runtime behavior, dependency health, action SHA immutability, and live deployment/rollback behavior are **UNVERIFIED**.
