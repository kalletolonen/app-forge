#!/usr/bin/env node
/**
 * Provision Cloudflare (D1, workers.dev, optional custom domain) and deploy
 * an app to a public HTTPS URL.
 *
 *   pnpm go-live <slug>
 *   pnpm go-live <slug> --dry-run
 *   pnpm go-live <slug> --provision-only
 *   pnpm go-live --check
 *
 * Env:
 *   CLOUDFLARE_API_TOKEN          required in CI (or `wrangler login` locally)
 *   CLOUDFLARE_ACCOUNT_ID         required (auto-detected when the token sees one account)
 *   ROOT_DOMAIN                   optional, e.g. example.com → {subdomain}.example.com
 *   CLOUDFLARE_ZONE_ID            optional; Wrangler infers the zone from the hostname
 *   CLOUDFLARE_WORKERS_DEV_SUBDOMAIN  used only when the account has no workers.dev yet
 */
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  appendFileSync,
  existsSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CLOUDFLARE_TOKEN_PERMISSIONS,
  customHostname,
  findD1Id,
  getApp,
  loadRegistryFromJson,
  parseD1Id,
  parseWorkersDevUrl,
  patchWranglerConfig,
  publicUrls,
  upsertAppLaunch,
} from "./lib/go-live-config.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const registryPath = join(root, "apps.registry.json");

function parseArgs(argv) {
  const flags = new Set();
  let slug = null;
  for (const arg of argv) {
    if (arg.startsWith("--")) {
      flags.add(arg);
      continue;
    }
    if (!slug && !arg.startsWith("-")) {
      slug = arg;
    }
  }
  return {
    slug,
    dryRun: flags.has("--dry-run"),
    provisionOnly: flags.has("--provision-only"),
    check: flags.has("--check"),
    skipHealth: flags.has("--skip-health"),
    noWriteRegistry: flags.has("--no-write-registry"),
    json: flags.has("--json"),
  };
}

function usage(exitCode = 1) {
  console.error(`Usage:
  pnpm go-live <slug>                 Provision D1, deploy, print public HTTPS URL
  pnpm go-live <slug> --dry-run       Show the plan without calling Cloudflare
  pnpm go-live <slug> --provision-only
  pnpm go-live --check                Verify Cloudflare credentials

Env: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID
Optional: ROOT_DOMAIN, CLOUDFLARE_ZONE_ID, CLOUDFLARE_WORKERS_DEV_SUBDOMAIN`);
  process.exit(exitCode);
}

function loadRegistry() {
  return loadRegistryFromJson(
    JSON.parse(readFileSync(registryPath, "utf8")),
  );
}

function writeRegistry(registry) {
  writeFileSync(registryPath, `${JSON.stringify(registry, null, 2)}\n`);
}

function loadWrangler(appDir) {
  const path = join(appDir, "wrangler.jsonc");
  if (!existsSync(path)) {
    throw new Error(`Missing ${path}`);
  }
  return { path, config: JSON.parse(readFileSync(path, "utf8")) };
}

function writeWrangler(path, config) {
  writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`);
}

function resolveWrangler(appDir) {
  const candidates = [
    join(appDir, "node_modules/.bin/wrangler"),
    join(root, "node_modules/.bin/wrangler"),
  ];
  return candidates.find((bin) => existsSync(bin)) ?? "wrangler";
}

function run(command, args, { cwd, input, allowFail = false, env } = {}) {
  const result = spawnSync(command, args, {
    cwd: cwd ?? root,
    encoding: "utf8",
    input,
    env: env ?? process.env,
  });
  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";
  const combined = `${stdout}\n${stderr}`;
  if (result.status !== 0 && !allowFail) {
    const err = new Error(
      `${command} ${args.join(" ")} failed (${result.status}):\n${combined.trim()}`,
    );
    err.output = combined;
    throw err;
  }
  return { status: result.status ?? 1, stdout, stderr, combined };
}

function wrangler(appDir, args, options = {}) {
  return run(resolveWrangler(appDir), args, { cwd: appDir, ...options });
}

function tokenPermissionsHint() {
  return `Create a Cloudflare API token with:
  Account: ${CLOUDFLARE_TOKEN_PERMISSIONS.account.join(", ")}
  Zone (only if ROOT_DOMAIN is set): ${CLOUDFLARE_TOKEN_PERMISSIONS.zone.join(", ")}
Set repo secrets CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID.`;
}

async function cfApi(accountId, token, method, path, body) {
  const url = path.startsWith("https://")
    ? path
    : `https://api.cloudflare.com/client/v4${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) {
    const message =
      json.errors?.map((e) => e.message).join("; ") ||
      json.messages?.map((m) => m.message).join("; ") ||
      res.statusText;
    const err = new Error(`Cloudflare API ${method} ${path}: ${message}`);
    err.status = res.status;
    err.body = json;
    throw err;
  }
  return json.result;
}

