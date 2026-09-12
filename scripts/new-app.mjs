#!/usr/bin/env node
import { cpSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const slug = process.argv[2];
if (!slug || !/^[a-z][a-z0-9-]{1,30}$/.test(slug)) {
  console.error("Usage: pnpm new-app <slug>  (e.g. pnpm new-app acme-books)");
  process.exit(1);
}

const root = join(import.meta.dirname, "..");
const registryPath = join(root, "apps.registry.json");
const registry = JSON.parse(readFileSync(registryPath, "utf8"));

if (registry.apps.some((a) => a.slug === slug)) {
  console.error(`App "${slug}" already exists in apps.registry.json`);
  process.exit(1);
}
if (registry.apps.length >= registry.maxApps) {
  console.error(`Maximum of ${registry.maxApps} apps reached.`);
  process.exit(1);
}

const target = join(root, "apps", slug);
if (existsSync(target)) {
  console.error(`Directory apps/${slug} already exists`);
  process.exit(1);
}

const displayName =
  slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ") + " App";

cpSync(join(root, "apps", "demo"), target, {
  recursive: true,
  filter: (src) => !src.includes("node_modules") && !src.includes(".next"),
});

const wranglerPath = join(target, "wrangler.jsonc");
let wrangler = readFileSync(wranglerPath, "utf8");
wrangler = wrangler
  .replaceAll("crud-demo", `crud-${slug}`)
  .replaceAll('"demo"', `"${slug}"`)
  .replaceAll("Demo Records", displayName);
writeFileSync(wranglerPath, wrangler);

const pkgPath = join(target, "package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
pkg.name = slug;
pkg.scripts["db:push"] =
  `mkdir -p .data && sh -c 'cd ../../packages/database && APP_ID=${slug} LOCAL_DATABASE_URL=file://$INIT_CWD/.data/${slug}.sqlite drizzle-kit push'`;
pkg.scripts["db:migrate:local"] = `wrangler d1 migrations apply crud-${slug} --local`;
writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);

registry.apps.push({
  slug,
  displayName,
  workerName: `crud-${slug}`,
  d1Database: `crud-${slug}`,
  subdomain: slug,
});
writeFileSync(registryPath, `${JSON.stringify(registry, null, 2)}\n`);

console.log(`
Created apps/${slug}

Next steps:
  1. Provision Cloudflare: ./scripts/provision-cloudflare.sh ${slug}
  2. Copy apps/demo/.env.local → apps/${slug}/.env.local and set APP_ID=${slug}
  3. pnpm --filter ${slug} db:push
  4. pnpm --filter ${slug} dev
`);
