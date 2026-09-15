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
# set BETTER_AUTH_SECRET in that file (openssl rand -base64 32)
pnpm --filter demo db:push
pnpm dev
```

http://127.0.0.1:43123

## Quick start (public URL)

One command provisions D1, enables `workers.dev`, deploys the Worker, sets auth secrets, and prints an HTTPS URL:

```bash
export CLOUDFLARE_API_TOKEN=...
export CLOUDFLARE_ACCOUNT_ID=...
# optional: same value as the GitHub secret so CI and local stay in sync
export BETTER_AUTH_SECRET="$(openssl rand -base64 32)"
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

## GitHub Actions secrets

**Settings → Secrets and variables → Actions.** Deploy workflows (`Go live`, `Deploy demo to Cloudflare`) read these at runtime — they are never committed.

| Name | Required | Used by |
|------|----------|---------|
| `CLOUDFLARE_API_TOKEN` | Yes, to deploy | Cloudflare API (see permissions above) |
| `CLOUDFLARE_ACCOUNT_ID` | Yes, to deploy | Account that owns the Worker and D1 |
| `BETTER_AUTH_SECRET` | Recommended for `next-d1` apps | Worker secret for Better Auth. Generate once with `openssl rand -base64 32`. When this GitHub secret is set, `pnpm go-live` writes it onto the Worker **before** deploy. If it is missing, go-live generates a random secret the first time and leaves an existing Worker secret alone. |

Optional **variables** (or secrets): `ROOT_DOMAIN`, `CLOUDFLARE_ZONE_ID`, `CLOUDFLARE_WORKERS_DEV_SUBDOMAIN`.

The **Tests** workflow only runs `node --test` and does not need any of these.

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

| Workflow | When | Needs secrets |
|----------|------|----------------|
| **Tests** | Every push / PR | No |
| **Go live** | Push to `main` when app/shared files change, or **Actions → Go live → Run workflow** | Cloudflare secrets above. Skips on push until they are set. |
| **Deploy demo to Cloudflare** | Manual only | Same as Go live, always deploys `demo` |
