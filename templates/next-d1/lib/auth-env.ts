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

function mergeAuthEnv(binding: AuthEnv): AuthEnv {
  return {
    BETTER_AUTH_SECRET:
      binding.BETTER_AUTH_SECRET?.trim() ||
      process.env.BETTER_AUTH_SECRET?.trim() ||
      undefined,
    BETTER_AUTH_URL:
      binding.BETTER_AUTH_URL ?? process.env.BETTER_AUTH_URL ?? undefined,
    BETTER_AUTH_TRUSTED_ORIGINS:
      binding.BETTER_AUTH_TRUSTED_ORIGINS ??
      process.env.BETTER_AUTH_TRUSTED_ORIGINS ??
      undefined,
  };
}

function bindingFromContext(env: Record<string, unknown>): AuthEnv {
  return pickAuthEnv(env);
}

/** Worker secrets and vars (OpenNext also copies string bindings onto process.env per request). */
export async function loadAuthEnv(): Promise<AuthEnv> {
  try {
    const { env } = getCloudflareContext();
    return mergeAuthEnv(bindingFromContext(env as Record<string, unknown>));
  } catch {
    try {
      const { env } = await getCloudflareContext({ async: true });
      return mergeAuthEnv(bindingFromContext(env as Record<string, unknown>));
    } catch {
      return mergeAuthEnv({});
    }
  }
}

/** Sync context for dynamic routes (API handlers). */
export function loadAuthEnvSync(): AuthEnv {
  try {
    return mergeAuthEnv(
      bindingFromContext(getCloudflareContext().env as Record<string, unknown>),
    );
  } catch {
    return mergeAuthEnv({});
  }
}
