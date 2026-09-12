import { Hono } from "hono";
import { serveStatic } from "hono/cloudflare-workers";
import { eq, and, desc } from "drizzle-orm";
import { createDbFromD1 } from "@repo/database";
import { records } from "@repo/database/schema";

type Env = {
  DB: D1Database;
  APP_ID: string;
  ASSETS: Fetcher;
};

const app = new Hono<{ Bindings: Env }>();

app.get("/health", (c) => c.json({ ok: true, app: c.env.APP_ID }));

app.get("/api/records", async (c) => {
  const db = createDbFromD1(c.env.DB);
  const rows = await db
    .select()
    .from(records)
    .where(eq(records.appId, c.env.APP_ID))
    .orderBy(desc(records.updatedAt));
  return c.json(rows);
});

app.post("/api/records", async (c) => {
  const body = await c.req.json<{ title?: string; notes?: string; userId?: string }>();
  const title = body.title?.trim();
  if (!title) {
    return c.json({ error: "title is required" }, 400);
  }
  const userId = body.userId?.trim() || "public";
  const db = createDbFromD1(c.env.DB);
  const [row] = await db
    .insert(records)
    .values({
      appId: c.env.APP_ID,
      userId,
      title,
      notes: body.notes?.trim() || null,
    })
    .returning();
  return c.json(row, 201);
});

app.delete("/api/records/:id", async (c) => {
  const id = c.req.param("id");
  const db = createDbFromD1(c.env.DB);
  await db
    .delete(records)
    .where(and(eq(records.id, id), eq(records.appId, c.env.APP_ID)));
  return c.body(null, 204);
});

app.get("*", (c) => serveStatic({ root: "./" })(c));

export default app;
