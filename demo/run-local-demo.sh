#!/usr/bin/env bash
# Preflight and start the local Preprod workshop demo without printing runtime identifiers.
set -euo pipefail

PORT=5173
PROOF_SERVER="http://127.0.0.1:6300"
INDEXER_ENDPOINT="${MIDNIGHT_INDEXER_URL:-https://indexer.preprod.midnight.network/api/v4/graphql}"
INDEXER_MAX_AGE_SECONDS="${MIDNIGHT_INDEXER_MAX_AGE_SECONDS:-300}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEPLOYMENT_JSON="${MIDNIGHT_DEPLOYMENT_JSON:-$REPO_ROOT/deploy-test/deployment.json}"

CHECK_ONLY=0
if [ "${1:-}" = "--check" ] || [ "${1:-}" = "-n" ]; then
  CHECK_ONLY=1
fi

fail() { printf '\n\033[31m✗ %s\033[0m\n' "$1" >&2; exit 1; }
ok()   { printf '\033[32m✓\033[0m %s\n' "$1"; }

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "required command not found: $1"
}

require_command curl
require_command lsof
require_command npx
require_command python3

printf '%s\n' '── Preprod demo preflight ─────────────────────────────'

if curl -fsS -o /dev/null --max-time 5 "$PROOF_SERVER/health"; then
  ok "local proof server is responding"
else
  fail "local proof server is not responding at $PROOF_SERVER"
fi

[[ "$INDEXER_MAX_AGE_SECONDS" =~ ^[1-9][0-9]*$ ]] \
  || fail "MIDNIGHT_INDEXER_MAX_AGE_SECONDS must be a positive whole number"

INDEXER_RESPONSE="$(curl -fsS --max-time 10 \
  -H 'content-type: application/json' \
  --data-binary '{"query":"query PreflightTip { block { timestamp } }"}' \
  "$INDEXER_ENDPOINT")" \
  || fail "Preprod Indexer did not return a response"

if printf '%s' "$INDEXER_RESPONSE" \
  | python3 "$REPO_ROOT/demo/check_indexer_freshness.py" \
      --max-age-seconds "$INDEXER_MAX_AGE_SECONDS" >/dev/null; then
  ok "Preprod Indexer tip is fresh"
else
  fail "Preprod Indexer tip is stale or malformed; refusing to start"
fi

[ -f "$DEPLOYMENT_JSON" ] || fail "deployment metadata not found; set MIDNIGHT_DEPLOYMENT_JSON"

CONTRACT_ADDRESS="$(python3 -c '
import json, sys
with open(sys.argv[1], encoding="utf-8") as source:
    value = str(json.load(source).get("contractAddress", "")).strip()
print(value)
' "$DEPLOYMENT_JSON")"

[[ "$CONTRACT_ADDRESS" =~ ^[0-9a-fA-F]{64}$ ]] \
  || fail "deployment metadata does not contain a valid contract address"

DEPLOY_NETWORK="$(python3 -c '
import json, sys
with open(sys.argv[1], encoding="utf-8") as source:
    value = str(json.load(source).get("network", "")).strip()
print(value)
' "$DEPLOYMENT_JSON")"

[ "$DEPLOY_NETWORK" = "preprod" ] \
  || fail "deployment network is not preprod; refusing to start"

ok "Preprod deployment metadata is valid (contract address hidden)"

if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  fail "port $PORT is already in use; stop the existing process instead of changing origins"
fi

ok "fixed local port $PORT is available"
printf '%s\n' '──────────────────────────────────────────────────────'

if [ "$CHECK_ONLY" = "1" ]; then
  ok "preflight passed; application not started (--check)"
  exit 0
fi

printf '\n%s\n' "Open http://localhost:$PORT in the browser profile used for the disposable Demo wallet."
printf '%s\n' 'Use Demo Mode and never paste the seed into chat, logs, screenshots, or commits.'
printf '%s\n' 'Follow demo/2026-08-04-local-test-checklist.md for the six-tab workshop flow.'
printf '\n'

cd "$REPO_ROOT/dapp-ui"
VITE_MIDNIGHT_CONTRACT_ADDRESS="$CONTRACT_ADDRESS" exec npx vite --port "$PORT" --strictPort
