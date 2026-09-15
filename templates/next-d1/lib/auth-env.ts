import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { AuthEnv } from "@repo/auth";

function pickAuthEnv(env: Record<string, unknown>): AuthEnv {
  return {
    BETTER_AUTH_SECRET:
      typeof env.BETTER_AUTH_SECRET === "string"
        ? env.BETTER_AUTH_SECRET
        : undefined,
    BETTER_AUTH_URL:
      typeof env.BETTER_AUTH_URL === "string" ? env.BETTER_AUTH_URL : undefined,
    BETTER_AUTH_TRUSTED_ORIGINS:
      typeof env.BETTER_AUTH_TRUSTED_ORIGINS === "string"
        ? env.BETTER_AUTH_TRUSTED_ORIGINS
        : undefined,
  };
}

/** Worker secrets and vars from the Cloudflare binding (not always on process.env). */
export async function loadAuthEnv(): Promise<AuthEnv> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    return pickAuthEnv(env as Record<string, unknown>);
  } catch {
    return {};
  }
}

/** Sync context for dynamic routes (API handlers). */
export function loadAuthEnvSync(): AuthEnv {
  try {
    return pickAuthEnv(getCloudflareContext().env as Record<string, unknown>);
  } catch {
    return {};
  }
}
