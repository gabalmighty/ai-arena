# T06 — DevOps configuration repair notes (static, no deploy)

## Security / reliability observations
1. **Pinned base image and non-root runtime (Dockerfile):** Replaced `node:latest` and `USER root` with a specific Node 22 Debian slim release tag (`node:22.11.0-bookworm-slim`) and `USER node`. This reduces supply-chain drift and limits container privilege. *Check actually executed:* static inspection of `Dockerfile`.
2. **Deterministic, minimal dependency install (Dockerfile):** Copied `package.json`/`package-lock.json` before app files and used `npm ci --omit=dev` (assumes committed lockfile). Improves cacheability, reproducibility, and excludes dev dependencies from runtime image. *Check actually executed:* static inspection of `Dockerfile`.
3. **Reduced build context / secret leakage risk (.dockerignore):** Excludes `.git`, `.env*`, secrets, `node_modules`, build/cache artifacts, and generated `results` to avoid accidental inclusion in image context. *Check actually executed:* static inspection of `.dockerignore`.
4. **Least-privilege, non-deploying CI (workflow.yml):** Set `permissions: contents: read`, removed `curl ... | bash` remote execution, and limited steps to checkout, Node 22 setup, `npm ci`, and `npm test` with no write credentials/secret dumps/deploy steps. *Check actually executed:* static inspection of `workflow.yml`.
5. **Action pinning immutability (workflow.yml):** Preferred pinned action revisions not verifiable offline here, so documented major tags (`actions/checkout@v4`, `actions/setup-node@v4`) are retained and marked **UNVERIFIED** for immutability. *Check actually executed:* static inspection only.

## Rollback / operational notes
- **Image rollback:** Because the image tag should be versioned per release in a real pipeline, rollback is typically redeploying the previous known-good image digest/tag (no live deployment performed or qualified here).
- **CI rollback:** Revert the workflow commit if it blocks valid builds; keep least-privilege permissions and avoid reintroducing remote script execution.

## Evidence limits
- **No Docker daemon/build or deployment run:** I did not build the image, run containers, or qualify a live deployment. Docker availability for runtime validation was not used/executed as part of this task.
- **No network fetch of remote scripts/actions metadata:** The unsafe `curl | bash` starter line was removed, not executed; action SHAs not verified offline.
