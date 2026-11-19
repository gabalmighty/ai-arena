# Node 22 application image — pinned to a specific supported Debian slim
# release tag (not :latest). Base image existence verified via the Docker Hub
# API on 2026-11-19 (tag "22.16.0-bookworm-slim", status active).
FROM node:22.16.0-bookworm-slim

WORKDIR /app

# Install dependency manifests first so the dependency layer is cached
# independently of application code changes.
COPY package.json package-lock.json ./

# Reproducible production install: no dev dependencies.
RUN npm ci --omit=dev

COPY . .

# Run as a non-root user.
RUN adduser --system --group --uid 10001 nodeuser
USER nodeuser

# Preserve the original startup command.
CMD ["node", "server.js"]
