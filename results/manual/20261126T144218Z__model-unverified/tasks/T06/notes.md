# T06 notes — DevOps configuration repair (offline; nothing deployed)

**Scope.** Static authoring + inspection only. No real `.github/workflows/` created or modified in this
repository; `workflow.yml` here is a candidate artifact. No deploy, no cloud, no Docker daemon, no
network, no `curl|bash`, no remote URL executed. The starting unsafe snippets (node:latest, root,
`npm install`, `curl ... | bash`, `permissions: write-all`, `push`-only) were used as reference and
replaced.

## Checks actually executed
- **Static inspection** of the generated `Dockerfile`, `.dockerignore`, `workflow.yml` (this file's claims).
- **NOT executed:** `docker build`, `docker run`, `hadolint`, `actionlint`, `npm ci`, `npm test`, any lint,
  any network fetch, any SHA verification. **Docker is not installed/available in this environment** and was
  not installed (per rules). 
- **No live image qualification and no live deployment qualification.** A static-valid file is not proof of
  a secure container image or safe pipeline; an independent reviewer must rebuild + scan + test.

## Observed facts vs unverified
- Observed: Node app starts with `node server.js`; repository assumed to have `package.json` + committed
  `package-lock.json`; Node 22 target. (These are task assumptions, restated.)
- Unverified (offline): `node:22.11.0-bookworm-slim` registry tag existence / "supported" status; digest;
  `actions/checkout@v4` / `actions/setup-node@v4` immutability; `ubuntu-latest` contents; `npm test` behavior
  of the target repo; runtime correctness. No action SHA invented.
- Container hardening beyond non-root + prod-only deps (e.g. read-only FS, `no-new-privileges`,
  cap-drop, tmpfs) is NOT applied here; recommended for production (see observations).

## Security / rollback observations (4)

1. **Pinned base + reproducible install reduces supply-chain drift.** `FROM node:22.11.0-bookworm-slim`
   (specific Node 22 Debian-slim release, not `node:latest`) + `npm ci` against committed `package-lock.json`
   makes builds reproducible and blocks silent upstream changes. Offline cannot verify the tag/digest, so it
   is marked UNVERIFIED; production should pin `node:22.x.y-bookworm-slim@sha256:<digest>`. Rollback: rebuild
   a previously published image tag/digest; image rollback is independent of code rollback.
2. **Least privilege in container and CI.** `USER node` (non-root) + `npm ci --omit=dev` (no dev deps in
   runtime) reduce attack surface; CI `permissions: contents: read`, `persist-credentials: false`, no write
   tokens, no `secrets`, no `curl|shell`, no remote scripts. Rollback for a bad CI change = revert the commit;
   `contents: read` means CI cannot push or publish. (Not a verified hardened image.)
3. **Secret + context hygiene via `.dockerignore`.** `.git`, `.env*`, `*.env`, `secrets/`, keys/PEMs,
   `.npmrc`, `node_modules`, caches/build output, generated `results`, and `.github` are excluded from the
   build context; no secret is baked into the image; no `ARG`/`ENV` secrets. `COPY . .` runs after ignore
   rules. Rollback irrelevant (no secret in artifact); rotate any secret that ever entered a build context.
   `.env*` exclusion protects local secrets; verify the build context separately in a real build.
4. **CI is test-only and immutable-by-default recommended.** Non-deploying `npm ci` + `npm test` on push;
   no artifact publish, no cloud auth. Prefer pinned action SHAs for `actions/checkout`/`actions/setup-node`
   when a real SHA can be verified; here only documented major tag `@v4` is used and its immutability is
   **UNVERIFIED** offline. Rollback = disable workflow / revert commit. No live run was performed, so no
   passing pipeline is claimed.
