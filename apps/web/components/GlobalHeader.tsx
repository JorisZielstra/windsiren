import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase-server";

// Sticky brand + nav at the top of every page.
export async function GlobalHeader() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <header className="border-b border-zinc-200 bg-white/95 backdrop-blur dark:border-zinc-900 dark:bg-zinc-950/95">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <Link
          href="/"
          className="text-base font-bold tracking-tight text-zinc-950 dark:text-zinc-50"
        >
          windsiren
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <NavLink href="/" label="Today" />
          <NavLink href="/spots" label="Spots" />
          <NavLink href="/map" label="Map" />
          {user ? <NavLink href="/feed" label="Feed" /> : null}
          {user ? (
            <NavLink href="/profile" label="Profile" />
          ) : (
            <Link
              href="/auth/sign-in"
              className="ml-2 rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
            >
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}

function NavLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="rounded-md px-3 py-1.5 text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-50"
    >
      {label}
    </Link>
  );
}
