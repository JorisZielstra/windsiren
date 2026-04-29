"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(error.message);
        return;
      }
      router.push("/profile");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-sm px-6 py-16">
      <Link href="/" className="text-sm text-ink-mute hover:text-ink">
        ← Home
      </Link>
      <h1 className="headline mt-4 text-4xl text-ink">Sign in</h1>
      <p className="mt-2 text-sm text-ink-mute">
        Welcome back. Wind's up — let's check the conditions.
      </p>
      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <label className="block">
          <span className="text-sm font-semibold text-ink-2">Email</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1.5 block w-full rounded-lg border border-border bg-paper-2 px-3 py-2 text-ink outline-none transition-colors focus:border-brand"
          />
        </label>
        <label className="block">
          <span className="text-sm font-semibold text-ink-2">Password</span>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1.5 block w-full rounded-lg border border-border bg-paper-2 px-3 py-2 text-ink outline-none transition-colors focus:border-brand"
          />
        </label>
        {error ? (
          <p className="rounded-lg border border-hazard/30 bg-hazard-soft px-3 py-2 text-sm text-hazard">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-brand px-4 py-2.5 font-semibold text-white transition-colors hover:bg-brand-strong disabled:opacity-50"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <p className="mt-6 text-sm text-ink-mute">
        No account yet?{" "}
        <Link href="/auth/sign-up" className="font-semibold text-brand-link hover:underline">
          Create one
        </Link>
      </p>
    </main>
  );
}
