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
APP_DIR="$ROOT/apps/$SLUG"

if [[ -z "${CLOUDFLARE_ACCOUNT_ID:-}" ]]; then
  echo "Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN (or run wrangler login)."
  exit 1
fi

export CLOUDFLARE_ACCOUNT_ID

echo "Creating D1 database: $D1_NAME"
CREATE_OUT="$(wrangler d1 create "$D1_NAME" 2>&1)" || true
echo "$CREATE_OUT"

DB_ID="$(echo "$CREATE_OUT" | sed -n 's/.*database_id = \"\\([^\"]*\\)\".*/\\1/p' | head -1)"
if [[ -z "$DB_ID" ]]; then
  echo "Fetching existing D1 id..."
  DB_ID="$(wrangler d1 list | grep "$D1_NAME" | awk '{print $1}' | head -1)"
fi

if [[ -n "$DB_ID" ]]; then
  sed -i "s/REPLACE_AFTER_PROVISION/$DB_ID/" "$APP_DIR/wrangler.jsonc" 2>/dev/null || \
    sed -i '' "s/REPLACE_AFTER_PROVISION/$DB_ID/" "$APP_DIR/wrangler.jsonc"
fi

echo "Applying D1 migrations (remote)..."
(cd "$APP_DIR" && wrangler d1 migrations apply "$D1_NAME" --remote)

SECRET="$(openssl rand -base64 32)"
echo "Setting Worker secrets (run deploy after setting BETTER_AUTH_URL to your live URL)..."
(cd "$APP_DIR" && wrangler secret put BETTER_AUTH_SECRET <<< "$SECRET")

echo ""
echo "Provisioned $D1_NAME (id: ${DB_ID:-unknown})."
echo "Deploy: pnpm --filter $SLUG deploy"
echo "Then set BETTER_AUTH_URL / NEXT_PUBLIC_BETTER_AUTH_URL to https://<your-worker>.workers.dev"
