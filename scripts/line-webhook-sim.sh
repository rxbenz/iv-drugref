#!/usr/bin/env bash
# ============================================================
# Simulate a LINE-signed webhook POST against the deployed Edge Function,
# to confirm signature verification works end-to-end WITHOUT the LINE app.
#
# Secrets are read from the environment — NEVER hardcode them:
#   export LINE_CHANNEL_SECRET='...'          # from your password manager
#   export FUNCTION_URL='https://bzwbagojjpiazbeaahmg.supabase.co/functions/v1/line-webhook'
#   bash scripts/line-webhook-sim.sh
#
# Expected: valid signature -> HTTP 200 ; tampered signature -> HTTP 403
# ============================================================
set -euo pipefail
: "${LINE_CHANNEL_SECRET:?set LINE_CHANNEL_SECRET (do not paste it into any file)}"
: "${FUNCTION_URL:?set FUNCTION_URL to your deployed function URL}"

# Empty events array = the same shape LINE's console "Verify" button sends.
BODY='{"events":[]}'
SIG=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$LINE_CHANNEL_SECRET" -binary | openssl base64)

echo "== valid signature (expect 200) =="
curl -s -o /dev/null -w 'HTTP %{http_code}\n' -X POST "$FUNCTION_URL" \
  -H 'content-type: application/json' \
  -H "x-line-signature: $SIG" \
  --data "$BODY"

echo "== tampered signature (expect 403) =="
curl -s -o /dev/null -w 'HTTP %{http_code}\n' -X POST "$FUNCTION_URL" \
  -H 'content-type: application/json' \
  -H 'x-line-signature: dGFtcGVyZWQ=' \
  --data "$BODY"
