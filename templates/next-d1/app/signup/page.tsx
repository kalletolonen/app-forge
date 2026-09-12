import Link from "next/link";
import { SignupForm } from "./signup-form";

export default function SignupPage() {
  return (
    <main className="container" style={{ padding: "2.5rem 0" }}>
      <div className="card stack" style={{ maxWidth: 420, margin: "0 auto" }}>
        <h1 style={{ margin: 0, fontSize: "1.5rem" }}>Create account</h1>
        <p className="muted" style={{ margin: 0 }}>
          Your data stays in this app&apos;s isolated D1 database.
        </p>
        <SignupForm />
        <p className="muted" style={{ margin: 0, fontSize: "0.9rem" }}>
          Already registered? <Link href="/login">Sign in</Link>
        </p>
      </div>
    </main>
  );
}
