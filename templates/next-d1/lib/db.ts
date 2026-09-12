import { createDbFromD1, createDbLocal, type Db } from "@repo/database";

export async function getDb(): Promise<Db> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const { env } = await getCloudflareContext({ async: true });
    const d1 = (env as { DB?: D1Database }).DB;
    if (d1) {
      return createDbFromD1(d1);
    }
  } catch {
    // next dev / Node
  }

  return createDbLocal();
}
