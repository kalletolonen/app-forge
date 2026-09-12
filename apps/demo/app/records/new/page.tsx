import Link from "next/link";
import { redirect } from "next/navigation";
import { createRecord } from "@/lib/actions";
import { requireSession } from "@/lib/session";

export default async function NewRecordPage() {
  const session = await requireSession();
  if (!session) {
    redirect("/login");
  }

  return (
    <main className="container" style={{ padding: "2rem 0" }}>
      <div className="card stack" style={{ maxWidth: 520, margin: "0 auto" }}>
        <Link className="muted" href="/dashboard" style={{ fontSize: "0.9rem" }}>
          ← Back to dashboard
        </Link>
        <h1 style={{ margin: 0, fontSize: "1.35rem" }}>New record</h1>
        <form action={createRecord} className="stack">
          <div className="field">
            <label htmlFor="title">Title</label>
            <input id="title" name="title" required maxLength={200} />
          </div>
          <div className="field">
            <label htmlFor="notes">Notes</label>
            <textarea id="notes" name="notes" maxLength={4000} />
          </div>
          <button className="btn" type="submit">Save</button>
        </form>
      </div>
    </main>
  );
}
