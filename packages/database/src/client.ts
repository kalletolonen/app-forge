import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "./schema";

export type AppDb = DrizzleD1Database<typeof schema>;

/** Production / Cloudflare Workers — D1 only (no Node libsql in this module). */
export function createDbFromD1(d1: D1Database): AppDb {
  return drizzle(d1, { schema });
}

export type Db = AppDb;
