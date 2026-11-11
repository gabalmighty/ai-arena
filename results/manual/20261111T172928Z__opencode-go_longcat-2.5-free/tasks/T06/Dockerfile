# T06 — hardened production-style image for the Node 22 app.
#
# Base tag: a specific Node 22 Debian slim release line (NOT `node:latest`).
# `node:22-bookworm-slim` tracks the 22.x line on Debian 12 (bookworm).
# For production reproducibility, pin by immutable digest instead; that digest
# was NOT verified offline in this run and is therefore left unpinned here.

FROM node:22-bookworm-slim

# Production semantics and quieter, non-interactive npm behaviour.
ENV NODE_ENV=production \
    NPM_CONFIG_FUND=false \
    NPM_CONFIG_AUDIT=false \
    NPM_CONFIG_UPDATE_NOTIFIER=false

WORKDIR /app

# 1) Copy ONLY the dependency manifests first, so this layer is cached
#    independently of application source changes.
COPY package.json package-lock.json ./

# 2) Install exactly what the lockfile records, without dev dependencies.
#    `npm ci` fails closed if package.json and package-lock.json disagree.
RUN npm ci --omit=dev

# 3) Copy the application source after dependency installation.
COPY . .

# 4) Drop privileges. The official node image ships a `node` user (uid 1000).
USER node

# 5) Preserve the original startup command.
CMD ["node", "server.js"]
