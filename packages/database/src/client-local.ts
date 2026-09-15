import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { createClient, type Client } from "@libsql/client";
import { drizzle as drizzleLibsql } from "drizzle-orm/libsql";
import * as schema from "./schema";

const globalForLibsql = globalThis as unknown as {
  libsql: Client | undefined;
};

function getLocalSqliteUrl(): string {
  const fromEnv = process.env.LOCAL_DATABASE_URL;
  if (fromEnv) {
    return fromEnv;
  }
  const appSlug = process.env.APP_ID ?? "demo";
  const dir = join(process.cwd(), ".data");
  mkdirSync(dir, { recursive: true });
  return `file:${join(dir, `${appSlug}.sqlite`)}`;
}

/** Local dev / Node only — do not import from Worker bundles. */
export function createDbLocal() {
  const client =
    globalForLibsql.libsql ??
    createClient({
      url: getLocalSqliteUrl(),
    });
  if (process.env.NODE_ENV !== "production") {
    globalForLibsql.libsql = client;
  }
  return drizzleLibsql(client, { schema });
}
