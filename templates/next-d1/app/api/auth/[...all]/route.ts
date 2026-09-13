import { getAuth } from "@repo/auth";
import { toNextJsHandler } from "better-auth/next-js";
import { getDb } from "@/lib/db";

export async function GET(request: Request) {
  const db = await getDb();
  const auth = getAuth(db, request);
  const { GET: handler } = toNextJsHandler(auth);
  return handler(request);
}

export async function POST(request: Request) {
  const db = await getDb();
  const auth = getAuth(db, request);
  const { POST: handler } = toNextJsHandler(auth);
  return handler(request);
}
