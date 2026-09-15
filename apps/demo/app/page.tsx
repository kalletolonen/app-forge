import Link from "next/link";
import { redirect } from "next/navigation";
import { optionalSession } from "@/lib/session";

export default async function HomePage() {
  const session = await optionalSession();
  if (session) {
    redirect("/dashboard");
  }

  const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "Demo";

  return (
    <main className="container" style={{ padding: "3rem 0" }}>
      <div className="card stack">
        <span className="badge">Cloudflare · D1 · SSL</span>
        <h1 style={{ margin: 0, fontSize: "2rem" }}>{appName}</h1>
        <p className="muted" style={{ margin: 0, maxWidth: "52ch" }}>
          Customer-facing CRUD workspace. Each app gets its own D1 database,
          HTTPS URL, and auth — deployed from this monorepo.
        </p>
        <div className="row">
          <Link className="btn" href="/signup">Create account</Link>
          <Link className="btn secondary" href="/login">Sign in</Link>
        </div>
      </div>
    </main>
  );
}
