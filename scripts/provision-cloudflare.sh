#!/usr/bin/env bash
# Back-compat wrapper. Prefer: pnpm go-live <slug>
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SLUG="${1:-}"
if [[ -z "$SLUG" ]]; then
  echo "Usage: ./scripts/provision-cloudflare.sh <slug>"
  echo "Prefer: pnpm go-live <slug>"
  exit 1
fi
exec node "$ROOT/scripts/go-live.mjs" "$SLUG" --provision-only
