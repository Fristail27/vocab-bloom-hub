#!/usr/bin/env bash
# docker compose smoke test (issue #316): the stack from docker-compose.yml is
# up; check the probes, the public API, the login page, and that the admin
# login over plain http sets a cookie without the `secure` flag (the cookie
# follows the request scheme, so a proxy with TLS gets a secure one).
#
# Needs ADMIN_USERNAME / ADMIN_PASSWORD (read from .env when not exported)
# and curl + openssl. Ports: SERVER_PORT / FRONT_PORT (defaults 3010 / 3000).
set -euo pipefail

ENV_FILE="${ENV_FILE:-.env}"
env_value() { grep -E "^$1=" "$ENV_FILE" 2>/dev/null | tail -1 | cut -d= -f2-; }
ADMIN_USERNAME="${ADMIN_USERNAME:-$(env_value ADMIN_USERNAME)}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-$(env_value ADMIN_PASSWORD)}"
SERVER_URL="http://localhost:${SERVER_PORT:-$(env_value SERVER_PORT)}"
FRONT_URL="http://localhost:${FRONT_PORT:-$(env_value FRONT_PORT)}"
SERVER_URL="${SERVER_URL%:}"; FRONT_URL="${FRONT_URL%:}"
[ "$SERVER_URL" = "http://localhost" ] && SERVER_URL="http://localhost:3010"
[ "$FRONT_URL" = "http://localhost" ] && FRONT_URL="http://localhost:3000"

fail() { echo "::error::$1"; exit 1; }
http_status() { curl -s -o /dev/null -w '%{http_code}' "$@"; }

wait_for() {
  local seconds="$1" what="$2"; shift 2
  local waited=0
  until "$@"; do
    [ "$waited" -ge "$seconds" ] && fail "$what did not happen within ${seconds}s"
    sleep 2; waited=$((waited + 2))
  done
  echo "ok: $what (${waited}s)"
}

# --- probes and the public API
wait_for 120 "readiness ($SERVER_URL/api/ready = 200)" test "$(http_status "$SERVER_URL/api/ready")" = 200
[ "$(curl -sf "$SERVER_URL/api/ready")" = '{"status":"ok"}' ] || fail "unexpected /api/ready body"
curl -sf "$SERVER_URL/api/health" | grep -q '"status":"ok"' || fail "/api/health is not ok"
[ "$(http_status "$SERVER_URL/api/v1/meta")" = 200 ] || fail "/api/v1/meta is not 200"
echo "ok: probes and /api/v1/meta"

# --- the frontend renders the login page (server-side rendering talks to the API through API_INTERNAL_URL)
wait_for 60 "login page ($FRONT_URL/en/login = 200)" test "$(http_status "$FRONT_URL/en/login")" = 200
[ "$(http_status -L "$FRONT_URL/")" = 200 ] || fail "/ does not reach the login page"

# --- admin login over plain http: a one-time HMAC proof (docs/authentication.md)
sha256() { printf '%s' "$1" | openssl dgst -sha256 -r | cut -d' ' -f1; }
login_hash="$(sha256 "$(sha256 "$ADMIN_USERNAME")$(sha256 "$ADMIN_PASSWORD")$(sha256 "$ADMIN_USERNAME$ADMIN_PASSWORD")")"
salt="$(openssl rand -hex 16)"
slot=$(( $(date +%s) / 60 ))
proof="$(printf '%s' "$slot:$salt" | openssl dgst -sha256 -mac HMAC -macopt "key:$login_hash" -r | cut -d' ' -f1)"
headers="$(curl -s -D - -o /dev/null -H 'Content-Type: application/json' \
  -d "{\"hash\":\"$proof\",\"salt\":\"$salt\"}" "$SERVER_URL/api/auth/login")"
echo "$headers" | grep -q '^HTTP/[0-9.]* 20[01]' || fail "login failed: $(echo "$headers" | head -1)"
cookie="$(echo "$headers" | grep -i '^set-cookie: bearer=' || true)"
[ -n "$cookie" ] || fail "login did not set the bearer cookie"
echo "$cookie" | grep -qi 'httponly' || fail "bearer cookie is not HttpOnly"
if echo "$cookie" | grep -qi 'secure'; then fail "bearer cookie is Secure over plain http — the login could never work here"; fi
echo "ok: admin login over http sets an HttpOnly, non-secure cookie"

# --- with the cookie, the admin API answers
token="$(echo "$cookie" | sed -E 's/^[Ss]et-[Cc]ookie: bearer=([^;]*).*/\1/')"
[ "$(http_status -H "Cookie: bearer=$token" "$SERVER_URL/api/settings/all")" = 200 ] || fail "admin API refused the cookie"
echo "ok: admin API accepts the cookie"

echo "compose smoke test passed"
