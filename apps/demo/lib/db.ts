import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDbFromD1, createDbLocal, type Db } from "@repo/database";

function dbBinding(env: unknown): D1Database | undefined {
  return (env as { DB?: D1Database }).DB;
}

export async function getDb(): Promise<Db> {
  try {
    const { env } = getCloudflareContext();
    const d1 = dbBinding(env);
    if (d1) return createDbFromD1(d1);
  } catch {
    // sync context unavailable outside a Worker request
  }

  try {
    const { env } = await getCloudflareContext({ async: true });
    const d1 = dbBinding(env);
    if (d1) return createDbFromD1(d1);
  } catch {
    // next dev without a request context
  }

  if (process.env.NODE_ENV === "development") {
    return createDbLocal();
  }

  throw new Error(
    "D1 binding DB is not available on this request. Deploy to Cloudflare Workers with a DB binding.",
  );
}
