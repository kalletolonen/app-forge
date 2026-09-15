import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import type { Db } from "@repo/database";
import * as schema from "@repo/database/schema";

export function originFromHeaders(headers: Headers): string | null {
  const host = headers.get("x-forwarded-host") ?? headers.get("host");
  if (!host) return null;
  const firstHost = host.split(",")[0]?.trim();
  if (!firstHost) return null;
  const protoHeader = headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const proto =
    protoHeader ||
    (firstHost.includes("localhost") || firstHost.startsWith("127.")
      ? "http"
      : "https");
  return `${proto}://${firstHost}`;
}

export function originFromRequest(request: Request): string | null {
  const fromHeaders = originFromHeaders(request.headers);
  if (fromHeaders) return fromHeaders;
  try {
    return new URL(request.url).origin;
  } catch {
    return null;
  }
}

/** Cloudflare Worker bindings / local .env overrides for auth. */
export type AuthEnv = {
  BETTER_AUTH_SECRET?: string;
  BETTER_AUTH_URL?: string;
  BETTER_AUTH_TRUSTED_ORIGINS?: string;
};

function readAuthEnv(overrides?: AuthEnv) {
  return {
    secret:
      overrides?.BETTER_AUTH_SECRET?.trim() ??
      process.env.BETTER_AUTH_SECRET?.trim() ??
      "",
    authUrl: overrides?.BETTER_AUTH_URL ?? process.env.BETTER_AUTH_URL ?? "",
    trustedOrigins:
      overrides?.BETTER_AUTH_TRUSTED_ORIGINS ??
      process.env.BETTER_AUTH_TRUSTED_ORIGINS ??
      "",
  };
}

export function trustedOrigins(
  baseURL: string,
  overrides?: AuthEnv,
): string[] {
  const extra = readAuthEnv(overrides).trustedOrigins
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return [...new Set([baseURL, ...extra])];
}

function resolveBaseURL(
  origin?: string | Request | null,
  overrides?: AuthEnv,
): string {
  if (typeof origin === "string" && origin) {
    return origin.replace(/\/$/, "");
  }
  if (origin && typeof origin === "object") {
    const fromRequest = originFromRequest(origin);
    if (fromRequest) return fromRequest;
  }
  const fromEnv = readAuthEnv(overrides).authUrl;
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  throw new Error(
    "Could not determine auth base URL. Open the Worker on its public URL, set BETTER_AUTH_URL, or run `pnpm go-live <slug>`.",
  );
}

function buildAuth(db: Db, baseURL: string, overrides?: AuthEnv) {
  const secret = readAuthEnv(overrides).secret;
  if (!secret) {
    throw new Error(
      "BETTER_AUTH_SECRET must be set. For production run `pnpm go-live <slug>`; for local copy .env.example to apps/<slug>/.env.local.",
    );
  }

  return betterAuth({
    secret,
    baseURL,
    trustedOrigins: trustedOrigins(baseURL, overrides),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
    },
    database: drizzleAdapter(db, {
      provider: "sqlite",
      schema: {
        user: schema.user,
        session: schema.session,
        account: schema.account,
        verification: schema.verification,
      },
    }),
  });
}

type AuthInstance = ReturnType<typeof buildAuth>;

const authByDb = new WeakMap<Db, Map<string, AuthInstance>>();

export function getAuth(
  db: Db,
  origin?: string | Request | null,
  env?: AuthEnv,
): AuthInstance {
  const baseURL = resolveBaseURL(origin, env);
  let byUrl = authByDb.get(db);
  if (!byUrl) {
    byUrl = new Map();
    authByDb.set(db, byUrl);
  }
  const cached = byUrl.get(baseURL);
  if (cached) {
    return cached;
  }
  const instance = buildAuth(db, baseURL, env);
  byUrl.set(baseURL, instance);
  return instance;
}
