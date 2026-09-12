# CRUD Factory

**A Cursor-friendly monorepo codebase** for up to **10 customer-facing CRUD apps** on **Cloudflare**: Workers, D1, HTTPS, and per-app tech stacks.

Start here: **[CODEBASE.md](./CODEBASE.md)** (clone → install → run `demo` → provision Cloudflare).

## Stacks (pick per app)

| Stack | What you get |
|--------|----------------|
| **next-d1** | Next.js + Better Auth + CRUD UI → Workers (OpenNext) |
| **vite-d1** | Vite React SPA + Hono API on one Worker |
| **hono-d1** | Hono JSON API only (bring your own client) |

Catalog: `platform/stacks.json`.

```bash
pnpm new-app acme --stack vite-d1
```

## Shared platform

| Piece | Location |
|--------|-----------|
| Database schema & migrations | `packages/database` |
| Auth (Next stack) | `packages/auth` |
| App registry | `apps.registry.json` |
| Provision D1 + secrets | `scripts/provision-cloudflare.sh` |
| Optional DNS | `infra/terraform` |

## Quick start (local)

```bash
pnpm install --dangerously-allow-all-builds
cp .env.example apps/demo/.env.local
pnpm --filter demo db:push
pnpm dev
```

http://127.0.0.1:43123

## Quick start (Cloudflare)

```bash
npx wrangler login
export CLOUDFLARE_ACCOUNT_ID=...
./scripts/provision-cloudflare.sh demo
cd apps/demo && pnpm deploy
```

Custom domains: Worker → **Domains & Routes** (SSL is automatic on Cloudflare).

## Repo layout

```
apps/          # deployable products
templates/     # stack templates (used by new-app)
packages/      # shared libraries
platform/      # stack metadata
scripts/       # automation
```

Open **`crud-factory.code-workspace`** in Cursor to focus indexing on apps and packages.

## CI

`.github/workflows/deploy-demo.yml` deploys `demo` when `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` are set on the repo.
