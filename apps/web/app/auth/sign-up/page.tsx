"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

export default function SignUpPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) {
        setError(error.message);
        return;
      }
      // If "Confirm email" is enabled in Supabase dashboard, no session until
      // the user clicks the link we just emailed. Otherwise data.session is set
      // and we can log them in immediately.
      if (data.session) {
        router.push("/profile");
        router.refresh();
      } else {
        setNeedsConfirmation(true);
      }
    } finally {
      setBusy(false);
    }
  }

  if (needsConfirmation) {
    return (
      <main className="mx-auto max-w-sm px-4 py-10 sm:px-6 sm:py-16">
        <h1 className="headline text-3xl text-ink">Check your email</h1>
        <p className="mt-3 text-ink-2">
          We sent a confirmation link to{" "}
          <strong className="text-ink">{email}</strong>. Click it to finish
          setting up your account, then sign in.
        </p>
        <Link
          href="/auth/sign-in"
          className="mt-6 inline-block text-sm font-semibold text-brand-link hover:underline"
        >
          Back to sign in
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-sm px-4 py-10 sm:px-6 sm:py-16">
      <Link href="/" className="text-sm text-ink-mute hover:text-ink">
        ← Home
      </Link>
      <h1 className="headline mt-4 text-4xl text-ink">Create account</h1>
      <p className="mt-2 text-sm text-ink-mute">
        One-minute setup. We'll never email you about anything but the wind.
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
            minLength={6}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1.5 block w-full rounded-lg border border-border bg-paper-2 px-3 py-2 text-ink outline-none transition-colors focus:border-brand"
          />
          <span className="mt-1 block text-xs text-ink-mute">At least 6 characters.</span>
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
          {busy ? "Creating…" : "Create account"}
        </button>
      </form>
      <p className="mt-6 text-sm text-ink-mute">
        Already have an account?{" "}
        <Link
          href="/auth/sign-in"
          className="font-semibold text-brand-link hover:underline"
        >
          Sign in
        </Link>
      </p>
    </main>
  );
}
