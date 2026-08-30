# Vocab Bloom Hub API (docs/deployment/docker.md). Build from the repository
# root, the workspace install needs every package.json:
#   docker build -f apps/server/Dockerfile -t vocab-bloom-hub-server .
# Runtime: NODE_ENV=production, a postgres:// DATABASE_URL, ADMIN_USERNAME /
# ADMIN_PASSWORD (docs/environment.md); listens on SERVER_PORT (3010).

# --- deps: the whole workspace install, with the toolchain native modules need
FROM node:24-alpine AS deps
RUN apk add --no-cache python3 make g++
WORKDIR /app
RUN corepack enable
COPY package.json yarn.lock .yarnrc.yml ./
COPY apps/server/package.json apps/server/
COPY apps/frontend/package.json apps/frontend/
COPY apps/e2e/package.json apps/e2e/
COPY apps/site/package.json apps/site/
COPY packages/npm-sdk/package.json packages/npm-sdk/
RUN yarn install --immutable

# --- build: compile the server (dist/ mirrors src/ and core/)
FROM deps AS build
COPY tsconfig.base.json ./
COPY apps/server apps/server
RUN yarn workspace server build

# --- prod-deps: only what the server needs at runtime
FROM deps AS prod-deps
RUN yarn workspaces focus server --production

# --- runtime
FROM node:24-alpine AS runtime
# links the GHCR package to the repository; version and revision are added by CI
LABEL org.opencontainers.image.source="https://github.com/Fristail27/vocab-bloom-hub" \
      org.opencontainers.image.description="Vocab Bloom Hub API (NestJS)" \
      org.opencontainers.image.licenses="MIT"
ENV NODE_ENV=production
WORKDIR /app
COPY --from=prod-deps /app/node_modules ./node_modules
# package.json plus the workspace's own node_modules, when the install nested any
COPY --from=prod-deps /app/apps/server ./apps/server
COPY --from=build /app/apps/server/dist ./apps/server/dist
# the server reads its own package.json (version) from the working directory
WORKDIR /app/apps/server
USER node
EXPOSE 3010
# liveness only: readiness (/api/ready) is for the proxy / orchestrator
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${SERVER_PORT:-3010}/api/health" >/dev/null || exit 1
# node directly: SIGTERM reaches the server, which drains and exits by itself
CMD ["node", "dist/src/main.js"]
