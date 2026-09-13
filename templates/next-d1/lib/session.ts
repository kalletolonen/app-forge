import { headers } from "next/headers";
import { getAuth, originFromHeaders } from "@repo/auth";
import { getDb } from "./db";

export async function requireSession() {
  const db = await getDb();
  const requestHeaders = await headers();
  const auth = getAuth(db, originFromHeaders(requestHeaders));
  const session = await auth.api.getSession({
    headers: requestHeaders,
  });
  if (!session?.user) {
    return null;
  }
  return session;
}
