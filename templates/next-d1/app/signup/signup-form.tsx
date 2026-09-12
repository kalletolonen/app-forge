"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createAppAuthClient } from "@repo/auth/client";

const auth = createAppAuthClient(
  process.env.NEXT_PUBLIC_BETTER_AUTH_URL ?? "http://127.0.0.1:43123",
);

export function SignupForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name"));
    const email = String(form.get("email"));
    const password = String(form.get("password"));

    const result = await auth.signUp.email({ name, email, password });
    setPending(false);

    if (result.error) {
      setError(result.error.message ?? "Could not create account");
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form className="stack" onSubmit={onSubmit}>
      <div className="field">
        <label htmlFor="name">Name</label>
        <input id="name" name="name" required autoComplete="name" />
      </div>
      <div className="field">
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" required autoComplete="email" />
      </div>
      <div className="field">
        <label htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="new-password"
          minLength={8}
        />
      </div>
      {error ? (
        <p style={{ color: "var(--danger)", margin: 0 }}>{error}</p>
      ) : null}
      <button className="btn" type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create account"}
      </button>
    </form>
  );
}
