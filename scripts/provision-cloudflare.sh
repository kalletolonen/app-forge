#!/usr/bin/env bash
set -euo pipefail

SLUG="${1:-demo}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REGISTRY="$ROOT/apps.registry.json"
APP_JSON="$(node -e "
  const r=require('$REGISTRY');
  const a=r.apps.find(x=>x.slug==='$SLUG');
  if(!a){console.error('Unknown slug');process.exit(1)}
  console.log(JSON.stringify(a));
")"

WORKER_NAME="$(node -e "console.log(JSON.parse(process.argv[1]).workerName)" "$APP_JSON")"
D1_NAME="$(node -e "console.log(JSON.parse(process.argv[1]).d1Database)" "$APP_JSON")"
STACK="$(node -e "console.log(JSON.parse(process.argv[1]).stack || 'next-d1')" "$APP_JSON")"
APP_DIR="$ROOT/apps/$SLUG"

if [[ -z "${CLOUDFLARE_ACCOUNT_ID:-}" ]]; then
  echo "Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN (or run wrangler login)."
  exit 1
fi

export CLOUDFLARE_ACCOUNT_ID

echo "Stack: $STACK — Worker: $WORKER_NAME — D1: $D1_NAME"

echo "Creating D1 database: $D1_NAME"
CREATE_OUT="$(wrangler d1 create "$D1_NAME" 2>&1)" || true
echo "$CREATE_OUT"

DB_ID="$(echo "$CREATE_OUT" | sed -n 's/.*database_id = \"\\([^\"]*\\)\".*/\\1/p' | head -1)"
if [[ -z "$DB_ID" ]]; then
  echo "Fetching existing D1 id..."
  DB_ID="$(wrangler d1 list | grep "$D1_NAME" | awk '{print $1}' | head -1)"
fi

WRANGLER_FILE="$APP_DIR/wrangler.jsonc"
if [[ -f "$WRANGLER_FILE" && -n "$DB_ID" ]]; then
  sed -i "s/REPLACE_AFTER_PROVISION/$DB_ID/" "$WRANGLER_FILE" 2>/dev/null || \
    sed -i '' "s/REPLACE_AFTER_PROVISION/$DB_ID/" "$WRANGLER_FILE"
fi

echo "Applying D1 migrations (remote)..."
(cd "$APP_DIR" && wrangler d1 migrations apply "$D1_NAME" --remote)

if [[ "$STACK" == "next-d1" ]]; then
  SECRET="$(openssl rand -base64 32)"
  echo "Setting BETTER_AUTH_SECRET on Worker..."
  (cd "$APP_DIR" && wrangler secret put BETTER_AUTH_SECRET <<< "$SECRET")
  echo "After deploy, set BETTER_AUTH_URL and NEXT_PUBLIC_BETTER_AUTH_URL to your public Worker URL."
else
  echo "Stack $STACK: wire auth before exposing to customers (API is open by default)."
fi

echo ""
echo "Provisioned $D1_NAME (id: ${DB_ID:-unknown})."
echo "Deploy: pnpm --filter $SLUG deploy"