async function resolveAccountId(token) {
  if (process.env.CLOUDFLARE_ACCOUNT_ID) {
    return process.env.CLOUDFLARE_ACCOUNT_ID;
  }
  if (!token) {
    throw new Error(
      `CLOUDFLARE_ACCOUNT_ID is required.\n${tokenPermissionsHint()}`,
    );
  }
  const accounts = await cfApi(
    "",
    token,
    "GET",
    "https://api.cloudflare.com/client/v4/accounts?per_page=50",
  );
  const list = Array.isArray(accounts) ? accounts : [];
  if (list.length === 1) {
    return list[0].id;
  }
  const names = list.map((a) => `${a.name} (${a.id})`).join(", ");
  throw new Error(
    `Set CLOUDFLARE_ACCOUNT_ID. This token can see ${list.length} accounts${names ? `: ${names}` : ""}.`,
  );
}

async function ensureWorkersDevSubdomain(accountId, token) {
  if (!token) return null;
  try {
    const current = await cfApi(
      accountId,
      token,
      "GET",
      `/accounts/${accountId}/workers/subdomain`,
    );
    if (current?.subdomain) return current.subdomain;
  } catch (error) {
    if (error.status && error.status !== 404) {
      console.warn(`Could not read workers.dev subdomain: ${error.message}`);
    }
  }
  const desired =
    process.env.CLOUDFLARE_WORKERS_DEV_SUBDOMAIN || "crud-factory";
  try {
    const created = await cfApi(
      accountId,
      token,
      "PUT",
      `/accounts/${accountId}/workers/subdomain`,
      { subdomain: desired },
    );
    return created?.subdomain ?? desired;
  } catch (error) {
    console.warn(
      `Could not create workers.dev subdomain "${desired}": ${error.message}`,
    );
    return null;
  }
}

async function enableWorkersDev(accountId, token, workerName) {
  if (!token) return;
  try {
    await cfApi(
      accountId,
      token,
      "POST",
      `/accounts/${accountId}/workers/scripts/${workerName}/subdomain`,
      { enabled: true },
    );
  } catch (error) {
    // Older accounts use PUT; ignore if already enabled.
    try {
      await cfApi(
        accountId,
        token,
        "PUT",
        `/accounts/${accountId}/workers/scripts/${workerName}/subdomain`,
        { enabled: true },
      );
    } catch {
      console.warn(`Could not enable workers.dev for ${workerName}: ${error.message}`);
    }
  }
}

function accountIdFromWhoami(appDir) {
  const result = wrangler(appDir, ["whoami"], { allowFail: true });
  const match =
    result.combined.match(/Account ID[:\s|]+([a-f0-9]{32})/i) ||
    result.combined.match(/\b([a-f0-9]{32})\b/);
  return match ? match[1] : null;
}

function resolveRootDomain(registry) {
  return (
    process.env.ROOT_DOMAIN ||
    registry.rootDomain ||
    ""
  ).trim();
}

function listD1(appDir) {
  const result = wrangler(appDir, ["d1", "list", "--json"], { allowFail: true });
  if (result.status !== 0) {
    throw new Error(
      `wrangler d1 list failed. ${tokenPermissionsHint()}\n${result.combined.trim()}`,
    );
  }
  try {
    return JSON.parse(result.stdout || "[]");
  } catch {
    return [];
  }
}

function ensureD1(appDir, d1Name, dryRun) {
  if (dryRun) {
    console.log(`Would create D1 database ${d1Name} if missing`);
    return null;
  }
  const existing = findD1Id(listD1(appDir), d1Name);
  if (existing) {
    console.log(`D1 ${d1Name} already exists (${existing})`);
    return existing;
  }
  console.log(`Creating D1 database ${d1Name}…`);
  const created = wrangler(appDir, ["d1", "create", d1Name], { allowFail: true });
  const id = parseD1Id(created.stdout) || parseD1Id(created.combined);
  if (id) return id;
  const retry = findD1Id(listD1(appDir), d1Name);
  if (retry) return retry;
  throw new Error(
    `Could not create or look up D1 "${d1Name}".\n${created.combined.trim()}\n${tokenPermissionsHint()}`,
  );
}

