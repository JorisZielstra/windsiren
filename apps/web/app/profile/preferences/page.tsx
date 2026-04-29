import Link from "next/link";
import { redirect } from "next/navigation";
import { getUserPrefs } from "@windsiren/core";
import { ThemeToggle } from "@/components/ThemeToggle";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { PreferencesForm } from "./PreferencesForm";

export const dynamic = "force-dynamic";

export default async function PreferencesPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/auth/sign-in");
  }
  const prefs = await getUserPrefs(supabase, user.id);

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
      <Link
        href="/profile"
        className="text-sm text-ink-mute hover:text-ink"
      >
        ← Back to profile
      </Link>

      <header className="mt-4 mb-8">
        <h1 className="headline text-4xl text-ink">Preferences</h1>
        <p className="mt-2 text-sm text-ink-mute">
          Tune what counts as a GO day for you, and pick how the app looks.
        </p>
      </header>

      <section className="mb-10">
        <h2 className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-ink-mute">
          Kite conditions
        </h2>
        <p className="mt-1 mb-5 text-sm text-ink-2">
          Every spot's verdict, score, and forecast tile reads from these
          numbers.
        </p>
        <PreferencesForm initial={prefs} />
      </section>

      <section className="border-t border-border pt-8">
        <h2 className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-ink-mute">
          Display
        </h2>
        <div className="mt-4">
          <ThemeToggle />
        </div>
      </section>
    </main>
  );
}
