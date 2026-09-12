import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1";
import { drizzle as drizzleLibsql } from "drizzle-orm/libsql";
import { createClient, type Client } from "@libsql/client";
import * as schema from "./schema";

export type AppDb = DrizzleD1Database<typeof schema>;

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

export function createDbFromD1(d1: D1Database): AppDb {
  return drizzle(d1, { schema });
}

export function createDbLocal(): ReturnType<typeof drizzleLibsql<typeof schema>> {
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

export type Db = AppDb | ReturnType<typeof createDbLocal>;
