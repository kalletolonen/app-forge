# CRUD Factory

**A Cursor-friendly monorepo codebase** for up to **10 customer-facing CRUD apps** on **Cloudflare**: Workers, D1, HTTPS, and per-app tech stacks.

Start here: **[CODEBASE.md](./CODEBASE.md)** (clone → install → run `demo` → `pnpm go-live demo`).

## Stacks (pick per app)

| Stack | What you get |
|--------|----------------|
| **next-d1** | Next.js + Better Auth + CRUD UI → Workers (OpenNext) |
| **vite-d1** | Vite React SPA + Hono API on one Worker |
| **hono-d1** | Hono JSON API only (bring your own client) |

Catalog: `platform/stacks.json`.

```bash
pnpm new-app acme --stack vite-d1
pnpm go-live acme
```

## Shared platform

| Piece | Location |
|--------|-----------|
| Database schema & migrations | `packages/database` |
| Auth (Next stack) | `packages/auth` |
| App registry | `apps.registry.json` |
| Provision D1 + deploy public URL | `pnpm go-live <slug>` |
| Optional DNS as code | `infra/terraform` |

## Quick start (local)

```bash
pnpm install --dangerously-allow-all-builds
cp .env.example apps/demo/.env.local
pnpm --filter demo db:push
pnpm dev
```

http://127.0.0.1:43123

## Quick start (public URL)

One command provisions D1, enables `workers.dev`, deploys the Worker, sets auth secrets, and prints an HTTPS URL:

```bash
export CLOUDFLARE_API_TOKEN=...
export CLOUDFLARE_ACCOUNT_ID=...
pnpm go-live demo
```

That prints something like `https://crud-demo.<your-subdomain>.workers.dev` (SSL included).

Optional custom domain (Cloudflare must already host the zone):

```bash
export ROOT_DOMAIN=example.com
pnpm go-live demo    # also attaches demo.example.com
```

`pnpm go-live --check` verifies the Cloudflare token and prints predicted URLs.

### Cloudflare API token

Create a token at https://dash.cloudflare.com/profile/api-tokens with:

| Scope | Permissions |
|--------|-------------|
| Account | Account Settings: Read, Workers Scripts: Edit, D1: Edit |
| Zone (only if using `ROOT_DOMAIN`) | DNS: Edit, SSL and Certificates: Edit, Workers Routes: Edit |

Then set GitHub repo secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. Optional repo **variables**: `ROOT_DOMAIN`, `CLOUDFLARE_ZONE_ID`.

## Repo layout

```
apps/          # deployable products
templates/     # stack templates (used by new-app)
packages/      # shared libraries
platform/      # stack metadata
scripts/       # new-app, go-live
```

Open **`crud-factory.code-workspace`** in Cursor to focus indexing on apps and packages.

## CI

`.github/workflows/go-live.yml` deploys each changed app on push to `main`, and can publish any slug from **Actions → Go live → Run workflow**.
It no-ops on push until the Cloudflare secrets above are set.
