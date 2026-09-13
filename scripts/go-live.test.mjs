import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  PLACEHOLDER_D1_ID,
  customHostname,
  detectChangedApps,
  findD1Id,
  getApp,
  loadRegistryFromJson,
  needsD1Id,
  parseD1Id,
  parseWorkersDevUrl,
  patchWranglerConfig,
  publicUrls,
  upsertAppLaunch,
} from "./lib/go-live-config.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const registry = loadRegistryFromJson({
  platform: "cloudflare",
  maxApps: 10,
  apps: [
    {
      slug: "demo",
      stack: "next-d1",
      workerName: "crud-demo",
      d1Database: "crud-demo",
      subdomain: "demo",
    },
    {
      slug: "shop",
      stack: "vite-d1",
      workerName: "crud-shop",
      d1Database: "crud-shop",
      subdomain: "shop",
    },
  ],
});

describe("publicUrls", () => {
  it("uses workers.dev immediately when the account subdomain is known", () => {
    const urls = publicUrls({
      workerName: "crud-demo",
      workersDevSubdomain: "acme",
      subdomain: "demo",
      rootDomain: "",
    });
    assert.equal(urls.workersDev, "https://crud-demo.acme.workers.dev");
    assert.equal(urls.custom, null);
    assert.equal(urls.canonical, "https://crud-demo.acme.workers.dev");
  });

  it("prefers a custom domain when ROOT_DOMAIN is set", () => {
    const urls = publicUrls({
      workerName: "crud-demo",
      workersDevSubdomain: "acme",
      subdomain: "demo",
      rootDomain: "https://example.com/",
    });
    assert.equal(urls.custom, "https://demo.example.com");
    assert.equal(urls.canonical, "https://demo.example.com");
    assert.equal(urls.workersDev, "https://crud-demo.acme.workers.dev");
  });
});

describe("parse helpers", () => {
  it("extracts a workers.dev URL from wrangler deploy output", () => {
    const text = `
Published crud-demo (1.0.0)
  https://crud-demo.acme.workers.dev
Current Version ID: abc
`;
    assert.equal(
      parseWorkersDevUrl(text),
      "https://crud-demo.acme.workers.dev",
    );
  });

  it("parses D1 ids from json, uuid objects, and wrangler text", () => {
    assert.equal(parseD1Id({ uuid: "111" }), "111");
    assert.equal(parseD1Id({ database_id: "222" }), "222");
    assert.equal(
      parseD1Id('[[d1_databases]]\ndatabase_id = "333"\n'),
      "333",
    );
    assert.equal(
      findD1Id(
        [
          { name: "other", uuid: "aaa" },
          { name: "crud-demo", uuid: "bbb" },
        ],
        "crud-demo",
      ),
      "bbb",
    );
  });
});

describe("patchWranglerConfig", () => {
  it("keeps workers.dev enabled when attaching a custom domain", () => {
    const patched = patchWranglerConfig(
      {
        name: "crud-demo",
        d1_databases: [
          {
            binding: "DB",
            database_name: "crud-demo",
            database_id: PLACEHOLDER_D1_ID,
          },
        ],
        vars: { APP_ID: "demo" },
      },
      {
        databaseId: "db-123",
        databaseName: "crud-demo",
        customHostname: "demo.example.com",
        authUrl: "https://demo.example.com",
        trustedOrigins: [
          "https://crud-demo.acme.workers.dev",
          "https://demo.example.com",
        ],
      },
    );
    assert.equal(patched.workers_dev, true);
    assert.equal(patched.preview_urls, true);
    assert.equal(patched.observability.enabled, true);
    assert.equal(patched.d1_databases[0].database_id, "db-123");
    assert.deepEqual(patched.routes, [
      { pattern: "demo.example.com", custom_domain: true },
    ]);
    assert.equal(patched.vars.BETTER_AUTH_URL, "https://demo.example.com");
    assert.match(
      patched.vars.BETTER_AUTH_TRUSTED_ORIGINS,
      /workers\.dev/,
    );
  });

  it("detects placeholder D1 ids", () => {
    assert.equal(
      needsD1Id({
        d1_databases: [{ database_name: "crud-demo", database_id: PLACEHOLDER_D1_ID }],
      }, "crud-demo"),
      true,
    );
    assert.equal(
      needsD1Id({
        d1_databases: [{ database_name: "crud-demo", database_id: "real" }],
      }, "crud-demo"),
      false,
    );
  });
});

describe("detectChangedApps", () => {
  it("deploys only the app whose files changed", () => {
    assert.deepEqual(
      detectChangedApps(registry.apps, ["apps/shop/src/index.ts"]),
      ["shop"],
    );
  });

  it("deploys every app when shared packages change", () => {
    assert.deepEqual(
      detectChangedApps(registry.apps, ["packages/database/src/schema.ts"]),
      ["demo", "shop"],
    );
  });
});

describe("wrangler configs", () => {
  it("keep workers.dev enabled so deploy yields a public URL", () => {
    for (const rel of [
      "apps/demo/wrangler.jsonc",
      "templates/next-d1/wrangler.jsonc",
      "templates/vite-d1/wrangler.jsonc",
      "templates/hono-d1/wrangler.jsonc",
    ]) {
      const config = JSON.parse(readFileSync(join(root, rel), "utf8"));
      assert.equal(config.workers_dev, true, rel);
      assert.equal(config.observability?.enabled, true, rel);
    }
  });
});

describe("registry", () => {
  it("looks up apps and records launch URLs", () => {
    const app = getApp(registry, "demo");
    assert.equal(app.workerName, "crud-demo");
    assert.equal(customHostname("demo", "example.com"), "demo.example.com");
    const next = structuredClone(registry);
    upsertAppLaunch(next, "demo", {
      publicUrl: "https://crud-demo.acme.workers.dev",
      d1DatabaseId: "db-123",
    });
    assert.equal(next.apps[0].publicUrl, "https://crud-demo.acme.workers.dev");
    assert.equal(next.apps[0].d1DatabaseId, "db-123");
    assert.throws(() => getApp(registry, "nope"), /Unknown slug/);
  });
});
