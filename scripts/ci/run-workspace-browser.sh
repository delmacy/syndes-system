#!/usr/bin/env bash
# Disposable local browser fixture. Real external preview smoke requires an operator environment.
set -Eeuo pipefail
cd "$(dirname "$0")/../../apps/workspace-web"
npx playwright install --with-deps chromium
export CHROME_PATH
CHROME_PATH="$(node --input-type=module -e 'import {chromium} from "playwright";process.stdout.write(chromium.executablePath())')"

# Tests from historic CRM/Inbox UI suites use two well-known local fixture origins.
npx vite preview --host 127.0.0.1 --port 18084 --strictPort >"$RUNNER_TEMP/syndes-ui-18084.log" 2>&1 &
p1=$!
npx vite preview --host 127.0.0.1 --port 4185 --strictPort >"$RUNNER_TEMP/syndes-ui-4185.log" 2>&1 &
p2=$!
cleanup() { kill "$p1" "$p2" >/dev/null 2>&1 || true; }
trap cleanup EXIT
for port in 18084 4185; do
  ready=0
  for attempt in $(seq 1 40); do
    if curl -fsS "http://127.0.0.1:$port/" >/dev/null; then ready=1; break; fi
    sleep 1
  done
  if [[ "$ready" != 1 ]]; then
    echo "::error::Workspace disposable preview failed on port $port" >&2
    cat "$RUNNER_TEMP/syndes-ui-$port.log" >&2
    exit 1
  fi
done
for script in test:ui-anon test:inbox-ui test:crm-ui test:whatsapp-ui; do
  if SCRIPT_NAME="$script" node -e \
      'const p=require("./package.json");process.exit(Object.hasOwn(p.scripts||{},process.env.SCRIPT_NAME)?0:1)'; then
    echo "Running isolated browser fixture: $script"
    npm run "$script"
  fi
done
