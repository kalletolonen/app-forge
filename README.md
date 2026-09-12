# CRUD Factory (Cloudflare)

Monorepo for up to **10 customer-facing CRUD apps** on your **Cloudflare** account: each app is a Next.js site on **Workers**, with its own **D1** database, **email/password auth**, and **HTTPS** (Workers dev URL or your custom domain).

## What's included

| Piece | Technology |
|--------|------------|
| Apps | Next.js 16 (`apps/<slug>`) |
| Deploy | [OpenNext Cloudflare](https://opennext.js.org/cloudflare) + Wrangler |
| Database | Cloudflare D1 (SQLite), Drizzle ORM |
| Auth | Better Auth (sessions in D1) |
| SSL | Automatic on `*.workers.dev` and proxied custom domains |
| IaC | Terraform DNS stubs (`infra/terraform`) + `scripts/provision-cloudflare.sh` |

The included **`demo`** app is a full CRUD example (sign up, sign in, create/edit/delete records scoped to the signed-in user).

## Prerequisites

- Node 20+ and pnpm
- Cloudflare account
- [Wrangler](https://developers.cloudflare.com/workers/wrangler/) authenticated: `npx wrangler login`

## Local development (demo)

```bash
pnpm install
cp .env.example apps/demo/.env.local
# Edit BETTER_AUTH_SECRET (e.g. openssl rand -base64 32)

cd apps/demo
pnpm db:push
pnpm dev
```

Open http://127.0.0.1:43123 — data is stored in `apps/demo/.data/demo.sqlite`.

## Provision on Cloudflare (first app)

```bash
export CLOUDFLARE_ACCOUNT_ID=your_account_id
# API token with D1 + Workers edit, or use wrangler login

chmod +x scripts/provision-cloudflare.sh
./scripts/provision-cloudflare.sh demo
```

This creates the D1 database, applies migrations, writes the database ID into `apps/demo/wrangler.jsonc`, and stores `BETTER_AUTH_SECRET` as a Worker secret.

Deploy:

```bash
cd apps/demo
export BETTER_AUTH_URL=https://crud-demo.<your-subdomain>.workers.dev
export NEXT_PUBLIC_BETTER_AUTH_URL=$BETTER_AUTH_URL
pnpm deploy
```

Set the same `BETTER_AUTH_URL` / `NEXT_PUBLIC_BETTER_AUTH_URL` in the Worker (vars in `wrangler.jsonc` or dashboard) so auth cookies match your public URL.

### Custom domain (SSL included)

1. In the Cloudflare dashboard, open the **crud-demo** Worker → **Settings** → **Domains & Routes** → add `demo.yourdomain.com`.
2. Optionally apply Terraform DNS (proxied records):

```bash
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars
terraform init && terraform apply
```

## Add another app (up to 10)

```bash
pnpm new-app acme-books
./scripts/provision-cloudflare.sh acme-books
pnpm --filter acme-books db:push   # local only
pnpm --filter acme-books dev
```

Each app gets its own D1 database (`crud-<slug>`) and Worker name. Registry: `apps.registry.json`.

## CI

`.github/workflows/deploy-demo.yml` deploys `demo` on push to `main` when you set repository secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.

## Project layout

```
apps/demo/          # Example customer CRUD app + wrangler.jsonc
packages/database/  # Drizzle schema + D1 migrations
packages/auth/      # Better Auth wiring
scripts/            # new-app + Cloudflare provisioning
infra/terraform/    # Optional DNS for *.yourdomain.com
```
