# T06 evidence notes

- **task:** T06 — DevOps configuration repair without deploying anything (static repair; no live build/deployment).
- **status:** COMPLETED
- **started_utc:** 2026-11-19T11:04:32Z (measured; first T06 artifact `tasks/T06/Dockerfile` creation, authoritative UTC via `[System.IO.File]::GetLastWriteTimeUtc`; host offset +8:00 per `Get-TimeZone`)
- **finished_utc:** 2026-11-19T11:04:38Z (measured `[DateTimeOffset]::UtcNow` after the artifacts were written)
- **elapsed_seconds:** 6
- **files changed:** `tasks/T06/Dockerfile` (created), `tasks/T06/.dockerignore` (created), `tasks/T06/workflow.yml` (created), `tasks/T06/notes.md` (this file). No real `.github/workflows` created; nothing deployed; nothing downloaded or executed.
- **commands run:**
  1. `Get-Command docker` — measured: no output, non-zero exit; Docker is not installed on this host.
  2. `docker --version` — measured: fails (`docker : The term 'docker' is not recognized as the name of a cmdlet, function, script file, or operable program`, `CommandNotFoundException`).
  3. `webfetch https://api.github.com/repos/actions/checkout/git/refs/tags/v4` — measured response: ref `refs/tags/v4`, object type `commit`, SHA `11d5960a326750d5838078e36cf38b85af677262`.
  4. `webfetch https://hub.docker.com/v2/repositories/library/node/tags?name=22.16.0&page_size=25` — measured response: tag `22.16.0-bookworm-slim` present, `tag_status: "active"`, digest `sha256:048ed02c5fd52e86fda6fbd2f6a76cf0d4492fd6c6fee9e2c463ed5108da0e34`.
  5. Static inspection of the written Dockerfile/.dockerignore/workflow.yml.
- **Checks actually executed (static inspection is valid evidence):**
  - Dockerfile contract: specific supported Node 22 Debian slim tag (`node:22.16.0-bookworm-slim`, existence + status verified via the Docker Hub API); dependency manifests (`package.json package-lock.json`) copied before application files (`COPY . .` after `RUN npm ci --omit=dev`); `npm ci --omit=dev`; non-root user (`RUN adduser --system --group --uid 10001 nodeuser` + `USER nodeuser`); startup command preserved (`CMD ["node", "server.js"]`).
  - `.dockerignore` excludes `.git`, `.env*`, `secrets*`, `node_modules`, `build`, `dist`, `coverage`, `out`, `results`, `.npm`, `logs`, `*.log`, `.DS_Store`, `Thumbs.db`, `*.tmp`.
  - workflow.yml: non-deploying test-only CI (steps: checkout, `npm ci`, `npm test`); `permissions: read-all` (least privilege, no write credentials); no `curl|bash`; no secret dumps; `actions/checkout` pinned to commit SHA `11d5960a326750d5838078e36cf38b85af677262` (verified via the GitHub API).
- **Live image / deployment qualification:** NOT qualified — Docker CLI/daemon not available on this host (measured), so no image build, container run, deployment or remote script execution was performed against real infrastructure.
- **Security observations (3–5):**
  1. Starter ran the server as `USER root` — a hardening gap; the repair runs as non-root user `nodeuser` (uid 10001).
  2. Starter used `FROM node:latest` — unpinned base image → supply-chain drift; repaired to the specific, verified-existing tag `node:22.16.0-bookworm-slim`.
  3. Starter used `npm install` — can install devDependencies and mutate the lockfile; repaired to `npm ci --omit=dev` (reproducible, no dev deps in the production image).
  4. Starter workflow: `permissions: write-all` plus `curl https://example.invalid/install.sh | bash` — over-broad token permissions and arbitrary remote script execution during CI; repaired: `permissions: read-all`, no remote script steps, no secret dumps.
  5. No new file was created under `.github/workflows`; the delivered `workflow.yml` is a named `Build` CI definition only (non-deploying).
- **Rollback observation:** Nothing was deployed (see "Live image qualification"). If this is rolled out later: record the base image digest (`sha256:048ed02c5fd52e86fda6fbd2f6a76cf0d4492fd6c6fee9e2c463ed5108da0e34`) and the previous Dockerfile/workflow; rollback = deploy the previous commit's Dockerfile/workflow and pin the previous image digest. No runtime rollback needed because the CI is non-deploying.
- **evidence type:** measured (file mtimes, Docker/GitHub API responses, static inspection of the written files).
