import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { eq, and } from "drizzle-orm";
import { records } from "@repo/database/schema";
import { getDb } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { updateRecord } from "@/lib/actions";

const appId = process.env.APP_ID ?? "demo";

export default async function EditRecordPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  if (!session) {
    redirect("/login");
  }

  const { id } = await params;
  const db = await getDb();
  const [row] = await db
    .select()
    .from(records)
    .where(
      and(
        eq(records.id, id),
        eq(records.userId, session.user.id),
        eq(records.appId, appId),
      ),
    );

  if (!row) {
    notFound();
  }

  const boundUpdate = updateRecord.bind(null, id);

  return (
    <main className="container" style={{ padding: "2rem 0" }}>
      <div className="card stack" style={{ maxWidth: 520, margin: "0 auto" }}>
        <Link className="muted" href="/dashboard" style={{ fontSize: "0.9rem" }}>
          ← Back to dashboard
        </Link>
        <h1 style={{ margin: 0, fontSize: "1.35rem" }}>Edit record</h1>
        <form action={boundUpdate} className="stack">
          <div className="field">
            <label htmlFor="title">Title</label>
            <input
              id="title"
              name="title"
              required
              maxLength={200}
              defaultValue={row.title}
            />
          </div>
          <div className="field">
            <label htmlFor="notes">Notes</label>
            <textarea
              id="notes"
              name="notes"
              maxLength={4000}
              defaultValue={row.notes ?? ""}
            />
          </div>
          <button className="btn" type="submit">Save changes</button>
        </form>
      </div>
    </main>
  );
}
