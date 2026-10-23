#!/usr/bin/env bash
# Disposable fixtures only: verify an existing Alpine 17 volume survives adding pgvector,
# and the actual Compose Ollama service persists data without downloading a model.
# Build the first argument from docker/postgres/Dockerfile before running this script.
set -euo pipefail
image="${1:?Pass the locally built PostgreSQL image}"
repo="$(cd "$(dirname "$0")/../.." && pwd)"
fixture="$(mktemp -d)"
name="vbh-semantic-smoke-$(basename "$fixture" | tr '[:upper:].' '[:lower:]-')"
volume="${name}-pg"
container="${name}-pg"
compose=(docker compose --project-name "$name" --project-directory "$repo" --env-file "$fixture/.env" -f "$repo/docker-compose.yml")
export ENV_FILE="$fixture/.env"
export COMPOSE_PROFILES=embeddings
cleanup() {
  docker rm -f "$container" >/dev/null 2>&1 || true
  docker volume rm "$volume" >/dev/null 2>&1 || true
  "${compose[@]}" down --volumes >/dev/null 2>&1 || true
  rm -rf "$fixture"
}
trap cleanup EXIT
printf 'COMPOSE_PROFILES=embeddings\nEMBEDDINGS_MODEL=vbh-fixture-not-installed:latest\n' > "$fixture/.env"
# Override operator env; never contact a remote daemon/model or reuse their project.
export EMBEDDINGS_MODEL=vbh-fixture-not-installed:latest
export EMBEDDINGS_IMAGE=ollama/ollama:0.40.8
wait_pg() {
  # The entrypoint's temporary init server accepts Unix-socket connections but
  # shuts down before the final server starts. Wait for TCP to avoid that race.
  for ((i=0; i<60; i++)); do
    if docker exec "$container" pg_isready -h 127.0.0.1 -U fixture -d fixture >/dev/null 2>&1; then return; fi
    sleep 1
  done
  docker logs "$container"; return 1
}
sql() { docker exec "$container" psql -U fixture -d fixture -v ON_ERROR_STOP=1 -Atc "$1"; }
docker volume create "$volume" >/dev/null
docker run -d --name "$container" -e POSTGRES_USER=fixture -e POSTGRES_PASSWORD=fixture \
  -v "$volume:/var/lib/postgresql/data" postgres:17-alpine >/dev/null
wait_pg
sql "CREATE TABLE preserved (word text PRIMARY KEY); INSERT INTO preserved VALUES ('птица'), ('bird');" >/dev/null
docker stop "$container" >/dev/null
docker rm "$container" >/dev/null
docker run -d --name "$container" -e POSTGRES_USER=fixture -e POSTGRES_PASSWORD=fixture \
  -v "$volume:/var/lib/postgresql/data" "$image" >/dev/null
wait_pg
test "$(sql 'SELECT count(*) FROM preserved')" = 2
test "$(sql "SELECT count(*) FROM pg_extension WHERE extname='vector'")" = 0
sql 'CREATE EXTENSION vector WITH SCHEMA public' >/dev/null
test "$(sql "SELECT extversion FROM pg_extension WHERE extname='vector'")" = 0.8.1
test "$(sql "SELECT '[1,0,0]'::vector <=> '[1,0,0]'::vector")" = 0
echo 'ok: existing Alpine 17 volume, explicit extension activation and cosine query'

"${compose[@]}" up -d embeddings
for ((i=0; i<60; i++)); do
  if "${compose[@]}" exec -T embeddings ollama list >/dev/null 2>&1; then break; fi
  sleep 1
done
"${compose[@]}" exec -T embeddings ollama list
id="$("${compose[@]}" ps -q embeddings)"
probe="$(docker inspect --format '{{index .Config.Healthcheck.Test 1}}' "$id")"
if docker exec "$id" sh -c "$probe"; then
  echo 'error: missing model was reported ready'; exit 1
fi
docker run --rm --network "${name}_default" node:22-alpine node -e \
  'fetch("http://embeddings:11434/api/tags").then(async r => { if (!r.ok || (await r.json()).models.length !== 0) process.exit(1); }).catch(() => process.exit(1));'
test "$(docker exec "$id" sh -c 'find /root/.ollama/models -type f 2>/dev/null | wc -l')" -eq 0
docker exec "$id" sh -c 'printf fixture > /root/.ollama/persistence-fixture'
"${compose[@]}" up -d --force-recreate embeddings
test "$("${compose[@]}" exec -T embeddings cat /root/.ollama/persistence-fixture)" = fixture
echo 'ok: Ollama starts without a model, readiness fails, no automatic download, volume survives recreation'
