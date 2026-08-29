# Vocab Bloom Hub admin UI (docs/deployment/docker.md). Build from the
# repository root: the frontend imports types from the server workspace.
#   docker build -f apps/frontend/Dockerfile -t vocab-bloom-hub-frontend .
# NEXT_PUBLIC_BASE_API_URL is inlined into the browser bundle at build time;
# the default (/api, relative to the page origin) works behind the documented
# reverse proxy, so the image needs no build argument in the standard setup.
# Server-side rendering reaches the API through API_INTERNAL_URL at runtime.

# --- deps: the whole workspace install
FROM node:24-alpine AS deps
RUN apk add --no-cache python3 make g++
WORKDIR /app
RUN corepack enable
COPY package.json yarn.lock .yarnrc.yml ./
COPY apps/server/package.json apps/server/
COPY apps/frontend/package.json apps/frontend/
COPY apps/e2e/package.json apps/e2e/
COPY packages/npm-sdk/package.json packages/npm-sdk/
RUN yarn install --immutable

# --- build: next build with output: 'standalone' (next.config.ts)
FROM deps AS build
ARG NEXT_PUBLIC_BASE_API_URL=/api
ENV NEXT_PUBLIC_BASE_API_URL=$NEXT_PUBLIC_BASE_API_URL
ENV NODE_ENV=production
COPY tsconfig.base.json ./
# the frontend imports types, constants and a few modules from the server workspace
COPY apps/server apps/server
COPY apps/frontend apps/frontend
RUN yarn workspace frontend exec next build

# --- runtime: the standalone output only
FROM node:24-alpine AS runtime
# links the GHCR package to the repository; version and revision are added by CI
LABEL org.opencontainers.image.source="https://github.com/Fristail27/vocab-bloom-hub" \
      org.opencontainers.image.description="Vocab Bloom Hub admin UI (Next.js)" \
      org.opencontainers.image.licenses="MIT"
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
WORKDIR /app
# standalone is traced from the monorepo root (outputFileTracingRoot), so it
# already contains apps/frontend/server.js and the node_modules it needs
COPY --from=build /app/apps/frontend/.next/standalone ./
COPY --from=build /app/apps/frontend/.next/static ./apps/frontend/.next/static
COPY --from=build /app/apps/frontend/public ./apps/frontend/public
USER node
EXPOSE 3000
# the login page is the frontend's liveness check (docs/deployment/README.md)
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT:-3000}/en/login" >/dev/null || exit 1
CMD ["node", "apps/frontend/server.js"]
