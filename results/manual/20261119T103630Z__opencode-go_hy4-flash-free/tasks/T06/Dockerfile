FROM node:22-bookworm-slim

WORKDIR /app

# Install from the committed lockfile first so dependency layers are cached
# and the dependency set is reproducible. Production dependencies only.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

# Official Node images provide an unprivileged 'node' user.
USER node

CMD ["node", "server.js"]