function applyMigrations(appDir, d1Name, dryRun) {
  if (dryRun) {
    console.log(`Would apply D1 migrations for ${d1Name}`);
    return;
  }
  console.log(`Applying D1 migrations on ${d1Name}…`);
  wrangler(appDir, ["d1", "migrations", "apply", d1Name, "--remote"], {
    env: { ...process.env, CI: "true" },
  });
}

function secretNames(appDir) {
  const attempts = [
    ["secret", "list", "--json"],
    ["secret", "list", "--format", "json"],
    ["secret", "list"],
  ];
  for (const args of attempts) {
    const result = wrangler(appDir, args, { allowFail: true });
    if (result.status !== 0) continue;
    try {
      const parsed = JSON.parse(result.stdout || "[]");
      const rows = Array.isArray(parsed) ? parsed : [];
      const names = rows.map((row) => row?.name).filter(Boolean);
      if (names.length) return names;
    } catch {
      // table output
    }
    if (result.combined.includes("BETTER_AUTH_SECRET")) {
      return ["BETTER_AUTH_SECRET"];
    }
  }
  return [];
}

function putSecret(appDir, name, value, dryRun) {
  if (dryRun) {
    console.log(`Would set Worker secret ${name}`);
    return;
  }
  wrangler(appDir, ["secret", "put", name], { input: value });
}

function ensureAuthSecret(appDir, dryRun) {
  const fromEnv = process.env.BETTER_AUTH_SECRET?.trim();
  if (fromEnv) {
    console.log("Setting BETTER_AUTH_SECRET from BETTER_AUTH_SECRET env…");
    putSecret(appDir, "BETTER_AUTH_SECRET", fromEnv, dryRun);
    return;
  }
  const names = secretNames(appDir);
  if (names.includes("BETTER_AUTH_SECRET")) {
    console.log("BETTER_AUTH_SECRET already set");
    return;
  }
  const secret = randomBytes(32).toString("base64");
  console.log("Setting BETTER_AUTH_SECRET…");
  putSecret(appDir, "BETTER_AUTH_SECRET", secret, dryRun);
}

function verifyD1Schema(appDir, d1Name, dryRun) {
  if (dryRun) {
    console.log(`Would verify D1 schema on ${d1Name}`);
    return;
  }
  const result = wrangler(
    appDir,
    [
      "d1",
      "execute",
      d1Name,
      "--remote",
      "--command",
      "SELECT name FROM sqlite_master WHERE type='table' AND name='user'",
    ],
    { allowFail: true },
  );
  if (result.status !== 0 || !result.combined.includes("user")) {
    throw new Error(
      `D1 schema check failed for ${d1Name} (user table missing). Re-run migrations or check D1 permissions.\n${result.combined.trim()}`,
    );
  }
  console.log(`D1 schema OK on ${d1Name}`);
}

function deployApp(appDir, dryRun) {
  if (dryRun) {
    console.log(`Would run pnpm deploy in ${appDir}`);
    return "";
  }
  console.log("Deploying to Cloudflare Workers…");
  const result = run("pnpm", ["run", "deploy"], { cwd: appDir });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  return result.combined;
}

