#!/usr/bin/env node
/**
 * Print `apps=["slug"]` for GitHub Actions matrices.
 *
 * Env:
 *   INPUT_SLUG          workflow_dispatch slug (wins)
 *   GITHUB_EVENT_NAME   workflow_dispatch with no slug → all apps
 *   EVENT_BEFORE        github.event.before
 *   GITHUB_SHA          github.sha
 */
import { appendFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  detectChangedApps,
  loadRegistryFromJson,
} from "./lib/go-live-config.mjs";
import { readFileSync } from "node:fs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const registry = loadRegistryFromJson(
  JSON.parse(readFileSync(join(root, "apps.registry.json"), "utf8")),
);
const known = new Set(registry.apps.map((app) => app.slug));

function git(args) {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
  return {
    ok: result.status === 0,
    lines: (result.stdout || "")
      .trim()
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean),
  };
}

function changedFiles(before, sha) {
  const emptyBefore = !before || /^0+$/.test(before);
  if (emptyBefore) {
    const shown = git(["show", "--name-only", "--pretty=", sha]);
    if (shown.ok) return shown.lines;
  } else {
    const diff = git(["diff", "--name-only", before, sha]);
    if (diff.ok) return diff.lines;
  }
  return git(["diff", "--name-only", "HEAD"]).lines;
}

const inputSlug = (process.env.INPUT_SLUG || "").trim();
const eventName = process.env.GITHUB_EVENT_NAME || "";
let apps;

if (inputSlug) {
  if (!known.has(inputSlug)) {
    console.error(
      `Unknown slug "${inputSlug}". Known: ${[...known].join(", ")}`,
    );
    process.exit(1);
  }
  apps = [inputSlug];
} else if (eventName === "workflow_dispatch") {
  apps = registry.apps.map((app) => app.slug);
} else {
  const files = changedFiles(
    process.env.EVENT_BEFORE || "",
    process.env.GITHUB_SHA || "HEAD",
  );
  apps = detectChangedApps(registry.apps, files);
}

const payload = JSON.stringify(apps);
if (process.env.GITHUB_OUTPUT) {
  appendFileSync(
    process.env.GITHUB_OUTPUT,
    `apps<<EOF\n${payload}\nEOF\n`,
  );
}
console.log(`apps=${payload}`);
