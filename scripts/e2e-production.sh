#!/usr/bin/env bash
# Runs the browser suite against the production build (dist/, served by
# `vite preview`) instead of the dev server: the launch smoke test for the
# closed alpha (#32). CI is unchanged; it still runs every test on the dev server.
#
# Excluded (12 per project; all still run on the dev server in CI), because
# production builds remove the test-only Easter egg switch by design:
# - the "keyboard Easter egg" tests (11), which switch the Easter egg on;
# - "tapping Ember gets a musing..." (1), which taps a hatched Ember 8 times
#   assuming the Easter egg is off. In production each tap has the real
#   1-in-25 chance of finding Ember at his keyboard (about 28% per run).
# Other taps in the suite are on the egg or after a low-mood check-in, where
# the Easter egg never happens. Everything else runs.
#
# Usage: scripts/e2e-production.sh [extra Playwright arguments]
set -euo pipefail
cd "$(dirname "$0")/.."

PORT=4173 # playwright.config.ts's baseURL port
if curl -s -o /dev/null "http://localhost:$PORT"; then
  echo "Port $PORT is already in use; stop that server first." >&2
  exit 1
fi

npm run build
# vite itself (not through npx), so stopping it below really stops the server.
node_modules/.bin/vite preview --port "$PORT" --strictPort >/dev/null 2>&1 &
SERVER=$!
trap 'kill "$SERVER" 2>/dev/null || true' EXIT

for _ in $(seq 1 30); do
  curl -s -o /dev/null "http://localhost:$PORT" && break
  sleep 1
done
# Must be the built app (hashed bundle), never the dev server (/src/main.tsx).
if ! curl -s "http://localhost:$PORT/" | grep -q '/assets/index-'; then
  echo "Not serving the production build on port $PORT." >&2
  exit 1
fi

# Without CI=1, Playwright reuses the server above instead of starting the dev server.
env -u CI npx playwright test --grep-invert "keyboard Easter egg|tapping Ember gets a musing" "$@"
