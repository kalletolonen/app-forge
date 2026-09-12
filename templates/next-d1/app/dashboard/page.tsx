import Link from "next/link";
import { redirect } from "next/navigation";
import { eq, desc, and } from "drizzle-orm";
import { records } from "@repo/database/schema";
import { getDb } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { DeleteRecordButton } from "./delete-button";

const appId = process.env.APP_ID ?? "demo";

export default async function DashboardPage() {
  const session = await requireSession();
  if (!session) {
    redirect("/login");
  }

  const db = await getDb();
  const rows = await db
    .select()
    .from(records)
    .where(and(eq(records.userId, session.user.id), eq(records.appId, appId)))
    .orderBy(desc(records.updatedAt));

  const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "Demo";

  return (
    <main className="container">
      <header className="nav">
        <div>
          <div className="badge">{appName}</div>
          <p className="muted" style={{ margin: "0.25rem 0 0" }}>
            Signed in as {session.user.email}
          </p>
        </div>
        <Link className="btn secondary" href="/records/new">New record</Link>
      </header>

      <section className="card">
        <h1 style={{ marginTop: 0, fontSize: "1.35rem" }}>Your records</h1>
        {rows.length === 0 ? (
          <p className="muted">
            No records yet.{" "}
            <Link href="/records/new">Add your first one</Link>.
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Updated</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <Link href={`/records/${row.id}`}>{row.title}</Link>
                    {row.notes ? (
                      <div className="muted" style={{ fontSize: "0.85rem" }}>
                        {row.notes}
                      </div>
                    ) : null}
                  </td>
                  <td className="muted" style={{ fontSize: "0.9rem" }}>
                    {row.updatedAt.toLocaleString()}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <DeleteRecordButton id={row.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
