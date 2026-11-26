# Base image: SPECIFIC supported Node 22 on Debian "bookworm" slim release tag (not "latest").
# NOTE: tag existence/"supported" status UNVERIFIED offline; for production pin a full @sha256 digest.
FROM node:22.11.0-bookworm-slim

# Production runtime; no build-time tooling beyond npm ci below.
ENV NODE_ENV=production

WORKDIR /app

# Copy dependency manifests BEFORE application files so the npm-ci layer caches independently.
# Requires a committed package-lock.json. (No package.json/package-lock.json is created here;
# the target repository is assumed to provide them.)
COPY package.json package-lock.json ./

# Reproducible, production-only install; no lifecycle-scripts hardening added here, see notes.md.
RUN npm ci --omit=dev

# Copy application files after dependencies.
COPY . .

# Run as a non-root user. Official node image provides uid/gid 1000 "node".
USER node

# Preserve startup command.
CMD ["node", "server.js"]
