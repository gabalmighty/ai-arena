# Build once; agent and offline grader run in different containers of this image.
FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends python3 git ca-certificates \
    && rm -rf /var/lib/apt/lists/*
RUN npm install --global @opencode/cli@2.0.0
RUN useradd --uid 10001 --create-home --home-dir /home/arena arena
WORKDIR /work
