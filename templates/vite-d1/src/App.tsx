import { useEffect, useState } from "react";

type RecordRow = {
  id: string;
  title: string;
  notes: string | null;
  updatedAt: string;
};

export function App() {
  const [rows, setRows] = useState<RecordRow[]>([]);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/records");
    if (!res.ok) {
      setError("Could not load records");
      return;
    }
    setRows(await res.json());
  }

  useEffect(() => {
    load().catch(() => setError("Could not load records"));
  }, []);

  async function onCreate(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const res = await fetch("/api/records", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title, notes, userId: "public" }),
    });
    if (!res.ok) {
      setError("Could not create record");
      return;
    }
    setTitle("");
    setNotes("");
    await load();
  }

  async function onDelete(id: string) {
    await fetch(`/api/records/${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <main>
      <div className="card">
        <h1>DISPLAY_NAME</h1>
        <p style={{ color: "#64748b" }}>
          Vite + Hono on Cloudflare Workers. Add auth before going live.
        </p>
        <form onSubmit={onCreate}>
          <label>
            Title
            <input value={title} onChange={(e) => setTitle(e.target.value)} required />
          </label>
          <label>
            Notes
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
          <p>
            <button type="submit">Add record</button>
          </p>
        </form>
        {error ? <p style={{ color: "#dc2626" }}>{error}</p> : null}
        <ul>
          {rows.map((row) => (
            <li key={row.id} style={{ marginTop: "0.75rem" }}>
              <strong>{row.title}</strong>
              {row.notes ? <div>{row.notes}</div> : null}
              <button type="button" onClick={() => onDelete(row.id)} style={{ marginLeft: 8 }}>
                Delete
              </button>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
