FROM node:22.11.0-bookworm-slim

WORKDIR /app

# Install production dependencies first (better layer caching)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy application source
COPY . .

# Run as non-root user
USER node

CMD ["node", "server.js"]
