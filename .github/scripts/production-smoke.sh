#!/usr/bin/env bash
# Production start smoke test (issue #315): starts the built apps with the
# root `yarn start`, waits for the readiness probe and the login page, then
# stops the server with SIGTERM and checks that it shut down gracefully.
#
# Expects `yarn build` to have run and the production environment to be
# exported (NODE_ENV=production, a postgres:// DATABASE_URL, the admin
# credentials; see docs/deployment/README.md). Runs in CI and locally:
#   NODE_ENV=production DATABASE_URL=postgres://... ADMIN_USERNAME=... ADMIN_PASSWORD=... \
#     bash .github/scripts/production-smoke.sh
set -euo pipefail

SERVER_URL="http://localhost:${SERVER_PORT:-3010}"
FRONT_URL="http://localhost:${PORT:-${FRONT_PORT:-3000}}"
START_TIMEOUT="${SMOKE_START_TIMEOUT:-120}"   # seconds to wait for readiness
STOP_TIMEOUT="${SMOKE_STOP_TIMEOUT:-40}"      # seconds to wait for the processes to exit
LOG_FILE="${SMOKE_LOG_FILE:-production-smoke.log}"

fail() {
  echo "::error::$1"
  echo "--- $LOG_FILE ---"
  cat "$LOG_FILE" || true
  exit 1
}

cleanup() {
  if [ -n "${START_PID:-}" ] && kill -0 "$START_PID" 2>/dev/null; then
    echo "cleanup: stopping yarn start ($START_PID)"
    kill -TERM "$START_PID" 2>/dev/null || true
  fi
  pkill -TERM -f 'dist/src/main' 2>/dev/null || true
  pkill -TERM -f 'next start' 2>/dev/null || true
}
trap cleanup EXIT

wait_for() {
  # wait_for <seconds> <description> <command...>
  # EXPECT_EXIT=1 while waiting for the processes to stop, when a gone
  # `yarn start` is the expected outcome rather than a crash
  local seconds="$1" what="$2"; shift 2
  local waited=0
  until "$@"; do
    if [ "${EXPECT_EXIT:-0}" = "0" ] && [ -n "${START_PID:-}" ] && ! kill -0 "$START_PID" 2>/dev/null; then
      fail "yarn start exited while waiting for $what"
    fi
    if [ "$waited" -ge "$seconds" ]; then
      fail "$what did not happen within ${seconds}s"
    fi
    sleep 1; waited=$((waited + 1))
  done
  echo "ok: $what (${waited}s)"
}

http_status() { curl -s -o /dev/null -w '%{http_code}' "$@"; }
is_ready() { [ "$(http_status "$SERVER_URL/api/ready")" = "200" ]; }
front_is_up() { [ "$(http_status -L "$FRONT_URL/")" = "200" ]; }
process_gone() { ! kill -0 "$1" 2>/dev/null; }

echo "starting: yarn start (log: $LOG_FILE)"
yarn start >"$LOG_FILE" 2>&1 &
START_PID=$!

wait_for "$START_TIMEOUT" "readiness ($SERVER_URL/api/ready = 200)" is_ready

# liveness carries the package version; readiness is the bare ok
HEALTH="$(curl -sf "$SERVER_URL/api/health")"
echo "health: $HEALTH"
echo "$HEALTH" | grep -q '"status":"ok"' || fail "unexpected /api/health body: $HEALTH"
echo "$HEALTH" | grep -q '"version":"' || fail "/api/health carries no version: $HEALTH"
[ "$(curl -sf "$SERVER_URL/api/ready")" = '{"status":"ok"}' ] || fail "unexpected /api/ready body"

# the public API answers through the production build
[ "$(http_status "$SERVER_URL/api/v1/meta")" = "200" ] || fail "/api/v1/meta is not 200"

# the frontend serves its production build; / redirects to the localized login page
wait_for "$START_TIMEOUT" "frontend ($FRONT_URL/ = 200 after redirects)" front_is_up
login_is_up() { [ "$(http_status "$FRONT_URL/en/login")" = "200" ]; }
wait_for 30 "login page ($FRONT_URL/en/login = 200)" login_is_up

# graceful stop: SIGTERM to the server process itself, the way a process
# manager stops it; readiness must drop and the process must exit on its own
SERVER_PID="$(pgrep -f 'dist/src/main' | head -1)"
[ -n "$SERVER_PID" ] || fail "server process (dist/src/main) not found"
echo "stopping server $SERVER_PID with SIGTERM"
kill -TERM "$SERVER_PID"
EXPECT_EXIT=1 wait_for "$STOP_TIMEOUT" "server process exit" process_gone "$SERVER_PID"

# the last lines of the process reach the log file a moment after it exits
# (they pass through concurrently's pipe), so give them a few seconds
shutdown_logged() { grep -q 'Shutdown complete (SIGTERM)' "$LOG_FILE"; }
EXPECT_EXIT=1 wait_for 10 "graceful shutdown logged ('Shutdown complete (SIGTERM)')" shutdown_logged
if grep -q 'forcing exit' "$LOG_FILE"; then fail "the shutdown watchdog forced the exit"; fi

# `yarn start` runs concurrently --kill-others: with the server gone it stops the frontend and exits
EXPECT_EXIT=1 wait_for "$STOP_TIMEOUT" "yarn start exit" process_gone "$START_PID"
if pgrep -f 'next start' >/dev/null; then fail "a 'next start' process survived the stop"; fi

echo "production start smoke test passed"