async function waitForUrl(url, { attempts = 10, delayMs = 2000 } = {}) {
  let lastError = new Error(`No response from ${url}`);
  for (let i = 0; i < attempts; i += 1) {
    try {
      const res = await fetch(url, { redirect: "manual" });
      if (res.status < 500) return res.status;
      lastError = new Error(`${url} returned HTTP ${res.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  throw lastError;
}

function writeGitHubOutput(values) {
  if (!process.env.GITHUB_OUTPUT) return;
  for (const [key, value] of Object.entries(values)) {
    if (value) appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
  }
}

function writeGitHubSummary(lines) {
  if (!process.env.GITHUB_STEP_SUMMARY) return;
  appendFileSync(
    process.env.GITHUB_STEP_SUMMARY,
    `${lines.filter(Boolean).join("\n")}\n`,
  );
}

async function checkIntegrations() {
  const token = process.env.CLOUDFLARE_API_TOKEN || "";
  const registry = loadRegistry();
  console.log("Registry apps:", registry.apps.map((a) => a.slug).join(", ") || "(none)");
  const probeDir = registry.apps[0]
    ? join(root, "apps", registry.apps[0].slug)
    : root;
  if (!process.env.CLOUDFLARE_ACCOUNT_ID) {
    const fromWhoami = existsSync(join(probeDir, "wrangler.jsonc"))
      ? accountIdFromWhoami(probeDir)
      : null;
    if (fromWhoami) process.env.CLOUDFLARE_ACCOUNT_ID = fromWhoami;
  }
  if (!token && !process.env.CLOUDFLARE_ACCOUNT_ID) {
    console.log("Cloudflare credentials: missing");
    console.log(tokenPermissionsHint());
    return { ok: false };
  }
  try {
    const accountId = await resolveAccountId(token);
    process.env.CLOUDFLARE_ACCOUNT_ID = accountId;
    const subdomain = token
      ? await ensureWorkersDevSubdomain(accountId, token)
      : null;
    const rootDomain = resolveRootDomain(registry);
    console.log(`Cloudflare account: ${accountId}`);
    console.log(`workers.dev subdomain: ${subdomain || "(unknown until first deploy)"}`);
    if (rootDomain) console.log(`Custom root domain: ${rootDomain}`);
    for (const app of registry.apps) {
      const urls = publicUrls({
        workerName: app.workerName,
        workersDevSubdomain: subdomain,
        subdomain: app.subdomain,
        rootDomain,
      });
      console.log(
        `  ${app.slug}: ${urls.canonical || "(deploy to get URL)"}`,
      );
    }
    return { ok: true, accountId, subdomain };
  } catch (error) {
    console.error(error.message);
    console.error(tokenPermissionsHint());
    return { ok: false };
  }
}

async function goLive(opts) {
  const registry = loadRegistry();
  const app = getApp(registry, opts.slug);
  const appDir = join(root, "apps", app.slug);
  if (!existsSync(appDir)) {
    throw new Error(`App directory missing: ${appDir}`);
  }

  if (!opts.dryRun && !process.env.CLOUDFLARE_ACCOUNT_ID) {
    const fromWhoami = accountIdFromWhoami(appDir);
    if (fromWhoami) process.env.CLOUDFLARE_ACCOUNT_ID = fromWhoami;
  }

  const token = process.env.CLOUDFLARE_API_TOKEN || "";
  if (!opts.dryRun && !token && !process.env.CLOUDFLARE_ACCOUNT_ID) {
    throw new Error(
      `Set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID, or run wrangler login.\n${tokenPermissionsHint()}`,
    );
  }

  const accountId = opts.dryRun
    ? process.env.CLOUDFLARE_ACCOUNT_ID || "dry-run-account"
    : await resolveAccountId(token);
  if (!opts.dryRun) process.env.CLOUDFLARE_ACCOUNT_ID = accountId;

  const workersDevSubdomain = opts.dryRun
    ? process.env.CLOUDFLARE_WORKERS_DEV_SUBDOMAIN || "crud-factory"
    : await ensureWorkersDevSubdomain(accountId, token);

  const rootDomain = resolveRootDomain(registry);
  const hostname = customHostname(app.subdomain, rootDomain);
  const urls = publicUrls({
    workerName: app.workerName,
    workersDevSubdomain,
    subdomain: app.subdomain,
    rootDomain,
  });

  const { path: wranglerPath, config } = loadWrangler(appDir);
  const trusted = [urls.workersDev, urls.custom].filter(Boolean);

  console.log(`App: ${app.slug} (${app.stack})`);
  console.log(`Worker: ${app.workerName}`);
  console.log(`D1: ${app.d1Database}`);
  if (urls.workersDev) console.log(`workers.dev: ${urls.workersDev}`);
  if (urls.custom) console.log(`custom domain: ${urls.custom}`);

  const databaseId = opts.dryRun
    ? app.d1DatabaseId || null
    : ensureD1(appDir, app.d1Database, opts.dryRun);

  const patched = patchWranglerConfig(config, {
    databaseId: databaseId || undefined,
    databaseName: app.d1Database,
    customHostname: hostname || undefined,
    authUrl: urls.canonical || undefined,
    trustedOrigins: trusted,
  });
  if (!opts.dryRun) {
    writeWrangler(wranglerPath, patched);
  } else {
    console.log("Would update wrangler.jsonc with workers_dev, D1 id, and public URL vars");
  }

  if (!opts.dryRun) {
    applyMigrations(appDir, app.d1Database, false);
    verifyD1Schema(appDir, app.d1Database, false);
  } else {
    console.log(`Would apply D1 migrations for ${app.d1Database}`);
  }

  if (opts.provisionOnly) {
    if (app.stack === "next-d1") {
      try {
        ensureAuthSecret(appDir, opts.dryRun);
      } catch (error) {
        console.warn(
          `Auth secret not set yet (Worker may not exist). Deploy with pnpm go-live ${app.slug}. (${error.message})`,
        );
      }
    }
    if (!opts.noWriteRegistry && databaseId) {
      upsertAppLaunch(registry, app.slug, { d1DatabaseId: databaseId });
      writeRegistry(registry);
    }
    return {
      slug: app.slug,
      provisioned: true,
      d1DatabaseId: databaseId,
      publicUrl: urls.canonical,
    };
  }

  if (app.stack === "next-d1" && !opts.dryRun) {
    ensureAuthSecret(appDir, false);
  }

  const deployOut = deployApp(appDir, opts.dryRun);
  const deployedUrl = parseWorkersDevUrl(deployOut);
  const workersDevUrl = urls.workersDev || deployedUrl;
  const publicUrl = urls.custom || workersDevUrl;

  if (!opts.dryRun) {
    await enableWorkersDev(accountId, token, app.workerName);
  }

  if (!opts.dryRun && !opts.skipHealth && workersDevUrl) {
    const authProbe = `${workersDevUrl}/api/auth/get-session`;
    console.log(`Checking auth API ${authProbe}…`);
    const authStatus = await waitForUrl(authProbe);
    console.log(`Auth API ready (HTTP ${authStatus})`);
    console.log(`Checking ${workersDevUrl}…`);
    const status = await waitForUrl(workersDevUrl);
    console.log(`Public URL ready (HTTP ${status}): ${workersDevUrl}`);
    if (urls.custom && urls.custom !== workersDevUrl) {
      try {
        const customStatus = await waitForUrl(urls.custom, {
          attempts: 8,
          delayMs: 3000,
        });
        console.log(`Custom domain ready (HTTP ${customStatus}): ${urls.custom}`);
      } catch (error) {
        console.warn(
          `Custom domain ${urls.custom} is not answering yet (${error.message}). SSL/DNS usually finishes within a few minutes.`,
        );
      }
    }
  }

  if (!opts.noWriteRegistry && !opts.dryRun) {
    upsertAppLaunch(registry, app.slug, {
      publicUrl,
      workersDevUrl,
      customDomain: hostname || undefined,
      d1DatabaseId: databaseId || undefined,
    });
    writeRegistry(registry);
  }

  writeGitHubOutput({
    public_url: publicUrl,
    workers_dev_url: workersDevUrl,
    custom_domain: hostname,
    slug: app.slug,
  });
  writeGitHubSummary([
    `## ${app.displayName || app.slug} is live`,
    publicUrl ? `- Public URL: ${publicUrl}` : null,
    workersDevUrl && workersDevUrl !== publicUrl
      ? `- workers.dev: ${workersDevUrl}`
      : null,
    hostname ? `- Custom domain: https://${hostname}` : null,
  ]);

  return {
    slug: app.slug,
    publicUrl,
    workersDevUrl,
    customDomain: hostname,
    d1DatabaseId: databaseId,
  };
}

const opts = parseArgs(process.argv.slice(2));
if (opts.check && !opts.slug) {
  const result = await checkIntegrations();
  process.exit(result.ok ? 0 : 1);
}
if (!opts.slug) usage(1);

try {
  const result = await goLive(opts);
  if (opts.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log("");
    console.log(
      result.publicUrl
        ? `Live: ${result.publicUrl}`
        : "Provisioned. Deploy with pnpm go-live <slug> to get a public URL.",
    );
    if (result.d1DatabaseId) {
      console.log(
        "Commit the updated wrangler.jsonc (D1 id) so later deploys skip the lookup.",
      );
    }
  }
} catch (error) {
  console.error(error.message || error);
  process.exit(1);
}
