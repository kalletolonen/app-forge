/**
 * Pure helpers for going live on Cloudflare (Workers + D1 + public URL).
 * Kept free of network I/O so unit tests do not need credentials.
 */

export const PLACEHOLDER_D1_ID = "REPLACE_AFTER_PROVISION";

export const CLOUDFLARE_TOKEN_PERMISSIONS = {
  account: [
    "Account Settings: Read",
    "Workers Scripts: Edit",
    "D1: Edit",
  ],
  zone: [
    "DNS: Edit",
    "SSL and Certificates: Edit",
    "Workers Routes: Edit",
  ],
};

export function loadRegistryFromJson(json) {
  if (!json || !Array.isArray(json.apps)) {
    throw new Error("apps.registry.json is missing an apps array");
  }
  return json;
}

export function getApp(registry, slug) {
  const app = registry.apps.find((a) => a.slug === slug);
  if (!app) {
    const known = registry.apps.map((a) => a.slug).join(", ") || "(none)";
    throw new Error(`Unknown slug "${slug}". Known apps: ${known}`);
  }
  return app;
}

export function publicUrls({
  workerName,
  workersDevSubdomain,
  subdomain,
  rootDomain,
}) {
  const workersDev = workersDevSubdomain
    ? `https://${workerName}.${workersDevSubdomain}.workers.dev`
    : null;
  const custom =
    rootDomain && subdomain
      ? `https://${subdomain}.${String(rootDomain).replace(/^https?:\/\//, "").replace(/\/$/, "")}`
      : null;
  return {
    workersDev,
    custom,
    canonical: custom ?? workersDev,
  };
}

export function parseWorkersDevUrl(text) {
  const match = String(text).match(
    /https:\/\/[a-z0-9-]+\.[a-z0-9-]+\.workers\.dev/i,
  );
  return match ? match[0].replace(/\/$/, "") : null;
}

export function parseD1Id(output) {
  if (output && typeof output === "object") {
    return (
      output.uuid ??
      output.id ??
      output.database_id ??
      parseD1Id(output.result ?? output.database ?? null)
    );
  }
  if (output == null || output === "") {
    return null;
  }
  const text = String(output);
  try {
    return parseD1Id(JSON.parse(text));
  } catch {
    const quoted =
      text.match(/database_id\s*=\s*"([^"]+)"/) ||
      text.match(/"uuid"\s*:\s*"([^"]+)"/) ||
      text.match(/"database_id"\s*:\s*"([^"]+)"/);
    return quoted ? quoted[1] : null;
  }
}

export function findD1Id(list, name) {
  if (!list) {
    return null;
  }
  const rows = Array.isArray(list)
    ? list
    : (list.databases ?? list.result ?? list.d1_databases ?? []);
  if (!Array.isArray(rows)) {
    return parseD1Id(list);
  }
  const row = rows.find((r) => r && r.name === name);
  return row ? parseD1Id(row) : null;
}

export function patchWranglerConfig(config, options = {}) {
  const next = structuredClone(config);
  next.workers_dev = true;
  next.preview_urls = true;
  next.observability = {
    enabled: true,
    ...(next.observability ?? {}),
  };

  if (options.databaseId) {
    for (const db of next.d1_databases ?? []) {
      if (
        !options.databaseName ||
        db.database_name === options.databaseName
      ) {
        db.database_id = options.databaseId;
      }
    }
  }

  if (options.customHostname) {
    const routes = Array.isArray(next.routes) ? [...next.routes] : [];
    if (!routes.some((r) => r.pattern === options.customHostname)) {
      routes.push({
        pattern: options.customHostname,
        custom_domain: true,
      });
    }
    next.routes = routes;
  }

  next.vars = { ...(next.vars ?? {}) };
  if (options.authUrl) {
    next.vars.BETTER_AUTH_URL = options.authUrl;
    next.vars.NEXT_PUBLIC_BETTER_AUTH_URL = options.authUrl;
  }
  if (options.trustedOrigins?.length) {
    next.vars.BETTER_AUTH_TRUSTED_ORIGINS = options.trustedOrigins.join(",");
  }
  return next;
}

export function detectChangedApps(apps, changedFiles) {
  const known = new Set(apps.map((a) => a.slug));
  const slugs = new Set();
  let all = false;
  for (const file of changedFiles) {
    const normalized = String(file).replaceAll("\\", "/");
    const appMatch = normalized.match(/^apps\/([^/]+)\//);
    if (appMatch && known.has(appMatch[1])) {
      slugs.add(appMatch[1]);
    }
    if (
      normalized.startsWith("packages/") ||
      normalized === "pnpm-lock.yaml" ||
      normalized === "apps.registry.json" ||
      normalized.startsWith("scripts/go-live") ||
      normalized.startsWith("scripts/lib/") ||
      normalized.startsWith("scripts/provision-cloudflare")
    ) {
      all = true;
    }
  }
  if (all) {
    return apps.map((a) => a.slug);
  }
  return apps.map((a) => a.slug).filter((slug) => slugs.has(slug));
}

export function upsertAppLaunch(registry, slug, launch) {
  const app = getApp(registry, slug);
  if (launch.publicUrl) app.publicUrl = launch.publicUrl;
  if (launch.workersDevUrl) app.workersDevUrl = launch.workersDevUrl;
  if (launch.customDomain) app.customDomain = launch.customDomain;
  if (launch.d1DatabaseId) app.d1DatabaseId = launch.d1DatabaseId;
  return registry;
}

export function customHostname(subdomain, rootDomain) {
  if (!rootDomain || !subdomain) return null;
  return `${subdomain}.${String(rootDomain)
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "")}`;
}

export function needsD1Id(config, databaseName) {
  const db = (config.d1_databases ?? []).find(
    (row) => !databaseName || row.database_name === databaseName,
  );
  return !db?.database_id || db.database_id === PLACEHOLDER_D1_ID;
}
