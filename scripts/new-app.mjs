#!/usr/bin/env node
import {
  cpSync,
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join, relative } from "node:path";

function parseArgs(argv) {
  let stack = "next-d1";
  let slug = null;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--stack" && argv[i + 1]) {
      stack = argv[++i];
      continue;
    }
    if (!slug && !arg.startsWith("-")) {
      slug = arg;
    }
  }
  return { slug, stack };
}

const { slug, stack } = parseArgs(process.argv.slice(2));

if (!slug || !/^[a-z][a-z0-9-]{1,30}$/.test(slug)) {
  console.error(
    "Usage: pnpm new-app <slug> [--stack next-d1|vite-d1|hono-d1]",
  );
  process.exit(1);
}

const root = join(import.meta.dirname, "..");
const stacksPath = join(root, "platform/stacks.json");
const stacksDoc = JSON.parse(readFileSync(stacksPath, "utf8"));
const stackMeta = stacksDoc.stacks.find((s) => s.id === stack);
if (!stackMeta) {
  console.error(`Unknown stack "${stack}". See platform/stacks.json`);
  process.exit(1);
}

const templateDir = join(root, "templates", stack);
if (!existsSync(templateDir)) {
  console.error(`Template missing: templates/${stack}`);
  process.exit(1);
}

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

cpSync(templateDir, target, {
  recursive: true,
  filter: (src) =>
    !src.includes("node_modules") &&
    !src.includes(".next") &&
    !src.includes(".data") &&
    !src.endsWith(".env.local"),
});

function walk(dir, files = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      walk(path, files);
    } else {
      files.push(path);
    }
  }
  return files;
}

const textExtensions = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".json",
  ".jsonc",
  ".md",
  ".html",
  ".css",
  ".yml",
  ".yaml",
  ".example",
]);

function applyPlaceholders(content, filePath) {
  let out = content;
  out = out.replaceAll("crud-SLUG", `crud-${slug}`);
  out = out.replaceAll("crud-demo", `crud-${slug}`);
  out = out.replaceAll("DISPLAY_NAME", displayName);
  out = out.replaceAll("Demo Records", displayName);
  if (!filePath.includes("apps.registry")) {
    out = out.replaceAll('"APP_ID": "SLUG"', `"APP_ID": "${slug}"`);
    out = out.replaceAll('"APP_ID": "demo"', `"APP_ID": "${slug}"`);
    out = out.replaceAll("APP_ID=demo", `APP_ID=${slug}`);
  }
  out = out.replaceAll("crud-SLUG", `crud-${slug}`);
  out = out.replaceAll("/demo.sqlite", `/${slug}.sqlite`);
  out = out.replaceAll("hono-d1-template", slug);
  out = out.replaceAll("vite-d1-template", slug);
  return out;
}

for (const file of walk(target)) {
  const ext = file.slice(file.lastIndexOf("."));
  if (!textExtensions.has(ext)) {
    continue;
  }
  const raw = readFileSync(file, "utf8");
  writeFileSync(file, applyPlaceholders(raw, relative(root, file)));
}

const pkgPath = join(target, "package.json");
if (existsSync(pkgPath)) {
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  pkg.name = slug;
  if (stack === "next-d1") {
    pkg.scripts["db:push"] =
      `mkdir -p .data && sh -c 'cd ../../packages/database && APP_ID=${slug} LOCAL_DATABASE_URL=file://$INIT_CWD/.data/${slug}.sqlite drizzle-kit push'`;
    pkg.scripts["db:migrate:local"] =
      `wrangler d1 migrations apply crud-${slug} --local`;
  }
  if (stack === "vite-d1" || stack === "hono-d1") {
    pkg.scripts["db:migrate:local"] =
      `wrangler d1 migrations apply crud-${slug} --local`;
  }
  writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
}

registry.apps.push({
  slug,
  displayName,
  stack,
  deployTarget: stackMeta.deployTarget,
  workerName: `crud-${slug}`,
  d1Database: `crud-${slug}`,
  subdomain: slug,
});
writeFileSync(registryPath, `${JSON.stringify(registry, null, 2)}\n`);

const nextSteps = [
  `Provision Cloudflare: ./scripts/provision-cloudflare.sh ${slug}`,
];
if (stack === "next-d1") {
  nextSteps.push(
    `cp .env.example apps/${slug}/.env.local and set APP_ID=${slug}`,
    `pnpm --filter ${slug} db:push`,
  );
}
nextSteps.push(`pnpm --filter ${slug} dev`);

console.log(`
Created apps/${slug} (${stack})

${nextSteps.map((s, i) => `${i + 1}. ${s}`).join("\n")}
`);
