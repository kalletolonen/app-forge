import { headers } from "next/headers";
import { getAuth } from "@repo/auth";
import { getDb } from "./db";

export async function requireSession() {
  const db = await getDb();
  const auth = await getAuth(db);
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user) {
    return null;
  }
  return session;
}
