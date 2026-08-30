# Vocab Bloom Hub website (docs/deployment/docker.md): the documentation, the
# public API reference, the playground and the word pages, served next to an
# instance. Build from the repository root: the pages are rendered from the
# repository's own Markdown, the OpenAPI document and the server's types.
#   docker build -f apps/site/Dockerfile -t vocab-bloom-hub-site .
# NEXT_PUBLIC_BASE_API_URL is inlined into the browser bundle at build time;
# the default (/api, relative to the page origin) works behind the documented
# reverse proxy and through the site's own /api forwarding. Server-side
# rendering (the word pages) reaches the API through API_INTERNAL_URL at runtime.

# --- deps: the whole workspace install
FROM node:24-alpine AS deps
RUN apk add --no-cache python3 make g++
WORKDIR /app
RUN corepack enable
COPY package.json yarn.lock .yarnrc.yml ./
COPY apps/server/package.json apps/server/
COPY apps/frontend/package.json apps/frontend/
COPY apps/site/package.json apps/site/
COPY apps/e2e/package.json apps/e2e/
COPY packages/npm-sdk/package.json packages/npm-sdk/
RUN yarn install --immutable

# --- build: next build with output: 'standalone' (next.config.ts)
FROM deps AS build
ARG NEXT_PUBLIC_BASE_API_URL=/api
ENV NEXT_PUBLIC_BASE_API_URL=$NEXT_PUBLIC_BASE_API_URL
ENV NODE_ENV=production
COPY tsconfig.base.json ./
# the content the pages are rendered from: the READMEs, docs/, the licences,
# the OpenAPI document and the response types of the server workspace
COPY README.md CONTRIBUTING.md DATA_LICENSE.md LICENSE ./
COPY docs docs
COPY packages/npm-sdk/README.md packages/npm-sdk/
COPY packages/python-sdk/README.md packages/python-sdk/
COPY apps/server apps/server
COPY apps/site apps/site
RUN yarn workspace site exec next build

# --- runtime: the standalone output only
FROM node:24-alpine AS runtime
LABEL org.opencontainers.image.source="https://github.com/Fristail27/vocab-bloom-hub" \
      org.opencontainers.image.description="Vocab Bloom Hub website (Next.js): docs, API reference, playground, word pages" \
      org.opencontainers.image.licenses="MIT"
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3020
WORKDIR /app
COPY --from=build /app/apps/site/.next/standalone ./
COPY --from=build /app/apps/site/.next/static ./apps/site/.next/static
COPY --from=build /app/apps/site/public ./apps/site/public
USER node
EXPOSE 3020
# the start page is the site's liveness check
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT:-3020}/en" >/dev/null || exit 1
CMD ["node", "apps/site/server.js"]
