import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import type { Db } from "@repo/database";
import * as schema from "@repo/database/schema";

function buildAuth(db: Db) {
  const secret = process.env.BETTER_AUTH_SECRET;
  const baseURL = process.env.BETTER_AUTH_URL;
  if (!secret || !baseURL) {
    throw new Error("BETTER_AUTH_SECRET and BETTER_AUTH_URL must be set");
  }

  return betterAuth({
    secret,
    baseURL,
    trustedOrigins: [baseURL],
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

const authByDb = new WeakMap<Db, AuthInstance>();

export function getAuth(db: Db): AuthInstance {
  const cached = authByDb.get(db);
  if (cached) {
    return cached;
  }
  const instance = buildAuth(db);
  authByDb.set(db, instance);
  return instance;
}
