# Codebase guide

Use this repository as your **starting codebase**: clone it, connect it in Cursor, and spin up customer CRUD apps on Cloudflare without re-deciding infrastructure each time.

## First hour

1. **Clone** and open the folder in Cursor (indexing will pick up `apps/`, `packages/`, `templates/`).
2. **Install**
   ```bash
   pnpm install --dangerously-allow-all-builds
   ```
3. **Run the reference app** (`demo`, Next.js stack):
   ```bash
   cp .env.example apps/demo/.env.local
   # set BETTER_AUTH_SECRET
   pnpm --filter demo db:push
   pnpm dev
   ```
4. **Cloudflare** (when ready): `npx wrangler login`, then `./scripts/provision-cloudflare.sh demo`.

## Mental model

```text
crud-factory/
├── apps/           ← your live products (max 10)
├── templates/      ← blueprints (do not edit for one-off hacks)
├── packages/       ← shared DB + auth
├── scripts/        ← new-app, provision-cloudflare
└── apps.registry.json  ← source of truth for slugs & stacks
```

Each **app** can use a **different stack** (`next-d1`, `vite-d1`, `hono-d1`). Shared **D1 schema** lives in `packages/database`; SSL and public URLs come from Cloudflare.

## Cursor tips

- Use `@folder apps/demo` (or the app you’re editing) to keep agent context tight.
- Rules in `.cursor/rules/crud-factory.mdc` describe how agents should scaffold and deploy.
- Large artifacts are excluded via `.cursorignore` so codebase search stays useful.

## Commands cheat sheet

| Goal | Command |
|------|---------|
| List stacks | `cat platform/stacks.json` |
| New app | `pnpm new-app my-shop --stack vite-d1` |
| Provision D1 + secrets | `./scripts/provision-cloudflare.sh my-shop` |
| Dev one app | `pnpm --filter my-shop dev` |
| Deploy one app | `pnpm --filter my-shop deploy` |

## What to customize

- **Branding & copy** in each `apps/<slug>/` UI
- **Auth** for `vite-d1` / `hono-d1` (templates ship open API — add JWT, API keys, or Cloudflare Access)
- **Custom domains** in the Cloudflare dashboard per Worker
- **Terraform** (`infra/terraform`) when you want DNS for `*.yourdomain.com`

See [README.md](./README.md) for full deployment steps.
