import Link from "next/link";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="container" style={{ padding: "2.5rem 0" }}>
      <div className="card stack" style={{ maxWidth: 420, margin: "0 auto" }}>
        <h1 style={{ margin: 0, fontSize: "1.5rem" }}>Sign in</h1>
        <p className="muted" style={{ margin: 0 }}>
          Use the email and password you registered with.
        </p>
        <LoginForm />
        <p className="muted" style={{ margin: 0, fontSize: "0.9rem" }}>
          No account? <Link href="/signup">Create one</Link>
        </p>
      </div>
    </main>
  );
}
